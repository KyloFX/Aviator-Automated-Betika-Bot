import json
import os
from statistics import mean, median
from typing import List
from time import sleep
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Configuration
JSON_FILE_PATH = "./game_history.json"
CASHOUT_FILE_PATH = "./cashout_points.txt"
IFRAME_SELECTOR = "iframe"
HISTORY_SELECTOR = ".result-history"
APP_BUBBLE_SELECTOR = ".app-bubble-multiplier"

# Selenium WebDriver or Puppeteer Connection
def setup_driver(debugger_address=None):
    options = webdriver.ChromeOptions()
    if debugger_address:
        options.debugger_address = debugger_address
    else:
        options.add_argument("--start-maximized")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# Fetch game data from iframe
def fetch_game_data(driver):
    try:
        # Switch to iframe
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, IFRAME_SELECTOR)))
        iframe = driver.find_element(By.CSS_SELECTOR, IFRAME_SELECTOR)
        driver.switch_to.frame(iframe)
        
        # Fetch history data
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, HISTORY_SELECTOR)))
        history_element = driver.find_element(By.CSS_SELECTOR, HISTORY_SELECTOR)
        history_data = [
            float(item.replace("x", "")) for item in history_element.text.split("\n") if item.endswith("x")
        ]
        
        # Fetch bubble multipliers
        bubble_elements = driver.find_elements(By.CSS_SELECTOR, APP_BUBBLE_SELECTOR)
        bubble_data = [
            float(item.text.replace("x", "")) for item in bubble_elements if "x" in item.text
        ]
        
        return {"history": history_data, "bubbles": bubble_data}
    except Exception as e:
        print(f"Error fetching game data: {e}")
        return {"history": [], "bubbles": []}

# Update JSON file
def update_json_file(data):
    try:
        if os.path.exists(JSON_FILE_PATH):
            with open(JSON_FILE_PATH, "r") as file:
                existing_data = json.load(file)
        else:
            existing_data = {"rounds": []}
        
        # Merge new data
        for round_value in data["history"]:
            if round_value not in existing_data["rounds"]:
                existing_data["rounds"].append(round_value)
        
        with open(JSON_FILE_PATH, "w") as file:
            json.dump(existing_data, file, indent=4)
        print("Game history updated.")
    except Exception as e:
        print(f"Error updating JSON file: {e}")

# Calculate mean and median
def calculate_statistics(data: List[float]):
    if not data:
        return {"mean": None, "median": None}
    return {"mean": round(mean(data), 2), "median": round(median(data), 2)}

# Save cashout points
def save_cashout_points(stats):
    try:
        with open(CASHOUT_FILE_PATH, "w") as file:
            file.write(f"Mean: {stats['mean']}\nMedian: {stats['median']}\n")
        print("Cashout points saved.")
    except Exception as e:
        print(f"Error saving cashout points: {e}")

# Main loop
def main(debugger_address=None):
    driver = setup_driver(debugger_address)
    if debugger_address:
        print("Connected to Puppeteer browser.")
    else:
        driver.get("https://aviator-next.spribegaming.com/")
    
    try:
        while True:
            game_data = fetch_game_data(driver)
            print(f"Fetched Game Data: {game_data}")

            update_json_file(game_data)

            # Load current rounds for stats
            with open(JSON_FILE_PATH, "r") as file:
                current_data = json.load(file)["rounds"]

            stats = calculate_statistics(current_data)
            print(f"Calculated Mean: {stats['mean']}, Median: {stats['median']}")

            save_cashout_points(stats)

            # Pause before fetching new data
            sleep(10)  # Adjust interval based on game rounds
    except KeyboardInterrupt:
        print("Stopping script.")
    finally:
        driver.quit()

if __name__ == "__main__":
    # Use Puppeteer debugging address if needed
    DEBUGGER_ADDRESS = "127.0.0.1:9222"  # Set to None to run standalone
    main(debugger_address=DEBUGGER_ADDRESS)
