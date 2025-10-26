import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/manualscan.css";

const ManualScan = () => {
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [results, setResults] = useState({});
  const [status, setStatus] = useState("Select sensors and click Scan.");
  const [scanning, setScanning] = useState(false);

  const sensors = ["pH Level", "Turbidity", "Temperature", "TDS"];

  const toggleSensor = (sensor) => {
    setSelectedSensors((prev) =>
      prev.includes(sensor)
        ? prev.filter((s) => s !== sensor)
        : [...prev, sensor]
    );
  };

  const getStatus = (sensor, value) => {
    if (
      value === null ||
      value === undefined ||
      (sensor === "pH Level" && value === 7) ||
      (sensor === "Turbidity" && value === 0) ||
      (sensor === "Temperature" && value === 0) ||
      (sensor === "TDS" && value === 0)
    ) {
      return "Unknown";
    }

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
      case "Safe": return "green";
      case "Moderate": return "orange";
      case "Unsafe": return "red";
      case "Unknown": return "gray";
      default: return "gray";
    }
  };

  const fetchSensorData = async () => {
    const API_URL = "http://aquacheck.local:5000/data";
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Server unreachable");
    return await response.json();
  };

  const handleScan = async () => {
    if (selectedSensors.length === 0) {
      setStatus("⚠ Please select at least one sensor.");
      return;
    }

    setScanning(true);
    setStatus("⏳ Fetching selected sensor data... Please wait 5 seconds.");

    setTimeout(async () => {
      try {
        const data = await fetchSensorData();
        const now = new Date().toLocaleString();
        const newResults = {};

        selectedSensors.forEach((sensor) => {
          switch (sensor) {
            case "pH Level": newResults[sensor] = data.ph ?? null; break;
            case "Turbidity": newResults[sensor] = data.turbidity ?? null; break;
            case "Temperature": newResults[sensor] = data.temperature ?? null; break;
            case "TDS": newResults[sensor] = data.tds ?? null; break;
            default: newResults[sensor] = null;
          }
        });

        const overall = Object.entries(newResults).reduce((acc, [key, value]) => {
          const s = getStatus(key, value);
          if (s === "Unsafe") return "Unsafe";
          if (s === "Moderate" && acc !== "Unsafe") return "Moderate";
          if (s === "Unknown" && acc === "Safe") return "Unknown";
          return acc;
        }, "Safe");

        setResults({ time: now, overall, ...newResults });
        setStatus(`✅ Selected data fetched at ${now}`);
      } catch (error) {
        console.error(error);
        setStatus("❌ Failed to fetch selected data. Check your backend.");
      } finally {
        setScanning(false);
      }
    }, 5000);
  };

  const handleScanAll = async () => {
    setSelectedSensors([...sensors]);
    await handleScan();
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="manualscan-container">
        <div className="manualscan-header">
          <h1>Manual Scan</h1>
        </div>

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

        <div className="button-row">
          {selectedSensors.length > 0 && (
            <button className="scan-btn" onClick={handleScan} disabled={scanning}>
              Scan Selected
            </button>
          )}
          <button className="scan-all-btn" onClick={handleScanAll} disabled={scanning}>
            Scan All
          </button>
        </div>

        {results.time && (
          <div className="results-box">
            <h3>Results (at {results.time})</h3>
            <ul>
              {Object.entries(results)
                .filter(([key]) => !["time", "overall"].includes(key))
                .map(([key, value]) => (
                  <li key={key} style={{ color: getColor(getStatus(key, value)) }}>
                    <span className="sensor-label">{key}:</span>{" "}
                    <span className="sensor-value">
                      {value !== null && value !== undefined ? value : "No Data"}{" "}
                      {key === "Turbidity" ? "NTU" : ""}
                      {key === "Temperature" ? "°C" : ""}
                      {key === "TDS" ? "ppm" : ""}
                      {" → "}
                      {getStatus(key, value)}
                    </span>
                  </li>
                ))}
            </ul>
            <p>
              <strong>Overall Result:</strong>{" "}
              <span style={{ color: getColor(results.overall) }}>{results.overall}</span>
            </p>
          </div>
        )}

        <div className="status-box">{status}</div>

        <button className="back-btn" onClick={() => window.history.back()}>
          ⬅ Back to Master Admin 
        </button>
      </div>
    </div>
  );
};

export default ManualScan;
