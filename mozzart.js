const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const UserAgent = require('user-agents');
const { performance } = require('perf_hooks');
const nodemailer = require('nodemailer');
const csv = require('csv-parser');
const { math } = require('@tensorflow/tfjs');
const formatToUSD = (amount) => parseFloat(amount).toFixed(2);

puppeteer.use(StealthPlugin());

// Configuration
const config = {
    url: 'https://betting.co.zw/virtual/fast-games',
    loginUrl: 'https://betting.co.zw/authentication/login',
    logFile: './logs/activity.log',
    csvFile: './multipliers.csv', // CSV file path
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
        multiplierSelector: '.multiplier-selector',
    },
    minBetAmount: 0.10,
    maxBetAmount: 0.20,
};

// Load multipliers from CSV file
let multipliers = [];
const loadMultipliersFromCSV = () => {
    return new Promise((resolve, reject) => {
        let results = [];
        fs.createReadStream(config.csvFile)
            .pipe(csv())
            .on('data', (row) => {
                const value = parseFloat(Object.values(row)[0]);
                if (!isNaN(value)) results.push(value);
            })
            .on('end', () => {
                multipliers = results;
                log(`Loaded ${multipliers.length} multipliers from CSV.`);
                resolve();
            })
            .on('error', (error) => reject(error));
    });
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

const getRandomMultiplier = () => {
    return multipliers.length ? multipliers[Math.floor(Math.random() * multipliers.length)] : 1.5;
};

const placeBet = async (iframe, winCount) => {
    try {
        const balanceText = await iframe.$eval(config.selectors.balance, el => el.innerText.trim());
        const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));

        if (currentBalance < config.minBetAmount) {
            log("Insufficient balance to place a bet.");
            return;
        }

        const bet = config.minBetAmount;
        //const bet = (currentBalance * 0.05).toFixed(2);
        const targetMultiplier = getRandomMultiplier();

        const betInput = await iframe.$(config.selectors.betInput);
        await betInput.click();
        await iframe.evaluate(input => { input.value = ''; }, betInput);
        await betInput.type(bet.toString(), { delay: 100 });
        const betButton = await iframe.$(config.selectors.betButton);
        await retry(() => betButton.click());
        log(`Bet placed: ${bet}, Target Multiplier: ${targetMultiplier}`);

        await tryCashout(iframe, targetMultiplier);
    } catch (error) {
        log(`Error in placeBet: ${error.message}`);
    }
};

const tryCashout = async (iframe, targetMultiplier) => {
    let retries = 0;
    const maxRetries = 50;

    while (retries < maxRetries) {
        try {
            const multiplierText = await iframe.$eval('label.amount', el => el.innerText.trim());
            const currentMultiplier = parseFloat(multiplierText);

            if (currentMultiplier >= targetMultiplier) {
                log(`Cashing out at multiplier: ${currentMultiplier}`);
                const cashoutButton = await iframe.$(config.selectors.cashoutButton);
                await cashoutButton.click();
                log("Cashout successful.");
                return;
            }
        } catch (error) {
            log(`Error during cashout attempt: ${error.message}`);
        }

        retries++;
        await sleep(500);
    }
    log("Failed to cash out. Moving to next round.");
};

const navigateWithRetry = async (url, page) => {
    await retry(() => page.goto(url, { waitUntil: 'networkidle2' }));
};

const switchToIframe = async (page, iframeSelector) => {
    await page.waitForSelector(iframeSelector);
    const iframeElement = await page.$(iframeSelector);
    const iframe = await iframeElement.contentFrame();
    return iframe;
};

(async () => {
    await loadMultipliersFromCSV();
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);

    await navigateWithRetry(config.loginUrl, page);
    await page.type(config.selectors.usernameInput, process.env.MOZZARTUSERNAME);
    await page.type(config.selectors.passwordInput, process.env.MOZZARTPASSWORD);
    await page.click(config.selectors.submitButton);
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    log("Logged in successfully.");

    await navigateWithRetry(config.url, page);
    await page.waitForSelector(config.selectors.aviatorGameGrid, { visible: true });
    await retry(() => page.click(config.selectors.aviatorGameGrid, { clickCount: 2 }));
    await page.waitForSelector(config.selectors.playNowButton, { visible: true });
    await page.click(config.selectors.playNowButton);
    log("Aviator game loaded.");

    const iframe = await switchToIframe(page, config.iframeSelector);
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
