import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const FIXED_INTERVAL = 900000; // 15 minutes in milliseconds

const AdminDashboard = () => {
  const [sensorData, setSensorData] = useState({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [status, setStatus] = useState("Awaiting data...");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  const esp32Url = process.env.NODE_ENV === "production"
    ? "/api/data" // Vercel
    : "http://aquacheck.local:5000/data"; // Local ESP32

  // ---------------------- Compute Overall Safety ----------------------
  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every(v => v === "N/A")) {
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

  // ---------------------- Fetch Sensor Data ----------------------
  const fetchSensorData = useCallback(async () => {
    try {
      const res = await fetch(esp32Url);
      const data = await res.json();
      const latest = data.latestData || data;

      const formatted = {
        ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
      };

      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("✅ Data fetched successfully.");
      return formatted;
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setStatus("❌ Failed to fetch data.");
      return null;
    }
  }, [esp32Url, computeOverallSafety]);

  // ---------------------- Save Data to Supabase ----------------------
  const saveData = useCallback(async (data) => {
    if (!data || Object.values(data).every(v => v === "N/A")) {
      setStatus("⚠ No valid data to save.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("⚠ User not authenticated."); return; }

      const saveData = {
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatus(`✅ Data saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Error saving data.");
    }
  }, []);

  // ---------------------- Auto Scan Logic ----------------------
  const startAutoScan = useCallback(() => {
    const now = Date.now();
    localStorage.setItem("autoScanStartTime", now.toString());
    localStorage.setItem("autoScanRunning", "true");
    setAutoScanRunning(true);
  }, []);

  const stopAutoScan = useCallback(() => {
    localStorage.setItem("autoScanRunning", "false");
    localStorage.removeItem("autoScanStartTime");
    setCountdown(FIXED_INTERVAL / 1000);
    setAutoScanRunning(false);
    setStatus("🛑 Auto Scan stopped.");
  }, []);

  const toggleAutoScan = useCallback(() => {
    if (autoScanRunning) stopAutoScan();
    else startAutoScan();
  }, [autoScanRunning, startAutoScan, stopAutoScan]);

  // ---------------------- Countdown Timer ----------------------
  useEffect(() => {
    const interval = setInterval(async () => {
      const startTime = parseInt(localStorage.getItem("autoScanStartTime"));
      if (!startTime) return;

      const elapsed = Date.now() - startTime;
      const remaining = FIXED_INTERVAL - (elapsed % FIXED_INTERVAL);
      setCountdown(Math.floor(remaining / 1000));

      // Auto-save every interval
      if (remaining <= 1000) {
        const latestData = await fetchSensorData();
        await saveData(latestData);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchSensorData, saveData]);

  // ---------------------- Fetch Latest Sensor Data Every 5s ----------------------
  useEffect(() => {
    const interval = setInterval(fetchSensorData, 5000);
    return () => clearInterval(interval);
  }, [fetchSensorData]);

  // ---------------------- Load State from localStorage ----------------------
  useEffect(() => {
    const running = localStorage.getItem("autoScanRunning") === "true";
    if (running) setAutoScanRunning(true);
  }, []);

  // ---------------------- Sensor Status Helper ----------------------
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";
    const val = parseFloat(value);
    switch(type){
      case "ph": return val>=6.5&&val<=8.5?"safe":"unsafe";
      case "turbidity": return val<=5?"safe":val<=10?"moderate":"unsafe";
      case "temp": return val>=24&&val<=32?"safe":"unsafe";
      case "tds": return val<=500?"safe":"unsafe";
      default: return "";
    }
  };

  // ---------------------- JSX ----------------------
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>

        <section className="scan-controls">
          <div className="button-group">
            <button className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`} onClick={toggleAutoScan}>
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>
          {autoScanRunning && (
            <div className="countdown-timer">
              ⏱ Next auto-save in: {Math.floor(countdown/60)}m {countdown%60}s
            </div>
          )}
        </section>

        <section className="sensor-grid">
          {["ph","turbidity","temp","tds"].map(key => (
            <div key={key} className={`sensor-card ${getSensorStatus(key,sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>{sensorData[key]} {key==="turbidity"?"NTU":key==="temp"?"°C":key==="tds"?"ppm":""}</p>
              <p className={`status-label ${getSensorStatus(key,sensorData[key])}`}>{getSensorStatus(key,sensorData[key]).toUpperCase()}</p>
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
