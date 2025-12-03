import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // 15 min
  const intervalRef = useRef(null);
  const pendingFetch = useRef(null);

  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    if (!fetchSensorData) {
      // Save the function and retry later
      pendingFetch.current = startAutoScan;
      return;
    }
    pendingFetch.current = null;
    window.fetchSensorData = fetchSensorData;

    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchSensorData(); // run immediately
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);
    localStorage.setItem("autoScanRunning", "true");

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
    localStorage.setItem("autoScanRunning", "false");

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 0 })
        .eq("id", 1);
    }
  }, []);

  // Resume scan on page reload if previously running
  useEffect(() => {
    const running = localStorage.getItem("autoScanRunning") === "true";
    if (!running) return;

    const checkFn = setInterval(() => {
      if (typeof window.fetchSensorData === "function") {
        startAutoScan(window.fetchSensorData, false);
        clearInterval(checkFn);
      }
    }, 100);

    return () => clearInterval(checkFn);
  }, [startAutoScan]);

  // Retry pending fetchSensorData
  useEffect(() => {
    if (pendingFetch.current && typeof window.fetchSensorData === "function") {
      pendingFetch.current(window.fetchSensorData, false);
      pendingFetch.current = null;
    }
  }, [autoScanRunning]);

  // Supabase sync for multi-admin
  useEffect(() => {
    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning" },
        (payload) => {
          const isRunning = payload.new.status === 1;
          setAutoScanRunning(isRunning);
          setIntervalTime(payload.new.interval_ms);

          if (isRunning && typeof window.fetchSensorData === "function") {
            startAutoScan(window.fetchSensorData, false);
          } else if (!isRunning) {
            stopAutoScan(false);
          }
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
