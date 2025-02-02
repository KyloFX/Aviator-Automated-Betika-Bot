const WebSocket = require('ws');
const fs = require('fs');

// Load captured WebSocket data
const heartbeatData = JSON.parse(fs.readFileSync('heartbeat_data.json', 'utf-8'));

// Simulate WebSocket connection
const ws = new WebSocket('wss://af-south-1-game1.spribegaming.com:443/BlueBox/websocket'); // Replace with actual URL

ws.on('open', () => {
    console.log('WebSocket connection opened.');

    // Simulate heartbeat traffic
    heartbeatData.forEach((frame) => {
        if (frame.type === 'sent') {
            ws.send(frame.data);
        }
    });
});

ws.on('message', (data) => {
    console.log('Received message:', data.toString());
});

ws.on('close', () => {
    console.log('WebSocket connection closed.');
});