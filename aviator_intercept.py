# Import necessary modules from Mitmproxy
from mitmproxy import http
from mitmproxy import websocket
from mitmproxy import ctx
import json

# Function to handle HTTP responses
def response(flow: http.HTTPFlow) -> None:
    # Check if the request is to the Aviator server
    if "aviator-next.spribegaming.com" in flow.request.host:
        # Log the endpoint and the response
        ctx.log.info(f"Intercepted {flow.request.method} {flow.request.url}")

        # Process the data for relevant endpoints
        if "rounds" in flow.request.url or "results" in flow.request.url:
            try:
                # Parse the response as JSON
                data = json.loads(flow.response.text)

                # Check for server seed or multiplier
                if "seed" in data:
                    server_seed = data.get("seed")
                    ctx.log.info(f"Server Seed: {server_seed}")

                if "multiplier" in data:
                    multiplier = data.get("multiplier")
                    ctx.log.info(f"Multiplier: {multiplier}")
                
                # Log the entire response (optional, for debugging)
                ctx.log.debug(json.dumps(data, indent=2))

            except json.JSONDecodeError:
                ctx.log.error("Unable to decode JSON response.")

# Function to handle WebSocket messages
def websocket_message(flow: websocket.WebSocketFlow):
    if "aviator-next.spribegaming.com" in flow.server_conn.address:
        for message in flow.messages:
            if message.from_server:
                ctx.log.info(f"WebSocket Message: {message.content}")

                # Parse JSON if applicable
                try:
                    data = json.loads(message.content)
                    ctx.log.debug(json.dumps(data, indent=2))

                    # Extract multiplier or any other relevant fields
                    if "multiplier" in data:
                        multiplier = data["multiplier"]
                        ctx.log.info(f"Multiplier: {multiplier}")
                except json.JSONDecodeError:
                    pass

# Function to handle TLS handshake failures (optional)
def tls_failed(flow: http.HTTPFlow):
    ctx.log.error(f"TLS handshake failed for {flow.server_conn.address}: {flow.error}")
