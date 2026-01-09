import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "../assets/dataanalytics.css";

export default function DataAnalytics() {
  const [data, setData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [viewMode, setViewMode] = useState("daily"); // daily | weekly
  const [overallDailyStatus, setOverallDailyStatus] = useState("Calculating...");
  const [overallMonthlyStatus, setOverallMonthlyStatus] = useState("Calculating...");

  const sensors = [
    { key: "ph", label: "pH Level", color: "#2563eb" },
    { key: "turbidity", label: "Turbidity", color: "#0f766e" },
    { key: "temperature", label: "Temperature (°C)", color: "#b45309" },
    { key: "tds", label: "TDS (ppm)", color: "#374151" },
  ];

  const getColor = (status) => {
    return status === "Safe" ? "#16a34a" :
           status === "Moderate" ? "#f59e0b" :
           status === "Unsafe" ? "#dc2626" :
           "#6b7280";
  };

  const computeOverallStatus = (dataEntry) => {
    if (!dataEntry) return "N/A";
    const safetyScores = Object.entries(dataEntry).map(([key, value]) => {
      if (value === "N/A") return 0;
      const val = parseFloat(value);
      switch (key) {
        case "ph": return val >= 6.5 && val <= 8.5 ? 2 : 0;
        case "turbidity": return val <= 5 ? 2 : val <= 10 ? 1 : 0;
        case "temperature": return val >= 24 && val <= 32 ? 2 : 0;
        case "tds": return val <= 500 ? 2 : 0;
        default: return 0;
      }
    });
    const totalScore = safetyScores.reduce((acc, val) => acc + val, 0);
    if (totalScore >= 7) return "Safe";
    else if (totalScore >= 4) return "Moderate";
    else return "Unsafe";
  };

  // Fetch available dates
  useEffect(() => {
    const fetchDates = async () => {
      const { data: rows } = await supabase
        .from("dataset_history")
        .select("created_at")
        .order("created_at", { ascending: false });

      if (rows?.length) {
        const uniqueDates = [...new Set(rows.map(r => r.created_at.split("T")[0]))];
        setAvailableDates(uniqueDates);
        setSelectedDate(uniqueDates[0]);

        const mostRecent = new Date(uniqueDates[0]);
        setSelectedMonth(mostRecent.getMonth() + 1);
        setSelectedYear(mostRecent.getFullYear());
      }
    };
    fetchDates();
  }, []);

  const groupByDay = (rows) => {
    const map = {};
    rows.forEach(r => {
      const day = new Date(r.created_at).toLocaleDateString("en-US", { weekday: "short" });
      if (!map[day]) map[day] = [];
      map[day].push(r);
    });
    return Object.entries(map).map(([day, values]) => {
      const avg = key => values.reduce((s, v) => s + (v[key] || 0), 0) / values.length;
      return {
        label: day,
        ph: parseFloat(avg("ph").toFixed(2)),
        turbidity: parseFloat(avg("turbidity").toFixed(2)),
        temperature: parseFloat(avg("temperature").toFixed(2)),
        tds: parseFloat(avg("tds").toFixed(2)),
      };
    });
  };

  // Fetch daily/weekly data
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingDaily(true);

    const fetchDaily = async () => {
      const { data: rows } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (rows?.length) {
        const processedData = viewMode === "weekly" ? groupByDay(rows) :
          rows.map(item => ({
            label: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            ph: parseFloat(item.ph?.toFixed(2)) || 0,
            turbidity: parseFloat(item.turbidity?.toFixed(2)) || 0,
            temperature: parseFloat(item.temperature?.toFixed(2)) || 0,
            tds: parseFloat(item.tds?.toFixed(2)) || 0,
          }));

        setData(processedData);
        const latest = rows[rows.length - 1];
        setOverallDailyStatus(computeOverallStatus(latest));
      } else {
        setData([]);
        setOverallDailyStatus("No data");
      }
      setLoadingDaily(false);
    };
    fetchDaily();
  }, [selectedDate, viewMode]);

  // Fetch monthly data
  useEffect(() => {
    if (!selectedMonth || !selectedYear) return;
    setLoadingMonthly(true);

    const fetchMonthly = async () => {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-31`;

      const { data: rows } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (rows?.length) {
        const dailyMap = {};
        rows.forEach((item) => {
          const day = new Date(item.created_at).toISOString().split("T")[0];
          if (!dailyMap[day]) dailyMap[day] = [];
          dailyMap[day].push(item);
        });

        const averaged = Object.entries(dailyMap).map(([day, values]) => {
          const avg = key => values.reduce((sum, x) => sum + (x[key] || 0), 0) / values.length;
          return {
            label: new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            turbidity: parseFloat(avg("turbidity").toFixed(2)),
            ph: parseFloat(avg("ph").toFixed(2)),
            tds: parseFloat(avg("tds").toFixed(2)),
            temperature: parseFloat(avg("temperature").toFixed(2)),
          };
        });

        setMonthlyData(averaged);

        // Compute overall monthly
        const avgAll = {
          ph: averaged.reduce((a, b) => a + b.ph, 0) / averaged.length,
          turbidity: averaged.reduce((a, b) => a + b.turbidity, 0) / averaged.length,
          tds: averaged.reduce((a, b) => a + b.tds, 0) / averaged.length,
          temperature: averaged.reduce((a, b) => a + b.temperature, 0) / averaged.length,
        };
        const isSafe = (avgAll.ph >= 6.5 && avgAll.ph <= 8.5) &&
                       (avgAll.turbidity <= 5) &&
                       (avgAll.tds <= 500) &&
                       (avgAll.temperature >= 24 && avgAll.temperature <= 32);
        const isModerate = (avgAll.ph >= 6 && avgAll.ph <= 9) &&
                           (avgAll.turbidity <= 10) &&
                           (avgAll.tds <= 600) &&
                           (avgAll.temperature >= 18 && avgAll.temperature <= 35);

        if (isSafe) setOverallMonthlyStatus("Safe ✅");
        else if (isModerate) setOverallMonthlyStatus("Moderate ⚠️");
        else setOverallMonthlyStatus("Unsafe ❌");
      } else {
        setMonthlyData([]);
        setOverallMonthlyStatus("No data");
      }
      setLoadingMonthly(false);
    };
    fetchMonthly();
  }, [selectedMonth, selectedYear]);

  return (
    <div className="analytics-main">
      <Sidebar />
      <div className="analytics-content-sidebar">
        <h2>AquaCheck Analytics</h2>
        <p className="subtitle">Daily, Weekly & Monthly Water Trends</p>

        {/* Toggle */}
        <div className="view-toggle">
          <button className={viewMode==="daily"?"active":""} onClick={()=>setViewMode("daily")}>Daily</button>
          <button className={viewMode==="weekly"?"active":""} onClick={()=>setViewMode("weekly")}>Weekly</button>
        </div>

        {/* Date filter */}
        <div className="filter-section">
          <label>Date:</label>
          <select value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)}>
            {availableDates.map(d => <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>)}
          </select>
        </div>

        {/* Daily / Weekly Charts */}
        {loadingDaily ? <p className="loading">Loading...</p> : (
          <div className="sensor-grid">
            {sensors.map(sensor => (
              <div key={sensor.key} className="sensor-card">
                <h4>{sensor.label}</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey={sensor.key} stroke={sensor.color} fill={sensor.color} fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign:"center", marginTop:"0.5rem", color:getColor(overallDailyStatus), fontWeight:600 }}>
          Overall Daily: {overallDailyStatus}
        </div>

        {/* Monthly Charts */}
        <div className="filter-section month-selector" style={{ marginTop:"1.5rem" }}>
          <label>Month & Year:</label>
          <div className="month-controls">
            <select value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)}>
              {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loadingMonthly ? <p className="loading">Loading monthly data...</p> : (
          <div className="sensor-grid">
            {sensors.map(sensor => (
              <div key={sensor.key} className="sensor-card">
                <h4>{sensor.label}</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey={sensor.key} stroke={sensor.color} fill={sensor.color} fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
        <div className="status-card" style={{ textAlign:"center", marginTop:"0.5rem" }}>
          Overall Monthly: <span style={{ color:getColor(overallMonthlyStatus) }}>{overallMonthlyStatus}</span>
        </div>
      </div>
    </div>
  );
}
