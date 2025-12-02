// pages/api/data.js — REALTIME MIRROR VERSION

let latestData = {
  ph: 7.0,
  temperature: 25.0,
  tds: 0,
  turbidity: 0,
};

// List of all SSE dashboard clients
let clients = [];

// Push latest data to all connected dashboards
function broadcastRealtime() {
  const payload = `data: ${JSON.stringify(latestData)}\n\n`;
  clients.forEach((client) => client.res.write(payload));
}

export default function handler(req, res) {
  // ---------------------------
  // 1. REALTIME STREAM (SSE)
  // ---------------------------
  if (req.method === "GET" && req.headers.accept === "text/event-stream") {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send current data instantly
    res.write(`data: ${JSON.stringify(latestData)}\n\n`);

    const client = { id: Date.now(), res };
    clients.push(client);

    req.on("close", () => {
      clients = clients.filter((c) => c.id !== client.id);
    });

    return;
  }

  // ---------------------------
  // 2. ESP32 POSTS NEW DATA
  // ---------------------------
  if (req.method === "POST") {
    try {
      const { ph, temperature, tds, turbidity } = req.body;

      // Update memory
      latestData = {
        ph: parseFloat(ph),
        temperature: parseFloat(temperature),
        tds: parseFloat(tds),
        turbidity: parseFloat(turbidity),
      };

      // Broadcast immediately to dashboards
      broadcastRealtime();

      return res.status(200).json({
        success: true,
        latestData,
      });
    } catch (err) {
      return res.status(400).json({ error: "Invalid data format" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
