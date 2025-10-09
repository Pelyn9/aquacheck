import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { AutoScanContext } from "../context/AutoScanContext";
import { supabase } from "../supabaseClient";

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

  // === Fetch Sensor Data ===
  const fetchSensorData = async () => {
    try {
      const response = await fetch("http://192.168.0.100:5000/sensor-data");
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      setSensorData({
        ph: data.ph ? parseFloat(data.ph).toFixed(2) : "N/A",
        turbidity: data.turbidity
          ? parseFloat(data.turbidity).toFixed(1)
          : "N/A",
        temp: data.temp ? parseFloat(data.temp).toFixed(1) : "N/A",
        tds: data.tds ? parseFloat(data.tds).toFixed(0) : "N/A",
      });
      setStatus("✅ Data fetched successfully!");
    } catch (error) {
      console.error("❌ Error fetching sensor data:", error);
      setStatus("❌ Failed to fetch data. Check your connection.");
    }
  };

  // === Sensor Status Evaluation ===
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

  // === Auto-Save Once a Day ===
  useEffect(() => {
    const dailySave = setInterval(async () => {
      const newEntry = { ...sensorData, timestamp: new Date().toISOString() };
      const { error } = await supabase.from("sensor_logs").insert([newEntry]);
      if (error) console.error("Auto-save failed:", error);
    }, 86400000); // Every 24 hours
    return () => clearInterval(dailySave);
  }, [sensorData]);

  const handleSave = async () => {
    const newEntry = { ...sensorData, timestamp: new Date().toISOString() };
    const { error } = await supabase.from("sensor_logs").insert([newEntry]);
    if (error) setStatus("❌ Failed to save data!");
    else setStatus("✅ Data saved successfully!");
  };

  const toggleAutoScan = () => {
    if (autoScanRunning) stopAutoScan();
    else startAutoScan(fetchSensorData);
  };

  const handleManualScanClick = () => {
    if (!autoScanRunning) {
      navigate("/manual-scan", { state: { autoScanRunning } });
    } else {
      setStatus("⚠️ Stop Auto Scan before using Manual Scan.");
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <header className="topbar">
          <h1>Admin Dashboard</h1>
        </header>

        {/* Scan Controls */}
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

        {/* Sensor Grid */}
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

        {/* Status */}
        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
