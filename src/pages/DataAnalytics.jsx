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
  // ---------------- STATES ----------------
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

  // ---------------- HELPER: Overall Status Computation ----------------
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

        // Compute daily overall status (latest entry)
        const latest = rows[rows.length - 1];
        const latestData = {
          ph: latest.ph,
          turbidity: latest.turbidity,
          temperature: latest.temperature,
          tds: latest.tds
        };
        setOverallDailyStatus(computeOverallStatus(latestData));
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
        const dailyMap = {};
        rows.forEach((item) => {
          const day = new Date(item.created_at).toISOString().split("T")[0];
          if (!dailyMap[day]) dailyMap[day] = [];
          dailyMap[day].push(item);
        });

        const averaged = Object.entries(dailyMap).map(([day, values]) => {
          const avg = (key) => (values.reduce((sum, x) => sum + (x[key] || 0), 0) / values.length).toFixed(2);
          return {
            day: new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            turbidity: parseFloat(avg("turbidity")),
            ph: parseFloat(avg("ph")),
            tds: parseFloat(avg("tds")),
            temperature: parseFloat(avg("temperature")),
          };
        });

        setMonthlyData(averaged);

        // Compute overall monthly average values
        const avgAll = {
          ph: averaged.reduce((a, b) => a + b.ph, 0) / averaged.length,
          turbidity: averaged.reduce((a, b) => a + b.turbidity, 0) / averaged.length,
          tds: averaged.reduce((a, b) => a + b.tds, 0) / averaged.length,
          temperature: averaged.reduce((a, b) => a + b.temperature, 0) / averaged.length,
        };

        // Determine overall monthly status
        const isSafe = (avgAll.ph >= 6.5 && avgAll.ph <= 8.5) &&
                       (avgAll.turbidity <= 5) &&
                       (avgAll.tds <= 500) &&
                       (avgAll.temperature >= 24 && avgAll.temperature <= 32);

        const isModerate = (avgAll.ph >= 6 && avgAll.ph <= 9) &&
                           (avgAll.turbidity <= 10) &&
                           (avgAll.tds <= 600) &&
                           (avgAll.temperature >= 18 && avgAll.temperature <= 35);

        if (isSafe) setOverallMonthlyStatus("✅ Safe (Good Water Quality)");
        else if (isModerate) setOverallMonthlyStatus("⚠️ Moderate (Some Parameters Slightly Off)");
        else setOverallMonthlyStatus("❌ Unsafe (Water Quality Poor)");
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
