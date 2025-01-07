import json
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Define the keywords to filter
keywords = ["game state", "roundId", "roundMaxMultiplier"]

# Function to decode and filter messages
def decode_and_filter_messages(raw_messages):
    for i, raw_message in enumerate(raw_messages):
        try:
            # Decode the raw content
            decoded_message = raw_message.encode('utf-8').decode('unicode_escape')
            # Check for specific keywords and log matches
            for keyword in keywords:
                if keyword in decoded_message:
                    print(f"{keyword} found in message {i+1}:\n{decoded_message}\n")
        except Exception as e:
            print(f"Error decoding message {i+1}: {e}")

# Function to read new messages from the file
def read_new_messages(file_path, last_position):
    with open(file_path, 'r', encoding='utf-8') as file:
        file.seek(last_position)
        new_data = file.read()
        if not new_data.strip():
            return [], file.tell()  # No new data
        new_messages = new_data.split('\n}\n{')
        # Ensure JSON consistency for parsing
        new_messages = [msg + '}' if not msg.endswith('}') else msg for msg in new_messages]
        new_messages = ['{' + msg if not msg.startswith('{') else msg for msg in new_messages]
        return new_messages, file.tell()

# Custom event handler for file changes
class FileChangeHandler(FileSystemEventHandler):
    def __init__(self, file_path):
        self.file_path = file_path
        self.last_position = 0

    def on_modified(self, event):
        if event.src_path == self.file_path:
            try:
                new_messages, self.last_position = read_new_messages(self.file_path, self.last_position)
                if new_messages:
                    decode_and_filter_messages(new_messages)
            except Exception as e:
                print(f"Error processing file changes: {e}")

# Main function to monitor the file using watchdog
def main():
    file_path = 'C:/Users/Administrator/Documents/GitHub/Aviator-Automated-Betika-Bot/websocket_logs/raw_websocket_messages_client.txt'

    # Set up Watchdog observer
    event_handler = FileChangeHandler(file_path)
    observer = Observer()
    observer.schedule(event_handler, path=file_path.rsplit('/', 1)[0], recursive=False)

    print(f"Monitoring file: {file_path}")
    observer.start()

    try:
        while True:
            time.sleep(1)  # Keep the script running
    except KeyboardInterrupt:
        print("Stopping file monitor...")
        observer.stop()
    observer.join()

if __name__ == "__main__":
    main()
