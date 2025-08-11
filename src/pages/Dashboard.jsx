import React, { useState, useEffect, useContext } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";

import { database } from "../firebase";
import { ref, push } from "firebase/database";
import { AdminContext } from "../App";

const Dashboard = () => {
  const { isAdmin } = useContext(AdminContext);

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [intervalTime, setIntervalTime] = useState(1800000); // 30 minutes default
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  // Fetch sensor data from API
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

  // Auto scan effect: only if admin and running
  useEffect(() => {
    if (!isAdmin || !autoScanRunning) return;

    fetchSensorData(); // fetch immediately

    const interval = setInterval(fetchSensorData, intervalTime);
    return () => clearInterval(interval);
  }, [autoScanRunning, intervalTime, isAdmin]);

  // Auto-save to Firebase every 24h (admin only)
  useEffect(() => {
    if (!isAdmin) return;

    const dailySave = setInterval(() => {
      const historyRef = ref(database, "sensorHistory/");
      const newEntry = {
        ...sensorData,
        timestamp: new Date().toISOString(),
      };

      push(historyRef, newEntry)
        .then(() => console.log("✅ Auto-saved to Firebase:", newEntry))
        .catch((err) => console.error("❌ Auto-save failed:", err));
    }, 86400000);

    return () => clearInterval(dailySave);
  }, [sensorData, isAdmin]);

  // Manual save to Firebase (admin only)
  const handleSave = () => {
    if (!isAdmin) return;

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
      .catch(() => {
        setStatus("❌ Failed to save to history.");
      });
  };

  // Toggle auto scan start/stop
  const toggleAutoScan = () => {
    setAutoScanRunning((prev) => !prev);
  };

  return (
    <div className="container">
      {isAdmin && <Sidebar />}
      <main
        className="main-content"
        style={{ marginLeft: isAdmin ? undefined : 0 }}
      >
        <header className="topbar">
          <h1>AquaCheck</h1>
        </header>

        <section className="sensor-section" id="dashboard">
          <h2>Real-Time Water Sensor Data</h2>

          {/* Show controls only if admin */}
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
                  onClick={fetchSensorData}
                  disabled={autoScanRunning}
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
