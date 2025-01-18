import json
import logging
import os
import base64
from threading import Timer
from mitmproxy import http

# Configure logging for debugging
logging.basicConfig(
    filename="websocket_debug.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

# Specify the WebSocket endpoint
TARGET_ENDPOINT = "af-south-1-game1.spribegaming.com/BlueBox/websocket"

# List to store WebSocket traffic
filtered_traffic = []

# File to save WebSocket traffic
TRAFFIC_FILE = "traffic.json"

# Save interval (in seconds)
SAVE_INTERVAL = 10


def save_traffic_periodically():
    """
    Saves the filtered traffic to a JSON file periodically.
    """
    try:
        with open(TRAFFIC_FILE, "w") as f:
            json.dump(filtered_traffic, f, indent=4)
        logging.info(f"Traffic saved periodically to {TRAFFIC_FILE}")
    except Exception as e:
        logging.error(f"Error saving traffic: {e}")
    # Schedule the next save
    Timer(SAVE_INTERVAL, save_traffic_periodically).start()


def detect_message_type(content):
    """
    Detect and decode WebSocket message types.
    """
    try:
        # Check for JSON
        return json.loads(content), "json"
    except json.JSONDecodeError:
        pass

    # Check for base64-encoded data
    try:
        decoded_data = base64.b64decode(content).decode("utf-8")
        return decoded_data, "base64"
    except Exception:
        pass

    # Check for hexadecimal
    try:
        decoded_hex = bytes.fromhex(content).decode("utf-8")
        return decoded_hex, "hex"
    except ValueError:
        pass

    # If all else fails, return raw content
    return content, "raw"


def websocket_message(flow: http.HTTPFlow):
    """
    Handles WebSocket messages within an HTTP flow.
    """
    if flow.websocket and TARGET_ENDPOINT in flow.request.url:
        for message in flow.websocket.messages:
            direction = "client_to_server" if message.from_client else "server_to_client"
            try:
                # Decode and identify message type
                content, content_type = detect_message_type(message.content.decode("utf-8", errors="ignore"))
                filtered_traffic.append({
                    "type": "websocket",
                    "direction": direction,
                    "time": message.timestamp,
                    "content_type": content_type,
                    "data": content,
                })
                logging.info(f"Captured {content_type} message: {content}")
            except Exception as e:
                logging.error(f"Error processing message: {e}")


def websocket_end(flow: http.HTTPFlow):
    """
    Handles the end of a WebSocket connection.
    """
    if flow.websocket and TARGET_ENDPOINT in flow.request.url:
        logging.info(f"WebSocket connection to {flow.request.url} closed.")
        try:
            with open(TRAFFIC_FILE, "w") as f:
                json.dump(filtered_traffic, f, indent=4)
            logging.info(f"Final traffic saved to {TRAFFIC_FILE}")
        except Exception as e:
            logging.error(f"Error saving final traffic: {e}")


# Start the periodic save process
save_traffic_periodically()
