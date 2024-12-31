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
    minBetAmount: 0.00015,
    maxBetAmount: 0.00015, 
    betPercentage: 0.005,
    growthFactor: 0.15,
    fibonacciSequence: [0.20, 0.3, 0.5, 0.8, 1.3],
    strategyWeights: { exponential: 0.4, fibonacci: 0.1 },
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

// Adjusted calculateBetAmount with target multiplier calculation
const calculateBetAmount = (currentBalance, winCount) => {
    const strategy = Math.random() < config.strategyWeights.exponential
        ? 'exponential'
        : 'fibonacci';
    
    let bet, targetMultiplier;

    if (strategy === 'exponential') {
        bet = (currentBalance * config.betPercentage * config.growthFactor).toFixed(2);
        targetMultiplier = config.growthFactor * Math.random() + .09; // Example: Increase base multiplier
        log(`Exponential strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    } else {
        const fibIndex = winCount % config.fibonacciSequence.length;
        bet = (currentBalance * 0.1 * config.fibonacciSequence[fibIndex]).toFixed(2);
        targetMultiplier = (fibIndex * 0.1); // Fibonacci scaling for multiplier
        log(`Fibonacci strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    }

    // Apply the max bet limit
    bet = Math.min(bet, config.maxBetAmount).toFixed(2);
    log(`Final Bet Amount (after max limit applied): ${bet}`);
 
    return { bet, targetMultiplier };
};

// Updated placeBet function
const placeBet = async (iframe, winCount) => {
    const balanceText = await retry(() =>
        iframe.$eval(config.selectors.balance, el => el.innerText.trim())
    );
    const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));

    if (currentBalance < config.minBetAmount) {
        log('Insufficient balance to place a bet.');
        return;
    }

    const { bet, targetMultiplier } = calculateBetAmount(currentBalance, winCount);

    // Enter bet amount
    await iframe.type(config.selectors.betInput, bet, { delay: 100 });
    log(`Bet amount entered: ${bet}`);

    // Place bet
    await retry(() => iframe.click(config.selectors.betButton));
    log('Bet placed.');

    // Monitor for cashout
    try {
        await tryCashout(iframe, targetMultiplier);
    } catch (error) {
        log(`Error during cashout process: ${error.message}`);
    }
};

// Refined tryCashout function
const tryCashout = async (iframe, targetMultiplier, retries = 50, checkInterval = 1000) => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            const multiplierText = await iframe.$eval('label.amount', el => el.innerText.trim());
            const currentMultiplier = parseFloat(multiplierText);

            if (!isNaN(currentMultiplier)) {
                log(`Current multiplier: ${currentMultiplier}`);

                if (currentMultiplier >= targetMultiplier) {
                    log(`Target multiplier ${targetMultiplier} reached. Attempting to cash out.`);
                    await iframe.click(config.selectors.cashoutButton);
                    log('Cashed out successfully.');
                    return; // Exit after success
                }
            }
        } catch (error) {
            log(`Attempt ${attempt + 1}: Error fetching multiplier - ${error.message}`);
        }

        // Increment attempt counter and wait before retrying
        attempt++;
        if (attempt < retries) await sleep(checkInterval);
    }

    throw new Error(`Failed to cash out after ${retries} attempts.`);
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
                        const roundElement = document.querySelector('.dom-container'); // Replace with the actual selector
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
                        const multiplierElement = document.querySelector('.'); // Replace with the actual selector
                        return multiplierElement ? multiplierElement.innerText.trim() : 'Unknown';
                    });
                    if (multiplier === 'Unknown') throw new Error('Multiplier not available yet.');
                });
    
                log(`Round ${roundCount} in progress. Current multiplier: ${multiplier}`);
    
                // Wait for the round to end
                log(`Waiting for round ${roundCount} to end...`);
                await retry(async () => {
                    const isRoundOver = await iframe.evaluate(() => {
                        const roundElement = document.querySelector('.dom-container'); // Replace with the actual selector
                        return roundElement && roundElement.innerText.includes('Waiting for Next Round');
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