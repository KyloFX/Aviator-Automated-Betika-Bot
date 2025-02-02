const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let latestGameData = {}; // Store latest game state

// Endpoint to receive game data from replay.js
app.post('/betting_logic.py', (req, res) => {
    latestGameData = req.body;
    console.log('Updated game data:', latestGameData);
    res.sendStatus(200);
});

// Endpoint for mozzart.js to retrieve game state
app.get('/betting_logic.py', (req, res) => {
    res.json(latestGameData);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
