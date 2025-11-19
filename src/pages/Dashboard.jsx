import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { AutoScanContext } from "../context/AutoScanContext";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const { autoScanRunning, startAutoScan, stopAutoScan } = useContext(AutoScanContext);

  const FIXED_INTERVAL = 900000; // 15 minutes
  const [sensorData, setSensorData] = useState({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);

  const countdownRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const isScanning = useRef(false);
  const hasSaved = useRef(false);

  const esp32Url =
    window.location.protocol === "https:"
      ? "/api/data" // Vercel
      : "http://aquacheck.local:5000/data"; // Local ESP32

  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url);
      if (!response.ok) throw new Error("ESP32 not reachable");
      const localData = await response.json();

      const newData = {
        ph: localData.ph ? parseFloat(localData.ph).toFixed(2) : "N/A",
        turbidity: localData.turbidity ? parseFloat(localData.turbidity).toFixed(1) : "N/A",
        temp: localData.temperature ? parseFloat(localData.temperature).toFixed(1) : "N/A",
        tds: localData.tds ? parseFloat(localData.tds).toFixed(0) : "N/A",
      };

      setSensorData(newData);
      setStatus("✅ Data fetched successfully (Local ESP32).");
      return newData;
    } catch (err) {
      console.warn("⚠️ Primary source failed, trying Vercel backup...");
      try {
        const cloudResponse = await fetch("/api/data");
        const data = await cloudResponse.json();

        const newData = {
          ph: data.ph ? parseFloat(data.ph).toFixed(2) : "N/A",
          turbidity: data.turbidity ? parseFloat(data.turbidity).toFixed(1) : "N/A",
          temp: data.temperature ? parseFloat(data.temperature).toFixed(1) : "N/A",
          tds: data.tds ? parseFloat(data.tds).toFixed(0) : "N/A",
        };

        setSensorData(newData);
        setStatus("🌐 Fetched from Vercel backup.");
        return newData;
      } catch (cloudError) {
        console.error("❌ Both sources failed:", cloudError);
        setStatus("❌ Failed to fetch data.");
        return null;
      }
    }
  }, [esp32Url]);

  const handleSave = useCallback(async () => {
    if (Object.values(sensorData).every((v) => v === "N/A")) {
      setStatus("⚠ No valid data to save. Please scan first.");
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return setStatus("⚠ User not authenticated.");

      const saveData = {
        user_id: user.id,
        ph: parseFloat(sensorData.ph) || null,
        turbidity: parseFloat(sensorData.turbidity) || null,
        temperature: parseFloat(sensorData.temp) || null,
        tds: parseFloat(sensorData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatus("✅ Data saved successfully!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error saving data.");
    }
  }, [sensorData]);

  const handleAutoSave = useCallback(async () => {
    if (!isScanning.current || hasSaved.current) return;
    hasSaved.current = true;

    const newData = await fetchSensorData();
    if (!newData || Object.values(newData).every((v) => v === "N/A")) {
      setStatus("⚠ No valid data to auto-save.");
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return setStatus("⚠ User not authenticated. Auto-save skipped.");

      const saveData = {
        user_id: user.id,
        ph: parseFloat(newData.ph) || null,
        turbidity: parseFloat(newData.turbidity) || null,
        temperature: parseFloat(newData.temp) || null,
        tds: parseFloat(newData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatus(`✅ Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error("❌ Auto-save error:", err);
      setStatus("❌ Auto-save failed.");
    }
  }, [fetchSensorData]);

  const stopContinuousAutoScan = useCallback(() => {
    clearInterval(countdownRef.current);
    clearInterval(liveIntervalRef.current);
    countdownRef.current = null;
    liveIntervalRef.current = null;
    isScanning.current = false;
    hasSaved.current = false;

    setCountdown(FIXED_INTERVAL / 1000);
    setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
    setStatus("🛑 Auto Scan stopped.");
    localStorage.setItem("autoScanRunning", "false"); // Stop persistence
  }, []);

  const startContinuousAutoScan = useCallback(() => {
    stopContinuousAutoScan();
    isScanning.current = true;
    hasSaved.current = false;
    setCountdown(FIXED_INTERVAL / 1000);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleAutoSave();
          setTimeout(() => { hasSaved.current = false; }, 1000);
          return FIXED_INTERVAL / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    liveIntervalRef.current = setInterval(fetchSensorData, 1000);
    setStatus("🔄 Auto Scan started (every 15 minutes).");
    localStorage.setItem("autoScanRunning", "true"); // Start persistence
  }, [fetchSensorData, handleAutoSave, stopContinuousAutoScan]);

  const toggleAutoScan = useCallback(() => {
    if (autoScanRunning) {
      stopAutoScan();
      stopContinuousAutoScan();
    } else {
      startAutoScan(handleAutoSave);
      startContinuousAutoScan();
    }
  }, [autoScanRunning, stopAutoScan, stopContinuousAutoScan, startAutoScan, startContinuousAutoScan, handleAutoSave]);

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

  // --- Fix: Only auto-start if persisted ---
  useEffect(() => {
    if (localStorage.getItem("autoScanRunning") === "true") {
      startContinuousAutoScan();
    }
    return () => stopContinuousAutoScan();
  }, [startContinuousAutoScan, stopContinuousAutoScan]);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>

        <section className="scan-controls">
          <div className="interval-setting">
            <label htmlFor="scanInterval">Auto Scan Interval:</label>
            <select id="scanInterval" value={FIXED_INTERVAL} disabled>
              <option value={FIXED_INTERVAL}>Every 15 Minutes</option>
            </select>
          </div>

          <div className="button-group">
            <button className="save-btn" onClick={handleSave}>Save</button>
            <button className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`} onClick={toggleAutoScan}>
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>

          {autoScanRunning && <div className="countdown-timer">⏱ Next auto-save in: {Math.floor(countdown / 60)}m {countdown % 60}s</div>}
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map((key) => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>{sensorData[key]} {key === "turbidity" ? "NTU" : key === "temp" ? "°C" : key === "tds" ? "ppm" : ""}</p>
              <p className="status-label">{getSensorStatus(key, sensorData[key]).toUpperCase()}</p>
            </div>
          ))}
        </section>

        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
