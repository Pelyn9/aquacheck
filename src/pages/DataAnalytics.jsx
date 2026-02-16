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

const MONTH_OPTIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function DataAnalytics() {
  const [data, setData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [viewMode, setViewMode] = useState("daily");
  const [overallDailyStatus, setOverallDailyStatus] = useState("Calculating...");
  const [overallMonthlyStatus, setOverallMonthlyStatus] = useState("Calculating...");

  const sensors = [
    { key: "ph", label: "pH Level", color: "#2563eb" },
    { key: "turbidity", label: "Turbidity (NTU)", color: "#0f766e" },
    { key: "temperature", label: "Temperature (C)", color: "#b45309" },
    { key: "tds", label: "TDS (ppm)", color: "#374151" },
  ];

  const getStatusClass = (status) => {
    if (status === "Safe") return "status-safe";
    if (status === "Moderate") return "status-moderate";
    if (status === "Unsafe") return "status-unsafe";
    return "status-neutral";
  };

  const computeOverallStatus = (dataEntry) => {
    if (!dataEntry) return "N/A";

    const safetyScores = Object.entries(dataEntry).map(([key, value]) => {
      if (value === "N/A" || value === null || value === undefined) return 0;

      const numericValue = parseFloat(value);
      if (Number.isNaN(numericValue)) return 0;

      switch (key) {
        case "ph":
          return numericValue >= 6.5 && numericValue <= 8.5 ? 2 : 0;
        case "turbidity":
          return numericValue <= 5 ? 2 : numericValue <= 10 ? 1 : 0;
        case "temperature":
          return numericValue >= 24 && numericValue <= 32 ? 2 : 0;
        case "tds":
          return numericValue <= 500 ? 2 : 0;
        default:
          return 0;
      }
    });

    const totalScore = safetyScores.reduce((sum, value) => sum + value, 0);
    if (totalScore >= 7) return "Safe";
    if (totalScore >= 4) return "Moderate";
    return "Unsafe";
  };

  useEffect(() => {
    const fetchDates = async () => {
      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("created_at")
        .order("created_at", { ascending: false });

      if (error || !rows?.length) return;

      const uniqueDates = [...new Set(rows.map((row) => row.created_at.split("T")[0]))];
      if (!uniqueDates.length) return;

      setAvailableDates(uniqueDates);
      setSelectedDate(uniqueDates[0]);

      const mostRecent = new Date(`${uniqueDates[0]}T00:00:00`);
      setSelectedMonth(String(mostRecent.getMonth() + 1));
      setSelectedYear(String(mostRecent.getFullYear()));
    };

    fetchDates();
  }, []);

  const groupByDay = (rows) => {
    const grouped = {};

    rows.forEach((row) => {
      const day = new Date(row.created_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(row);
    });

    return Object.entries(grouped).map(([day, values]) => {
      const average = (key) =>
        values.reduce((sum, item) => sum + (item[key] || 0), 0) / values.length;

      return {
        label: day,
        ph: parseFloat(average("ph").toFixed(2)),
        turbidity: parseFloat(average("turbidity").toFixed(2)),
        temperature: parseFloat(average("temperature").toFixed(2)),
        tds: parseFloat(average("tds").toFixed(2)),
      };
    });
  };

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingDaily(true);

    const fetchDaily = async () => {
      let query = supabase
        .from("dataset_history")
        .select("*")
        .order("created_at", { ascending: true });

      if (viewMode === "weekly") {
        const endDate = new Date(`${selectedDate}T00:00:00`);
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        const startISO = startDate.toISOString().split("T")[0];

        query = query
          .gte("created_at", `${startISO}T00:00:00`)
          .lte("created_at", `${selectedDate}T23:59:59`);
      } else {
        query = query
          .gte("created_at", `${selectedDate}T00:00:00`)
          .lte("created_at", `${selectedDate}T23:59:59`);
      }

      const { data: rows, error } = await query;
      if (error) {
        setData([]);
        setOverallDailyStatus("No data");
        setLoadingDaily(false);
        return;
      }

      if (rows?.length) {
        const processed =
          viewMode === "weekly"
            ? groupByDay(rows)
            : rows.map((item) => ({
                label: new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                ph: parseFloat(item.ph?.toFixed(2)) || 0,
                turbidity: parseFloat(item.turbidity?.toFixed(2)) || 0,
                temperature: parseFloat(item.temperature?.toFixed(2)) || 0,
                tds: parseFloat(item.tds?.toFixed(2)) || 0,
              }));

        setData(processed);
        setOverallDailyStatus(computeOverallStatus(rows[rows.length - 1]));
      } else {
        setData([]);
        setOverallDailyStatus("No data");
      }

      setLoadingDaily(false);
    };

    fetchDaily();
  }, [selectedDate, viewMode]);

  useEffect(() => {
    if (!selectedMonth || !selectedYear) return;
    setLoadingMonthly(true);

    const fetchMonthly = async () => {
      const month = String(selectedMonth).padStart(2, "0");
      const year = String(selectedYear);
      const endDay = new Date(Number(year), Number(month), 0).getDate();
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${String(endDay).padStart(2, "0")}`;

      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (error) {
        setMonthlyData([]);
        setOverallMonthlyStatus("No data");
        setLoadingMonthly(false);
        return;
      }

      if (rows?.length) {
        const dailyMap = {};
        rows.forEach((item) => {
          const day = new Date(item.created_at).toISOString().split("T")[0];
          if (!dailyMap[day]) dailyMap[day] = [];
          dailyMap[day].push(item);
        });

        const averaged = Object.entries(dailyMap)
          .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
          .map(([day, values]) => {
            const average = (key) =>
              values.reduce((sum, value) => sum + (value[key] || 0), 0) / values.length;

            return {
              label: new Date(day).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              ph: parseFloat(average("ph").toFixed(2)),
              turbidity: parseFloat(average("turbidity").toFixed(2)),
              tds: parseFloat(average("tds").toFixed(2)),
              temperature: parseFloat(average("temperature").toFixed(2)),
            };
          });

        setMonthlyData(averaged);

        const total = averaged.reduce(
          (acc, day) => ({
            ph: acc.ph + day.ph,
            turbidity: acc.turbidity + day.turbidity,
            tds: acc.tds + day.tds,
            temperature: acc.temperature + day.temperature,
          }),
          { ph: 0, turbidity: 0, tds: 0, temperature: 0 }
        );

        const divisor = averaged.length || 1;
        const averages = {
          ph: total.ph / divisor,
          turbidity: total.turbidity / divisor,
          tds: total.tds / divisor,
          temperature: total.temperature / divisor,
        };

        setOverallMonthlyStatus(computeOverallStatus(averages));
      } else {
        setMonthlyData([]);
        setOverallMonthlyStatus("No data");
      }

      setLoadingMonthly(false);
    };

    fetchMonthly();
  }, [selectedMonth, selectedYear]);

  const yearOptions = [
    ...new Set(
      availableDates.map((date) => new Date(`${date}T00:00:00`).getFullYear())
    ),
  ].sort((a, b) => b - a);

  if (!yearOptions.length) {
    yearOptions.push(new Date().getFullYear());
  }

  return (
    <div className="analytics-main">
      <Sidebar />
      <main className="analytics-content-sidebar">
        <header className="analytics-header">
          <h2>Data Analytics</h2>
          <p className="subtitle">Daily, weekly, and monthly water quality trends</p>
        </header>

        <section className="analytics-controls-card">
          <div className="view-toggle">
            <button
              type="button"
              className={viewMode === "daily" ? "active" : ""}
              onClick={() => setViewMode("daily")}
            >
              Daily
            </button>
            <button
              type="button"
              className={viewMode === "weekly" ? "active" : ""}
              onClick={() => setViewMode("weekly")}
            >
              Weekly
            </button>
          </div>

          <div className="filter-row">
            <label className="filter-field" htmlFor="daily-date">
              <span>Reference Date</span>
              <select
                id="daily-date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              >
                {availableDates.length ? (
                  availableDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(`${date}T00:00:00`).toLocaleDateString()}
                    </option>
                  ))
                ) : (
                  <option value="">No dates available</option>
                )}
              </select>
            </label>
          </div>
        </section>

        <section className="analytics-section">
          <div className="section-head">
            <h3>{viewMode === "daily" ? "Daily Sensor Trends" : "Weekly Sensor Trends"}</h3>
            <span>
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString()
                : "No date selected"}
            </span>
          </div>

          {loadingDaily ? (
            <p className="loading">Loading chart data...</p>
          ) : data.length ? (
            <div className="sensor-grid">
              {sensors.map((sensor) => (
                <article key={sensor.key} className="sensor-card">
                  <h4>{sensor.label}</h4>
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d6dde8" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#334155" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#334155" }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey={sensor.key}
                        stroke={sensor.color}
                        fill={sensor.color}
                        fillOpacity={0.16}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">No records found for the selected range.</p>
          )}

          <p className={`status-pill ${getStatusClass(overallDailyStatus)}`}>
            Overall {viewMode === "daily" ? "Daily" : "Weekly"} Status: {overallDailyStatus}
          </p>
        </section>

        <section className="analytics-section">
          <div className="section-head monthly-head">
            <div>
              <h3>Monthly Sensor Trends</h3>
              <span>Average value per day for the selected month</span>
            </div>

            <div className="month-controls">
              <label className="filter-field" htmlFor="month-select">
                <span>Month</span>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                >
                  {MONTH_OPTIONS.map((monthName, index) => (
                    <option key={monthName} value={String(index + 1)}>
                      {monthName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field" htmlFor="year-select">
                <span>Year</span>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loadingMonthly ? (
            <p className="loading">Loading monthly data...</p>
          ) : monthlyData.length ? (
            <div className="sensor-grid">
              {sensors.map((sensor) => (
                <article key={sensor.key} className="sensor-card">
                  <h4>{sensor.label}</h4>
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d6dde8" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#334155" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#334155" }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey={sensor.key}
                        stroke={sensor.color}
                        fill={sensor.color}
                        fillOpacity={0.16}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">No monthly records found for the selected period.</p>
          )}

          <p className={`status-pill ${getStatusClass(overallMonthlyStatus)}`}>
            Overall Monthly Status: {overallMonthlyStatus}
          </p>
        </section>
      </main>
    </div>
  );
}
