const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks'); // For performance monitoring
const util = require('util');

// Enable Puppeteer stealth mode to bypass detection
puppeteer.use(StealthPlugin());

// Load configuration from a JSON file
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) throw new Error('Configuration file missing.');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Utility function to log messages to console and file
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(config.logFile, logMessage + '\n');
};

// Email notification setup
const sendEmailNotification = async (subject, text) => {
    const transporter = nodemailer.createTransport(config.email);
    const mailOptions = {
        from: config.email.from,
        to: config.email.to,
        subject,
        text,
    };

    try {
        await transporter.sendMail(mailOptions);
        log(`Email sent: ${subject}`);
    } catch (error) {
        log(`Failed to send email: ${error.message}`);
    }
};

// Graceful shutdown function
const shutdown = async (browser) => {
    log('Shutting down...');
    if (browser) await browser.close();
    process.exit(0);
};

// **Performance Monitoring Setup**
let lastEventLoopDelay = 0;
const observeEventLoopDelay = async () => {
    const start = performance.now();
    await new Promise(resolve => setImmediate(resolve)); // Measure delay over the event loop
    const delay = performance.now() - start;
    lastEventLoopDelay = delay;
};

// Log system performance periodically
const logSystemPerformance = async () => {
    const memoryUsage = process.memoryUsage();
    log(`Memory Usage - RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB, Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB, Event Loop Delay: ${lastEventLoopDelay.toFixed(2)} ms`);
};

// Set interval for periodic performance logging
setInterval(() => {
    observeEventLoopDelay();
    logSystemPerformance();
}, config.performanceLogInterval || 10000); // Default to 10 seconds if not set

let browser; // Global reference for proper shutdown handling
let winCount = 0; // Track consecutive wins
let betInProgress = false; // Prevent simultaneous bets

// Capture Ctrl+C for graceful shutdown
process.on('SIGINT', async () => {
    await shutdown(browser);
});

// Betting strategy calculation
const calculateBetAmount = (currentBalance) => {
    const strategy = Math.random() < config.strategyWeights.exponential
        ? 'exponential'
        : 'fibonacci';

    if (strategy === 'exponential') {
        const bet = (currentBalance * config.betPercentage * config.growthFactor).toFixed(2);
        log(`Exponential strategy chosen. Bet amount: ${bet}`);
        return bet;
    } else {
        const fibIndex = winCount % config.fibonacciSequence.length;
        const bet = (currentBalance * config.fibonacciSequence[fibIndex]).toFixed(2);
        log(`Fibonacci strategy chosen. Bet amount: ${bet}`);
        return bet;
    }
};

(async () => {
    try {
        // Connect to existing browser instance
        const browserWSEndpoint = fs.readFileSync('wsEndpoint.txt', 'utf-8');
        browser = await puppeteer.connect({ browserWSEndpoint });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(60000);

        // Load cookies before navigating
        const cookiesPath = path.join(__dirname, 'cookies.json');
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath));
            await page.setCookie(...cookies);
            log('Cookies loaded successfully.');
        } else {
            throw new Error('Cookies file not found. Ensure `mozzart.js` runs first.');
        }

        log('Navigating to the Aviator game...');
        await page.goto('https://betting.co.zw/virtual/fast-games/aviator');

        // Utility functions for iframe handling (including GrooveGaming iframe handling)
        const getIframe = async () => {
            let retries = 10;
            while (retries > 0) {
                const frame = page.frames().find(frame => frame.url().includes('spribe.co') || frame.url().includes('groovegaming.com'));
                if (frame) return frame;
                await new Promise(res => setTimeout(res, 1000));
                retries--;
            }
            throw new Error('Iframe not found after multiple attempts.');
        };

        const getTextContent = async (frame, selector) => {
            try {
                const content = await frame.evaluate(selector => {
                    const el = document.querySelector(selector);
                    return el ? el.innerText.trim() : null;
                }, selector);
                if (!content) throw new Error(`No text found for selector: ${selector}`);
                return content;
            } catch (error) {
                log(`Error retrieving text content: ${error.message}`);
                throw error;
            }
        };

        const safeClick = async (frame, selector) => {
            try {
                const element = await frame.$(selector);
                if (!element) throw new Error(`Element with selector "${selector}" not found.`);
                await frame.evaluate(el => el.click(), element);
                log(`Clicked element with selector: ${selector}`);
            } catch (error) {
                log(`Error clicking element: ${error.message}`);
                throw error;
            }
        };

        // Main betting logic
        const placeBet = async () => {
            if (betInProgress) return;
            betInProgress = true;

            try {
                const iframe = await getIframe();
                const balanceText = await getTextContent(iframe, config.balanceSelector);
                const balance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));
                log(`Current balance: ${balance}`);

                if (balance < config.minBetAmount) {
                    throw new Error('Insufficient balance to place a bet.');
                }

                const betAmount = calculateBetAmount(balance);

                // Enter bet amount
                await iframe.evaluate((selector, value) => {
                    const input = document.querySelector(selector);
                    if (input) {
                        input.value = value;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, config.betInputSelector, betAmount.toString());
                log(`Entered bet amount: ${betAmount}`);

                // Click bet button
                await safeClick(iframe, config.betButtonSelector);
                log('Bet placed successfully.');

                // Wait for a random period before cashing out
                const delay = Math.random() * (5000 - 2000) + 2000;
                log(`Waiting ${delay} ms before cashing out...`);
                await new Promise(res => setTimeout(res, delay));

                // Click cashout button
                await safeClick(iframe, config.cashoutButtonSelector);
                log('Cashed out successfully.');

                winCount++;
                if (winCount >= config.allInAfterWins) {
                    await sendEmailNotification('All-In Strategy Triggered', `You have ${winCount} consecutive wins.`);
                    winCount = 0;
                }
            } catch (error) {
                log(`Error during betting: ${error.message}`);
                winCount = 0;
            } finally {
                betInProgress = false;
            }
        };

        // Periodically place bets
        setInterval(async () => {
            try {
                await placeBet();
            } catch (error) {
                log(`Error in betting interval: ${error.message}`);
            }
        }, config.betInterval);

    } catch (error) {
        log(`Script error: ${error.message}`);
        if (browser) await shutdown(browser);
    }
})();
