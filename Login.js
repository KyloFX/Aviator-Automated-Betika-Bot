const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

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
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Save the WebSocket endpoint to a file
    const wsEndpoint = browser.wsEndpoint();
    fs.writeFileSync('wsEndpoint.txt', wsEndpoint);
    console.log('WebSocket endpoint saved to wsEndpoint.txt');

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
        const contentType = response.headers()['content-type'];

        // Skip responses without a body or non-JSON responses
        if (!contentType || !contentType.includes('application/json')) {
            console.log(`Skipping non-JSON response from ${url}: Content-Type is ${contentType}`);
            return;
        }

        try {
            const data = await response.json();
            networkData.push({ type: 'response', url, status: response.status(), data });
        } catch (error) {
            console.error(`Error parsing response from ${url}: ${error.message}`);
        }
    });

    // Navigate to the login page
    await page.goto(config.loginUrl, { waitUntil: 'networkidle2' });

    // Fill in login form
    await page.type(config.selectors.usernameInput, process.env.MOZZARTUSERNAME);
    await page.type(config.selectors.passwordInput, process.env.MOZZARTPASSWORD);
    await page.click(config.selectors.submitButton);

    // Wait for navigation to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Navigate to the Aviator game
    await page.goto(config.url + '/aviator', { waitUntil: 'networkidle2' });

    // Wait for the iframe to load
    await page.waitForSelector('iframe');
    const iframe = await page.frames().find(frame => frame.url().includes('aviator'));

    if (!iframe) {
        console.error("❌ Failed to detect iframe, exiting.");
        await browser.close();
        return;
    }

    // Inject the script controller into the iframe
    await iframe.evaluate(() => {
        if (!window.scriptController) {
            window.scriptController = {
                loadModule: function(url) {
                    var script = document.createElement('script');
                    script.src = url;
                    script.onload = () => console.log(url + ' loaded');
                    document.head.appendChild(script);
                }
            };
        }
    });

    console.log("✅ Script controller injected into the iframe.");

    await page.evaluate(() => {
        // Save the original method
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;
        
        // Override fillText
        CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
          // Log or store the text for later retrieval
          console.log("Canvas fillText called with:", text);
          
          // Optionally, expose the text to the window object for Puppeteer to read
          window.lastDrawnText = text;
          
          // Call the original method
          return originalFillText.apply(this, arguments);
        };
      });
     

    const multiplier = await page.evaluate(() => {
        const textElements = document.querySelectorAll('svg text');
        return Array.from(textElements).map(text => text.textContent.trim());
    });
    
    console.log("Extracted Multipliers:", multiplier);
    

    // Save the page URL to a file for heartbeat.js to use
    fs.writeFileSync('pageUrl.txt', page.url());
    console.log('Page URL saved to pageUrl.txt');

    // Save network data to a file
    fs.writeFileSync('network_data.json', JSON.stringify(networkData, null, 2));
    console.log('Network data saved to network_data.json');

    // Dynamically load heartbeat.js using the script controller
    await iframe.evaluate(() => {
        window.scriptController.loadModule('https://127.0.0.1:5000/heartbeat.js');
    });

    // Keep the browser open
    console.log('Login script completed. Browser will remain open.');
})();