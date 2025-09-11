import React, { createContext, useState, useRef } from "react";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(1800000); // 30 minutes default
  const intervalRef = useRef(null);

  // ✅ Start Auto Scan
  const startAutoScan = (fetchSensorData) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    fetchSensorData(); // fetch immediately once
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);
  };

  // ✅ Stop Auto Scan
  const stopAutoScan = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setAutoScanRunning(false);
  };

  return (
    <AutoScanContext.Provider
      value={{
        autoScanRunning,
        startAutoScan,
        stopAutoScan,
        intervalTime,
        setIntervalTime,
      }}
    >
      {children}
    </AutoScanContext.Provider>
  );
};
