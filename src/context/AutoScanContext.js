import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // 15 min
  const intervalRef = useRef(null);
  const pendingStart = useRef(false);

  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    if (typeof window === "undefined") return;
    if (!fetchSensorData) {
      pendingStart.current = true;
      return;
    }
    pendingStart.current = false;
    window.fetchSensorData = fetchSensorData;

    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchSensorData(); // run immediately
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);
    localStorage.setItem("autoScanRunning", "true"); // persist in browser

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 1, interval_ms: intervalTime })
        .eq("id", 1);
    }
  }, [intervalTime]);

  const stopAutoScan = useCallback(async (updateDB = true) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    setAutoScanRunning(false);
    localStorage.setItem("autoScanRunning", "false"); // persist stop

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 0 })
        .eq("id", 1);
    }
  }, []);

  // Resume scan on page reload if previously running
  useEffect(() => {
    if (typeof window === "undefined") return;
    const running = localStorage.getItem("autoScanRunning") === "true";

    if (running) {
      // Wait for fetchSensorData to be defined
      const checkFn = setInterval(() => {
        if (typeof window.fetchSensorData === "function") {
          startAutoScan(window.fetchSensorData, false);
          clearInterval(checkFn);
        }
      }, 100);
    }
  }, [startAutoScan]);

  // Subscribe to Supabase for cross-admin sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning" },
        (payload) => {
          const isRunning = payload.new.status === 1;
          setAutoScanRunning(isRunning);
          setIntervalTime(payload.new.interval_ms);

          if (isRunning) startAutoScan(window.fetchSensorData, false);
          else stopAutoScan(false);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [startAutoScan, stopAutoScan]);

  return (
    <AutoScanContext.Provider
      value={{ autoScanRunning, startAutoScan, stopAutoScan, intervalTime, setIntervalTime }}
    >
      {children}
    </AutoScanContext.Provider>
  );
};
