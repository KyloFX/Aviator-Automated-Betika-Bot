const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { exec } = require('child_process'); // Import to execute external scripts
puppeteer.use(StealthPlugin());

const url = 'https://betting.co.zw/virtual/fast-games';
const loginUrl = 'https://betting.co.zw/authentication/login';
const username = process.env.MOZZARTUSERNAME;
const password = process.env.MOZZARTPASSWORD;

// Helper to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry helper for unstable actions
const retry = async (fn, retries = 3, delay = 1000) => {
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

(async () => {
    console.log(`[${new Date().toISOString()}] Launching Puppeteer...`);
    const browser = await puppeteer.launch({ headless: false, args: ['--remote-debugging-port=9222'] });

    const page = await browser.newPage();

    // Set default timeout for navigation
    page.setDefaultNavigationTimeout(60000);

    console.log(`[${new Date().toISOString()}] Navigating to ${url}`);
    await page.goto(url);

    try {
        console.log(`[${new Date().toISOString()}] Trying to click on login button...`);
        await page.waitForSelector('#user-menu-login', { visible: true, timeout: 20000 }); // Increase timeout
        await page.click('#user-menu-login');
        console.log(`[${new Date().toISOString()}] Login button clicked.`);
    } catch (error) {
        console.log(`[${new Date().toISOString()}] Login button not found, navigating directly to login URL.`);
        await page.goto(loginUrl);
    }

    // Wait for login form to appear
    console.log(`[${new Date().toISOString()}] Waiting for login form...`);
    await page.waitForSelector('input#phoneInput', { visible: true, timeout: 10000 });

    // Fill in login credentials
    console.log(`[${new Date().toISOString()}] Entering username and password...`);
    await page.type('input#phoneInput', username);
    await page.type('input#password', password);

    // Submit login form
    console.log(`[${new Date().toISOString()}] Submitting login form...`);
    await page.waitForSelector('span#buttonLoginSubmitLabel', { visible: true });
    await page.click('span#buttonLoginSubmitLabel');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    console.log(`[${new Date().toISOString()}] Logged in successfully.`);

    // Navigate to Fast Games and the Aviator game
    try {
        console.log(`[${new Date().toISOString()}] Navigating to the Aviator game...`);
        await page.goto(url);

        // Wait for the Aviator game image and click
        const gridSelector = 'body > app-root > div > div.au-l-main > ng-component > div.grid-100.idb-gam-virtual > div > div.grid-100.idb-gam-wrapper-games > div.au-m-thn > div:nth-child(9) > img';
        const playButtonSelector = 'button.au-m-btn.positive';

        await retry(async () => {
            await page.waitForSelector(gridSelector, { visible: true, timeout: 20000 }); // Increased timeout
            await page.click(gridSelector);
        });

        console.log(`[${new Date().toISOString()}] Waiting for "PLAY NOW" button in the modal...`);
        await page.waitForSelector(playButtonSelector, { visible: true, timeout: 5000 });
        await page.click(playButtonSelector);

        console.log(`[${new Date().toISOString()}] PLAY NOW button clicked. Waiting for 6 seconds before continuing...`);
        // Wait for 6 seconds after clicking the Play Now button
        await sleep(6000);  // 6 seconds

        // Ensure the browser window is in focus
        await page.bringToFront();  // Bring the page to the front

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error navigating to Aviator game: ${error.message}`);
    }

    // Wait for 6 seconds before moving forward
    console.log(`[${new Date().toISOString()}] Waiting for 10 seconds...`);
    await sleep(10000); // Wait for 10 seconds before handing over control to index.js

    // Log current URL before handing over
    console.log(`[${new Date().toISOString()}] Current URL before handing over: ${page.url()}`);

    // Execute the index.js script for betting logic
    console.log(`[${new Date().toISOString()}] Starting betting logic in index.js...`);
    exec('node index.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`[Error executing index.js]: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr from index.js: ${stderr}`);
            return;
        }
        console.log(`Output from index.js:\n${stdout}`);
    });

    // Keep the browser open for index.js to take over
    console.log(`[${new Date().toISOString()}] Handed over to index.js.`);
})();
