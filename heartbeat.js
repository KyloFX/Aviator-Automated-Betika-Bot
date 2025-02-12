const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    // Read the WebSocket endpoint from the file
    const wsEndpoints = fs.readFileSync('wsEndpoint.txt', 'utf8').split('\n').map(line => line.trim()).filter(line => line);

    // Connect to the existing browser instance
    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoints[0] });

    // Read the page URL from the file
    const pageUrl = fs.readFileSync('pageUrl.txt', 'utf8');

    // Get the existing page
    const pages = await browser.pages();
    const page = pages.find(p => p.url() === pageUrl);

    if (!page) {
        console.error("❌ Failed to find the page, exiting.");
        await browser.close();
        return;
    }

    // Find the target iframe
    const iframe = await page.frames().find(frame => frame.url().includes('aviator'));

    if (!iframe) {
        console.error("❌ Failed to detect iframe, exiting.");
        await browser.close();
        return;
    }
    console.log("✅ Iframe detected, switching context.");

    // Enable WebSocket monitoring
    const cdpSession = await iframe._client();
    await cdpSession.send('Network.enable');

    const heartbeatData = [];

    cdpSession.on('Network.webSocketFrameSent', (event) => {
        const { payloadData } = event;
        if (payloadData && (payloadData.includes('heartbeat') || payloadData.includes('pulse'))) {
            heartbeatData.push({ type: 'sent', data: payloadData });
        }
    });

    cdpSession.on('Network.webSocketFrameReceived', (event) => {
        const { payloadData } = event;
        if (payloadData && (payloadData.includes('heartbeat') || payloadData.includes('pulse'))) {
            heartbeatData.push({ type: 'received', data: payloadData });
        }
    });

    // Connect to additional WebSocket endpoints
    for (let i = 1; i < wsEndpoints.length; i++) {
        const wsEndpoint = wsEndpoints[i];
        const ws = new WebSocket(wsEndpoint);

        ws.on('open', () => {
            console.log(`Connected to WebSocket endpoint: ${wsEndpoint}`);
        });

        ws.on('message', (data) => {
            if (data.includes('heartbeat') || data.includes('pulse')) {
                heartbeatData.push({ type: 'received', data });
            }
        });

        ws.on('close', () => {
            console.log(`Disconnected from WebSocket endpoint: ${wsEndpoint}`);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error on endpoint ${wsEndpoint}: ${error.message}`);
        });
    }

    // Wait for 30 seconds to capture heartbeat traffic
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Save heartbeat data to a file
    fs.writeFileSync('heartbeat_data.json', JSON.stringify(heartbeatData, null, 2));
    console.log('Heartbeat data saved to heartbeat_data.json');

    // Keep the script running
    console.log('Heartbeat monitoring started.');
    console.log('Press Ctrl+C to stop.');
})();