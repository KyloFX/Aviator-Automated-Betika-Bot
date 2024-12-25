const trackAndCashout = async (iframe, targetMultiplier) => {
    log(`Waiting to cash out at target multiplier: ${targetMultiplier}`);
    await retry(async () => {
        const currentMultiplier = await iframe.evaluate(() => {
            const multiplierElement = document.querySelector('.multiplier'); // Update with correct selector
            return multiplierElement ? parseFloat(multiplierElement.innerText.trim()) : null;
        });
        if (currentMultiplier >= targetMultiplier) {
            await iframe.click(config.selectors.cashoutButton);
            log(`Cashed out at multiplier: ${currentMultiplier}`);
        } else {
            throw new Error('Multiplier not reached yet.');
        }
    });
};


//add logic to determine targetMultiplier (e.g predictor.py, or other AI model)
