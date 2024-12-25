const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const UserAgent = require('user-agents');
const { performance } = require('perf_hooks');
const nodemailer = require('nodemailer');
const formatToUSD = (amount) => parseFloat(amount).toFixed(2);

puppeteer.use(StealthPlugin());

// Configuration
const config = {
    url: 'https://betting.co.zw/virtual/fast-games',
    loginUrl: 'https://betting.co.zw/authentication/login',
    logFile: './logs/activity.log',
    iframeSelector: 'iframe.grid-100',
    selectors: {
        loginButton: '#user-menu-login',
        usernameInput: 'input#phoneInput',
        passwordInput: 'input#password',
        submitButton: 'span#buttonLoginSubmitLabel',
        aviatorGameGrid: 'body > app-root > div > div.au-l-main > ng-component > div.grid-100.idb-gam-virtual > div > div.grid-100.idb-gam-wrapper-games > div.au-m-thn > div:nth-child(9) > img',
        playNowButton: 'button.au-m-btn.positive',
        balance: 'span.amount.font-weight-bold',
        betInput: 'input.font-weight-bold',
        betButton: 'button.btn.btn-success.bet.ng-star-inserted',
        cashoutButton: 'button.btn.btn-warning.cashout.ng-star-inserted',
    },
    minBetAmount: 0.0001,
    maxBetAmount: 0.000015, 
    betPercentage: 0.0005,
    growthFactor: 1.5,
    fibonacciSequence: [0.0002, 0.0003, 0.005, 0.0008, 0.000013],
    strategyWeights: { exponential: 0.7, fibonacci: 0.3 },
    allInAfterWins: 4,
};

// Utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(config.logFile, logMessage + '\n');
};

const retry = async (fn, retries = 3, delay = 3000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            log(`[Retry ${i + 1}] Error: ${error.message}`);
            if (i < retries - 1) await sleep(delay);
        }
    }
    throw new Error('Failed after maximum retries.');
};

// Missing navigateWithRetry function
const navigateWithRetry = async (url, page, retries = 3) => {
    await retry(async () => {
        await page.goto(url, { waitUntil: 'networkidle2' });
        log(`Navigated to ${url}`);
    }, retries);
};

// Functions
const switchToIframe = async (page, iframeSelector) => {
    const iframeElement = await retry(async () => {
        return await page.waitForSelector(iframeSelector, { visible: true });
    });
    const iframe = await iframeElement.contentFrame();
    if (!iframe) throw new Error('Failed to access iframe content.');
    return iframe;
};

const calculateBetAmount = (currentBalance, winCount) => {
    const strategy = Math.random() < config.strategyWeights.exponential
        ? 'exponential'
        : 'fibonacci';
    
    let bet;

    if (strategy === 'exponential') {
        bet = (currentBalance * config.betPercentage * config.growthFactor).toFixed(2);
        log(`Exponential strategy chosen. Bet amount: ${bet}`);
        return bet;
    } else {
        const fibIndex = winCount % config.fibonacciSequence.length;
        bet = (currentBalance * config.fibonacciSequence[fibIndex]).toFixed(2);
        log(`Fibonacci strategy chosen. Bet amount: ${bet}`);
    }

    // Apply the max bet limit
    bet = Math.min(bet, config.maxBetAmount).toFixed(2);
    log(`Final Bet Amount (after max limit applied): ${bet}`);
 
    return bet;
};

const placeBet = async (iframe, winCount) => {
    const balanceText = await retry(() =>
        iframe.$eval(config.selectors.balance, el => el.innerText.trim())
    );
    const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));

    if (currentBalance < config.minBetAmount) {
        log('Insufficient balance to place a bet.');
        return;
    }

    const betAmount = calculateBetAmount(currentBalance, winCount);

    // Enter bet amount
   // await iframe.type(config.selectors.betInput, betAmount, { delay: 100 });
   // log(`Bet amount entered: ${betAmount}`);

    // Place bet
    await retry(() => iframe.click(config.selectors.betButton));
    log('Bet placed.');

    // Cashout logic
<<<<<<< Updated upstream
    const tryCashout = async (iframe, retries = 13, baseDelay = 3777) => {
=======
    const tryCashout = async (iframe, retries = 13, baseDelay = 1799) => {
>>>>>>> Stashed changes
        let attempt = 0;
        while (attempt < retries) {
            try {
                log(`Cashout attempt ${attempt + 1}...`);
                await iframe.click(config.selectors.cashoutButton);
                log('Cashed out successfully.');
                return; // Exit loop on success
            } catch (error) {
                log(`Cashout attempt ${attempt + 1} failed: ${error.message}`);
                attempt++;
                if (attempt < retries) {
                    // Add randomness to the delay between retries
<<<<<<< Updated upstream
                    const randomDelay = baseDelay - Math.random() * 999; // Adjust range as needed
=======
                    const randomDelay = baseDelay + Math.random() * 793; // Adjust range as needed
>>>>>>> Stashed changes
                    await sleep(randomDelay); // Wait before retrying
                }
            }
        }
        throw new Error(`Failed to cash out after ${retries} attempts.`);
    };

// Call cashout function with retries
const cashoutDelay =  (1-Math.random() * (999)) * 1111; // Adjust delay range if needed
await sleep(cashoutDelay);

try {
    await tryCashout(iframe);
} catch (error) {
    log(`Error during cashout process: ${error.message}`);
}

};

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const page = await browser.newPage();

    // Set Stealth User Agent
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);

    // Login
    await navigateWithRetry(config.loginUrl, page);
    await page.type(config.selectors.usernameInput, process.env.MOZZARTUSERNAME);
    await page.type(config.selectors.passwordInput, process.env.MOZZARTPASSWORD);
    await page.click(config.selectors.submitButton);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    log('Logged in successfully.');

    // Navigate to Aviator game
    await navigateWithRetry(config.url, page);
    await page.waitForSelector(config.selectors.aviatorGameGrid, { visible: true });
    await retry(() => page.click(config.selectors.aviatorGameGrid, { clickCount: 2 }));
    await page.waitForSelector(config.selectors.playNowButton, { visible: true });
    await page.click(config.selectors.playNowButton);
    log('Aviator game loaded.');

    // Switch to game iframe
    const iframe = await switchToIframe(page, config.iframeSelector);

    //Live round tracking
    const trackLiveRounds = async (iframe) => {
        let roundCount = 0;
    
        while (true) {
            try {
                // Wait for the "Round Start" indicator
                log(`Waiting for the next round to start...`);
                await retry(async () => {
                    const isRoundActive = await iframe.evaluate(() => {
                        const roundElement = document.querySelector('button.bt.btn-dange.bet'); // Replace with the actual selector
                        return roundElement && roundElement.innerText.includes('WAITING FOR NEXT ROUND');
                    });
                    if (!isRoundActive) throw new Error('Round not active yet.');
                });
    
                // Log round start
                roundCount++;
                log(`Round ${roundCount} started.`);
    
                // Monitor round progress
                let multiplier = 'Unknown';
                await retry(async () => {
                    multiplier = await iframe.evaluate(() => {
                        const multiplierElement = document.querySelector('li.active'); // Replace with the actual selector
                        return multiplierElement ? multiplierElement.innerText.trim() : 'Unknown';
                    });
                    if (multiplier === 'Unknown') throw new Error('Multiplier not available yet.');
                });
    
                log(`Round ${roundCount} in progress. Current multiplier: ${multiplier}`);
    
                // Wait for the round to end
                log(`Waiting for round ${roundCount} to end...`);
                await retry(async () => {
                    const isRoundOver = await iframe.evaluate(() => {
                        const roundElement = document.querySelector('grid-100'); // Replace with the actual selector
                        return roundElement && roundElement.innerText.includes('');
                    });
                    if (!isRoundOver) throw new Error('Round not over yet.');
                });
    
                // Log round end
                log(`Round ${roundCount} ended. Final multiplier: ${multiplier}`);
    
                // Track memory usage after each round
                trackMemoryUsage();
    
                // Optional sleep before next round
                await sleep(2000);
    
            } catch (error) {
                log(`Error tracking live round: ${error.message}`);
            }
        }
    };
    
    // Betting loop
    let winCount = 0;
    while (true) {
        try {
            await placeBet(iframe, winCount);
            winCount++;
        } catch (error) {
            log(`Error during betting process: ${error.message}`);
        }
    }
})();