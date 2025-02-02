const fs = require('fs');
const path = require('path');

function log(message, logFile) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { log, sleep };

// utils.js

/**
 * Retry a function multiple times before failing
 * @param {Function} fn - The function to retry
 * @param {Number} retries - Number of retries
 * @param {Number} delay - Delay between retries in ms
 */
async function retry(fn, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`Retry ${i + 1}/${retries} failed:`, error);
            if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error(`❌ All ${retries} retries failed.`);
}

/**
 * Switch to the game iframe
 * @param {Object} page - Puppeteer Page instance
 * @param {String} iframeKeyword - Part of the iframe URL to search for
 */
async function switchToIframe(page, iframeKeyword) {
    try {
        await page.waitForSelector('iframe', { visible: true, timeout: 15000 });
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

module.exports = { retry, switchToIframe, log };
