class MockWebSocket {
    constructor() {
        this.readyState = 1; // OPEN
        this.events = {};
    }

    addEventListener(event, callback) {
        this.events[event] = callback;
    }

    simulateMessage(data) {
        if (this.events['message']) {
            const event = { data: JSON.stringify(data) };
            this.events['message'](event);
        }
    }
}

// Export the MockWebSocket class
module.exports = MockWebSocket;
