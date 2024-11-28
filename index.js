const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const util = require('util');

console.log('Script started.');

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
    await new Promise(resolve => setImmediate(resolve));
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

let browser;
let winCount = 0;
let betInProgress = false;

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

// Improved betting logic with bypass mechanisms
const placeBet = async (page) => {
    if (betInProgress) return;
    betInProgress = true;

    try {
        // Wait for the balance element to be present on the page
        await page.waitForSelector('span.amount.font-weight-bold', { timeout: 10000 });
        
        const balanceText = await page.evaluate(selector => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
        }, 'span.amount.font-weight-bold');

        if (!balanceText) {
            throw new Error('Balance not found on the page.');
        }

        const balance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));
        log(`Current balance: ${balance}`);

        if (balance < config.minBetAmount) {
            log('Insufficient balance to place a bet. Skipping bet execution.');
            return; // Bypass and proceed
        } else {
            const betAmount = calculateBetAmount(balance);

            // Enter bet amount
            await page.evaluate((selector, value) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 'input.font-weight-bold', betAmount.toString());
            log(`Entered bet amount: ${betAmount}`);

            // Click bet button
            await safeClick(page, 'button.btn.btn-success.bet.ng-star-inserted');
            log('Bet placed successfully.');

            // Wait for a random period before cashing out
            const delay = Math.random() * (5000 - 2000) + 2000;
            log(`Waiting ${delay} ms before cashing out...`);
            await new Promise(res => setTimeout(res, delay));

            // Click cashout button
            await safeClick(page, 'button.btn.btn-warning.cashout.ng-star-inserted');
            log('Cashed out successfully.');

            winCount++;
            if (winCount >= config.allInAfterWins) {
                await sendEmailNotification('All-In Strategy Triggered', `You have ${winCount} consecutive wins.`);
                winCount = 0;
            }
        }
    } catch (error) {
        log(`Error during betting: ${error.message}`);
        winCount = 0; // Reset win count on error
    } finally {
        betInProgress = false;
    }
};

// Safely click an element within the page
const safeClick = async (page, selector) => {
    try {
        const element = await page.$(selector);
        if (!element) throw new Error(`Element with selector "${selector}" not found.`);
        await element.click();
        log(`Clicked element with selector: ${selector}`);
    } catch (error) {
        log(`Error clicking element: ${error.message}`);
        // Continue execution even if the click fails
    }
};

(async () => {
    try {
        const browserWSEndpoint = fs.readFileSync('wsEndpoint.txt', 'utf-8');
        browser = await puppeteer.connect({ browserWSEndpoint });

        const page = (await browser.pages())[0];
        page.setDefaultNavigationTimeout(60000);
        log('Attached to existing browser session.');

        // No need to look for iframe, we assume we're working directly in the correct page context

        // Periodically place bets
        setInterval(async () => {
            try {
                await placeBet(page);
            } catch (error) {
                log(`Error in betting interval: ${error.message}`);
            }
        }, config.betInterval);

    } catch (error) {
        log(`Script error: ${error.message}`);
        if (browser) await shutdown(browser);
    }
})();
