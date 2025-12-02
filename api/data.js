// api/data.js — REALTIME VERSION (SSE + POST updates)

let latestData = {
  ph: 7.0,
  temperature: 25.0,
  tds: 2418.89,
  turbidity: 2395.53,
};

// List of SSE clients
let clients = [];

// Helper to push realtime data to all connected clients
function broadcastRealtime() {
  const dataString = `data: ${JSON.stringify(latestData)}\n\n`;
  clients.forEach((client) => client.res.write(dataString));
}

export default function handler(req, res) {
  // ----------------------------
  // 1. SERVER-SENT EVENTS (REALTIME STREAM)
  // ----------------------------
  if (req.method === "GET" && req.headers.accept === "text/event-stream") {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // send initial data immediately
    res.write(`data: ${JSON.stringify(latestData)}\n\n`);

    const client = { id: Date.now(), res };
    clients.push(client);

    req.on("close", () => {
      clients = clients.filter((c) => c.id !== client.id);
    });

    return;
  }

  // ----------------------------
  // 2. NORMAL GET REQUEST (just get last data)
  // ----------------------------
  if (req.method === "GET") {
    return res.status(200).json(latestData);
  }

  // ----------------------------
  // 3. ESP32 POSTING SENSOR DATA
  // ----------------------------
  if (req.method === "POST") {
    try {
      const { ph, temperature, tds, turbidity } = req.body;

      latestData = {
        ph: ph !== undefined ? parseFloat(ph) : latestData.ph,
        temperature: temperature !== undefined ? parseFloat(temperature) : latestData.temperature,
        tds: tds !== undefined ? parseFloat(tds) : latestData.tds,
        turbidity: turbidity !== undefined ? parseFloat(turbidity) : latestData.turbidity,
      };

      // 🔥 broadcast real-time update to all dashboards
      broadcastRealtime();

      return res.status(200).json({
        message: "✅ Sensor data updated",
        latestData,
      });
    } catch (error) {
      return res.status(400).json({ message: "❌ Invalid data format" });
    }
  }

  // Method not allowed
  return res.status(405).json({ message: "Method not allowed" });
}
