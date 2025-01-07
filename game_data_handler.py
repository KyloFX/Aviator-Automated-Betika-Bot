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


# Configuration
JSON_FILE_PATH = "./game_history.json"
IFRAME_SELECTOR = "iframe"
HISTORY_SELECTOR = ".result-history"
APP_BUBBLE_SELECTOR = ".app-bubble-multiplier"

# Selenium WebDriver setup
def setup_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    driver = webdriver.Chrome(options=options)
    return driver

# Fetch game history from iframe
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
            float(item.replace("x", ""))
            for item in history_element.text.split("\n")
            if item.endswith("x")
        ]
        
        # Fetch app bubble multipliers
        bubble_elements = driver.find_elements(By.CSS_SELECTOR, APP_BUBBLE_SELECTOR)
        bubble_data = [
            float(item.text.replace("x", ""))
            for item in bubble_elements if "x" in item.text
        ]
        
        return {"history": history_data, "bubbles": bubble_data}
    except Exception as e:
        print(f"Error fetching game data: {e}")
        return {"history": [], "bubbles": []}

# Update JSON file
def update_json_file(data):
    if os.path.exists(JSON_FILE_PATH):
        with open(JSON_FILE_PATH, "r") as file:
            existing_data = json.load(file)
    else:
        existing_data = {"rounds": []}

    # Merge new rounds
    for round_value in data["history"]:
        if round_value not in existing_data["rounds"]:
            existing_data["rounds"].append(round_value)

    # Save updated data
    with open(JSON_FILE_PATH, "w") as file:
        json.dump(existing_data, file, indent=4)
    print("Game history updated.")

# Calculate mean and median
def calculate_statistics(data: List[float]):
    if not data:
        return {"mean": None, "median": None}
    return {
        "mean": round(mean(data), 2),
        "median": round(median(data), 2),
    }

# Main loop
def main():
    driver = setup_driver()
    driver.get("https://aviator-next.spribegaming.com/")
    
    try:
        while True:
            game_data = fetch_game_data(driver)
            print(f"Fetched Game Data: {game_data}")

            update_json_file(game_data)

            with open(JSON_FILE_PATH, "r") as file:
                current_data = json.load(file)["rounds"]

            stats = calculate_statistics(current_data)
            print(f"Calculated Mean: {stats['mean']}, Median: {stats['median']}")

            # Pass these values to your Mozzart script
            # Here, we simulate this by writing them to a text file
            with open("./cashout_points.txt", "w") as file:
                file.write(f"Mean: {stats['mean']}\nMedian: {stats['median']}\n")
            print("Cashout points saved.")

            # Pause before fetching new data
            sleep(10)  # Adjust this interval based on game rounds

    except KeyboardInterrupt:
        print("Stopping script.")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
