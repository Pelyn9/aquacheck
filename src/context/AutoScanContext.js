import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // 15 minutes
  const [nextAutoSave, setNextAutoSave] = useState(null);
  const intervalRef = useRef(null);

  // Start Auto Scan
  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    if (!fetchSensorData) return;

    // Clear any existing interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Fetch immediately
    fetchSensorData();

    // Calculate next auto-save timestamp
    const now = Date.now();
    const nextSave = now + intervalTime;
    setNextAutoSave(nextSave);

    // Save state in DB
    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 1, interval_ms: intervalTime, next_auto_save_ts: nextSave })
        .eq("id", 1);
    }

    // Set up local countdown interval
    intervalRef.current = setInterval(async () => {
      const remaining = nextSave - Date.now();
      if (remaining <= 1000) {
        await fetchSensorData();
        const newNextSave = Date.now() + intervalTime;
        setNextAutoSave(newNextSave);
        if (updateDB) {
          await supabase
            .from("device_scanning")
            .update({ next_auto_save_ts: newNextSave })
            .eq("id", 1);
        }
      }
    }, 1000);

    setAutoScanRunning(true);
  }, [intervalTime]);

  // Stop Auto Scan
  const stopAutoScan = useCallback(async (updateDB = true) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    setAutoScanRunning(false);
    setNextAutoSave(null);

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 0 })
        .eq("id", 1);
    }
  }, []);

  // Resume scan on page load if previously running
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("*")
        .eq("id", 1)
        .single();

      if (data?.status === 1 && typeof window.fetchSensorData === "function") {
        startAutoScan(window.fetchSensorData, false);
        setNextAutoSave(data.next_auto_save_ts);
      }
    };
    init();
  }, [startAutoScan]);

  // Live sync across users
  useEffect(() => {
    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning" },
        async (payload) => {
          const isRunning = payload.new.status === 1;
          setAutoScanRunning(isRunning);
          setIntervalTime(payload.new.interval_ms);
          setNextAutoSave(payload.new.next_auto_save_ts);

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
      value={{ autoScanRunning, startAutoScan, stopAutoScan, intervalTime, nextAutoSave }}
    >
      {children}
    </AutoScanContext.Provider>
  );
};
