const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const UserAgent = require('user-agents');
const { performance } = require('perf_hooks');
const nodemailer = require('nodemailer');
const formatToUSD = (amount) => parseFloat(amount).toFixed(2);

puppeteer.use(StealthPlugin());

const config = require('./config.json'); // Ensure your config.json is up to date
const log = (message) => console.log(`[LOG] ${new Date().toISOString()} - ${message}`);

// Utility: Retry logic
const retry = async (fn, retries = 5, delay = 1000) => {
    let attempts = 0;
    while (attempts < retries) {
        try {
            return await fn();
        } catch (error) {
            attempts++;
            log(`Retry attempt ${attempts} failed: ${error.message}`);
            if (attempts === retries) throw error;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};

// Function to switch to iframe
const switchToIframe = async (page, iframeSelector) => {
    return retry(async () => {
        const iframeElement = await page.waitForSelector(iframeSelector, { visible: true });
        const iframe = await iframeElement.contentFrame();
        if (!iframe) throw new Error('Failed to access iframe content.');
        return iframe;
    });
};

// Updated placeBet function
const placeBet = async (iframe, winCount, averageMultiplier, riskMultiplier) => {
    const balanceText = await retry(() =>
        iframe.$eval(config.selectors.balance, el => el.innerText.trim())
    );
    const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));

    const { bet, targetMultiplier } = calculateBetAmount(currentBalance, winCount, averageMultiplier, riskMultiplier);

    if (bet <= 0) {
        log('No valid bet amount calculated.');
        return;
    }

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

// Main Function
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

    // Set Stealth User Agent
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);

    // Modify navigator.mediaDevices property
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'mediaDevices', {
            get: () => undefined,
        });
    });

    await page.goto('https://betting.co.zw/virtual/fast-games/aviator', { waitUntil: 'domcontentloaded' });

    // Wait for critical elements
    await page.waitForSelector('span.text-uppercase.ng-tns.c29-22'); // Round ID
    await page.waitForSelector('div.bubble-multiplier.font-weight-bold'); // Multiplier

    // Function to place a bet
    const placeBet = async (amount) => {
        try {
            await page.type('input.bet-input-selector', amount.toString(), { delay: 100 });
            await page.click('button.place-bet-selector');
            console.log(`Bet placed: ${amount}`);
        } catch (error) {
            console.error('Error placing bet:', error);
        }
    };

    // Function to cash out
    const cashOut = async (targetMultiplier) => {
        try {
            while (true) {
                const currentMultiplier = await page.$eval('div.bubble-multiplier.font-weight-bold', el => parseFloat(el.textContent.trim()));
                console.log(`Current Multiplier: ${currentMultiplier}`);
                
                if (currentMultiplier >= targetMultiplier) {
                    await page.click('button.cashout-button-selector');
                    console.log(`Cashed out at multiplier: ${currentMultiplier}`);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100)); // Check multiplier every 100ms
            }
        } catch (error) {
            console.error('Error during cashout:', error);
        }
    };

    // Betting loop
    while (true) {
        try {
            // Fetch betting data from local server
            const response = await axios.get('http://localhost:3000/mozzart.js');
            const { roundId, bubbleValue, time, result } = response.data;

            console.log(`Received game data: Round ID ${roundId}, Multiplier ${bubbleValue}`);
            
            // Place bet
            await placeBet(0.1);

            // Wait for target multiplier
            const targetMultiplier = parseFloat(bubbleValue) * 1.5; // Example multiplier strategy
            await cashOut(targetMultiplier);

            // Wait before next round
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error('Error in betting loop:', error);
        }
    }
})();