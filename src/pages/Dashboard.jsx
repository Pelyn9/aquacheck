// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const FIXED_INTERVAL = 900000; // 15 minutes

const AdminDashboard = () => {
  const intervalRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [status, setStatus] = useState("Awaiting sensor data...");

  // --------------------------
  // Compute Overall Safety
  // --------------------------
  const computeOverallSafety = (data) => {
    if (!data || Object.values(data).every((v) => v === "N/A")) return "N/A";

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
    if (total >= 7) return "Safe";
    if (total >= 4) return "Moderate";
    return "Unsafe";
  };

  // --------------------------
  // ESP32 URL (per device)
  // --------------------------
  const esp32Url = (device) =>
    process.env.NODE_ENV === "production"
      ? `/api/data?device_id=${device.id}`
      : `http://${device.local_ip || "aquacheck.local"}:5000/data`;

  // --------------------------
  // Fetch Sensor Data (per device)
  // --------------------------
  const fetchSensorData = useCallback(async (device) => {
    try {
      const response = await fetch(esp32Url(device), { cache: "no-store" });
      if (!response.ok) throw new Error("ESP32 fetch failed");
      const data = await response.json();
      const latest = data.latestData || data;

      const formatted = {
        ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
      };

      const overallSafety = computeOverallSafety(formatted);

      setDevices(prev => prev.map(d =>
        d.id === device.id ? { ...d, sensorData: formatted, overallSafety } : d
      ));

      return formatted;
    } catch (err) {
      console.warn(`ESP32 fetch failed for ${device.name}, trying cloud backup...`);
      try {
        const cloudRes = await fetch(`/api/data?device_id=${device.id}`, { cache: "no-store" });
        const cloudJson = await cloudRes.json();
        const latest = cloudJson.latestData || {};

        const formatted = {
          ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
          turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
          temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
          tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
        };

        const overallSafety = computeOverallSafety(formatted);

        setDevices(prev => prev.map(d =>
          d.id === device.id ? { ...d, sensorData: formatted, overallSafety } : d
        ));

        return formatted;
      } catch (err2) {
        console.error(`Both ESP32 & Cloud failed for ${device.name}:`, err2);
        return null;
      }
    }
  }, []);

  // --------------------------
  // Auto Save All Devices
  // --------------------------
  const handleAutoSaveAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const device of devices) {
      const data = await fetchSensorData(device);
      if (!data) continue;

      try {
        const saveData = {
          user_id: user.id,
          device_id: device.id,
          ph: parseFloat(data.ph) || null,
          turbidity: parseFloat(data.turbidity) || null,
          temperature: parseFloat(data.temp) || null,
          tds: parseFloat(data.tds) || null,
        };

        const { error } = await supabase.from("dataset_history").insert([saveData]);
        if (error) throw error;
      } catch (err) {
        console.error(`Auto-save failed for ${device.name}`, err);
      }
    }

    const nextTS = Date.now() + FIXED_INTERVAL;
    await supabase.from("device_scanning").update({
      last_scan_time: new Date().toISOString(),
      next_auto_save_ts: nextTS,
      status: 1
    });

    setStatus(`💾 Auto-saved all devices at ${new Date().toLocaleTimeString()}`);
  }, [devices, fetchSensorData]);

  // --------------------------
  // Global Countdown
  // --------------------------
  const startCountdown = useCallback((nextTS) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      const remaining = nextTS - Date.now();
      if (remaining <= 0 && autoScanRunning) {
        await handleAutoSaveAll();
      }
    }, 1000);
  }, [autoScanRunning, handleAutoSaveAll]);

  // --------------------------
  // Toggle Auto Scan (Global)
  // --------------------------
  const toggleAutoScan = async () => {
    const newStatus = !autoScanRunning;
    setAutoScanRunning(newStatus);

    const nextTS = newStatus ? Date.now() + FIXED_INTERVAL : null;

    await supabase.from("device_scanning").update({
      status: newStatus ? 1 : 0,
      next_auto_save_ts: nextTS
    });

    if (newStatus) startCountdown(nextTS);
    else if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // --------------------------
  // Fetch All Devices & Realtime Listener
  // --------------------------
  useEffect(() => {
    const fetchDevices = async () => {
      const { data } = await supabase.from("device_scanning").select("*");
      if (!data) return;

      setDevices(data.map(d => ({
        ...d,
        sensorData: { ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" },
        overallSafety: "N/A"
      })));

      // If any device running, start countdown globally
      const anyRunning = data.some(d => d.status === 1);
      setAutoScanRunning(anyRunning);
      if (anyRunning && data[0]?.next_auto_save_ts) startCountdown(data[0].next_auto_save_ts);
    };

    fetchDevices();

    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning" },
        (payload) => {
          setDevices(prev => prev.map(d => ({ ...d, status: payload.new.status })));

          const running = payload.new.status === 1;
          setAutoScanRunning(running);
          if (running && payload.new.next_auto_save_ts) startCountdown(payload.new.next_auto_save_ts);
          else if (!running && intervalRef.current) clearInterval(intervalRef.current);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [startCountdown]);

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
        <header className="topbar"><h1>Admin Dashboard - Global</h1></header>

        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleAutoSaveAll}>Save All Now</button>
            <button
              className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>
        </section>

        {devices.map(device => (
          <section key={device.id} className="device-section">
            <h2>{device.name}</h2>
            <div className="sensor-grid">
              {["ph","turbidity","temp","tds"].map(key => (
                <div key={key} className={`sensor-card ${getSensorStatus(key, device.sensorData[key])}`}>
                  <h3>{key.toUpperCase()}</h3>
                  <p>{device.sensorData[key]} {key==="turbidity"?"NTU":key==="temp"?"°C":key==="tds"?"ppm":""}</p>
                  <p className={`status-label ${getSensorStatus(key, device.sensorData[key])}`}>
                    {device.sensorData[key]==="N/A"?"NO DATA":getSensorStatus(key,device.sensorData[key]).toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
            <section className={`overall-safety ${device.overallSafety.toLowerCase()}`}>
              <h3>Swimming Safety: {device.overallSafety}</h3>
            </section>
          </section>
        ))}

        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
