from mitmproxy import http, websocket
import json

# Handle HTTP responses
def response(flow: http.HTTPFlow) -> None:
    # Check if the request is to the Aviator server
    if "aviator-next.spribegaming.com" in flow.request.host:
        # Log the intercepted request method and URL
        print(f"Intercepted {flow.request.method} {flow.request.url}")

        # Process the data for specific API endpoints
        if "rounds" in flow.request.url or "results" in flow.request.url:
            try:
                # Parse the response as JSON
                data = json.loads(flow.response.text)

                # Extract and log server seed and multiplier if available
                server_seed = data.get("seed")
                if server_seed:
                    print(f"Server Seed: {server_seed}")

                multiplier = data.get("multiplier")
                if multiplier:
                    print(f"Multiplier: {multiplier}")

                # Log the full response data (optional for debugging)
                print(json.dumps(data, indent=2))
            except json.JSONDecodeError:
                print("Unable to decode JSON response.")

# Handle WebSocket messages
def websocket_message(flow: websocket.WebSocketFlow) -> None:
    if "aviator-next.spribegaming.com" in flow.server_conn.address:
        for message in flow.messages:
            if message.from_server:
                print(f"WebSocket Message: {message.content}")

                # Attempt to parse WebSocket messages as JSON
                try:
                    data = json.loads(message.content)
                    print(json.dumps(data, indent=2))

                    # Extract multiplier or other relevant fields
                    multiplier = data.get("multiplier")
                    if multiplier:
                        print(f"Multiplier: {multiplier}")
                except json.JSONDecodeError:
                    print("Non-JSON WebSocket message received.")
