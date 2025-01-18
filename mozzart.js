const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const UserAgent = require('user-agents');
const { performance } = require('perf_hooks');
const nodemailer = require('nodemailer');
const formatToUSD = (amount) => parseFloat(amount).toFixed(2);

puppeteer.use(StealthPlugin());

// Configuration
const config = {
    url: 'https://betting.co.zw/virtual/fast-games',
    loginUrl: 'https://betting.co.zw/authentication/login',
    logFile: './logs/activity.log',
    iframeSelector: 'iframe.grid-100',
    selectors: {
        loginButton: '#user-menu-login',
        usernameInput: 'input#phoneInput',
        passwordInput: 'input#password',
        submitButton: 'span#buttonLoginSubmitLabel',
        aviatorGameGrid: 'body > app-root > div > div.au-l-main > ng-component > div.grid-100.idb-gam-virtual > div > div.grid-100.idb-gam-wrapper-games > div.au-m-thn > div:nth-child(9) > img',
        playNowButton: 'button.au-m-btn.positive',
        balance: 'span.amount.font-weight-bold',
        betInput: 'input.font-weight-bold',
        betButton: 'button.btn.btn-success.bet.ng-star-inserted',
        cashoutButton: 'button.btn.btn-warning.cashout.ng-star-inserted',
        multiplierHistory: 'div.payouts-block',
    },
    minBetAmount: 0.10,
    maxBetAmount: 0.10, 
    betPercentage: 0.4,  // Percentage of balance to bet,
    growthFactor: 0.3, // Exponential growth factor
    fibonacciSequence: [0.1, 0.2, 0.3, 0.5, 0.8, 1.3, 2.1, 3.4, 5.5, 8.9], // Fibonacci sequence for bet calculation
    strategyWeights: { exponential: 0.3, fibonacci: 0.1, bob: 0.6 }, // Strategy selection weights
    allInAfterWins: 4,
};

// Utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(config.logFile, logMessage + '\n');
};

const retry = async (fn, retries = 3, delay = 3000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            log(`[Retry ${i + 1}] Error: ${error.message}`);
            if (i < retries - 1) await sleep(delay);
        }
    }
    throw new Error('Failed after maximum retries.');
};

// Missing navigateWithRetry function
const navigateWithRetry = async (url, page, retries = 3) => {
    await retry(async () => {
        await page.goto(url, { waitUntil: 'networkidle2' });
        log(`Navigated to ${url}`);
    }, retries);
};

// Functions
const switchToIframe = async (page, iframeSelector) => {
    const iframeElement = await retry(async () => {
        return await page.waitForSelector(iframeSelector, { visible: true });
    });
    const iframe = await iframeElement.contentFrame();
    if (!iframe) throw new Error('Failed to access iframe content.');
    return iframe;
};

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the game page
  await page.goto('https://example-game.com'); // Replace with actual URL

  // Monitor WebSocket and API traffic
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('aviator-next.spribegaming.com')) {
      try {
        const data = await response.json();
        console.log(`API Response from ${url}:`, data);

        // Example: Log multiplier or position from API
        if (data.multiplier) {
          console.log(`Multiplier: ${data.multiplier}`);
        }
      } catch (err) {
        console.error(`Error parsing response from ${url}:`, err.message);
      }
    }
  });

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('aviator-next.spribegaming.com')) {
      console.log(`Intercepted Request: ${url}`);
    }
  });

  // Monitor WebSocket Frames
  const cdpSession = await page.target().createCDPSession();
  await cdpSession.send('Network.enable');
  await cdpSession.send('Network.setWebSocketFrameHandler', {
    enable: true,
  });

  cdpSession.on('Network.webSocketFrameReceived', (event) => {
    const { requestId, timestamp, response } = event;
    const data = response.payloadData;

    try {
      const parsedData = JSON.parse(data);
      console.log(`WebSocket Data:`, parsedData);

      // Example: Extract relevant information (e.g., multiplier or plane state)
      if (parsedData.multiplier) {
        console.log(`Multiplier Update: ${parsedData.multiplier}`);
      }
    } catch (err) {
      console.error(`Non-JSON WebSocket Frame: ${data}`);
    }
  });

  // Wait for the SVG element controlling the plane
  const planeSelector = 'svg #plane'; // Replace with the actual SVG selector
  await page.waitForSelector(planeSelector);

  console.log("SVG plane detected.");

  // Function to fetch plane's SVG transform attribute
  const getPlaneTransform = async () => {
    return await page.$eval(planeSelector, (plane) => {
      // Get the transform attribute or any relevant property
      const transform = plane.getAttribute('transform');
      return { transform };
    });
  };

  // Monitor the plane's animation and correlate with network traffic
  let isFlying = true;
  while (isFlying) {
    const { transform } = await getPlaneTransform();
    console.log(`Plane Transform: ${transform}`);

    // Determine stop condition (e.g., when animation ends or transform is null)
    if (!transform || transform.includes('scale(0)')) {
      console.log("Plane animation has ended or flown away.");
      isFlying = false;
    }

    // Sleep for a short duration
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await browser.close();
})

//WebSocket Monitoring Setup
const monitorWebSocket = async (page) => {
    const cdpSession = await page.target().createCDPSession();
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.setWebSocketFrameHandler', { enable: true });

    cdpSession.on('Network.webSocketFrameReceived', (event) => {
        const { response } = event;
        const data = response.payloadData;

        try {
            const parsedData = JSON.parse(data);
            log(`WebSocket Frame Received: ${JSON.stringify(parsedData, null, 2)}`);

            // Example: React to specific game events
            if (parsedData.multiplier && parsedData.multiplier >= 2.0) {
                log(`High multiplier detected: ${parsedData.multiplier}`);
            }
        } catch (err) {
            log(`Non-JSON WebSocket Frame: ${data}`);
        }
    });
};

//API Monitoring Setup
const monitorAPI = async (page) => {
    page.on('response', async (response) => {
        const url = response.url();

        // Monitor specific game-related API
        if (url.includes('aviator-next.spribegaming.com')) {
            try {
                const jsonResponse = await response.json();
                log(`API Response from ${url}: ${JSON.stringify(jsonResponse, null, 2)}`);

                // Example: Log and act on multiplier updates
                if (jsonResponse.multiplier) {
                    log(`Multiplier Update: ${jsonResponse.multiplier}`);
                }
            } catch (err) {
                log(`Error processing API response from ${url}: ${err.message}`);
            }
        }
    });

    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('aviator-next.spribegaming.com')) {
            log(`API Request Intercepted: ${url}`);
        }
    });
};

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const page = await browser.newPage();
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);

    // Login Workflow
    await navigateWithRetry(config.loginUrl, page);
    await page.type(config.selectors.usernameInput, process.env.MOZZARTUSERNAME);
    await page.type(config.selectors.passwordInput, process.env.MOZZARTPASSWORD);
    await page.click(config.selectors.submitButton);
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Navigate to the Aviator game
    await navigateWithRetry(config.url, page);

    // Switch to the game iframe
    const iframe = await switchToIframe(page, config.iframeSelector);

    // Start WebSocket and API monitoring
    await monitorWebSocket(page);
    await monitorAPI(page);

    let winCount = 0;

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
    })

// Adjusted calculateBetAmount with target multiplier calculation
function calculateBetAmount(currentBalance, winCount) {
    const strategy = Math.random() < config.strategyWeights.exponential
        ? 'exponential'
        : Math.random() < config.strategyWeights.fibonacci
        ? 'fibonacci'
        : 'bob';

    let bet, targetMultiplier;

    if (strategy === 'exponential') {
        bet = (currentBalance * config.betPercentage * config.growthFactor).toFixed(2);
        targetMultiplier = (bet * ((1 + Math.random()) * (2.5**Math.random()))); // Example: Increase base multiplier
        log(`Exponential strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    } else if (strategy === 'fibonacci') {
        const fibIndex = 0.1 * winCount % config.fibonacciSequence.length;
        bet = (currentBalance * config.fibonacciSequence[fibIndex]).toFixed(2);
        targetMultiplier = (bet * 1.15 * (1.4**(2%fibIndex))).toFixed(2); // Fibonacci scaling for multiplier
        log(`Fibonacci strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    } else {
        // Bob strategy
        const { betAmount, targetMultiplier: bobTargetMultiplier } = playBobStrategy(currentBalance, winCount);
        bet = betAmount.toFixed(2);
        targetMultiplier = bobTargetMultiplier.toFixed(2);
        log(`Bob strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    }

    // Apply the max bet limit
    bet = Math.min(bet, config.maxBetAmount).toFixed(2);
    log(`Final Bet Amount (after max limit applied): ${bet}`);

    return { bet, targetMultiplier };
}

// Bob strategy function
const playBobStrategy = (balance, winCount) => {
    const rounds = 23; // 23-round cycle
    let currentRound = winCount % rounds + 1;

    let betAmount, targetMultiplier;

    if (currentRound % rounds === 0) {
        // High-risk phase
        betAmount = 0.30 ; //
        targetMultiplier = 1.7 * betAmount;
    } else if ((currentRound % rounds) <= 4) {
        // Low-risk phase
        betAmount = 0.30; //
        targetMultiplier = betAmount * getRandomInRange(1.10, 1.45);
    } else {
        // Medium-risk phase
        betAmount = 0.30; //
        targetMultiplier = betAmount * getRandomInRange(1.9, 2.5);  // Adjusted multiplier range
    }

    return { betAmount, targetMultiplier };
};

// Helper Functions
const getRandomInRange = (min, max) => Math.random() * (min, max) + min;

// Example: Extract multiplier history
const multipliersExtracted = await frame.$$eval(config.selectors.multiplierHistory, elements =>
    elements.map(el => parseFloat(el.textContent.trim()))
);

// Save to a JSON or CSV file
fs.writeFileSync('game_data.json', JSON.stringify(multipliers, null, 2));


    // Betting Loop
    while (true) {
        try {
            await placeBet(iframe, winCount);
            winCount++; // Increment win count upon success
        } catch (err) {
            log(`Betting error: ${err.message}`);
            break; // Exit the loop on critical errors
        }

        // Add a short delay between bets
        await sleep(10000);
    }
})

// Function to extract game history
async function getGameHistory(iframe) {
    try {
      // Locate the result-history container
      const historyData = await page.evaluate(() => {
        const historyElement = document.querySelector('div.payout-block');
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
  
//const puppeteer = require('puppeteer');
//const fs = require('fs');

//const puppeteer = require('puppeteer');
//const fs = require('fs');
async function extractMultipliers() {

    const multipliers = await page.evaluate(() => {
        const historyElement = document.querySelector('.payouts-block');
        if (!historyElement) return [];
        return Array.from(historyElement.innerText.split('\n')).map(item => item.trim()).filter(item => item.endsWith('x'));
    });

    console.log('Extracted Multipliers:', multipliers);

    // Write the multipliers to a text file
    fs.writeFileSync('./multipliers.txt', multipliers.join('\n'), 'utf-8');
    console.log('Multipliers saved to multipliers.txt');

    // Extract game history
    const gameHistory = await getGameHistory(iframe);

    console.log('Game History:', gameHistory);
}

// Adjusted calculateBetAmount with target multiplier calculation
function calculateBetAmount(currentBalance, winCount) {
    const strategy = Math.random() < config.strategyWeights.exponential
        ? 'exponential'
        : Math.random() < config.strategyWeights.fibonacci
        ? 'fibonacci'
        : 'bob';

    let bet, targetMultiplier;

    if (strategy === 'exponential') {
        bet = (currentBalance * config.betPercentage * config.growthFactor).toFixed(2);
        targetMultiplier = (bet * ((1 + Math.random()) * (2.5**Math.random()))); // Example: Increase base multiplier
        log(`Exponential strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    } else if (strategy === 'fibonacci') {
        const fibIndex = 0.1 * winCount % config.fibonacciSequence.length;
        bet = (currentBalance * config.fibonacciSequence[fibIndex]).toFixed(2);
        targetMultiplier = (bet * 1.15 * (1.4**(2%fibIndex))).toFixed(2); // Fibonacci scaling for multiplier
        log(`Fibonacci strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    } else {
        // Bob strategy
        const { betAmount, targetMultiplier: bobTargetMultiplier } = playBobStrategy(currentBalance, winCount);
        bet = betAmount.toFixed(2);
        targetMultiplier = bobTargetMultiplier.toFixed(2);
        log(`Bob strategy chosen. Bet amount: ${bet}, Target multiplier: ${targetMultiplier}`);
    }

    // Apply the max bet limit
    bet = Math.min(bet, config.maxBetAmount).toFixed(2);
    log(`Final Bet Amount (after max limit applied): ${bet}`);

    return { bet, targetMultiplier };
}

/// Bob strategy function
const playBobStrategy = (balance, winCount) => {
    const rounds = 23; // 23-round cycle
    let currentRound = winCount % rounds + 1;

    let betAmount, targetMultiplier;

    if (currentRound % rounds === 0) {
        // High-risk phase
        betAmount = 0.50 ; //  
        targetMultiplier = 1.45 * betAmount;
    } else if ((currentRound % rounds) <= 4) {
        // Low-risk phase
        betAmount = 0.5; // 
        targetMultiplier = betAmount * getRandomInRange(1.13, 1.35);
    } else {
        // Medium-risk phase
        betAmount = 0.3; //
        targetMultiplier = betAmount * getRandomInRange(2, 2.5);
    }

    return { betAmount, targetMultiplier };
};

// Helper Functions
const getRandomInRange = (min, max) => Math.random() * (max - min) + min;

const playRound = async (page) => {
    try {
      // Step 1: Fetch balance and calculate bet amount
      const balance = await getBalance(page);
      const betAmount = calculateBetAmount(balance); // Based on your strategy
      const targetMultiplier = getTargetMultiplier(); // From your "Bob" strategy
  
      console.log(`Placing bet: ${betAmount}, Target Multiplier: ${targetMultiplier}`);
  
      // Step 2: Place the bet
      await placeBet(page, betAmount, targetMultiplier);
  
      // Step 3: Monitor the round and multiplier
      const roundStatus = await monitorMultiplier(page);
  
      // Step 4: Handle round end
      if (roundStatus === "round-ended") {
        console.log("Round ended. Evaluating outcome...");
  
        const updatedBalance = await getBalance(page);
  
        if (updatedBalance > balance) {
          console.log("Bet WON! New balance:", updatedBalance);
        } else {
          console.log("Bet LOST. New balance:", updatedBalance);
        }
      }
  
      // Step 5: Delay and prepare for the next round
      await sleep(5000); // Adjust as necessary to mimic human timing
    } catch (error) {
      console.error("Error during round:", error);
    }
  };

const placeBet = async (iframe, winCount) => {
    try {
        // Retrieve current balance
        const balanceText = await retry(() =>
            iframe.$eval(config.selectors.balance, el => el.innerText.trim())
        );
        const currentBalance = parseFloat(balanceText.replace(/[^0-9.]/g, ''));

        if (currentBalance < config.minBetAmount) {
            log('Insufficient balance to place a bet.');
            return;
        }

        const { bet, targetMultiplier } = calculateBetAmount(currentBalance, winCount);

        // Focus on the bet input field
        const betInputElement = await iframe.$(config.selectors.betInput);
        if (!betInputElement) throw new Error('Bet input field not found');

        await betInputElement.click();

        // Clear the input field (simulate backspaces)
        await iframe.evaluate(input => {
            input.value = ''; // Directly clear the value of the input field
        }, betInputElement);
        await sleep(200);

        // Enter bet amount
        await betInputElement.type(bet.toString(), { delay: 100 });
        log(`Bet amount entered: ${bet}`);
        await sleep(100);

         // Place the bet
        const betButtonElement = await iframe.$(config.selectors.betButton);
        if (!betButtonElement) throw new Error('Bet button not found');

        await retry(() => betButtonElement.click());
        log('Bet placed.');
        
        const monitorMultiplier = async (page) => {
            let lastMultiplier = 0;
            let stableCounter = 0;
          
            while (true) {
              // Fetch the current multiplier
              const currentMultiplier = await getCurrentMultiplier(page);
          
              if (currentMultiplier > lastMultiplier) {
                // Multiplier is increasing
                lastMultiplier = currentMultiplier;
                stableCounter = 0; // Reset the counter
              } else if (currentMultiplier === lastMultiplier) {
                // Multiplier is stable
                stableCounter++;
          
                if (stableCounter > 3) { // Example: Adjust this threshold based on game behavior
                  console.log("Multiplier has stopped increasing. Round likely ended.");
                  return "round-ended";
                }
              } else {
                // Multiplier decreased abruptly
                console.log("Round abruptly ended. Bet lost or game stopped.");
                return "round-ended";
              }
          
              await sleep(500); // Small delay between checks
            }
          };
          
          const getCurrentMultiplier = async (page) => {
            return await page.evaluate(() => {
              const multiplierElement = document.querySelector('.multiplier-selector'); // Replace with actual selector
              return multiplierElement ? parseFloat(multiplierElement.innerText) : 0;
            });
          };
        
        // Monitor for cashout
        try {
            await tryCashout(iframe, targetMultiplier);
        } catch (error) {
            log(`Error during cashout process: ${error.message}`);
        }
    } catch (error) {
        log(`Error during betting process: ${error.message}`);
    }
};

// Refined tryCashout function
const tryCashout = async (iframe, targetMultiplier, retries = 50, checkInterval = 900) => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            const multiplierText = await iframe.$eval('label.amount', el => el.innerText.trim());
            const currentMultiplier = parseFloat(multiplierText);

            if (!isNaN(currentMultiplier)) {
                log(`Current multiplier: ${currentMultiplier}, ${targetMultiplier} > currentMultiplier ? 'waiting' : 'cashing out'}`);

                if (currentMultiplier >= targetMultiplier) {
                    log(`Target multiplier ${targetMultiplier} reached. Attempting to cash out.`);
                    await iframe.click(config.selectors.cashoutButton);
                    log('Cashed out successfully.');
                    return; // Exit after success
                }
            }
        } catch (error) {
            log(`Attempt ${attempt + 1}: Error fetching multiplier - ${error.message}`);
        }

        // Increment attempt counter and wait before retrying
        attempt++;
        if (attempt < retries) await sleep(checkInterval);
    }

    throw new Error(`Failed to cash out after ${retries} attempts.`);
};

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const page = await browser.newPage();

    // Set Stealth User Agent
    const userAgent = new UserAgent().toString();
    await page.setUserAgent(userAgent);

    // Login
    await navigateWithRetry(config.loginUrl, page);
    await page.type(config.selectors.usernameInput, process.env.MOZZARTUSERNAME);
    await page.type(config.selectors.passwordInput, process.env.MOZZARTPASSWORD);
    await page.click(config.selectors.submitButton);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    log('Logged in successfully.');

    // Navigate to Aviator game
    await navigateWithRetry(config.url, page);
    await page.waitForSelector(config.selectors.aviatorGameGrid, { visible: true });
    await retry(() => page.click(config.selectors.aviatorGameGrid, { clickCount: 2 }));
    await page.waitForSelector(config.selectors.playNowButton, { visible: true });
    await page.click(config.selectors.playNowButton);
    log('Aviator game loaded.');

    // Switch to game iframe
    const iframe = await switchToIframe(page, config.iframeSelector);

    //Live round tracking
    const trackLiveRounds = async (iframe) => {
        let roundCount = 0;
    
        while (true) {
            try {
                // Wait for the "Round Start" indicator
                log(`Waiting for the next round to start...`);
                await retry(async () => {
                    const isRoundActive = await iframe.evaluate(() => {
                        const roundElement = document.querySelector('.dom-container'); // Replace with the actual selector
                        return roundElement && roundElement.innerText.includes('WAITING FOR NEXT ROUND');
                    });
                    if (!isRoundActive) throw new Error('Round not active yet.');
                });
    
                // Log round start
                roundCount++;
                log(`Round ${roundCount} started.`);
    
                // Monitor round progress
                let multiplier = 'Unknown';
                await retry(async () => {
                    multiplier = await iframe.evaluate(() => {
                        const multiplierElement = document.querySelector('.'); // Replace with the actual selector
                        return multiplierElement ? multiplierElement.innerText.trim() : 'Unknown';
                    });
                    if (multiplier === 'Unknown') throw new Error('Multiplier not available yet.');
                });
    
                log(`Round ${roundCount} in progress. Current multiplier: ${multiplier}`);
    
                // Wait for the round to end
                log(`Waiting for round ${roundCount} to end...`);
                await retry(async () => {
                    const isRoundOver = await iframe.evaluate(() => {
                        const roundElement = document.querySelector('.dom-container'); // Replace with the actual selector
                        return roundElement && roundElement.innerText.includes('Waiting for Next Round');
                    });
                    if (!isRoundOver) throw new Error('Round not over yet.');
                });
    
                // Log round end
                log(`Round ${roundCount} ended. Final multiplier: ${multiplier}`);
    
                // Track memory usage after each round
                trackMemoryUsage();
    
                // Optional sleep before next round
                await sleep(2000);
    
            } catch (error) {
                log(`Error tracking live round: ${error.message}`);
            }
        }
    };
    
    // Betting loop
    let winCount = 0;
    while (true) {
        try {
            await placeBet(iframe, winCount);
            winCount++;
        } catch (error) {
            log(`Error during betting process: ${error.message}`);
        }
    }

    // Close the browser
    
    await browser.close();
})();
