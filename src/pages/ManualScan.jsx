import React from "react";
import Sidebar from "../components/Sidebar"; // make sure this path is correct
import "../assets/manualscan.css"; // updated to point to assets folder

const ManualScan = () => {
  const handleScan = (sensor) => {
    console.log(`Scanning ${sensor}...`);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="manualscan-container">
        <div className="manualscan-header">
          <h1>Manual Scan</h1>
          <p>
            Choose which sensor to scan.{" "}
            <strong>Auto Scan must be stopped</strong> to enable manual scanning.
          </p>
        </div>

        {/* Sensor Cards */}
        <div className="manualscan-grid">
          <div className="scan-card ph" onClick={() => handleScan("pH Level")}>
            <h3>pH Level</h3>
            <span>💧</span>
          </div>
          <div
            className="scan-card turbidity"
            onClick={() => handleScan("Turbidity")}
          >
            <h3>Turbidity</h3>
            <span>🌫️</span>
          </div>
          <div
            className="scan-card temp"
            onClick={() => handleScan("Temperature")}
          >
            <h3>Temperature</h3>
            <span>🌡️</span>
          </div>
          <div className="scan-card tds" onClick={() => handleScan("TDS")}>
            <h3>TDS</h3>
            <span>💦</span>
          </div>
        </div>

        {/* Scan All Button */}
        <button className="scan-all-btn" onClick={() => handleScan("All")}>
          🚀 Scan All
        </button>

        {/* Status Box */}
        <div className="status-box">
          Select a sensor to scan manually.
        </div>

        {/* Back Button */}
        <button className="back-btn" onClick={() => window.history.back()}>
          ⬅ Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ManualScan;
