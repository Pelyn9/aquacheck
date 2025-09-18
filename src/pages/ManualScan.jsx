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

  // Generate realistic values
  const generateSensorValue = (sensor) => {
    switch (sensor) {
      case "pH Level":
        return (Math.random() * (8.5 - 6.5) + 6.5).toFixed(2);
      case "Turbidity":
        return (Math.random() * 10).toFixed(2) + " NTU";
      case "Temperature":
        return (Math.random() * (35 - 20) + 20).toFixed(2) + " °C";
      case "TDS":
        return (Math.random() * (600 - 100) + 100).toFixed(2) + " ppm";
      default:
        return "N/A";
    }
  };

  // Scan selected sensors
  const handleScan = () => {
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

  // Scan all sensors
  const handleScanAll = () => {
    setScanning(true);
    setStatus("Scanning all sensors...");

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

  // Save scan results to Supabase
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

    const toNum = (v) => {
      if (!v) return null;
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : n;
    };

    const data = {
      user_id: user.id, // Include user_id for RLS
      ph: toNum(results["pH Level"]),
      turbidity: toNum(results["Turbidity"]),
      temperature: toNum(results["Temperature"]),
      tds: toNum(results["TDS"]),
    };

    if ([data.ph, data.turbidity, data.temperature, data.tds].every(v => v === null)) {
      setStatus("No numeric values found. Please scan again.");
      return;
    }

    const { error } = await supabase.from("dataset_history").insert([data]);

    if (error) {
      console.error("Error saving scan:", error.message);
      setStatus("Failed to save scan. Check RLS policy.");
    } else {
      setStatus("Scan saved to history!");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="manualscan-container">
        <div className="manualscan-header">
          <h1>Manual Scan</h1>
          <p>
            Select which sensors you want to scan and save manually.
            <br />
            <strong>Auto Scan must be stopped</strong> to enable manual scanning.
          </p>
        </div>

        {/* Sensor cards */}
        <div className="sensor-grid">
          {sensors.map((sensor) => (
            <div
              key={sensor}
              className={`sensor-card ${
                selectedSensors.includes(sensor) ? "selected" : ""
              }`}
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
                  <li key={key}>
                    <span className="sensor-label">{key}:</span>{" "}
                    <span className="sensor-value">{value}</span>
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
