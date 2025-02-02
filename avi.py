from mitmproxy import http, ctx
import json
import os

# Directory to save logs
LOG_DIR = "websocket_logs"

# Ensure the log directory exists
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Function to save data to a JSON file
def save_to_file(filename, data):
    filepath = os.path.join(LOG_DIR, filename)
    try:
        if isinstance(data, dict):
            data_to_save = json.dumps(data, indent=2)
        else:
            data_to_save = str(data)
        with open(filepath, "a") as file:  # Append mode
            file.write(data_to_save + "\n")
        ctx.log.info(f"Data successfully saved to {filepath}")
    except Exception as e:
        ctx.log.error(f"Failed to save data to {filepath}: {str(e)}")

# HTTP Response Interception
def response(flow: http.HTTPFlow) -> None:
    if "af-south-1-game1.spribegaming.com:443/BlueBox/websocket" in flow.request.host:
        ctx.log.info(f"HTTP Request to {flow.request.url}")
        if "rounds" in flow.request.url or "results" in flow.request.url:
            try:
                # Process the response data
                data = json.loads(flow.response.text)
                ctx.log.info(f"Intercepted HTTP response data: {json.dumps(data, indent=2)}")

                # Save to file
                save_to_file("http_responses.json", data)

            except json.JSONDecodeError:
                ctx.log.error("Failed to decode JSON response.")
            except Exception as e:
                ctx.log.error(f"Unexpected error: {str(e)}")

# WebSocket Message Interception
def websocket_message(flow: http.HTTPFlow) -> None:
    if "af-south-1-game1.spribegaming.com:443/BlueBox/websocket" in flow.request.host:
        for message in flow.websocket.messages:
            if message.from_server:  # Check if the message is from the server
                try:
                    # Decode the WebSocket message content
                    data = json.loads(message.content.decode('utf-8', errors='ignore'))
                    ctx.log.info(f"Intercepted WebSocket message: {json.dumps(data, indent=2)}")

                    # Save to file
                    save_to_file("websocket_messages.json", data)

                    # Save raw WebSocket message
                    save_to_file("raw_websocket_messages.txt", {"raw_content": message.content.decode('utf-8', errors='ignore')})

                except json.JSONDecodeError:
                    ctx.log.error(f"Failed to parse WebSocket message content: {message.content}")
                except Exception as e:
                    ctx.log.error(f"Unexpected error while processing WebSocket message: {str(e)}")

# Optional: Handle TLS handshake errors
def tls_failed(flow: http.HTTPFlow):
    ctx.log.error(f"TLS handshake failed for {flow.server_conn.address}: {flow.error}")
