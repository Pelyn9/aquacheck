import React, { useState} from "react";
import Sidebar from "../components/Sidebar";
import "../assets/datahistory.css";

const mockData = [
  { time: "2025-08-03 10:00", ph: "7.2", turbidity: "1.3", temp: "24.5", tds: "350" },
  { time: "2025-08-03 10:01", ph: "7.3", turbidity: "1.4", temp: "24.6", tds: "360" },
  // Add more sample entries here
];

const DataHistory = () => {
  const [data, setData] = useState(mockData);

  const handleSave = () => {
    const newEntry = {
      time: new Date().toLocaleString(),
      ph: (7 + Math.random()).toFixed(2),
      turbidity: (1 + Math.random()).toFixed(2),
      temp: (24 + Math.random()).toFixed(1),
      tds: (300 + Math.floor(Math.random() * 100)).toString()
    };
    setData(prev => [newEntry, ...prev]);
  };

  const handleDownload = () => {
    const csv = [
      ["Time", "pH", "Turbidity", "Temperature", "TDS"],
      ...data.map(row => [row.time, row.ph, row.turbidity, row.temp, row.tds])
    ]
      .map(e => e.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "AquaCheck_History.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <Sidebar />
      <div className="history-content">
        <h2>📊 Water Quality History</h2>
        <div className="history-buttons">
          <button onClick={handleSave}>📥 Save</button>
          <button onClick={handleDownload}>⬇ Download</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>pH</th>
              <th>Turbidity</th>
              <th>Temperature (°C)</th>
              <th>TDS (ppm)</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-data">No data available.</td>
              </tr>
            ) : (
              data.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.time}</td>
                  <td>{entry.ph}</td>
                  <td>{entry.turbidity}</td>
                  <td>{entry.temp}</td>
                  <td>{entry.tds}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataHistory;
