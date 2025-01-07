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
        if isinstance(data, (dict, list)):
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
    if "af-south-1-game1.spribegaming.com" in flow.request.host:
        ctx.log.info(f"HTTP Request to {flow.request.url}")
        try:
            data = json.loads(flow.response.text)
            ctx.log.info(f"Intercepted HTTP response data: {json.dumps(data, indent=2)}")
            save_to_file("http_responses.json", data)
        except json.JSONDecodeError:
            ctx.log.warning(f"Failed to decode HTTP response as JSON: {flow.response.text[:200]}")
            save_to_file("raw_http_responses.txt", flow.response.text)
        except Exception as e:
            ctx.log.error(f"Unexpected error while handling HTTP response: {str(e)}")

# WebSocket Message Interception
def websocket_message(flow: http.HTTPFlow) -> None:
    if "af-south-1-game1.spribegaming.com" in flow.request.host:
        for message in flow.websocket.messages:
            origin = "server" if message.from_state == "server" else "client"
            try:
                content = message.content.decode("utf-8", errors="ignore")
                ctx.log.info(f"Intercepted WebSocket message from {origin}: {content}")
                
                # Attempt to parse as JSON
                try:
                    data = json.loads(content)
                    save_to_file(f"websocket_messages_{origin}.json", data)
                except json.JSONDecodeError:
                    save_to_file(f"raw_websocket_messages_{origin}.txt", {"raw_content": content})
            except Exception as e:
                ctx.log.error(f"Error processing WebSocket message: {str(e)}")
