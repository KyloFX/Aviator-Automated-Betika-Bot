const calculateBetAmount = (currentBalance, winCount) => {
    const strategy = Math.random() < config.strategyWeights.exponential
        ? 'exponential'
        : 'fibonacci';
    let bet;

    if (strategy === 'exponential') {
        bet = (currentBalance *0.1* config.betPercentage * config.growthFactor).toFixed(2);
    } else {
        const fibIndex = winCount % config.fibonacciSequence.length;
        bet = (currentBalance * config.fibonacciSequence[fibIndex]).toFixed(2);
    }

    // Ensure the bet does not exceed balance or minimum limits
    bet = Math.min(bet, currentBalance).toFixed(2);
    if (bet < config.minBetAmount) {
        log(`Bet amount ${bet} is less than the minimum allowed bet.`);
        throw new Error('Bet amount too low.');
    }

    log(`Calculated bet using ${strategy} strategy: ${bet}`);
    return bet;
};
