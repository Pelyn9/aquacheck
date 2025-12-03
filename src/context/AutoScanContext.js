import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // default 15 min
  const intervalRef = useRef(null);

  // Start auto-scan globally
  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    if (!fetchSensorData) return;
    window.fetchSensorData = fetchSensorData;

    if (intervalRef.current) clearInterval(intervalRef.current);

    fetchSensorData(); // immediate fetch
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);

    if (updateDB) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("device_scanning")
        .update({ status: 1, interval_ms: intervalTime, started_by: user?.id || null })
        .eq("id", 1);
    }
  }, [intervalTime]);

  // Stop auto-scan globally
  const stopAutoScan = useCallback(async (updateDB = true) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    setAutoScanRunning(false);

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 0 })
        .eq("id", 1);
    }
  }, []);

  // Initialize scan status on mount
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("*")
        .eq("id", 1)
        .single();

      if (data?.status === 1 && typeof window.fetchSensorData === "function") {
        startAutoScan(window.fetchSensorData, false);
      }
      setIntervalTime(data?.interval_ms || 900000);
      setAutoScanRunning(data?.status === 1);
    };
    init();
  }, [startAutoScan]);

  // Real-time listener across all users
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
