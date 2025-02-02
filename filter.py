import json
import time
import requests
from mitmproxy import http
from playwright.sync_api import sync_playwright

# Configuration
CONFIG = {
    "BETTING_LOGIC_URL": "http://127.0.0.1:5000/betting_logic",  # Updated API URL
    "AVIATOR_GAME_URL": "https://www.betting.co.zw/aviator"  # Corrected game URL
}


# Function to send validated game data to betting logic
def send_to_betting_logic(data):
    try:
        response = requests.post(CONFIG["BETTING_LOGIC_URL"], json=data)
        print(f"Sent to betting logic: {data}, Response: {response.status_code}")
    except Exception as e:
        print(f"Error sending data: {e}")


# Function to scrape the DOM for game validation
def scrape_dom_for_validation():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("ws://localhost:9222")  # Attach to existing session
        context = browser.contexts[0]
        page = context.pages[0]

        page.goto(CONFIG["AVIATOR_GAME_URL"])
        page.wait_for_load_state("networkidle")  # Wait for page load

        # Updated selectors
        dom_data = {
            "round_id": page.locator("span:has-text('Round')").nth(0).inner_text(),
            "multiplier": page.locator("div.bubble-multiplier").inner_text(),
            "result": page.locator("span.result").inner_text(),
            "time": page.locator("div.time").inner_text(),
        }
        return dom_data


# Function to validate and augment intercepted game data
def validate_and_augment_data(game_data):
    try:
        dom_data = scrape_dom_for_validation()
        if dom_data["round_id"] == game_data.get("round_id"):
            game_data.update(dom_data)  # Merge DOM data
            return game_data
        else:
            print("Round ID mismatch. Skipping this entry.")
            return None
    except Exception as e:
        print(f"Error in validation: {e}")
        return None


# Mitmproxy HTTP request handler
def request(flow: http.HTTPFlow):
    if "aviator" in flow.request.url:
        print(f"Intercepted request: {flow.request.url}")


# Mitmproxy HTTP response handler
def response(flow: http.HTTPFlow):
    if "aviator" in flow.request.url:
        try:
            game_data = json.loads(flow.response.text)
            validated_data = validate_and_augment_data(game_data)
            if validated_data:
                send_to_betting_logic(validated_data)
        except Exception as e:
            print(f"Error processing response: {e}")
