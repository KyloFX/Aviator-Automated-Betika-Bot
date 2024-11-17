const mysql = require('mysql');

// const connection = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'aviatorBot'
// });

// connection.connect((err) => {
//   if (err) {
//     console.error('Error connecting to database:', err);
//     return;
//   }

//   console.log('Connected to database!');
// });

let previousBubbleValue = null;

// const saveToDatabase = (appBubbleValue) => {
//   if (appBubbleValue !== previousBubbleValue) {
//     const query = `INSERT INTO bubble_data (value) VALUES (${appBubbleValue})`;
  
//     connection.query(query, (err, result) => {
//       if (err) {
//         console.error('Error saving data to database:', err);
//         return;
//       }
  
//       console.log('Data saved to database!');
//     });
  
//     previousBubbleValue = appBubbleValue;
//   } else {
//     console.log('Loading changes...');
//   }
// };


const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const username = process.env.MOZZARTUSERNAME;
const password = process.env.MOZZARTPASSWORD;

const gamePageUrl = 'https://betting.co.zw/virtual/fast-games';  // Game URL (update as per your case)
const loginUrl = 'https://betting.co.zw/authentication/login'; // Login URL

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry helper for unstable actions
const retry = async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`[Retry ${i + 1}] Error:`, error.message);
            if (i < retries - 1) await sleep(delay);
        }
    }
    throw new Error('Failed after maximum retries.');
};

(async () => {
  page.setDefaultNavigationTimeout(60000); // 60 seconds
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);  // 60 seconds for navigation timeout

    console.log(`[${new Date().toISOString()}] Navigating to ${gamePageUrl}`);
    await page.goto(gamePageUrl);

    // Wait for the game selector to appear on the page
    const isGameLive = await page.$(gameSelector);  // Check if the game element exists

    if (isGameLive) {
        console.log(`[${new Date().toISOString()}] Game is already live. Proceeding with betting logic.`);
        await startBettingLogic(page);
    } else {
        console.log(`[${new Date().toISOString()}] Game not found, navigating to the game page...`);
        // Navigate to the game page if it's not already live
        await page.goto(gamePageUrl);
        await page.waitForSelector(gameSelector, { visible: true, timeout: 30000 });
        console.log(`[${new Date().toISOString()}] Game found, proceeding with betting logic.`);
        await startBettingLogic(page);
    }

    // Retain the browser open to observe the game (you can uncomment to close after some time)
    // await browser.close();
})();

const startBettingLogic = async (page) => {
    console.log(`[${new Date().toISOString()}] Starting betting logic...`);

            
                previousAppBubbleValue = appBubbleValue;
    // Wait for the play button to appear and click it
    await page.waitForSelector(playButtonSelector, { visible: true });
    await page.click(playButtonSelector);
    console.log(`[${new Date().toISOString()}] Clicked 'Play Now' button.`);

    // Additional betting actions can be added here
    // For example, wait for the game event, place a bet, etc.

    // Example of waiting for the game to settle before placing another bet
    await sleep(10000);  // Wait for 10 seconds before next action (you can modify timing based on the game)
    console.log(`[${new Date().toISOString()}] Betting action completed.`);
};
