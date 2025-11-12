import subprocess
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

# ✅ Path to your backend folder
WATCH_PATH = os.path.dirname(os.path.abspath(__file__))

# ✅ Command to run your Flask server
SERVER_CMD = ["py", "server.py"]

class ReloadHandler(FileSystemEventHandler):
    def __init__(self):
        self.process = subprocess.Popen(SERVER_CMD)
    
    def restart_server(self):
        print("🔄 Changes detected. Restarting server...")
        self.process.terminate()
        self.process.wait()
        self.process = subprocess.Popen(SERVER_CMD)
    
    def on_modified(self, event):
        if event.src_path.endswith(".py"):
            self.restart_server()

    def on_created(self, event):
        if event.src_path.endswith(".py"):
            self.restart_server()

if __name__ == "__main__":
    event_handler = ReloadHandler()
    observer = Observer()
    observer.schedule(event_handler, path=WATCH_PATH, recursive=True)
    observer.start()
    print(f"👀 Watching {WATCH_PATH} for changes...")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("🛑 Stopping auto-reload...")
        observer.stop()
        event_handler.process.terminate()

    observer.join()
