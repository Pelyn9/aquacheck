// pages/api/data.js
export const config = {
  api: {
    bodyParser: true, // allow ESP32 JSON body
  },
};

// -------------------------------------------
// In-memory latest sensor data
// -------------------------------------------
let latestData = {
  ph: 7.0,
  temperature: 25.0,
  tds: 0,
  turbidity: 0,
};

// Store all SSE dashboard clients
let clients = [];

// -------------------------------------------
// Push data to all SSE clients
// -------------------------------------------
function broadcastRealtime() {
  const payload = `data: ${JSON.stringify(latestData)}\n\n`;
  clients.forEach((client) => client.res.write(payload));
}

// -------------------------------------------
// Main API Handler
// -------------------------------------------
export default function handler(req, res) {
  
  // --------------------------------------------------
  // 1. Dashboard connects to realtime SSE stream
  // --------------------------------------------------
  if (req.method === "GET" && req.headers.accept === "text/event-stream") {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send the current data immediately
    res.write(`data: ${JSON.stringify(latestData)}\n\n`);

    const client = { id: Date.now(), res };
    clients.push(client);

    // Remove client when disconnected
    req.on("close", () => {
      clients = clients.filter((c) => c.id !== client.id);
    });

    return;
  }

  // --------------------------------------------------
  // 2. ESP32 POSTS sensor data here
  // --------------------------------------------------
  if (req.method === "POST") {
    if (!req.body) {
      return res.status(400).json({ error: "Missing JSON body" });
    }

    try {
      const { ph, temperature, tds, turbidity } = req.body;

      // Update memory safely
      latestData = {
        ph: parseFloat(ph ?? 0),
        temperature: parseFloat(temperature ?? 0),
        tds: parseFloat(tds ?? 0),
        turbidity: parseFloat(turbidity ?? 0),
      };

      // Push update to all connected dashboards
      broadcastRealtime();

      return res.status(200).json({
        success: true,
        message: "Data received",
        latestData,
      });

    } catch (err) {
      return res.status(400).json({
        error: "Invalid JSON payload",
        details: err.message,
      });
    }
  }

  // --------------------------------------------------
  // 3. Block other methods
  // --------------------------------------------------
  res.status(405).json({ message: "Method Not Allowed" });
}
