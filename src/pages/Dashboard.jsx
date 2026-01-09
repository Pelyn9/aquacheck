// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const FIXED_INTERVAL = 900000; // 15 minutes

const AdminDashboard = () => {
  const intervalRef = useRef(null);
  const lastAutoSaveRef = useRef(0); // 🔒 HARD LOCK

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(0);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  // --------------------------
  // Compute Overall Safety
  // --------------------------
  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every(v => v === "N/A")) {
      setOverallSafety("N/A");
      return;
    }

    let score = 0;
    if (data.ph !== "N/A" && data.ph >= 6.5 && data.ph <= 8.5) score += 2;
    if (data.turbidity !== "N/A" && data.turbidity <= 5) score += 2;
    else if (data.turbidity !== "N/A" && data.turbidity <= 10) score += 1;
    if (data.temp !== "N/A" && data.temp >= 24 && data.temp <= 32) score += 2;
    if (data.tds !== "N/A" && data.tds <= 500) score += 2;

    if (score >= 7) setOverallSafety("Safe");
    else if (score >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  // --------------------------
  // Fetch Sensor Data
  // --------------------------
  const fetchSensorData = useCallback(async () => {
    try {
      const res = await fetch(esp32Url, { cache: "no-store" });
      if (!res.ok) throw new Error("ESP32 failed");

      const json = await res.json();
      const latest = json.latestData || json;

      const formatted = {
        ph: latest.ph ? Number(latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? Number(latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? Number(latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? Number(latest.tds).toFixed(0) : "N/A",
      };

      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("✅ ESP32 data fetched");
      return formatted;
    } catch {
      setStatus("❌ Failed to fetch data");
      return null;
    }
  }, [esp32Url, computeOverallSafety]);

  // --------------------------
  // AUTO SAVE (LOCKED)
  // --------------------------
  const handleAutoSave = useCallback(async () => {
    if (!autoScanRunning) return;

    const now = Date.now();

    // 🔒 BLOCK DUPLICATE SAVES
    if (now - lastAutoSaveRef.current < FIXED_INTERVAL) return;
    lastAutoSaveRef.current = now;

    const data = await fetchSensorData();
    if (!data) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("dataset_history").insert([{
        user_id: user.id,
        ph: data.ph !== "N/A" ? parseFloat(data.ph) : null,
        turbidity: data.turbidity !== "N/A" ? parseFloat(data.turbidity) : null,
        temperature: data.temp !== "N/A" ? parseFloat(data.temp) : null,
        tds: data.tds !== "N/A" ? parseFloat(data.tds) : null,
      }]);

      const nextTS = now + FIXED_INTERVAL;

      await supabase.from("device_scanning")
        .update({
          last_scan_time: new Date().toISOString(),
          next_auto_save_ts: nextTS,
          latest_sensor: data
        })
        .eq("id", 1);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Auto-save failed");
    }
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // COUNTDOWN TIMER (SINGLE SOURCE)
  // --------------------------
  const startCountdown = useCallback((nextTS) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const remaining = nextTS - Date.now();
      setCountdown(Math.max(Math.floor(remaining / 1000), 0));

      if (remaining <= 0) {
        handleAutoSave();
      }
    }, 1000);
  }, [handleAutoSave]);

  // --------------------------
  // TOGGLE AUTO SCAN
  // --------------------------
  const toggleAutoScan = useCallback(async () => {
    const newState = !autoScanRunning;
    setAutoScanRunning(newState);

    if (!newState) {
      clearInterval(intervalRef.current);
      setCountdown(0);
      setStatus("⛔ Auto-scan stopped");
      return;
    }

    const nextTS = Date.now() + FIXED_INTERVAL;
    lastAutoSaveRef.current = 0;

    await supabase.from("device_scanning").upsert({
      id: 1,
      status: 1,
      next_auto_save_ts: nextTS
    });

    await fetchSensorData();
    startCountdown(nextTS);
  }, [autoScanRunning, fetchSensorData, startCountdown]);

  // --------------------------
  // SENSOR MIRROR (SAFE 5s)
  // --------------------------
  useEffect(() => {
    if (!autoScanRunning) return;
    const interval = setInterval(fetchSensorData, 5000);
    return () => clearInterval(interval);
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // INITIAL LOAD ONLY
  // --------------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("*")
        .eq("id", 1)
        .single();

      if (!data) return;

      if (data.status === 1 && data.next_auto_save_ts) {
        setAutoScanRunning(true);
        startCountdown(data.next_auto_save_ts);
        if (data.latest_sensor) {
          setSensorData(data.latest_sensor);
          computeOverallSafety(data.latest_sensor);
        }
      }
    };
    init();
  }, [startCountdown, computeOverallSafety]);

  // --------------------------
  // SENSOR COLOR
  // --------------------------
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";
    const v = parseFloat(value);
    if (type === "ph") return v >= 6.5 && v <= 8.5 ? "safe" : "unsafe";
    if (type === "turbidity") return v <= 5 ? "safe" : v <= 10 ? "moderate" : "unsafe";
    if (type === "temp") return v >= 24 && v <= 32 ? "safe" : "unsafe";
    if (type === "tds") return v <= 500 ? "safe" : "unsafe";
    return "";
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>

        <section className="scan-controls">
          <button
            className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
            onClick={toggleAutoScan}
          >
            {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
          </button>

          {autoScanRunning && (
            <div className="countdown-timer">
              ⏱ Next auto-save in:
              <strong> {Math.floor(countdown / 60)}m {countdown % 60}s</strong>
            </div>
          )}
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map(k => (
            <div key={k} className={`sensor-card ${getSensorStatus(k, sensorData[k])}`}>
              <h3>{k.toUpperCase()}</h3>
              <p>{sensorData[k]}</p>
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
