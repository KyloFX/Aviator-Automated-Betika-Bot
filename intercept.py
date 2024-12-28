from mitmproxy import http, ctx
from mitmproxy.websocket import WebSocketMessage
import json


# Function to handle HTTP responses
def response(flow: http.HTTPFlow) -> None:
    if "aviator-next.spribegaming.com" in flow.request.host:
        ctx.log.info(f"HTTP Request to {flow.request.url}")
        if "rounds" in flow.request.url or "results" in flow.request.url:
            try:
                # Process the response data
                data = json.loads(flow.response.text)
                ctx.log.info(f"Intercepted data: {json.dumps(data, indent=2)}")

                # Example: Log server seed and multiplier if available
                if "seed" in data:
                    server_seed = data.get("seed")
                    ctx.log.info(f"Server Seed: {server_seed}")
                if "multiplier" in data:
                    multiplier = data.get("multiplier")
                    ctx.log.info(f"Multiplier: {multiplier}")
            except json.JSONDecodeError:
                ctx.log.error("Failed to decode JSON response.")

# Function to handle WebSocket messages
def websocket_message(flow: http.HTTPFlow, message: WebSocketMessage) -> None:
    if "aviator-next.spribegaming.com" in flow.server_conn.address:
        if message.from_server:  # Check if the message is from the server
            try:
                # Decode the WebSocket message content
                data = json.loads(message.content)
                ctx.log.info(f"WebSocket Message: {json.dumps(data, indent=2)}")

                # Log multiplier or other relevant fields
                if "multiplier" in data:
                    multiplier = data["multiplier"]
                    ctx.log.info(f"Multiplier: {multiplier}")
            except json.JSONDecodeError:
                ctx.log.error("Failed to parse WebSocket message.")

# Optional: Handle TLS handshake errors
def tls_failed(flow: http.HTTPFlow):
    ctx.log.error(f"TLS handshake failed for {flow.server_conn.address}: {flow.error}")
