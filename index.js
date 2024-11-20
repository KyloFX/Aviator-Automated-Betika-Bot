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

let browser; // Define browser outside the try block

// Capture Ctrl+C for graceful shutdown
process.on('SIGINT', async () => {
    await shutdown(browser);
});

(async () => {
    let betInProgress = false; // Lock to prevent simultaneous bets

    try {
        // Connect to the existing browser instance
        const browserURL = 'http://127.0.0.1:9222';
        browser = await puppeteer.connect({ browserURL });
        const pages = await browser.pages();
        const page = pages[0];

        log(`Connected to an existing page with URL: ${await page.url()}`);

        // Function to interact with elements, even if they are not keyboard-focusable
        const safeClick = async (selector) => {
            const element = await page.$(selector);
            if (element) {
                const isVisible = await page.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0, element);
                if (isVisible) {
                    await page.evaluate((el) => el.click(), element);
                    log(`Clicked element with selector: ${selector}`);
                } else {
                    log(`Element with selector ${selector} is not visible.`);
                }
            } else {
                log(`Element with selector ${selector} not found.`);
            }
        };

        const safeType = async (selector, text) => {
            const element = await page.$(selector);
            if (element) {
                await element.focus(); // Focus the element first
                await page.evaluate(el => el.value = '', element); // Clear the input
                await page.type(selector, text); // Type the text
                log(`Typed '${text}' into element with selector: ${selector}`);
            } else {
                log(`Element with selector ${selector} not found.`);
            }
        };

        // Function to check visibility of an element in different contexts (iframe, Shadow DOM)
        const getElementContent = async (selector) => {
            // Check in the main document
            let element = await page.$(selector);
            if (element) {
                const isVisible = await page.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0, element);
                if (isVisible) {
                    return await page.evaluate(el => el.textContent.trim(), element);
                }
            }

            // Check in iframe
            const frames = page.frames();
            for (const frame of frames) {
                element = await frame.$(selector);
                if (element) {
                    const isVisible = await frame.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0, element);
                    if (isVisible) {
                        return await frame.evaluate(el => el.textContent.trim(), element);
                    }
                }
            }

            // Check in shadow DOM
            const shadowHosts = await page.$$('shadow-host-selector'); // Adjust the selector if necessary
            for (const shadowHost of shadowHosts) {
                const shadowRoot = await shadowHost.evaluateHandle(el => el.shadowRoot);
                element = await shadowRoot.$(selector);
                if (element) {
                    const isVisible = await shadowRoot.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0, element);
                    if (isVisible) {
                        return await shadowRoot.evaluate(el => el.textContent.trim(), element);
                    }
                }
            }

            throw new Error(`Element with selector ${selector} not found in the main document, iframe, or shadow DOM.`);
        };

        // Function to place random bets
        const placeRandomBet = async () => {
            if (betInProgress) return;
            betInProgress = true;

            try {
                // Wait for the balance element to appear
                await page.waitForSelector(config.balanceSelector, { visible: true, timeout: 15000 });

                // Read balance using dynamic methods
                const balanceText = await getElementContent(config.balanceSelector);
                const myBalance = parseFloat(balanceText);
                log(`Current Balance: ${myBalance}`);

                // Random bet amount between min and max bet
                const betAmount = (Math.random() * (config.maxBetAmount - config.minBetAmount) + config.minBetAmount).toFixed(2);
                log(`Placing a random bet of: ${betAmount}`);

                // Check if bet input field is available
                const betInputElement = await page.$(config.betInputSelector);
                if (betInputElement) {
                    await safeType(config.betInputSelector, betAmount);
                } else {
                    throw new Error(`Failed to find bet input field with selector ${config.betInputSelector}`);
                }

                // Check if bet button is clickable
                const betButton = await page.$(config.betButtonSelector);
                if (betButton) {
                    await safeClick(config.betButtonSelector);
                    log(`Bet of ${betAmount} placed successfully!`);
                } else {
                    throw new Error(`Failed to find bet button with selector ${config.betButtonSelector}`);
                }

                // Random delay before stopping the bet
                const stopDelay = Math.floor(Math.random() * (5000 - 2000)) + 2000; // Between 2s to 5s
                log(`Will stop the bet after ${stopDelay} ms`);

                setTimeout(async () => {
                    const cashoutButton = await page.$(config.cashoutButtonSelector);
                    if (cashoutButton) {
                        await safeClick(config.cashoutButtonSelector);
                        log(`Stopped the bet at random timing.`);
                    } else {
                        log(`Failed to find cashout button with selector ${config.cashoutButtonSelector}`);
                    }
                }, stopDelay);

            } catch (error) {
                log(`[ERROR] Random betting error: ${error.message}`);
            } finally {
                betInProgress = false;
            }
        };

        // Start placing random bets at intervals
        setInterval(async () => {
            try {
                await placeRandomBet();
            } catch (error) {
                log(`[ERROR] Error in interval: ${error.message}`);
            }
        }, config.betInterval);

    } catch (error) {
        log(`[ERROR] Startup error: ${error.message}`);
        if (browser) {
            await shutdown(browser);
        }
    }
})();
