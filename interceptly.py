from mitmproxy import http, ctx
import json


# HTTP Response Interception
def response(flow: http.HTTPFlow) -> None:
    if "af-south-1-game1.spribegaming.com/BlueBox/websocket" in flow.request.host:
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
                if "result" in data:
                    result = data.get("result")
                    ctx.log.info(f"Server Seed: {result}")
                if "multiplier" in data:
                    multiplier = data.get("multiplier")
                    ctx.log.info(f"Multiplier: {multiplier}")
            except json.JSONDecodeError:
                ctx.log.error("Failed to decode JSON response.")


# WebSocket Message Interception
def websocket_message(flow) -> None:
    if "af-south-1-game1.spribegaming.com/BlueBox/websocket" in flow.request.host:
        for message in flow.messages:
            if message.from_server:  # Check if the message is from the server
                try:
                    # Decode the WebSocket message content
                    data = json.loads(message.content)
                    ctx.log.info(f"WebSocket Message: {json.dumps(data, indent=2)}")

                    # Log multiplier or other relevant fields
                    if "result" in data:
                        result = data["result"]
                        ctx.log.info(f"Result: {result}")
                    if "multiplier" in data:
                        multiplier = data["multiplier"]
                        ctx.log.info(f"Multiplier: {multiplier}")
                    if "result" in data:
                        result = data["result"]
                        ctx.log.info(f"Result: {result}")
                    if "decimal" in data:
                        decimal = data["decimal"]
                        ctx.log.info(f"Decimal: {decimal}")
                    if "hex" in data:
                        hex = data["hex"]
                        ctx.log.info(f"Hex: {hex}")
                    if "round" in data:
                        round = data["round"]
                        ctx.log.info(f"Round: {round}") 
                    if "end" in data:
                        end = data["end"]
                        ctx.log.info(f"Multiplier: {end}")
                    if "seed" in data:
                        seed = data["seed"]
                        ctx.log.info(f"Seed: {seed}")            
                except json.JSONDecodeError:
                    ctx.log.error("Failed to parse WebSocket message.")


# Optional: Handle TLS handshake errors
def tls_failed(flow: http.HTTPFlow):
    ctx.log.error(f"TLS handshake failed for {flow.server_conn.address}: {flow.error}")

