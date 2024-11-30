const monitorMultiplier = async (iframe) => {
    let multiplier = 'Unknown';
    await retry(async () => {
        multiplier = await iframe.evaluate(() => {
            const multiplierElement = document.querySelector('label.amount'); // Update with correct selector
            return multiplierElement ? multiplierElement.innerText.trim() : 'Unknown';
        });
        if (multiplier === 'Unknown') throw new Error('Multiplier not available.');
    });
    return multiplier;
};

//remember multiplier in animated , read context from ng-star-inserted (refer to Puppeteer and Angular.js)