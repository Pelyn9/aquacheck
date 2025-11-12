import os
import socket
from flask import Flask, request, jsonify
from flask_cors import CORS

# Try to import Zeroconf (only used locally)
try:
    from zeroconf import Zeroconf, ServiceInfo
except ImportError:
    Zeroconf = None
    ServiceInfo = None

app = Flask(__name__)

# ✅ Allow only your Vercel frontend and localhost
CORS(app, resources={r"/*": {"origins": ["https://aquachecklive.vercel.app", "http://localhost:3000"]}})

# ✅ Latest sensor readings
latest_data = {"ph": None, "turbidity": None, "temperature": None, "tds": None}


# ✅ Automatically detect local IP
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
    return ip


# ✅ POST route: ESP32 uploads data here
@app.route("/upload", methods=["POST"])
def upload_data():
    global latest_data
    data = request.json
    latest_data = data
    print("📡 Received data:", latest_data)
    return jsonify({"message": "Data received successfully!"}), 200


# ✅ GET route: frontend reads latest data here
@app.route("/data", methods=["GET"])
def get_data():
    return jsonify(latest_data)


# ✅ Detect if running locally or on Vercel
if __name__ == "__main__":
    ip = get_local_ip()
    port = 5000
    is_vercel = os.environ.get("VERCEL", False)

    print(f"🌐 AquaCheck server running at: http://{ip}:{port}")
    print("✅ Allowed origins: https://aquachecklive.vercel.app, http://localhost:3000")

    # ✅ Only enable Zeroconf locally
    if not is_vercel and Zeroconf:
        service_type = "_aquacheck._tcp.local."
        service_name = "AquaCheck Flask Server._aquacheck._tcp.local."
        info = ServiceInfo(
            service_type,
            service_name,
            addresses=[socket.inet_aton(ip)],
            port=port,
            properties={"path": "/upload"},
            server="aquacheck.local.",
        )

        zeroconf = Zeroconf()
        zeroconf.register_service(info)
        print("📣 Broadcasting service as http://aquacheck.local:5000")

        try:
            app.run(host="0.0.0.0", port=port)
        finally:
            zeroconf.unregister_service(info)
            zeroconf.close()
    else:
        # ✅ For Vercel (no Zeroconf)
        app.run(host="0.0.0.0", port=port)
