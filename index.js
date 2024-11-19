const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer'); 
const debug = require('debug')('app');

// Enable Puppeteer stealth mode
puppeteer.use(StealthPlugin());

// Load configuration from a JSON file
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

// Log function to write to file and console
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(config.logFile, logMessage + '\n');
};

// Send email notifications
const sendNotification = async (subject, message) => {
    try {
        const transporter = nodemailer.createTransport(config.email);
        await transporter.sendMail({
            from: config.email.from,
            to: config.email.to,
            subject: subject,
            text: message,
        });
    } catch (error) {
        log(`[ERROR] Failed to send email: ${error.message}`);
    }
};

// Graceful shutdown
const shutdown = (browser) => {
    log('Shutting down...');
    browser.close();
    process.exit(0);
};

// Capture Ctrl+C for graceful shutdown
process.on('SIGINT', () => {
    shutdown(browser);
});

(async () => {
    let browser;
    let previousBubbleValue = null;
    let betAmount = config.minBetAmount;
    let consecutiveWins = 0;
    let fibonacciIndex = 2;
    let betInProgress = false; // Lock to prevent simultaneous bets

    try {
        // Connect to the existing browser instance
        const browserURL = 'http://127.0.0.1:9222'; 
        browser = await puppeteer.connect({ browserURL });
        const pages = await browser.pages();
        const page = pages[0];

        log(`Connected to an existing page with URL: ${await page.url()}`);

        // Function to monitor and place bets
        const monitorAndPlaceBet = async () => {
            if (betInProgress) return; // Skip if a bet is already in progress
            betInProgress = true;

            try {
                // Wait for the bubble multiplier selector
                await page.waitForSelector(config.bubbleSelector, { visible: true, timeout: 10000 });

                const appBubbleValue = await page.$eval(
                    config.bubbleSelector,
                    element => parseFloat(element.textContent.trim().slice(0, -1))
                );
                debug('Latest Bubble Multiplier:', appBubbleValue);

                const myBalance = await page.$eval(
                    config.balanceSelector,
                    element => parseFloat(element.textContent.trim())
                );
                log(`Current Balance: ${myBalance}`);

                // Strategy Evaluation and Bet Placement
                if (appBubbleValue < config.bubbleMultiplierThreshold && (previousBubbleValue === null || appBubbleValue !== previousBubbleValue)) {
                    log('Betting condition met. Attempting to place a bet...');

                    // Apply strategies
                    if (consecutiveWins >= config.allInAfterWins) {
                        betAmount = myBalance * 0.3; // Limit all-in strategy to 30% of balance
                        log(`Going All-In with ${betAmount} after ${consecutiveWins} wins`);
                    } else if (appBubbleValue < 1.5) {
                        betAmount = Math.min(Math.max(betAmount * config.growthFactor, config.minBetAmount), Math.floor(myBalance * config.betPercentage));
                        log(`Betting with exponential growth: ${betAmount}`);
                    } else if (appBubbleValue < 2.0) {
                        betAmount = config.fibonacciSequence[fibonacciIndex];
                        config.fibonacciSequence.push(config.fibonacciSequence[fibonacciIndex] + config.fibonacciSequence[fibonacciIndex - 1]);
                        fibonacciIndex++;
                        log(`Fibonacci Bet: ${betAmount}`);
                    } else {
                        betAmount = Math.min(Math.max(betAmount, config.minBetAmount), Math.floor(myBalance * config.betPercentage));
                        log(`Default bet: ${betAmount}`);
                    }

                    // Ensure bet amount does not exceed maximum
                    betAmount = Math.min(betAmount, config.maxBetAmount);

                    await page.waitForSelector(config.betButtonSelector, { visible: true });

                    const betButton = await page.$(config.betButtonSelector);
                    if (betButton) {
                        const isDisabled = await betButton.evaluate((btn) => btn.disabled);
                        if (!isDisabled) {
                            await betButton.click();
                            consecutiveWins++;
                            log(`Bet of ${betAmount} placed successfully!`);
                        } else {
                            log('Bet button is disabled.');
                        }
                    } else {
                        log('Bet button not found or unavailable.');
                    }
                } else {
                    log('Betting condition not met. Waiting for the next round...');
                }

                // Check for the cashout condition
                const cashoutButton = await page.$(config.cashoutButtonSelector);
                if (cashoutButton) {
                    const cashoutMultiplier = await cashoutButton.evaluate((btn) => {
                        const textContent = btn.textContent.trim();
                        return parseFloat(textContent);
                    });
                    debug('Current Cashout Multiplier:', cashoutMultiplier);

                    if (cashoutMultiplier >= config.bubbleMultiplierThreshold) {
                        await cashoutButton.click();
                        log(`Cashout triggered at multiplier: ${cashoutMultiplier}`);
                    }
                }

                // Update the previous bubble value
                previousBubbleValue = appBubbleValue;

                // Random delay for rate limiting
                const randomDelay = Math.floor(Math.random() * 2000) + 2000; // Random delay between 2s to 4s
                await new Promise(resolve => setTimeout(resolve, randomDelay));

            } catch (error) {
                log(`[ERROR] Monitoring error: ${error.message}`);
                await sendNotification('Monitoring Error', `An error occurred: ${error.message}`);
            } finally {
                betInProgress = false; // Reset lock after the bet is completed or skipped
            }
        };

        // Function to place simultaneous bets with different strategies
        const placeSimultaneousBets = async () => {
            if (betInProgress) return; // Skip if a bet is already in progress
            betInProgress = true;

            try {
                const appBubbleValue = await page.$eval(config.bubbleSelector, (el) => parseFloat(el.textContent.trim()));
                const myBalance = await page.$eval(config.balanceSelector, (el) => parseFloat(el.textContent.trim()));

                // Use trend analysis for the first bet
                const bettingTrend = analyzeTrends(historicalMultipliers);
                let betAmount1 = adjustBetAmount(appBubbleValue, myBalance);

                if (bettingTrend === 'low' && appBubbleValue < 1.5) {
                    betAmount1 = Math.min(betAmount1, config.maxBetAmount);
                    await placeBet(betAmount1, 1);  // Bet 1
                }

                // Use a different strategy for the second bet
                let betAmount2 = Math.min(myBalance * 0.2, config.maxBetAmount); // Example: Fibonacci or growth strategy
                await placeBet(betAmount2, 2);  // Bet 2
            } catch (error) {
                log(`[ERROR] Simultaneous bet error: ${error.message}`);
                await sendNotification('Simultaneous Bet Error', `An error occurred during bet placement: ${error.message}`);
            } finally {
                betInProgress = false; // Reset lock after the bet is completed or skipped
            }
        };

        // Function to place a bet on a specific bet control
        const placeBet = async (betAmount, betNumber) => {
            const betButtonSelector = betNumber === 1 ? config.betButtonSelector1 : config.betButtonSelector2;
            const betInputSelector = betNumber === 1 ? config.betInputSelector1 : config.betInputSelector2;

            await page.waitForSelector(betInputSelector);
            const betInput = await page.$(betInputSelector);
            await betInput.type(betAmount.toFixed(2), { delay: 100 });

            await page.waitForSelector(betButtonSelector);
            const betButton = await page.$(betButtonSelector);
            const isDisabled = await betButton.evaluate((btn) => btn.disabled);
            if (!isDisabled) {
                await betButton.click();
                log(`Bet placed with ${betAmount} on Bet ${betNumber}`);
            } else {
                log(`Bet ${betNumber} button is disabled.`);
            }
        };

        setInterval(monitorAndPlaceBet, config.betInterval);
        setInterval(placeSimultaneousBets, config.betInterval);

    } catch (error) {
        log(`[ERROR] Failed to start monitoring: ${error.message}`);
        await sendNotification('Startup Error', `Failed to start monitoring: ${error.message}`);
        if (browser) {
            shutdown(browser);
        }
    }
})();
