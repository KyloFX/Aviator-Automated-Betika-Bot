// Function to extract game history
async function getGameHistory(page) {
    try {
      // Locate the result-history container
      const historyData = await page.evaluate(() => {
        const historyElement = document.querySelector('.result-history');
        if (!historyElement) {
          return [];
        }
        // Extract text content
        const rawText = historyElement.textContent || '';
        // Split into lines and filter out non-numeric lines
        const lines = rawText.split('\n').map(line => line.trim());
        return lines
          .filter(line => /^[0-9]+(\.[0-9]+)?x$/.test(line)) // Keep only lines like "1.20x"
          .map(line => parseFloat(line.replace('x', ''))); // Convert to float
      });
  
      console.log('Extracted Game History:', historyData);
      return historyData;
    } catch (error) {
      console.error('Error extracting game history:', error);
      return [];
    }
  }
  
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to the game page
    await page.goto('https://aviator-next.spribegaming.com/');
    await page.waitForSelector('.result-history', { timeout: 10000 });

    // Extract multipliers from the game history
    const multipliers = await page.evaluate(() => {
        const historyElement = document.querySelector('.result-history');
        if (!historyElement) return [];
        return Array.from(historyElement.innerText.split('\n')).map(item => item.trim()).filter(item => item.endsWith('x'));
    });

    console.log('Extracted Multipliers:', multipliers);

    // Write the multipliers to a text file
    fs.writeFileSync('./multipliers.txt', multipliers.join('\n'), 'utf-8');
    console.log('Multipliers saved to multipliers.txt');

    // Extract game history
    const gameHistory = await getGameHistory(page);

    console.log('Game History:', gameHistory);

    await browser.close();
})();