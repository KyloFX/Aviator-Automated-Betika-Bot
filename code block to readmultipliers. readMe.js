//code to read multipliers from a file and calculate average. please insert this into mozzart.js
const fs = require('fs');

// Read multipliers from the file
const multipliers = fs.readFileSync('./multipliers.txt', 'utf-8').split('\n').map(item => parseFloat(item.replace('x', '')));

console.log('Loaded Multipliers:', multipliers);

// Use multipliers in betting logic
// Example: Calculate average or determine risk
const averageMultiplier = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
console.log('Average Multiplier:', averageMultiplier);
