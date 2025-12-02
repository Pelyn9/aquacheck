import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // 15 minutes default
  const intervalRef = useRef(null);

  // ✅ Fetch scanning status from Supabase
  const fetchScanStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("device_scanning")
        .select("status, timeout")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching scan status:", error.message);
        return false;
      }

      return data?.status === 1; // 1 = active
    } catch (err) {
      console.error(err);
      return false;
    }
  }, []);

  // ✅ Start Auto Scan
  const startAutoScan = useCallback(
    async (fetchSensorData) => {
      const enabled = await fetchScanStatus();
      if (!enabled) {
        console.log("Auto scan is disabled by admin.");
        setAutoScanRunning(false);
        return;
      }

      if (intervalRef.current) clearInterval(intervalRef.current);

      // Run immediately
      fetchSensorData();

      // Keep scanning continuously
      intervalRef.current = setInterval(async () => {
        const isEnabled = await fetchScanStatus();
        if (isEnabled) {
          fetchSensorData();
        } else {
          console.log("Auto scan stopped by admin.");
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setAutoScanRunning(false);
        }
      }, intervalTime);

      setAutoScanRunning(true);
    },
    [fetchScanStatus, intervalTime]
  );

  // ✅ Stop Auto Scan (manual admin stop)
  const stopAutoScan = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setAutoScanRunning(false);

    // Update Supabase to mark as stopped
    supabase
      .from("device_scanning")
      .update({ status: 0, updated_at: new Date().toISOString() })
      .eq("id", 1) // adjust row ID if needed
      .then(({ error }) => {
        if (error) console.error("Error updating scan status:", error.message);
      });
  }, []);

  // ✅ Automatically start scanning on page load
  useEffect(() => {
    if (!autoScanRunning) {
      startAutoScan(() => {
        console.log("Fetching sensor data...");
        // call your fetchSensorData function here
      });
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoScanRunning, startAutoScan]);

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
