from flask import Flask, request, jsonify
from playwright.sync_api import sync_playwright
import time

app = Flask(__name__)

# Configuration for Mozzart betting
CONFIG = {
    "MOZZART_URL": "https://www.betting.co.zw/aviator",
    "BET_AMOUNT": 5,  # Set your betting amount
    "CASHOUT_MULTIPLIER": 2.0,  # Adaptive cashout threshold
}

# Global Playwright variable
playwright = None

def start_playwright():
    """Starts Playwright and connects to an existing browser session or launches a new one."""
    global playwright
    playwright = sync_playwright().start()
    
    try:
        browser = playwright.chromium.connect_over_cdp("ws://localhost:9222")
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page = context.pages[0] if context.pages else context.new_page()
        print("✅ Connected to existing Chrome session.")
        return page
    except Exception as e:
        print(f"❌ Could not connect to Chrome Debugger. Error: {e}")
        print("⏳ Launching a new browser session...")
        return launch_new_browser()

def launch_new_browser():
    """Launches a new Chrome browser with remote debugging enabled."""
    browser = playwright.chromium.launch(headless=False, args=[
        "--remote-debugging-port=9222",
        "--user-data-dir=C:\\Users\\Administrator\\chrome-profile"
    ])
    context = browser.new_context()
    page = context.new_page()
    page.goto(CONFIG["MOZZART_URL"])
    print("🌍 New browser session launched.")
    return page

@app.route("/betting_logic", methods=["POST"])
def betting_logic():
    """Handles betting decisions based on game data."""
    page = start_playwright()  # Ensure Playwright is running
    
    try:
        game_data = request.json  # Receive game data

        round_id = game_data.get("round_id")
        multiplier = float(game_data.get("multiplier", 0))

        print(f"🔹 Processing round {round_id} with multiplier {multiplier}")

        # Adaptive Strategy: Adjust cashout based on history
        if multiplier < CONFIG["CASHOUT_MULTIPLIER"]:
            place_bet(page)
        else:
            cashout(page)

        return jsonify({"status": "success", "message": "Bet processed"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def place_bet(page):
    """Clicks the 'Place Bet' button on Mozzart's Aviator game."""
    try:
        bet_input = page.locator("input.font-weight-bold")  # Bet amount field
        bet_button = page.locator("button.btn.btn-success.bet.ng-star-inserted")  # Place Bet Button

        bet_input.fill(str(CONFIG["BET_AMOUNT"]))  # Enter bet amount
        bet_button.click()  # Click bet button

        print("✅ Placed Bet")
    except Exception as e:
        print(f"❌ Error placing bet: {e}")

def cashout(page):
    """Clicks the 'Cash Out' button on Mozzart's Aviator game."""
    try:
        cashout_button = page.locator("button.btn.btn-warning.cashout.ng-star-inserted")  # Cashout Button
        cashout_button.click()  # Click cashout

        print("💰 Cashed Out")
    except Exception as e:
        print(f"❌ Error cashing out: {e}")

if __name__ == "__main__":
    app.run(port=5000, debug=True)
