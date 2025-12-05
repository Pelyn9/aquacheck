// src/pages/AdminDashboard.jsx
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
    tds: 0
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
      setStatus("✅ ESP32 data fetched.");
      return formatted;
    } catch (err) {
      console.warn("ESP32 fetch failed, trying cloud backup...");
      try {
        const cloudRes = await fetch("/api/data", { cache: "no-store" });
        const cloudJson = await cloudRes.json();
        const latest = cloudJson.latestData || {};
        const formatted = {
          ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
          turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
          temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
          tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
        };
        setSensorData(formatted);
        computeOverallSafety(formatted);
        setStatus("🌐 Cloud backup used.");
        return formatted;
      } catch (err2) {
        console.error("Both ESP32 & Cloud failed:", err2);
        setStatus("❌ Failed to fetch data");
        setOverallSafety("N/A");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  // --------------------------
  // Auto Save with Zero Logic
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

      const newLastSavedZero = { ...lastSavedZero };
      Object.entries(data).forEach(([key, value]) => {
        if (parseFloat(value) === 0) newLastSavedZero[key] = now;
      });
      setLastSavedZero(newLastSavedZero);

      const saveData = {
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      const nextTS = now + FIXED_INTERVAL;
      await supabase.from("device_scanning")
        .update({ last_scan_time: new Date().toISOString(), next_auto_save_ts: nextTS, latest_sensor: data })
        .eq("id", 1);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Auto-save failed.");
    }
  }, [fetchSensorData, lastSavedZero, autoScanRunning]);

  // --------------------------
  // Manual Save (Save Now Button)
  // --------------------------
  const handleManualSave = useCallback(async () => {
    const data = await fetchSensorData();
    if (!data) return;

    try {
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

      setStatus(`💾 Manual save completed at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Manual save failed.");
    }
  }, [fetchSensorData]);

  // --------------------------
  // Smooth Countdown
  // --------------------------
  const startCountdown = useCallback((nextTS) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (!autoScanRunning) {
        clearInterval(intervalRef.current);
        return;
      }
      const remaining = nextTS - Date.now();
      setCountdown(Math.max(Math.floor(remaining / 1000), 0));

      if (remaining <= 0) {
        await handleAutoSave();
        const newNextTS = Date.now() + FIXED_INTERVAL;
        startCountdown(newNextTS);
      }
    }, 1000);
  }, [autoScanRunning, handleAutoSave]);

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
        const data = await fetchSensorData();
        if (data) {
          await supabase.from("device_scanning")
            .update({ latest_sensor: data })
            .eq("id", 1);
        }
        if (nextTS) startCountdown(nextTS);
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
  // Real-time Supabase listener
  // --------------------------
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase.from("device_scanning").select("*").eq("id", 1).single();
      if (!data) return;

      setAutoScanRunning(data.status === 1);

      if (data.status === 1 && data.latest_sensor) {
        setSensorData(data.latest_sensor);
        computeOverallSafety(data.latest_sensor);
      } else if (data.status === 0) {
        setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
        setOverallSafety("N/A");
      }

      if (data.next_auto_save_ts) startCountdown(data.next_auto_save_ts);
    };
    fetchInitial();

    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning", filter: "id=eq.1" },
        (payload) => {
          const isRunning = payload.new.status === 1;
          setAutoScanRunning(isRunning);

          if (isRunning && payload.new.latest_sensor) {
            setSensorData(payload.new.latest_sensor);
            computeOverallSafety(payload.new.latest_sensor);
          } else {
            setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
            setOverallSafety("N/A");
          }

          if (payload.new.next_auto_save_ts) startCountdown(payload.new.next_auto_save_ts);
          else setCountdown(0);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
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
