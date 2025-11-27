import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import "../assets/dataanalytics.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export default function DataAnalytics() {
  const [data, setData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [overallDailyStatus, setOverallDailyStatus] = useState("Calculating...");
  const [overallMonthlyStatus, setOverallMonthlyStatus] = useState("Calculating...");

  // ---------------- HELPER: Compute Overall Status ----------------
  const computeOverallStatus = (avgData) => {
    if (!avgData) return "N/A";

    const scores = [];

    // pH
    if (avgData.ph !== null && avgData.ph !== undefined) {
      const val = parseFloat(avgData.ph);
      scores.push(val >= 6.5 && val <= 8.5 ? 2 : 0);
    }

    // Turbidity
    if (avgData.turbidity !== null && avgData.turbidity !== undefined) {
      const val = parseFloat(avgData.turbidity);
      scores.push(val <= 5 ? 2 : val <= 10 ? 1 : 0);
    }

    // Temperature
    if (avgData.temperature !== null && avgData.temperature !== undefined) {
      const val = parseFloat(avgData.temperature);
      scores.push(val >= 24 && val <= 32 ? 2 : 0);
    }

    // TDS
    if (avgData.tds !== null && avgData.tds !== undefined) {
      const val = parseFloat(avgData.tds);
      scores.push(val <= 500 ? 2 : 0);
    }

    const totalScore = scores.reduce((a, b) => a + b, 0);
    if (totalScore >= 7) return "Safe";
    if (totalScore >= 4) return "Moderate";
    return "Unsafe";
  };

  const getColor = (status) => {
    return status === "Safe" ? "green" :
           status === "Moderate" ? "orange" :
           status === "Unsafe" ? "red" :
           "gray";
  };

  // ---------------- FETCH AVAILABLE DATES ----------------
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

  // ---------------- FETCH DAILY DATA ----------------
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
        const chartData = rows.map(item => ({
          time: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          ph: parseFloat(item.ph?.toFixed(2)) || 0,
          turbidity: parseFloat(item.turbidity?.toFixed(2)) || 0,
          temperature: parseFloat(item.temperature?.toFixed(2)) || 0,
          tds: parseFloat(item.tds?.toFixed(2)) || 0,
        }));
        setData(chartData);

        // Compute daily average for all readings
        const avgData = {
          ph: rows.reduce((sum, r) => sum + r.ph, 0) / rows.length,
          turbidity: rows.reduce((sum, r) => sum + r.turbidity, 0) / rows.length,
          temperature: rows.reduce((sum, r) => sum + r.temperature, 0) / rows.length,
          tds: rows.reduce((sum, r) => sum + r.tds, 0) / rows.length,
        };

        setOverallDailyStatus(computeOverallStatus(avgData));
      } else {
        setData([]);
        setOverallDailyStatus("No data");
      }

      setLoadingDaily(false);
    };

    fetchDaily();
  }, [selectedDate]);

  // ---------------- FETCH MONTHLY DATA ----------------
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
        // Group by day
        const dailyMap = {};
        rows.forEach((item) => {
          const day = new Date(item.created_at).toISOString().split("T")[0];
          if (!dailyMap[day]) dailyMap[day] = [];
          dailyMap[day].push(item);
        });

        // Compute daily averages
        const averaged = Object.entries(dailyMap).map(([day, values]) => {
          const avg = (key) => values.reduce((sum, x) => sum + (x[key] || 0), 0) / values.length;
          return {
            day: new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            turbidity: parseFloat(avg("turbidity").toFixed(2)),
            ph: parseFloat(avg("ph").toFixed(2)),
            tds: parseFloat(avg("tds").toFixed(2)),
            temperature: parseFloat(avg("temperature").toFixed(2)),
          };
        });

        setMonthlyData(averaged);

        // Compute overall monthly average across days
        const avgAll = {
          ph: averaged.reduce((a, b) => a + b.ph, 0) / averaged.length,
          turbidity: averaged.reduce((a, b) => a + b.turbidity, 0) / averaged.length,
          tds: averaged.reduce((a, b) => a + b.tds, 0) / averaged.length,
          temperature: averaged.reduce((a, b) => a + b.temperature, 0) / averaged.length,
        };

        setOverallMonthlyStatus(computeOverallStatus(avgAll));
      } else {
        setMonthlyData([]);
        setOverallMonthlyStatus("No data for this month");
      }

      setLoadingMonthly(false);
    };

    fetchMonthly();
  }, [selectedMonth, selectedYear]);

  // ---------------- RENDER ----------------
  return (
    <div className="data-analytics-page">
      <Sidebar />
      <div className="analytics-content">
        <h2>AquaCheck Data Analytics</h2>
        <p className="subtitle">View real-time daily and monthly water quality trends</p>

        <div className="chart-grid">
          {/* DAILY AREA CHART */}
          <div className="chart-container">
            <div className="filter-section">
              <label>Select Date:</label>
              <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
                {availableDates.map(d => (
                  <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                ))}
              </select>
            </div>

            {loadingDaily ? (
              <p className="loading">Loading daily data...</p>
            ) : data.length === 0 ? (
              <p className="no-data">No data available for this date.</p>
            ) : (
              <>
                <h2 style={{ marginBottom: "5px", fontSize: "28px", fontWeight: "700" }}>
                  {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long" })}
                </h2>

                <ResponsiveContainer width="100%" height={330}>
                  <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="PH" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0bef17ff" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#7EE8FA" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="Turbidity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4BB7A7" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#4BB7A7" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="Temperature" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6010ebff" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#67C6F2" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="TDS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c9e20aff" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#435B9A" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>

                    <XAxis dataKey="time" tick={{ fontSize: 12 }}/>
                    <YAxis tick={{ fontSize: 12 }}/>
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="ph" stroke="#0bef17ff" fill="url(#PH)" strokeWidth={2} name="PH"/>
                    <Area type="monotone" dataKey="turbidity" stroke="#4BB7A7" fill="url(#Turbidity)" strokeWidth={2} name="Turbidity"/>
                    <Area type="monotone" dataKey="temperature" stroke="#6010ebff" fill="url(#Temperature)" strokeWidth={2} name="Temperature"/>
                    <Area type="monotone" dataKey="tds" stroke="#c9e20aff" fill="url(#TDS)" strokeWidth={2} name="TDS"/>
                  </AreaChart>
                </ResponsiveContainer>

                {/* DAILY OVERALL STATUS */}
                <div style={{
                  margin: "2vh auto",
                  padding: "1vh 2vw",
                  width: "80%",
                  maxWidth: "300px",
                  borderRadius: "1rem",
                  textAlign: "center",
                  fontSize: "1.2rem",
                  fontWeight: "600",
                  background: "#f5f5f5"
                }}>
                  <span style={{ color: getColor(overallDailyStatus) }}>
                    Overall Water Quality: {overallDailyStatus}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* MONTHLY BAR CHART */}
          <div className="chart-container">
            <div className="filter-section month-selector">
              <label>Select Month & Year:</label>
              <div className="month-controls">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">Month</option>
                  {[
                    "January","February","March","April","May","June",
                    "July","August","September","October","November","December"
                  ].map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>

                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  <option value="">Year</option>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {loadingMonthly ? (
              <p className="loading">Loading monthly data...</p>
            ) : monthlyData.length === 0 ? (
              <p className="no-data">No data available for this month.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ph" fill="#22d3ee" name="pH Avg" />
                    <Bar dataKey="turbidity" fill="#3b82f6" name="Turbidity Avg" />
                    <Bar dataKey="temperature" fill="#f97316" name="Temp Avg" />
                    <Bar dataKey="tds" fill="#16a34a" name="TDS Avg" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="status-card">
                  <h3>Overall Monthly Status</h3>
                  <p>{overallMonthlyStatus}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
