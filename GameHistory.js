const puppeteer = require('puppeteer');
const fs = require('fs');

// Function to extract game history from iframe
async function getGameHistory(frame) {
    try {
        // Locate the result-history container inside the iframe
        const historyData = await frame.evaluate(() => {
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

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to the game page
    await page.goto('https://aviator-next.spribegaming.com/');
    await page.waitForSelector('iframe', { timeout: 10000 });

    // Select the iframe
    const iframeElement = await page.$('iframe');
    const frame = await iframeElement.contentFrame();

    if (!frame) {
        console.error('Failed to locate iframe.');
        await browser.close();
        return;
    }

    // Wait for the game history container inside the iframe
    await frame.waitForSelector('.result-history', { timeout: 10000 });

    // Extract multipliers from the game history
    const multipliers = await frame.evaluate(() => {
        const historyElement = document.querySelector('.result-history');
        if (!historyElement) return [];
        return Array.from(historyElement.innerText.split('\n'))
            .map(item => item.trim())
            .filter(item => item.endsWith('x'));
    });

    console.log('Extracted Multipliers:', multipliers);

    // Write the multipliers to a text file
    fs.writeFileSync('./multipliers.txt', multipliers.join('\n'), 'utf-8');
    console.log('Multipliers saved to multipliers.txt');

    // Extract game history
    const gameHistory = await getGameHistory(frame);

    console.log('Game History:', gameHistory);

    await browser.close();
})();
