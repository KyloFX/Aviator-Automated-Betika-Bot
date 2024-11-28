const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

const url = 'https://betting.co.zw/virtual/fast-games'; // Direct URL to Fast Games
const loginUrl = 'https://betting.co.zw/authentication/login';
const username = process.env.MOZZARTUSERNAME;
const password = process.env.MOZZARTPASSWORD;

if (!username || !password) {
    throw new Error("Environment variables MOZZARTUSERNAME or MOZZARTPASSWORD are not set.");
}

// Utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomSleep = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1) + min));

const retry = async (fn, retries = 3, delay = 3000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`[Retry ${i + 1}] Error:`, error.message);
            if (i < retries - 1) await sleep(delay);
        }
    }
    throw new Error('Failed after maximum retries.');
};

const navigateWithRetry = async (url, page, retries = 3, timeout = 120000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout });
            console.log(`[${new Date().toISOString()}] Navigated to ${url}`);
            return;
        } catch (error) {
            console.error(`[Retry ${i + 1}] Navigation error: ${error.message}`);
            if (i === retries - 1) throw error;
        }
    }
};

// Function to handle iframe switching
const switchToIframe = async (page, iframeSelector, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const iframeElement = await page.$(iframeSelector);
            if (iframeElement) {
                const iframe = await iframeElement.contentFrame();
                console.log('Switched to iframe.');
                return iframe;
            }
            console.log('Iframe not found, retrying...');
            await sleep(delay);
        } catch (error) {
            console.error(`Error while switching iframe: ${error.message}`);
            if (i === retries - 1) throw error;
        }
    }
    throw new Error('Failed to switch to iframe.');
};

// Selectors
const gridSelector = 'body > app-root > div > div.au-l-main > ng-component > div.grid-100.idb-gam-virtual > div > div.grid-100.idb-gam-wrapper-games > div.au-m-thn > div:nth-child(9) > img';
const playButtonSelector = 'button.au-m-btn.positive';
const iframeSelector = 'iframe.grid-100'; // Adjust this based on the actual iframe selector

(async () => {
    console.log(`[${new Date().toISOString()}] Launching Puppeteer...`);
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--remote-debugging-port=9222',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-webgl',
            '--disable-accelerated-2d-canvas',
            '--disable-extensions'
        ]
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    // Stealth configurations
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log(`[${new Date().toISOString()}] Navigating to ${url}`);
    await navigateWithRetry(url, page);

    // Login Process
    try {
        console.log(`[${new Date().toISOString()}] Trying to click on login button...`);
        await page.waitForSelector('#user-menu-login', { visible: true, timeout: 20000 });
        await page.click('#user-menu-login');
        console.log(`[${new Date().toISOString()}] Login button clicked.`);
    } catch (error) {
        console.log(`[${new Date().toISOString()}] Login button not found, navigating directly to login URL.`);
        await page.goto(loginUrl);
    }

    console.log(`[${new Date().toISOString()}] Waiting for login form...`);
    await page.waitForSelector('input#phoneInput', { visible: true, timeout: 10000 });

    console.log(`[${new Date().toISOString()}] Entering username and password...`);
    await page.type('input#phoneInput', username);
    await page.type('input#password', password);

    console.log(`[${new Date().toISOString()}] Submitting login form...`);
    await page.waitForSelector('span#buttonLoginSubmitLabel', { visible: true });
    await page.click('span#buttonLoginSubmitLabel');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    console.log(`[${new Date().toISOString()}] Logged in successfully.`);

    // Save cookies and WebSocket endpoint
    const cookiesPath = path.join(__dirname, 'cookies.json');
    const browserWSEndpoint = browser.wsEndpoint();
    const cookies = await page.cookies();
    fs.mkdirSync(path.dirname(cookiesPath), { recursive: true });
    fs.writeFileSync('wsEndpoint.txt', browserWSEndpoint);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies));

    // Directly navigate to Fast Games page
    try {
        console.log(`[${new Date().toISOString()}] Navigating directly to Fast Games page...`);
        await navigateWithRetry('https://betting.co.zw/virtual/fast-games', page);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error navigating to Fast Games: ${error.message}`);
        throw new Error('Fast Games navigation failed');
    }

    // Aviator Game Navigation
    try {
        console.log(`[${new Date().toISOString()}] Navigating to the Aviator game...`);
        await navigateWithRetry(`${url}/aviator`, page);

        await page.waitForSelector('div.grid-100.idb-gam-virtual', { visible: true, timeout: 40000 });
        await page.waitForSelector(gridSelector, { visible: true, timeout: 40000 });

        await retry(async () => {
            await page.click(gridSelector, { clickCount: 2 });
            console.log(`[${new Date().toISOString()}] Aviator game image double-clicked.`);
        }, 3, 2000);

        await randomSleep(1500, 2000);

        await retry(async () => {
            await page.waitForSelector(playButtonSelector, { visible: true, timeout: 3000 });
        }, 5, 1000);

        await page.click(playButtonSelector);
        console.log(`[${new Date().toISOString()}] "PLAY NOW" button clicked.`);

        console.log(`[${new Date().toISOString()}] Waiting for 5 seconds to allow the game to load...`);
        await randomSleep(5000, 6000);

        // Switch to iframe and perform actions
        try {
            const iframe = await switchToIframe(page, iframeSelector);
            console.log(`[${new Date().toISOString()}] Iframe switched successfully.`);

            console.log(`[${new Date().toISOString()}] Adding delay to ensure iframe content is loaded...`);
            await sleep(5000);

            await retry(async () => {
                await iframe.waitForSelector('span.amount.font-weight-bold', { visible: true, timeout: 20000 });
            }, 3, 2000);
            console.log(`[${new Date().toISOString()}] Balance selector located.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error during iframe interaction: ${error.message}`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error navigating to Aviator game: ${error.message}`);
    }

    console.log(`[${new Date().toISOString()}] Current URL before handing over: ${page.url()}`);
    console.log(`[${new Date().toISOString()}] Starting betting logic in index.js...`);

    retry(async () => {
        return new Promise((resolve, reject) => {
            exec('node index.js', (error, stdout, stderr) => {
                if (error) {
                    console.error(`[Retry exec] Error executing index.js: ${error.message}`);
                    return reject(error);
                }
                if (stderr) {
                    console.error(`[Retry exec] stderr from index.js: ${stderr}`);
                }
                console.log(`[Retry exec] Output from index.js:\n${stdout}`);
                resolve(stdout);
            });
        });
    }, 3, 2000).catch(error => {
        console.error(`[${new Date().toISOString()}] Failed to execute index.js after retries: ${error.message}`);
    });

    console.log(`[${new Date().toISOString()}] Handed over to index.js.`);
})();
