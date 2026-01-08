import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes
  const intervalRef = useRef(null);

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  const [lastSavedZero, setLastSavedZero] = useState({
    ph: 0,
    turbidity: 0,
    temp: 0,
    tds: 0,
  });

  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  // --------------------------
  // Compute Overall Safety
  // --------------------------
  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every((v) => v === "N/A")) {
      setOverallSafety("N/A");
      return;
    }

    const scores = Object.entries(data).map(([key, value]) => {
      if (value === "N/A") return 0;
      const val = parseFloat(value);
      switch (key) {
        case "ph": return val >= 6.5 && val <= 8.5 ? 2 : 0;
        case "turbidity": return val <= 5 ? 2 : val <= 10 ? 1 : 0;
        case "temp": return val >= 24 && val <= 32 ? 2 : 0;
        case "tds": return val <= 500 ? 2 : 0;
        default: return 0;
      }
    });

    const total = scores.reduce((a, b) => a + b, 0);
    if (total >= 7) setOverallSafety("Safe");
    else if (total >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  // --------------------------
  // Fetch Sensor Data (ESP32)
  // --------------------------
  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url, { cache: "no-store" });
      if (!response.ok) throw new Error("ESP32 fetch failed");

      const json = await response.json();
      const latest = json.latestData || json;

      const formatted = {
        ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
      };

      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("🔄 Live ESP32 data");

      return formatted;
    } catch (err) {
      console.error("ESP32 fetch failed:", err);
      setStatus("❌ Sensor fetch failed");
      return null;
    }
  }, [esp32Url, computeOverallSafety]);

  // --------------------------
  // 🔥 LIVE SENSOR MIRROR (1 SECOND)
  // --------------------------
  useEffect(() => {
    if (!autoScanRunning) return;

    const interval = setInterval(() => {
      fetchSensorData();
    }, 1000); // ⏱ every 1 second

    return () => clearInterval(interval);
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // Auto Save (15 min logic)
  // --------------------------
  const handleAutoSave = useCallback(async () => {
    if (!autoScanRunning) return;

    const data = await fetchSensorData();
    if (!data) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = Date.now();

      const shouldSave = Object.entries(data).some(([key, value]) => {
        const val = parseFloat(value);
        if (isNaN(val) || val !== 0) return true;
        return now - lastSavedZero[key] >= FIXED_INTERVAL;
      });

      if (!shouldSave) return;

      const updatedZero = { ...lastSavedZero };
      Object.entries(data).forEach(([key, value]) => {
        if (parseFloat(value) === 0) updatedZero[key] = now;
      });
      setLastSavedZero(updatedZero);

      await supabase.from("dataset_history").insert([{
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      }]);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Auto-save failed");
    }
  }, [fetchSensorData, lastSavedZero, autoScanRunning]);

  // --------------------------
  // Manual Save
  // --------------------------
  const handleManualSave = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("dataset_history").insert([{
        user_id: user.id,
        ph: sensorData.ph !== "N/A" ? parseFloat(sensorData.ph) : null,
        turbidity: sensorData.turbidity !== "N/A" ? parseFloat(sensorData.turbidity) : null,
        temperature: sensorData.temp !== "N/A" ? parseFloat(sensorData.temp) : null,
        tds: sensorData.tds !== "N/A" ? parseFloat(sensorData.tds) : null,
      }]);

      setStatus(`💾 Manual save at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Manual save failed");
    }
  }, [sensorData]);

  // --------------------------
  // Toggle Auto Scan
  // --------------------------
  const toggleAutoScan = () => {
    setAutoScanRunning(prev => !prev);
    setStatus(autoScanRunning ? "⛔ Auto scan stopped" : "▶️ Auto scan started");
  };

  // --------------------------
  // Sensor Status Color
  // --------------------------
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";
    const val = parseFloat(value);
    switch (type) {
      case "ph": return val >= 6.5 && val <= 8.5 ? "safe" : "unsafe";
      case "turbidity": return val <= 5 ? "safe" : val <= 10 ? "moderate" : "unsafe";
      case "temp": return val >= 24 && val <= 32 ? "safe" : "unsafe";
      case "tds": return val <= 500 ? "safe" : "unsafe";
      default: return "";
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>

        <section className="scan-controls">
          <button className="save-btn" onClick={handleManualSave}>Save Now</button>
          <button className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`} onClick={toggleAutoScan}>
            {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
          </button>
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map(key => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>{sensorData[key]}</p>
              <p className={`status-label ${getSensorStatus(key, sensorData[key])}`}>
                {sensorData[key] === "N/A" ? "NO DATA" : getSensorStatus(key, sensorData[key]).toUpperCase()}
              </p>
            </div>
          ))}
        </section>

        <section className={`overall-safety ${overallSafety.toLowerCase()}`}>
          <h2>Swimming Safety: {overallSafety}</h2>
        </section>

        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
