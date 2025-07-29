import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";

const Dashboard = () => {
  const [sensorData, setSensorData] = useState({
    ph: "7.2",
    turbidity: "3.5 NTU",
    temp: "26°C",
    tds: "450 ppm",
  });

  const [intervalTime, setIntervalTime] = useState(60000); // Default: 1 minute
  const [status, setStatus] = useState("Checking water safety...");

  // Simulate fetching sensor data
  const fetchSensorData = () => {
    const newData = {
      ph: (6.5 + Math.random()).toFixed(2),
      turbidity: (3 + Math.random()).toFixed(1) + " NTU",
      temp: (25 + Math.random()).toFixed(1) + "°C",
      tds: Math.floor(400 + Math.random() * 100) + " ppm",
    };
    setSensorData(newData);
    setStatus("Data fetched successfully!");
  };

  // Auto scan interval
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSensorData();
    }, intervalTime);
    return () => clearInterval(interval);
  }, [intervalTime]);

  // Save every 24 hours (optional logic placeholder)
  useEffect(() => {
    const dailySave = setInterval(() => {
      console.log("✅ Auto-saved to history:", sensorData);
    }, 86400000); // 24 hours
    return () => clearInterval(dailySave);
  }, [sensorData]);

  // Save button manually logs data
  const handleSave = () => {
    console.log("✅ Manually saved to history:", sensorData);
  };

  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Welcome, Admin</h1>
        </header>

        <section className="sensor-section" id="dashboard">
          <h2>Real-Time Water Sensor Data</h2>

          {/* Scan Controls Row */}
          <div className="scan-controls">
            <div className="interval-setting">
              <label htmlFor="scanInterval">Set Auto Scan Interval:</label>
              <select
                id="scanInterval"
                onChange={(e) => setIntervalTime(Number(e.target.value))}
              >
                <option value={60000}>Every 1 Minute</option>
                <option value={300000}>Every 5 Minutes</option>
                <option value={900000}>Every 15 Minutes</option>
                <option value={1800000}>Every 30 Minutes</option>
                <option value={3600000}>Every 1 Hour</option>
                <option value={7200000}>Every 2 Hours</option>
                <option value={10800000}>Every 3 Hours</option>
                <option value={14400000}>Every 4 Hours</option>
                <option value={86400000}>Every 24 Hours</option>
              </select>
            </div>

            <div className="button-group">
              <button className="manual-scan-btn" onClick={fetchSensorData}>
                Manual Scan
              </button>
              <button className="manual-scan-btn save-btn" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>

          {/* Sensor Data Cards */}
          <div className="sensor-grid">
            <div className="sensor-card"><h3>pH Level</h3><p>{sensorData.ph}</p></div>
            <div className="sensor-card"><h3>Turbidity</h3><p>{sensorData.turbidity}</p></div>
            <div className="sensor-card"><h3>Temperature</h3><p>{sensorData.temp}</p></div>
            <div className="sensor-card"><h3>TDS</h3><p>{sensorData.tds}</p></div>
          </div>

          <div id="water-status" className="status-card">{status}</div>
        </section>

        <footer>
          <p>© 2025 AquaCheck System. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
