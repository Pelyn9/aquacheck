// src/pages/Dashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";

import { database } from "../firebase";
import { ref, push } from "firebase/database";
import { AdminContext } from "../App";

const Dashboard = () => {
  const { isAdmin } = useContext(AdminContext);
  const navigate = useNavigate();

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [intervalTime, setIntervalTime] = useState(1800000); // 30 minutes
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  // Fetch sensor data
  const fetchSensorData = async () => {
    try {
      const response = await fetch("http://192.168.0.100:5000/sensor-data");
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();

      const formattedData = {
        ph: parseFloat(data.ph).toFixed(2),
        turbidity: `${parseFloat(data.turbidity).toFixed(1)} NTU`,
        temp: `${parseFloat(data.temp).toFixed(1)}°C`,
        tds: `${parseFloat(data.tds).toFixed(0)} ppm`,
      };

      setSensorData(formattedData);
      setStatus("✅ Data fetched from sensor!");
    } catch (error) {
      console.error("❌ Error fetching sensor data:", error);
      setStatus("❌ Failed to fetch data. Check device connection.");
    }
  };

  // Auto scan for admins
  useEffect(() => {
    if (!isAdmin || !autoScanRunning) return;
    fetchSensorData();
    const interval = setInterval(fetchSensorData, intervalTime);
    return () => clearInterval(interval);
  }, [autoScanRunning, intervalTime, isAdmin]);

  // Auto-save to Firebase (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    const dailySave = setInterval(() => {
      const historyRef = ref(database, "sensorHistory/");
      const newEntry = { ...sensorData, timestamp: new Date().toISOString() };

      push(historyRef, newEntry)
        .then(() => console.log("✅ Auto-saved:", newEntry))
        .catch((err) => console.error("❌ Auto-save failed:", err));
    }, 86400000);
    return () => clearInterval(dailySave);
  }, [sensorData, isAdmin]);

  // Manual save (admin only)
  const handleSave = () => {
    if (!isAdmin) return;
    const historyRef = ref(database, "sensorHistory/");
    const newEntry = { ...sensorData, timestamp: new Date().toISOString() };

    push(historyRef, newEntry)
      .then(() => setStatus("✅ Data saved to history!"))
      .catch(() => setStatus("❌ Failed to save to history."));
  };

  const toggleAutoScan = () => {
    setAutoScanRunning((prev) => !prev);
  };

  const handleManualScanClick = () => {
    if (!autoScanRunning) {
      navigate("/manual-scan", { state: { autoScanRunning } }); // ✅ send state
    } else {
      setStatus("⚠️ Stop Auto Scan before using Manual Scan.");
    }
  };

  return (
    <div className="container">
      {isAdmin && <Sidebar />}
      <main
        className={`main-content ${!isAdmin ? "visitor-mode" : ""}`}
        style={{ marginLeft: isAdmin ? undefined : 0 }}
      >
        {/* Header */}
        {isAdmin ? (
          <header className="topbar">
            <h1>Dashboard</h1>
          </header>
        ) : (
          <div className="wave-header">
            AquaCheck – Real-Time Water Quality
          </div>
        )}

        {/* Sensor Section */}
        <section className="sensor-section" id="dashboard">
          {!isAdmin && (
            <h2 className="visitor-subtitle">Live Sensor Readings</h2>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="scan-controls">
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
                  className="manual-scan-btn"
                  onClick={handleManualScanClick}
                  disabled={autoScanRunning} // ✅ disable button if running
                >
                  Manual Scan
                </button>

                <button
                  className="manual-scan-btn save-btn"
                  onClick={handleSave}
                >
                  Save
                </button>

                <button
                  className={`manual-scan-btn start-stop-btn ${
                    autoScanRunning ? "stop" : "start"
                  }`}
                  onClick={toggleAutoScan}
                >
                  {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
                </button>
              </div>
            </div>
          )}

          {/* Sensor Cards */}
          <div className="sensor-grid">
            <div className="sensor-card">
              <h3>pH Level</h3>
              <p>{sensorData.ph}</p>
            </div>
            <div className="sensor-card">
              <h3>Turbidity</h3>
              <p>{sensorData.turbidity}</p>
            </div>
            <div className="sensor-card">
              <h3>Temperature</h3>
              <p>{sensorData.temp}</p>
            </div>
            <div className="sensor-card">
              <h3>TDS</h3>
              <p>{sensorData.tds}</p>
            </div>
          </div>

          {/* Status */}
          <div id="water-status" className="status-card">
            {status}
          </div>
        </section>

        {/* Footer */}
        {!isAdmin && (
          <footer>
            <p>© 2025 AquaCheck System. All rights reserved.</p>
          </footer>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
