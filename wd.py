import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class TestHandler(FileSystemEventHandler):
    def on_modified(self, event):
        print(f"Detected file modification: {event.src_path}")

file_path = 'C:/Users/Administrator/Documents/GitHub/Aviator-Automated-Betika-Bot/websocket_logs/raw_websocket_messages_client.txt'

event_handler = TestHandler()
observer = Observer()
observer.schedule(event_handler, path=file_path, recursive=False)
observer.start()

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    observer.stop()

observer.join()
