const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Enable network monitoring
    await page.setRequestInterception(true);
    const networkData = [];

    page.on('request', (request) => {
        const url = request.url();
        networkData.push({ type: 'request', url });
        request.continue();
    });

    page.on('response', async (response) => {
        const url = response.url();
        networkData.push({ type: 'response', url, status: response.status() });

        // Capture login API responses
        if (url.includes('login') || url.includes('authenticate')) {
            try {
                const data = await response.json();
                networkData.push({ type: 'login_response', url, data });
            } catch (error) {
                console.error(`Error parsing login response: ${error.message}`);
            }
        }
    });

    // Navigate to the login page
    await page.goto('https://betting.co.zw/authentication/login', { waitUntil: 'networkidle2' });

    // Fill in login form
    await page.type('input#phoneInput', 'your-username');
    await page.type('input#password', 'your-password');
    await page.click('span#buttonLoginSubmitLabel');

    // Wait for navigation to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Navigate to the Aviator game
    await page.goto('https://betting.co.zw/virtual/fast-games/aviator', { waitUntil: 'networkidle2' });

    // Wait for the iframe to load
    await page.waitForSelector('iframe');
    const iframeSrc = await page.$eval('iframe', (el) => el.src);
    networkData.push({ type: 'iframe_src', src: iframeSrc });

    // Save network data to a file
    fs.writeFileSync('network_data.json', JSON.stringify(networkData, null, 2));
    console.log('Network data saved to network_data.json');

    await browser.close();
})();