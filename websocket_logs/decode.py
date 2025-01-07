import json
import time

# Define the keywords to filter
keywords = ["round ID", "player N1", "player N2", "server seed", "endpoint", "stop", "cashout", "multiplier", "game state"]

# Function to decode and filter messages
def decode_and_filter_messages(raw_messages):
    decoded_messages = [msg.encode('utf-8').decode('unicode_escape') for msg in raw_messages]
    for i, msg in enumerate(decoded_messages):
        if "game state" in msg:
            print(f"Game state found in message {i+1}:\n{msg}\n")
        if "roundId" in msg:
            print(f"round Id found in message {i+1}:\n{msg}\n")
        if "roundMaxMultiplier" in msg:
            print(f"roundMaxMultiplier found in message {i+1}:\n{msg}\n")

# Function to read new messages from the file
def read_new_messages(file_path, last_position):
    with open(file_path, 'r', encoding='utf-8') as file:
        file.seek(last_position)
        new_data = file.read()
        new_messages = new_data.split('\n}\n{')
        new_messages = [msg + '}' if not msg.endswith('}') else msg for msg in new_messages]
        new_messages = ['{' + msg if not msg.startswith('{') else msg for msg in new_messages]
        return new_messages, file.tell()

# Main function to run the script continuously
def main():
    file_path = 'C:/Users/Administrator/Documents/GitHub/Aviator-Automated-Betika-Bot/websocket_logs/raw_websocket_messages_client.txt'
    last_position = 0

    while True:
        try:
            new_messages, last_position = read_new_messages(file_path, last_position)
            decode_and_filter_messages(new_messages)
        except Exception as e:
            print(f"Error: {e}")

        time.sleep(1)  # Adjust the sleep time as needed

if __name__ == "__main__":
    main()