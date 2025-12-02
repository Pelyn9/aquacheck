// pages/api/data.js

export const config = {
  api: {
    bodyParser: true, // allow JSON from ESP32
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
// Broadcast realtime data to all SSE clients
// -------------------------------------------
function broadcastRealtime() {
  const message = `data: ${JSON.stringify(latestData)}\n\n`;
  clients.forEach((c) => c.res.write(message));
}

// -------------------------------------------
// MAIN API HANDLER
// -------------------------------------------
export default function handler(req, res) {
  const { method } = req;

  // =====================================================
  // 1. DASHBOARD GETS REALTIME DATA VIA SSE
  // =====================================================
  if (method === "GET" && req.headers.accept === "text/event-stream") {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // send immediate data
    res.write(`data: ${JSON.stringify(latestData)}\n\n`);

    const client = { id: Date.now(), res };
    clients.push(client);

    req.on("close", () => {
      clients = clients.filter((c) => c.id !== client.id);
    });

    return;
  }

  // =====================================================
  // 2. NORMAL GET REQUEST (Dashboard polling)
  // FIX FOR ERROR 405
  // =====================================================
  if (method === "GET") {
    return res.status(200).json({
      success: true,
      message: "Latest sensor data",
      data: latestData,
    });
  }

  // =====================================================
  // 3. ESP32 POSTS SENSOR DATA HERE
  // =====================================================
  if (method === "POST") {
    try {
      const { ph, temperature, tds, turbidity } = req.body;

      latestData = {
        ph: parseFloat(ph ?? 0),
        temperature: parseFloat(temperature ?? 0),
        tds: parseFloat(tds ?? 0),
        turbidity: parseFloat(turbidity ?? 0),
      };

      broadcastRealtime(); // send to dashboards

      return res.status(200).json({
        success: true,
        message: "Data received successfully!",
        latestData,
      });
    } catch (err) {
      return res.status(400).json({
        error: "Invalid JSON payload",
        details: err.message,
      });
    }
  }

  // =====================================================
  // 4. OTHER METHODS BLOCKED
  // =====================================================
  return res.status(405).json({
    message: "Method Not Allowed",
    allowed: ["GET", "POST"],
  });
}
