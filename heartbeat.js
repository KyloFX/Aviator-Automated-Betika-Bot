const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Enable WebSocket monitoring
    const cdpSession = await page.target().createCDPSession();
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.setWebSocketFrameHandler', { enable: true });

    const heartbeatData = [];

    cdpSession.on('Network.webSocketFrameSent', (event) => {
        const { payloadData } = event.response;
        if (payloadData.includes('heartbeat') || payloadData.includes('pulse')) {
            heartbeatData.push({ type: 'sent', data: payloadData });
        }
    });

    cdpSession.on('Network.webSocketFrameReceived', (event) => {
        const { payloadData } = event.response;
        if (payloadData.includes('heartbeat') || payloadData.includes('pulse')) {
            heartbeatData.push({ type: 'received', data: payloadData });
        }
    });

    // Navigate to the game page
    await page.goto('https://betting.co.zw/virtual/fast-games/aviator', { waitUntil: 'networkidle2' });

    // Wait for 30 seconds to capture heartbeat traffic
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Save heartbeat data to a file
    fs.writeFileSync('heartbeat_data.json', JSON.stringify(heartbeatData, null, 2));
    console.log('Heartbeat data saved to heartbeat_data.json');

    await browser.close();
})();