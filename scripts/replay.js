const fs = require('fs');
const { JSDOM } = require('jsdom');
const MockWebSocket = require('./mock-websocket');
const { log, sleep } = require('./utils');

// Load configurations
const config = JSON.parse(fs.readFileSync('./config/config.json', 'utf-8'));
const traffic = JSON.parse(fs.readFileSync('./config/traffic.json', 'utf-8'));

// Initialize sandbox environment
const dom = new JSDOM(`<!DOCTYPE html>`, {
    url: config.sandboxURL,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true
});

// Create the mock WebSocket and inject into the sandbox
const mockSocket = new MockWebSocket();
dom.window.WebSocket = MockWebSocket;

// Attach WebSocket event handlers in the sandbox
mockSocket.addEventListener('message', event => {
    console.log('Simulated message:', event.data);
    log(`Received message: ${event.data}`, config.logFile);
});

// Replay captured traffic
(async () => {
    log("Starting traffic replay...", config.logFile);
    for (const msg of traffic) {
        if (msg.type === 'websocket') {
            await sleep(msg.time / config.replaySpeed);
            mockSocket.simulateMessage(msg.data);
        }
    }
    log("Traffic replay complete.", config.logFile);
})();
