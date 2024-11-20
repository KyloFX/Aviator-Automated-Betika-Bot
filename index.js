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
//const sendNotification = async (subject, message) => {
//    try {
//        const transporter = nodemailer.createTransport(config.email);
//        await transporter.sendMail({
//            from: config.email.from,
//            to: config.email.to,
//            subject: subject,
//            text: message,
//        });
//    } catch (error) {
//        log(`[ERROR] Failed to send email: ${error.message}`);
//    }
//};

// Retry helper
const retryAction = async (action, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await action();
        } catch (error) {
            log(`Retry ${attempt + 1} failed: ${error.message}`);
            if (attempt === retries - 1) throw error;
        }
    }
};

// Random delay
const randomDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

// Reconnect to the browser page if not found or disconnected
const reconnectToBrowser = async (browser) => {
    try {
        const pages = await browser.pages();
        const gamePage = pages.find(p => p.url().includes('aviator'));
        if (gamePage) {
            return gamePage;
        }
        throw new Error('Game page not found.');
    } catch (error) {
        log(`[ERROR] Reconnection failed: ${error.message}`);
        return null;
    }
};

(async () => {
    let browser;
    let page;
    let previousBubbleValue = null;
    let betAmount = config.minBetAmount;
    let consecutiveWins = 0;
    let fibonacciIndex = 2;
    let betInProgress = false;

    try {
        // Connect to the existing browser instance
        const browserURL = 'http://127.0.0.1:9222';
        browser = await puppeteer.connect({ browserURL });
        page = await reconnectToBrowser(browser); // Reconnect to the game page if it's lost

        if (!page) {
            log('[ERROR] Game page could not be found.');
            return shutdown(browser);
        }

        log(`Connected to an existing page with URL: ${await page.url()}`);

        // Ensure the browser window is in focus
        await page.bringToFront(); // Bring the page to the front

        // Monitor and place bets
        const monitorAndPlaceBet = async () => {
            if (betInProgress) return;
            betInProgress = true;

            try {
                // Wait for the bubble multiplier selector
                await page.waitForSelector(config.bubbleSelector, { visible: true, timeout: 20000 }); // Increased timeout
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

                if (appBubbleValue < config.bubbleMultiplierThreshold &&
                    (previousBubbleValue === null || appBubbleValue !== previousBubbleValue)) {
                    
                    log('Betting condition met. Attempting to place a bet...');

                    // Adjust bet amount based on strategies
                    if (consecutiveWins >= config.allInAfterWins) {
                        betAmount = myBalance * 0.3; // All-in capped at 30%
                    } else if (appBubbleValue < 1.5) {
                        betAmount = Math.min(Math.max(betAmount * config.growthFactor, config.minBetAmount), Math.floor(myBalance * config.betPercentage));
                    } else if (appBubbleValue < 2.0) {
                        betAmount = config.fibonacciSequence[fibonacciIndex];
                        config.fibonacciSequence.push(config.fibonacciSequence[fibonacciIndex] + config.fibonacciSequence[fibonacciIndex - 1]);
                        fibonacciIndex++;
                    } else {
                        betAmount = Math.min(Math.max(betAmount, config.minBetAmount), Math.floor(myBalance * config.betPercentage));
                    }

                    betAmount = Math.min(betAmount, config.maxBetAmount); // Cap bet amount

                    // Place the bet
                    await retryAction(async () => {
                        await page.waitForSelector(config.betButtonSelector, { visible: true });
                        const betButton = await page.$(config.betButtonSelector);
                        const isDisabled = await betButton.evaluate(btn => btn.disabled);
                        if (!isDisabled) {
                            await betButton.click();
                            consecutiveWins++;
                            log(`Bet of ${betAmount} placed successfully!`);
                        } else {
                            throw new Error('Bet button is disabled.');
                        }
                    });

                } else {
                    log('Betting condition not met. Waiting for the next round...');
                }

                // Check for cashout
                const cashoutButton = await page.$(config.cashoutButtonSelector);
                if (cashoutButton) {
                    const cashoutMultiplier = await cashoutButton.evaluate(btn => parseFloat(btn.textContent.trim()));
                    if (cashoutMultiplier >= config.cashoutMultiplierThreshold) {
                        await cashoutButton.click();
                        log(`Cashout triggered at multiplier: ${cashoutMultiplier}`);
                    }
                }

                previousBubbleValue = appBubbleValue;
                await randomDelay();

            } catch (error) {
                log(`[ERROR] Monitoring error: ${error.message}`);
                await sendNotification('Monitoring Error', `An error occurred: ${error.message}`);
            } finally {
                betInProgress = false;
            }
        };

        // Main betting loop
        const bettingLoop = async () => {
            while (true) {
                await monitorAndPlaceBet();
                await randomDelay(); // Wait before the next check
            }
        };

        await bettingLoop();

    } catch (error) {
        log(`[ERROR] Startup error: ${error.message}`);
        await sendNotification('Startup Error', `Failed to start monitoring: ${error.message}`);
        if (browser) shutdown(browser);
    }
})();
