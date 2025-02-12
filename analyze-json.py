import json
import base64

# Load the HAR file with error handling for decoding
with open('flows.har.json', 'r', encoding='utf-8', errors='ignore') as f:
    data = f.read()

# Initialize an empty list to store parsed JSON objects
har_data = []

# Split the data into individual JSON objects
json_objects = data.split('\n')

# Parse each JSON object
for obj in json_objects:
    obj = obj.strip()  # Remove leading and trailing whitespace
    if obj:  # Skip empty lines
        try:
            parsed_obj = json.loads(obj)
            if isinstance(parsed_obj, dict):  # Ensure the parsed object is a dictionary
                har_data.append(parsed_obj)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}")
        except Exception as e:
            print(f"Unexpected error: {e}")

# Function to decode WebSocket message data
def decode_message_data(data, is_binary):
    if is_binary:
        try:
            decoded_data = base64.b64decode(data).decode('utf-8', errors='ignore')
            return decoded_data
        except Exception as e:
            print(f"Error decoding binary data: {e}")
            return data
    else:
        return data

# Extract WebSocket messages and potential game results
for entry in har_data:
    if isinstance(entry, dict) and 'log' in entry and 'entries' in entry['log']:
        for log_entry in entry['log']['entries']:
            if 'webSocketMessages' in log_entry:
                for message in log_entry['webSocketMessages']:
                    # Determine if the message is binary
                    is_binary = message.get('opcode') == 2
                    # Decode the message data
                    decoded_data = decode_message_data(message['data'], is_binary)
                    # Print the message details
                    print(f"Timestamp: {message['timestamp']}")
                    print(f"Direction: {message['direction']}")
                    print(f"Data: {decoded_data}")
                    print("-" * 40)
            # Look for other potential indicators of game results
            if 'response' in log_entry:
                response_content = log_entry['response'].get('content', {}).get('text', '')
                if any(keyword in response_content for keyword in ['aviator', 'game_state', 'multiplier', 'result', 'win', 'loss', 'round', 'cashout']):
                    print(f"Potential Game Result: {response_content}")
                    print("-" * 40)