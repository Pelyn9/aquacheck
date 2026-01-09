// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes
  const intervalRef = useRef(null);
  const autoSaveLockRef = useRef(false);

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
  // Fetch Sensor Data
  // --------------------------
  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url, { cache: "no-store" });
      if (!response.ok) throw new Error("ESP32 fetch failed");
      const data = await response.json();
      const latest = data.latestData || data;

      const formatted = {
        ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
      };

      setSensorData(formatted);
      computeOverallSafety(formatted);
      return formatted;
    } catch {
      return null;
    }
  }, [esp32Url, computeOverallSafety]);

  // --------------------------
  // Auto Save
  // --------------------------
  const handleAutoSave = useCallback(async () => {
    if (!autoScanRunning || autoSaveLockRef.current) return;

    autoSaveLockRef.current = true;

    try {
      const data = await fetchSensorData();
      if (!data) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const saveData = {
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      const nextTS = Date.now() + FIXED_INTERVAL;

      await supabase
        .from("device_scanning")
        .update({
          last_scan_time: new Date().toISOString(),
          next_auto_save_ts: nextTS,
          latest_sensor: data,
        })
        .eq("id", 1);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
      return nextTS;
    } catch (err) {
      console.error("Auto-save error:", err);
      setStatus("❌ Auto-save failed.");
      return Date.now() + FIXED_INTERVAL;
    } finally {
      autoSaveLockRef.current = false;
    }
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // Countdown logic
  // --------------------------
  const startCountdown = useCallback((nextTS) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const remaining = nextTS - Date.now();
      setCountdown(Math.max(Math.floor(remaining / 1000), 0));

      if (remaining <= 0) {
        const newNextTS = await handleAutoSave();
        startCountdown(newNextTS);
      }
    }, 1000);
  }, [handleAutoSave]);

  // --------------------------
  // Toggle Auto Scan
  // --------------------------
  const toggleAutoScan = useCallback(async () => {
    const newStatus = !autoScanRunning;
    setAutoScanRunning(newStatus);

    try {
      const nextTS = newStatus ? Date.now() + FIXED_INTERVAL : null;

      await supabase.from("device_scanning").upsert({
        id: 1,
        status: newStatus ? 1 : 0,
        next_auto_save_ts: nextTS,
      });

      if (newStatus) {
        // Only fetch for display, do NOT save
        const data = await fetchSensorData();
        if (data) {
          setSensorData(data); // update UI
        }

        if (nextTS) startCountdown(nextTS); // start countdown
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCountdown(0);
        setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
        setOverallSafety("N/A");
        setStatus("⛔ Auto-scan stopped.");
      }
    } catch (err) {
      console.error("Failed to update scan status:", err);
    }
  }, [autoScanRunning, fetchSensorData, startCountdown]);

  // --------------------------
  // Live Sensor Updates for UI only
  // --------------------------
  useEffect(() => {
    if (!autoScanRunning) return;

    const liveInterval = setInterval(fetchSensorData, 1000); // fetch for display only
    return () => clearInterval(liveInterval);
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // Initialize Dashboard
  // --------------------------
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase.from("device_scanning").select("*").eq("id", 1).single();
      if (!data) return;

      setAutoScanRunning(data.status === 1);

      if (data.status === 1 && data.latest_sensor) {
        setSensorData(data.latest_sensor);
        computeOverallSafety(data.latest_sensor);
      }

      // Continue countdown from persisted next_auto_save_ts
      let nextTS;
      if (data.next_auto_save_ts && data.next_auto_save_ts > Date.now()) {
        nextTS = data.next_auto_save_ts;
      } else if (data.status === 1) {
        nextTS = Date.now() + FIXED_INTERVAL;
        await supabase.from("device_scanning").update({ next_auto_save_ts: nextTS }).eq("id", 1);
      }

      if (nextTS) startCountdown(nextTS);
    };

    fetchInitial();
  }, [computeOverallSafety, startCountdown]);

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

  // --------------------------
  // Manual Save
  // --------------------------
  const handleManualSave = useCallback(async () => {
    try {
      setStatus("💾 Saving manually...");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        setStatus("❌ No logged-in user.");
        return;
      }

      const saveData = {
        user_id: userData.user.id,
        ph: parseFloat(sensorData.ph) || null,
        turbidity: parseFloat(sensorData.turbidity) || null,
        temperature: parseFloat(sensorData.temp) || null,
        tds: parseFloat(sensorData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) setStatus("❌ Manual save failed.");
      else setStatus(`💾 Manual save successful at ${new Date().toLocaleTimeString()}`);
    } catch {
      setStatus("❌ Manual save error.");
    }
  }, [sensorData]);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>

        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleManualSave}>Save Now</button>
            <button
              className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>
          {autoScanRunning && (
            <div className="countdown-timer">
              ⏱ Next auto-save in: <strong>{Math.floor(countdown / 60)}m {countdown % 60}s</strong>
            </div>
          )}
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map(key => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>{sensorData[key]} {key === "turbidity" ? "NTU" : key === "temp" ? "°C" : key === "tds" ? "ppm" : ""}</p>
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
