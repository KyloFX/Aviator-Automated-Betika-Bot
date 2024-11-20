const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
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

// Graceful shutdown
const shutdown = async (browser) => {
    log('Shutting down...');
    await browser.close();
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

        // Function to make an element focusable and click it
        const safeClick = async (selector) => {
            const element = await page.$(selector);
            if (element) {
                await page.evaluate((el) => {
                    if (!el.hasAttribute('tabindex')) {
                        el.tabIndex = 0; // Make focusable if not already
                    }
                    el.focus();
                }, element);
                await element.click();
                log(`Clicked element with selector: ${selector}`);
            } else {
                log(`Element with selector ${selector} not found.`);
            }
        };

        // Function to safely type into an input field
        const safeType = async (selector, text) => {
            const element = await page.$(selector);
            if (element) {
                await page.evaluate((el) => (el.value = ''), element); // Clear the input
                await page.type(selector, text); // Type the new value
                log(`Typed '${text}' into element with selector: ${selector}`);
            } else {
                log(`Element with selector ${selector} not found.`);
            }
        };

        // Function to monitor and place bets
        const monitorAndPlaceBet = async () => {
            if (betInProgress) return;
            betInProgress = true;

            try {
                // Wait for the bubble multiplier selector
                await page.waitForSelector(config.bubbleSelector, { visible: true, timeout: 15000 });

                const appBubbleValue = await page.$eval(
                    config.bubbleSelector,
                    (element) => parseFloat(element.textContent.trim().slice(0, -1))
                );
                debug('Latest Bubble Multiplier:', appBubbleValue);

                const myBalance = await page.$eval(
                    config.balanceSelector,
                    (element) => parseFloat(element.textContent.trim())
                );
                log(`Current Balance: ${myBalance}`);

                // Strategy Evaluation and Bet Placement
                if (appBubbleValue < config.bubbleMultiplierThreshold && (previousBubbleValue === null || appBubbleValue !== previousBubbleValue)) {
                    log('Betting condition met. Attempting to place a bet...');

                    // Strategy logic
                    if (consecutiveWins >= config.allInAfterWins) {
                        betAmount = myBalance * 0.3;
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

                    betAmount = Math.min(betAmount, config.maxBetAmount);

                    // Place bet
                    await safeType(config.betInputSelector, betAmount.toFixed(2));
                    await safeClick(config.betButtonSelector);
                    consecutiveWins++;
                    log(`Bet of ${betAmount} placed successfully!`);
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
                        await safeClick(config.cashoutButtonSelector);
                        log(`Cashout triggered at multiplier: ${cashoutMultiplier}`);
                    }
                }

                previousBubbleValue = appBubbleValue;

                const randomDelay = Math.floor(Math.random() * 2000) + 2000;
                await new Promise((resolve) => setTimeout(resolve, randomDelay));
            } catch (error) {
                log(`[ERROR] Monitoring error: ${error.message}`);
            } finally {
                betInProgress = false;
            }
        };

        setInterval(monitorAndPlaceBet, config.betInterval);
    } catch (error) {
        log(`[ERROR] Startup error: ${error.message}`);
        if (browser) {
            await shutdown(browser);
        }
    }
})();
