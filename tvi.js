const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Cluster } = require('puppeteer-cluster');
const fetch = require('node-fetch');

puppeteer.use(StealthPlugin());

(async () => {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 4, // Process up to 4 game states concurrently
        puppeteerOptions: {
            headless: false, // Set to `true` for production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
            ],
        },
    });

    // Task for processing each game state
    await cluster.task(async ({ page, data: { url } }) => {
        // Navigate to game page
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Anti-bot: Randomize user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        // Wait for key elements to load
        await page.waitForSelector('span.text-uppercase.ng-tns.c29-22'); // Round ID
        await page.waitForSelector('div.bubble-multiplier.font-weight-bold'); // App Bubble Value

        // Function to handle dynamic Result selectors
        const getResultSelector = async () => {
            const possibleSelectors = [
                'span.ng-tns.c29-22',
                'span.ng-tns.c29-23',
                'span.ng-tns.c29-24',
                'span.ng-tns.c29-25',
            ];
            for (const selector of possibleSelectors) {
                if (await page.$(selector)) return selector;
            }
            throw new Error('Result selector not found');
        };

        // Scrape game data
        const roundId = await page.$eval('span.text-uppercase.ng-tns.c29-22', el => el.textContent.trim());
        const bubbleValue = await page.$eval('div.bubble-multiplier.font-weight-bold', el => el.textContent.trim());
        const time = await page.$eval('div.header-info-time.ng-tns-c29-22', el => el.textContent.trim());
        const resultSelector = await getResultSelector();
        const result = await page.$eval(resultSelector, el => el.textContent.trim());

        console.log(`Scraped Data: Round ID = ${roundId}, Bubble = ${bubbleValue}, Time = ${time}, Result = ${result}`);

        // Validate using intercepted traffic (HTTP)
        const isValid = await validateDataFromTraffic(roundId, bubbleValue, time, result);

        if (isValid) {
            console.log('Data validated. Sending to betting logic...');
            await sendToBettingLogic({ roundId, bubbleValue, time, result });
        } else {
            console.error('Data validation failed.');
        }
    });

    // Queue URLs for processing
    const gameUrl = 'https://betting.co.zw/virtual/fast-games/aviator';
    for (let i = 0; i < 5; i++) {
        cluster.queue({ url: gameUrl });
    }

    await cluster.idle();
    await cluster.close();
})();

// Validate data using intercepted HTTP traffic
async function validateDataFromTraffic(roundId, bubbleValue, time, result) {
    // Mocked traffic validation logic
    // Replace with actual intercepted traffic processing
    console.log(`Validating data from traffic: ${roundId}, ${bubbleValue}, ${time}, ${result}`);
    return true; // Assume validation is successful
}

// Send data to betting logic
async function sendToBettingLogic(data) {
    console.log('Sending data to betting logic:', data);

    // Example API call to betting logic
    await fetch('http://127.0.0.1:3000/mozzart.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
