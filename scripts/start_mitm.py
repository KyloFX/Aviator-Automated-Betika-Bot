import subprocess
import time

def start_mitmproxy():
    try:
        print("Starting mitmproxy...")
        subprocess.Popen(["mitmproxy", "-s", "mitmproxy_capture.py"])
        time.sleep(5)  # Allow mitmproxy to initialize
        print("mitmproxy is running.")
    except Exception as e:
        print(f"Error starting mitmproxy: {e}")

if __name__ == "__main__":
    start_mitmproxy()
