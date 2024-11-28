const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Enable Puppeteer stealth mode to bypass detection
puppeteer.use(StealthPlugin());

// Configuration file setup
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) throw new Error('Configuration file missing.');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Logging setup
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

// Performance monitoring setup
let lastEventLoopDelay = 0;
const observeEventLoopDelay = async () => {
    const start = performance.now();
    await new Promise((resolve) => setImmediate(resolve));
    const delay = performance.now() - start;
    lastEventLoopDelay = delay;
};

const logSystemPerformance = () => {
    const memoryUsage = process.memoryUsage();
    log(
        `Memory Usage - RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB, Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(
            2
        )} MB, Event Loop Delay: ${lastEventLoopDelay.toFixed(2)} ms`
    );
};

setInterval(() => {
    observeEventLoopDelay();
    logSystemPerformance();
}, config.performanceLogInterval || 10000);

let browser;
let winCount = 0;
let betInProgress = false;

// Strategy calculation logic
const calculateBetAmount = (currentBalance) => {
    const strategy = Math.random() < config.strategyWeights.exponential ? 'exponential' : 'fibonacci';

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

// Improved iframe handler
const getIframe = async (page) => {
    let retries = 30;
    while (retries > 0) {
        const frame = await page.$('iframe.grid-100');
        if (frame) {
            const frameContent = await frame.contentFrame();
            if (frameContent) {
                log('Iframe found and content accessed.');

                // Ensure iframe is fully loaded
                await frameContent.waitForSelector('button.btn.btn-success.bet.ng-star-inserted', { timeout: 15000 });
                return frameContent;
            }
        }
        log('Iframe not found, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        retries--;
    }
    throw new Error('Iframe not found after multiple attempts.');
};

// Safe element interaction
const safeClick = async (frame, selector) => {
    try {
        const element = await frame.$(selector);
        if (!element) throw new Error(`Element "${selector}" not found.`);
        await frame.evaluate((el) => el.click(), element);
        log(`Clicked on: ${selector}`);
    } catch (error) {
        log(`Error clicking element: ${error.message}`);
        throw error;
    }
};

// Main script logic
(async () => {
    try {
        const browserWSEndpoint = fs.readFileSync('wsEndpoint.txt', 'utf-8');
        browser = await puppeteer.connect({ browserWSEndpoint });
        const page = (await browser.pages())[0];
        page.setDefaultNavigationTimeout(60000);

        log('Attached to existing browser session.');

        // Wait for iframe and switch to it
        const iframe = await getIframe(page);
        log('Successfully switched to the Aviator game iframe.');

        const placeBet = async () => {
            if (betInProgress) return;
            betInProgress = true;

            try {
                const balanceText = await iframe.evaluate((selector) => {
                    const el = document.querySelector(selector);
                    return el ? el.innerText.trim() : null;
                }, 'span.amount.font-weight-bold');

                const balance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));
                log(`Current balance: ${balance}`);

                if (balance < config.minBetAmount) throw new Error('Insufficient balance.');

                const betAmount = calculateBetAmount(balance);

                // Input bet amount
                await iframe.evaluate(
                    (selector, value) => {
                        const input = document.querySelector(selector);
                        if (input) {
                            input.value = value;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    },
                    'input.font-weight-bold',
                    betAmount.toString()
                );
                log(`Entered bet amount: ${betAmount}`);

                // Click bet button
                await safeClick(iframe, 'button.btn.btn-success.bet.ng-star-inserted');

                // Wait before cashing out
                const delay = Math.random() * (5000 - 2000) + 2000;
                log(`Waiting ${delay.toFixed(0)} ms before cashing out...`);
                await new Promise((resolve) => setTimeout(resolve, delay));

                // Click cashout button
                await safeClick(iframe, 'button.btn.btn-warning.cashout.ng-star-inserted');

                log('Cashed out successfully.');
                winCount++;

                if (winCount >= config.allInAfterWins) {
                    await sendEmailNotification('All-In Triggered', `You have ${winCount} consecutive wins.`);
                    winCount = 0;
                }
            } catch (error) {
                log(`Betting error: ${error.message}`);
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
                log(`Interval error: ${error.message}`);
            }
        }, config.betInterval);

    } catch (error) {
        log(`Script error: ${error.message}`);
        if (browser) await shutdown(browser);
    }
})();
