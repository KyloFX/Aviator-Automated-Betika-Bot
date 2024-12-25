//Bets may be placed during the wrong game phase (e.g., after the multiplier starts increasing).
//Verify the game state (e.g., "WAITING FOR NEXT ROUND") before interacting.

const waitForNextRound = async (iframe) => {
    log('Waiting for the next round...');
    await retry(async () => {
        const isReady = await iframe.evaluate(() => {
            const roundElement = document.querySelector('.dom-container'); // Update with correct selector
            return roundElement && roundElement.innerText.includes('WAITING FOR NEXT ROUND');
        });
        if (!isReady) throw new Error('Round not ready yet.');
    });
};
