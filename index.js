const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Enable Puppeteer stealth mode to bypass detection
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

let browser; // Define browser globally for proper shutdown handling
let winCount = 0; // Track consecutive wins
let betInProgress = false; // Prevent simultaneous bets

// Capture Ctrl+C for graceful shutdown
process.on('SIGINT', async () => {
    await shutdown(browser);
});

(async () => {
    try {
        // Launch Puppeteer browser with necessary options
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'], // Handle sandboxing for certain environments
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(60000);

        log('Navigating to the target website...');
        await page.goto('https://betting.co.zw/fast-games/aviator');

        // Check if already logged in
        const isLoggedIn = await page.evaluate(() => !!document.querySelector('.user-profile'));
        if (!isLoggedIn) {
            log('Not logged in. Proceeding to log in...');
            await page.goto('https://betting.co.zw/login');

            // Perform login
            await page.type(config.usernameSelector, config.username, { delay: 50 });
            await page.type(config.passwordSelector, config.password, { delay: 50 });
            await Promise.all([
                page.click(config.loginButtonSelector),
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
            ]);
            log('Login successful!');
        }

        // Navigate to the Aviator game
        await page.goto('https://betting.co.zw/virtual/fast-games/aviator');

        // Locate the game iframe dynamically
        const locateIframe = async () => {
            const frame = page.frames().find(frame => frame.url().includes('spribe.co'));
            if (!frame) throw new Error('Iframe not found!');
            return frame;
        };

        let iframe = await locateIframe();
        log('Iframe located, ready for interaction.');

        // Utility functions
        const getElementContent = async (frame, selector) => {
            try {
                const element = await frame.$(selector);
                if (!element) throw new Error(`Element with selector "${selector}" not found.`);
                const content = await frame.evaluate(el => el.textContent.trim(), element);
                return content;
            } catch (error) {
                log(`Error getting element content: ${error.message}`);
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

        // Betting logic
        const placeBet = async () => {
            if (betInProgress) return; // Prevent multiple bets
            betInProgress = true;

            try {
                iframe = await locateIframe(); // Refresh iframe reference
                const balanceText = await getElementContent(iframe, config.balanceSelector);
                const balance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));
                log(`Current balance: ${balance}`);

                if (balance < config.minBetAmount) {
                    throw new Error('Insufficient balance to place a bet.');
                }

                const betAmount = calculateBetAmount(balance);

                // Enter bet amount
                await iframe.focus(config.betInputSelector);
                await iframe.evaluate(selector => {
                    const input = document.querySelector(selector);
                    input.value = ''; // Clear input
                }, config.betInputSelector);
                await iframe.type(config.betInputSelector, betAmount.toString());
                log(`Entered bet amount: ${betAmount}`);

                // Click bet button
                await safeClick(iframe, config.betButtonSelector);
                log('Bet placed successfully.');

                // Wait for a random period before cashing out
                const delay = Math.random() * (5000 - 2000) + 2000; // Between 2s and 5s
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

        // Place bets at intervals
        setInterval(async () => {
            try {
                await placeBet();
            } catch (error) {
                log(`Error in betting interval: ${error.message}`);
            }
        }, config.betInterval);

    } catch (error) {
        log(`Script error: ${error.message}`);
        if (browser) {
            await shutdown(browser);
        }
    }
})();
