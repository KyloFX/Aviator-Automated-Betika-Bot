const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
//const config = require('./config.json'); // Load config settings

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
        multiplierHistory: 'div.payouts-block',
    },
    minBetAmount: 0.10,
    maxBetAmount: 0.25, 
    betPercentage: 0.2,  // Percentage of balance to bet,
    growthFactor: 1.5, // Exponential growth factor
};

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    });

    const page = await browser.newPage();

    // Missing navigateWithRetry function
const navigateWithRetry = async (url, page, retries = 3) => {
    await retry(async () => {
        await page.goto(url, { waitUntil: 'networkidle2' });
        log(`Navigated to ${url}`);
    }, retries);
};

    // ✅ Login Workflow
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

/**
 * Retry a function multiple times before failing
 * @param {Function} fn - The function to retry
 * @param {Number} retries - Number of retries
 * @param {Number} delay - Delay between retries in ms
 */
async function retry(fn, retries = 5, delay = 10000) {
    let lastError = null; // Capture the last error for proper logging
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error; // Store the last error to log it
            console.error(`⚠️ Retry ${i + 1}/${retries} failed: ${error.message}`);
            if (i < retries - 1) {
                console.log(`Waiting for ${delay}ms before retrying...`);
                await new Promise(res => setTimeout(res, delay)); // Add more time between retries
            }
        }
    }
    throw new Error(`❌ All ${retries} retries failed. Last error: ${lastError.message}`);
}

/**
 * Switch to the game iframe
 * @param {Object} page - Puppeteer Page instance
 * @param {String} iframeKeyword - Part of the iframe URL to search for
 */
async function switchToIframe(page, iframeKeyword) {
    try {
        console.log("🔄 Waiting for iframe to appear...");
        await page.waitForSelector('iframe', { visible: true, timeout: 15000 });  // Increased timeout
        const gameFrame = await page.frames().find(frame => frame.url().includes(iframeKeyword));
        if (!gameFrame) throw new Error("Game iframe not found.");
        return gameFrame;
    } catch (error) {
        console.error("❌ Error switching to iframe:", error);
        return null;
    }
}

/**
 * Log messages with timestamps
 * @param {String} message - Message to log
 */
function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

page.on('websocket', ws => {
    ws.on('message', data => {
        try {
            let parsedData = JSON.parse(data);
            if (parsedData.round_id) {
                console.log("Captured ROUND ID:", parsedData.round_id);
            }
        } catch (error) {
            console.log("WebSocket message received, but not JSON:", data);
        }
    });
});

/**
 * Scrape dynamic game data
 * @param {Object} aviatorFrame - Puppeteer Frame instance
 */
const scrapeGameData = async (aviatorFrame) => {
    try {
        // Dynamically find round ID selector
        const roundIdSelector = await aviatorFrame.evaluate(() => {
            let elements = Array.from(document.querySelectorAll("span.text-uppercase.ng-tns-c29-3"));
            return elements.length > 0 ? elements[0].className : null;
        });

        if (!roundIdSelector) {
            console.error("❌ Round ID selector not found.");
            return null;
        }

        // Wait for Round ID to be visible
        await aviatorFrame.waitForSelector(`.${roundIdSelector}`, { visible: true, timeout: 10000 });  // Increased timeout

        // Scrape game data
        const roundId = await aviatorFrame.$eval(`.${roundIdSelector}`, el => el.textContent.trim());
        const bubbleValue = await aviatorFrame.$eval("div.bubble-multiplier.font-weight-bold", el => el.textContent.trim());
        const time = new Date().toISOString();

        // Find result dynamically
        let result = null;
        const possibleSelectors = ["span.ng-tns-c29-22", "span.ng-tns-c29-23", "span.ng-tns-c29-24"];
        for (const selector of possibleSelectors) {
            if (await aviatorFrame.$(selector)) {
                result = await aviatorFrame.$eval(selector, el => el.textContent.trim());
                break;
            }
        }

        log(`📊 Scraped Data - Round: ${roundId}, Multiplier: ${bubbleValue}, Result: ${result}`);
        return { roundId, bubbleValue, time, result };

    } catch (error) {
        console.error("❌ Error scraping game data:", error);
        return null;
    }
};

/**
 * Send scraped data to the betting logic
 * @param {Object} data - Scraped game data
 */
const sendToBettingLogic = async (data) => {
    try {
        log('📤 Sending data to betting logic...');
        await axios.post('http://localhost:3000/game-data.json', data, {
            headers: { 'Content-Type': 'application/json' },
        });
        log("✅ Data sent successfully.");
    } catch (error) {
        console.error('❌ Error sending data to betting logic:', error);
    }
};
    // ✅ Step 1: Detect and Switch to Iframe
    const aviatorFrame = await switchToIframe(page, "aviator");
    if (!aviatorFrame) {
        console.error("❌ Failed to detect iframe, exiting.");
        await browser.close();
        return;
    }
    log("✅ Iframe detected, switching context.");

    // 🔹 Start Betting Loop
    while (true) {
        const gameData = await scrapeGameData(aviatorFrame);
        if (gameData) {
            await sendToBettingLogic(gameData);
        } else {
            console.error("❌ Failed to scrape game data, retrying...");
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Adjust delay as needed
    }
})();
