// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { AutoScanContext } from "../context/AutoScanContext";
import { supabase } from "../supabaseClient";

// Detect backend URL
const API_BASE =
  process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/admin`
    : "https://aquacheck-backend.vercel.app/api/admin"; // change if you deployed elsewhere

const AdminDashboard = () => {
  const navigate = useNavigate();
  const {
    autoScanRunning,
    startAutoScan,
    stopAutoScan,
    intervalTime,
    setIntervalTime,
  } = useContext(AutoScanContext);

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [, setMasterPassword] = useState("");

  // ✅ Load or initialize master password
  useEffect(() => {
    const storedPass = localStorage.getItem("masterPassword");
    if (storedPass) {    
      setMasterPassword(storedPass);
    } else {
      // Auto-create default
      const defaultPass = "watercheck123";
      localStorage.setItem("masterPassword", defaultPass);
      setMasterPassword(defaultPass);

      // Optional: Sync to backend
      fetch(`${API_BASE}/master-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: defaultPass }),
      }).catch((err) =>
        console.warn("⚠️ Failed to sync master password:", err.message)
      );
    }
  }, []);

  // Fetch and auto-save
  const fetchAndSaveSensorData = async () => {
    try {
      const response = await fetch("http://192.168.0.100:5000/sensor-data");
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      const newData = {
        ph: data.ph ? parseFloat(data.ph).toFixed(2) : "N/A",
        turbidity: data.turbidity ? parseFloat(data.turbidity).toFixed(1) : "N/A",
        temp: data.temp ? parseFloat(data.temp).toFixed(1) : "N/A",
        tds: data.tds ? parseFloat(data.tds).toFixed(0) : "N/A",
      };
      setSensorData(newData);

      // Auto-save to Supabase
      const { error } = await supabase.from("sensor_logs").insert([
        { ...newData, timestamp: new Date().toISOString() },
      ]);
      if (error) throw error;

      setStatus("✅ Data fetched and saved successfully!");
    } catch (error) {
      console.error("❌ Error:", error);
      setStatus("❌ Failed to fetch/save data. Check your connection.");
    }
  };

  // Manual save
  const handleSave = async () => {
    try {
      const { error } = await supabase.from("sensor_logs").insert([
        { ...sensorData, timestamp: new Date().toISOString() },
      ]);
      if (error) throw error;
      setStatus("✅ Data saved manually!");
    } catch (error) {
      console.error("❌ Manual save failed:", error);
      setStatus("❌ Failed to save data manually!");
    }
  };

  const toggleAutoScan = () => {
    if (autoScanRunning) stopAutoScan();
    else startAutoScan(fetchAndSaveSensorData);
  };

  const handleManualScanClick = () => {
    if (!autoScanRunning) navigate("/manual-scan");
    else setStatus("⚠️ Stop Auto Scan before using Manual Scan.");
  };

  // === Sensor Status ===
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "unknown";
    const val = parseFloat(value);
    switch (type) {
      case "ph":
        if (val >= 6.5 && val <= 8.5) return "safe";
        if ((val >= 6 && val < 6.5) || (val > 8.5 && val <= 9)) return "caution";
        return "unsafe";
      case "turbidity":
        if (val <= 5) return "safe";
        if (val > 5 && val <= 10) return "caution";
        return "unsafe";
      case "temp":
        if (val >= 24 && val <= 32) return "safe";
        if ((val >= 20 && val < 24) || (val > 32 && val <= 35)) return "caution";
        return "unsafe";
      case "tds":
        if (val <= 500) return "safe";
        if (val > 500 && val <= 1000) return "caution";
        return "unsafe";
      default:
        return "unknown";
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Admin Dashboard</h1>
        </header>

        <section className="scan-controls">
          <div className="interval-setting">
            <label htmlFor="scanInterval">Set Auto Scan Interval:</label>
            <select
              id="scanInterval"
              value={intervalTime}
              onChange={(e) => setIntervalTime(Number(e.target.value))}
              disabled={autoScanRunning}
            >
              <option value={1800000}>Every 30 Minutes</option>
              <option value={3600000}>Every 1 Hour</option>
              <option value={7200000}>Every 2 Hours</option>
              <option value={10800000}>Every 3 Hours</option>
              <option value={14400000}>Every 4 Hours</option>
              <option value={86400000}>Every 24 Hours</option>
            </select>
          </div>

          <div className="button-group">
            <button
              className={`manual-scan-btn ${autoScanRunning ? "disabled" : ""}`}
              onClick={handleManualScanClick}
              disabled={autoScanRunning}
            >
              Manual Scan
            </button>
            <button className="save-btn" onClick={handleSave}>
              Save
            </button>
            <button
              className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map((key) => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>
                {sensorData[key]}{" "}
                {key === "turbidity"
                  ? "NTU"
                  : key === "temp"
                  ? "°C"
                  : key === "tds"
                  ? "ppm"
                  : ""}
              </p>
            </div>
          ))}
        </section>

        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
