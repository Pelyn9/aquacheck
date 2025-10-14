import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import "../assets/manualscan.css";

const ManualScan = () => {
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [results, setResults] = useState({});
  const [status, setStatus] = useState("Select sensors and click Scan.");
  const [scanning, setScanning] = useState(false);

  const sensors = ["pH Level", "Turbidity", "Temperature", "TDS"];

  // Toggle sensor selection
  const toggleSensor = (sensor) => {
    setSelectedSensors((prev) =>
      prev.includes(sensor)
        ? prev.filter((s) => s !== sensor)
        : [...prev, sensor]
    );
  };

  // =================== Demo Sensor Status ===================
  const getStatus = (sensor, value) => {
    if (value === null || value === undefined) return "Unknown";
    switch (sensor) {
      case "pH Level":
        if (value >= 6.5 && value <= 8.5) return "Safe";
        if ((value >= 6 && value < 6.5) || (value > 8.5 && value <= 9)) return "Moderate";
        return "Unsafe";
      case "Turbidity":
        if (value <= 5) return "Safe";
        if (value > 5 && value <= 10) return "Moderate";
        return "Unsafe";
      case "Temperature":
        if (value >= 24 && value <= 32) return "Safe";
        if ((value >= 20 && value < 24) || (value > 32 && value <= 35)) return "Moderate";
        return "Unsafe";
      case "TDS":
        if (value <= 500) return "Safe";
        if (value > 500 && value <= 1000) return "Moderate";
        return "Unsafe";
      default:
        return "Unknown";
    }
  };

  const getColor = (status) => {
    switch (status) {
      case "Safe":
        return "green";
      case "Moderate":
        return "orange";
      case "Unsafe":
        return "red";
      default:
        return "gray";
    }
  };

  // =================== Demo Value Generator ===================
  const generateSensorValue = (sensor) => {
    switch (sensor) {
      case "pH Level":
        return parseFloat((6 + Math.random() * 3).toFixed(2)); // 6-9
      case "Turbidity":
        return parseFloat((Math.random() * 12).toFixed(1)); // 0-12
      case "Temperature":
        return parseFloat((20 + Math.random() * 15).toFixed(1)); // 20-35°C
      case "TDS":
        return parseFloat((200 + Math.random() * 900).toFixed(0)); // 200-1100 ppm
      default:
        return null;
    }
  };

  // =================== Scan Functions ===================
  const handleScan = () => {
    if (selectedSensors.length === 0) return;
    setScanning(true);
    setStatus("🔍 Scanning selected sensors...");

    setTimeout(() => {
      const now = new Date().toLocaleString();
      const newResults = {};
      selectedSensors.forEach((sensor) => {
        newResults[sensor] = generateSensorValue(sensor);
      });
      setResults({ time: now, ...newResults });
      setStatus(`Scan complete at ${now}`);
      setScanning(false);
    }, 2000);
  };

  const handleScanAll = () => {
    setScanning(true);
    setStatus("🔍 Scanning all sensors...");

    setTimeout(() => {
      const now = new Date().toLocaleString();
      const allResults = {};
      sensors.forEach((sensor) => {
        allResults[sensor] = generateSensorValue(sensor);
      });
      setResults({ time: now, ...allResults });
      setStatus(`Full scan complete at ${now}`);
      setScanning(false);
    }, 2500);
  };

  // =================== Save Function ===================
  const handleSave = async () => {
    if (!results.time) {
      setStatus("⚠ No results to save. Please scan first.");
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setStatus("User not authenticated. Please log in.");
      return;
    }

    const data = {
      user_id: user.id,
      ph: results["pH Level"] ?? null,
      turbidity: results["Turbidity"] ?? null,
      temperature: results["Temperature"] ?? null,
      tds: results["TDS"] ?? null,
    };

    const { error } = await supabase.from("dataset_history").insert([data]);

    if (error) {
      console.error("Error saving scan:", error.message);
      setStatus("❌ Failed to save scan. Check RLS policy or DB schema.");
    } else {
      setStatus("✅ Scan saved to history!");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="manualscan-container">
        <div className="manualscan-header">
          <h1>Manual Scan</h1>
          <p>Select which sensors you want to scan and save manually.<br/>
          <strong>Auto Scan must be stopped</strong> to enable manual scanning.</p>
        </div>

        {/* Sensor Cards */}
        <div className="sensor-grid">
          {sensors.map((sensor) => (
            <div
              key={sensor}
              className={`sensor-card ${selectedSensors.includes(sensor) ? "selected" : ""}`}
              onClick={() => toggleSensor(sensor)}
            >
              {sensor}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="button-row">
          {selectedSensors.length > 0 && (
            <button className="scan-btn" onClick={handleScan} disabled={scanning}>
              Scan Selected
            </button>
          )}
          <button className="scan-all-btn" onClick={handleScanAll} disabled={scanning}>
            Scan All
          </button>
          <button className="save-btn" onClick={handleSave} disabled={!results.time}>
            Save Results
          </button>
        </div>

        {/* Results */}
        {results.time && (
          <div className="results-box">
            <h3>Results (at {results.time})</h3>
            <ul>
              {Object.entries(results)
                .filter(([key]) => key !== "time")
                .map(([key, value]) => (
                  <li key={key} style={{ color: getColor(getStatus(key, value)) }}>
                    <span className="sensor-label">{key}:</span>{" "}
                    <span className="sensor-value">
                      {value} {key === "Turbidity" ? "NTU" : ""}
                      {key === "Temperature" ? " °C" : ""}
                      {key === "TDS" ? " ppm" : ""}
                      {" → "}{getStatus(key, value)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="status-box">{status}</div>
        <button className="back-btn" onClick={() => window.history.back()}>
          ⬅ Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ManualScan;
