const analyzeResults = (roundMultiplier, cashoutMultiplier) => {
    if (cashoutMultiplier > roundMultiplier) {
        log(`Loss: Cashout at ${cashoutMultiplier}, but round ended at ${roundMultiplier}`);
        return 'loss';
    } else {
        log(`Win: Cashout at ${cashoutMultiplier} before round ended at ${roundMultiplier}`);
        return 'win';
    }
};


//also add logic to log and store round results to a file for use with Ai and prediction tools
