export const config = {
  api: {
    bodyParser: true, // allow ESP32 JSON
  },
};

// Latest in-memory sensor data
let latestData = {
  ph: 7.0,
  temperature: 25.0,
  tds: 0,
  turbidity: 0,
};

// SSE clients
let clients = [];

// Push updates to SSE dashboards
function broadcastRealtime() {
  const payload = `data: ${JSON.stringify(latestData)}\n\n`;
  clients.forEach(c => c.res.write(payload));
}

export default function handler(req, res) {
  // ---------------- SSE connection ----------------
  if (req.method === "GET" && req.headers.accept === "text/event-stream") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`data: ${JSON.stringify(latestData)}\n\n`);
    const client = { id: Date.now(), res };
    clients.push(client);

    req.on("close", () => {
      clients = clients.filter(c => c.id !== client.id);
    });
    return;
  }

  // ---------------- Dashboard snapshot ----------------
  if (req.method === "GET") {
    return res.status(200).json({ success: true, latestData });
  }

  // ---------------- ESP32 POST ----------------
  if (req.method === "POST") {
    if (!req.body) return res.status(400).json({ error: "Missing JSON body" });

    try {
      const { ph, temperature, tds, turbidity } = req.body;

      latestData = {
        ph: parseFloat(ph ?? 0),
        temperature: parseFloat(temperature ?? 0),
        tds: parseFloat(tds ?? 0),
        turbidity: parseFloat(turbidity ?? 0),
      };

      broadcastRealtime();

      return res.status(200).json({
        success: true,
        message: "✅ Data received successfully!",
        latestData,
      });
    } catch (err) {
      return res.status(400).json({ error: "Invalid JSON", details: err.message });
    }
  }

  // ---------------- Block others ----------------
  res.status(405).json({ message: "Method Not Allowed" });
}
