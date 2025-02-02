import json
from mitmproxy import ctx, websocket
# Import WebSocketData class
from mitmproxy.websocket import WebSocketData   

def websocket_message(flow: WebSocketData):
    # Handle the WebSocket message here
    print(flow.message)
# Specify the target WebSocket endpoint
TARGET_ENDPOINT = "af-south-1-game1.spribegaming.com:443/BlueBox/websocket"

# List to store WebSocket traffic
filtered_traffic = []

def websocket_message(flow: websocket.WebSocketData):
    """
    Intercept WebSocket messages and filter based on the target endpoint.
    """
    if flow.websocket and TARGET_ENDPOINT in flow.request.host:
        for message in flow.messages:
            if message.from_client:  # Client-to-server message
                filtered_traffic.append({
                    "type": "websocket",
                    "direction": "client_to_server",
                    "time": message.timestamp,
                    "data": message.content.decode("utf-8", errors="ignore")  # Decode safely
                })
            else:  # Server-to-client message
                filtered_traffic.append({
                    "type": "websocket",
                    "direction": "server_to_client",
                    "time": message.timestamp,
                    "data": message.content.decode("utf-8", errors="ignore")  # Decode safely
                })

def done():
    """
    Save captured WebSocket traffic to a JSON file when mitmproxy exits.
    """
    with open("traffic.json", "w") as f:
        json.dump(filtered_traffic, f, indent=4)
    ctx.log.info(f"Filtered WebSocket traffic saved to traffic.json (focused on {TARGET_ENDPOINT})")
