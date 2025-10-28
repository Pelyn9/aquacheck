import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import "../assets/dataanalytics.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
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
  const [overallStatus, setOverallStatus] = useState("Calculating...");

  // 🧩 Fetch available dates
  useEffect(() => {
    const fetchDates = async () => {
      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("created_at");

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const uniqueDates = [
          ...new Set(
            rows.map(
              (r) => new Date(r.created_at).toISOString().split("T")[0]
            )
          ),
        ].reverse();

        const formattedDates = uniqueDates.map((dateStr) => ({
          value: dateStr,
          label: new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        }));

        setAvailableDates(formattedDates);
        setSelectedDate(formattedDates[0].value);

        // ✅ Automatically set most recent month/year for monthly chart
        const mostRecent = new Date(formattedDates[0].value);
        setSelectedMonth(mostRecent.getMonth() + 1); // Month: 1-12
        setSelectedYear(mostRecent.getFullYear());
      }
    };

    fetchDates();
  }, []);

  // 📅 Fetch Daily Chart Data
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingDaily(true);

    const fetchDaily = async () => {
      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(rows)) {
        const chartData = rows.map((item) => ({
          time: new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          turbidity: parseFloat(item.turbidity?.toFixed(2)) || 0,
          ph: parseFloat(item.ph?.toFixed(2)) || 0,
          tds: parseFloat(item.tds?.toFixed(2)) || 0,
          temperature: parseFloat(item.temperature?.toFixed(2)) || 0,
        }));
        setData(chartData);
      } else {
        setData([]);
      }

      setLoadingDaily(false);
    };

    fetchDaily();
  }, [selectedDate]);

  // 📆 Fetch Monthly Chart Data
  useEffect(() => {
    if (!selectedMonth || !selectedYear) return;
    setLoadingMonthly(true);

    const fetchMonthly = async () => {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(
        2,
        "0"
      )}-01`;
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(
        2,
        "0"
      )}-31`;

      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const dailyMap = {};
        rows.forEach((item) => {
          const day = new Date(item.created_at).toISOString().split("T")[0];
          if (!dailyMap[day]) dailyMap[day] = [];
          dailyMap[day].push(item);
        });

        const averaged = Object.entries(dailyMap).map(([day, values]) => {
          const avg = (key) =>
            (
              values.reduce((sum, x) => sum + (x[key] || 0), 0) / values.length
            ).toFixed(2);
          return {
            day: new Date(day).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            turbidity: parseFloat(avg("turbidity")),
            ph: parseFloat(avg("ph")),
            tds: parseFloat(avg("tds")),
            temperature: parseFloat(avg("temperature")),
          };
        });

        setMonthlyData(averaged);

        // ✅ Compute overall status
        const avgAll = {
          ph: averaged.reduce((a, b) => a + b.ph, 0) / averaged.length || 0,
          turbidity:
            averaged.reduce((a, b) => a + b.turbidity, 0) / averaged.length || 0,
          tds: averaged.reduce((a, b) => a + b.tds, 0) / averaged.length || 0,
          temperature:
            averaged.reduce((a, b) => a + b.temperature, 0) / averaged.length ||
            0,
        };

        if (
          avgAll.ph >= 6.5 &&
          avgAll.ph <= 8.5 &&
          avgAll.turbidity < 5 &&
          avgAll.tds < 500 &&
          avgAll.temperature < 35
        ) {
          setOverallStatus("✅ Safe for general use");
        } else if (
          avgAll.ph >= 5.5 &&
          avgAll.ph <= 9 &&
          avgAll.turbidity < 10 &&
          avgAll.tds < 1000
        ) {
          setOverallStatus("⚠️ Moderate (Caution Advised)");
        } else {
          setOverallStatus("❌ Unsafe (Water Quality Poor)");
        }
      } else {
        setMonthlyData([]);
        setOverallStatus("No data available for this month");
      }

      setLoadingMonthly(false);
    };

    fetchMonthly();
  }, [selectedMonth, selectedYear]);

  return (
    <div className="data-analytics-page">
      <Sidebar />
      <div className="analytics-content">
        <h2>AquaCheck Data Analytics</h2>
        <p className="subtitle">
          View real-time daily and monthly water quality trends
        </p>

        <div className="chart-grid">
          {/* 📈 DAILY LINE CHART */}
          <div className="chart-container">
            <div className="filter-section">
              <label>Select Date:</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {availableDates.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {loadingDaily ? (
              <p className="loading">Loading daily data...</p>
            ) : data.length === 0 ? (
              <p className="no-data">No data available for this date.</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                  <XAxis dataKey="time" stroke="#2563eb" />
                  <YAxis stroke="#2563eb" />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="ph" stroke="#22d3ee" name="pH" />
                  <Line dataKey="turbidity" stroke="#3b82f6" name="Turbidity" />
                  <Line dataKey="temperature" stroke="#f97316" name="Temp (°C)" />
                  <Line dataKey="tds" stroke="#16a34a" name="TDS (ppm)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 📊 MONTHLY BAR CHART + STATUS */}
          <div className="chart-container">
            <div className="filter-section month-selector">
              <label>Select Month & Year:</label>
              <div className="month-controls">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="">Month</option>
                  {[
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ].map((m, i) => (
                    <option key={i + 1} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="">Year</option>
                  {[2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
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

                {/* ✅ Overall Status */}
                <div className="status-card">
                  <h3> Overall Monthly Status</h3>
                  <p>{overallStatus}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
