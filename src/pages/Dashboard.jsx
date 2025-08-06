import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";

import { database } from "../firebase"; // ✅ Firebase config
import { ref, push } from "firebase/database"; // ✅ Realtime DB functions

const Dashboard = () => {
  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [intervalTime, setIntervalTime] = useState(60000); // Default: 1 minute
  const [status, setStatus] = useState("Awaiting sensor data...");

  // ✅ Fetch real sensor data from backend
  const fetchSensorData = async () => {
    try {
      const response = await fetch("http://192.168.0.100:5000/sensor-data"); // ← Replace with your local IP
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

  // ✅ Auto scan at selected interval
  useEffect(() => {
    const interval = setInterval(fetchSensorData, intervalTime);
    return () => clearInterval(interval);
  }, [intervalTime]);

  // ✅ Auto-save to Firebase every 24 hours
  useEffect(() => {
    const dailySave = setInterval(() => {
      const historyRef = ref(database, "sensorHistory/");
      const newEntry = {
        ...sensorData,
        timestamp: new Date().toISOString(),
      };

      push(historyRef, newEntry)
        .then(() => {
          console.log("✅ Auto-saved to Firebase:", newEntry);
        })
        .catch((err) => {
          console.error("❌ Auto-save failed:", err);
        });
    }, 86400000); // 24 hours

    return () => clearInterval(dailySave);
  }, [sensorData]);

  // ✅ Manual save to Firebase
  const handleSave = () => {
    const historyRef = ref(database, "sensorHistory/");
    const newEntry = {
      ...sensorData,
      timestamp: new Date().toISOString(),
    };

    push(historyRef, newEntry)
      .then(() => {
        console.log("✅ Manually saved to Firebase:", newEntry);
        setStatus("✅ Data saved to history!");
      })
      .catch((error) => {
        console.error("❌ Failed to save:", error);
        setStatus("❌ Failed to save to history.");
      });
  };

  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Dashboard</h1>
        </header>

        <section className="sensor-section" id="dashboard">
          <h2>Real-Time Water Sensor Data</h2>

          {/* Scan Controls */}
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

          {/* Sensor Data Grid */}
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

          <div id="water-status" className="status-card">
            {status}
          </div>
        </section>

        <footer>
          <p>© 2025 AquaCheck System. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
