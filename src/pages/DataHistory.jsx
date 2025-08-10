import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/datahistory.css";

const isSafe = (entry) => {
  return (
    entry.ph >= 6.5 &&
    entry.ph <= 8.5 &&
    parseFloat(entry.turbidity) < 5 &&
    parseFloat(entry.temp) < 30 &&
    parseFloat(entry.tds) < 500
  );
};

const DataHistory = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [filters, setFilters] = useState({
    status: "all",
    date: "",
    text: "",
  });

  const tableContainerRef = useRef(null);

  // Generate mock data on mount
  useEffect(() => {
    const mockData = [];
    for (let i = 1; i <= 50; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      mockData.push({
        time: date.toISOString().slice(0, 19).replace("T", " "),
        ph: (6 + Math.random() * 3).toFixed(2),
        turbidity: (Math.random() * 10).toFixed(2),
        temp: (20 + Math.random() * 15).toFixed(1),
        tds: (300 + Math.floor(Math.random() * 300)).toString(),
      });
    }
    setData(mockData);
  }, []);

  // Filter data live on filter change
  useEffect(() => {
    let filtered = data;

    if (filters.status !== "all") {
      filtered = filtered.filter((entry) =>
        filters.status === "safe" ? isSafe(entry) : !isSafe(entry)
      );
    }
    if (filters.date.trim() !== "") {
      filtered = filtered.filter((entry) => entry.time.startsWith(filters.date));
    }
    if (filters.text.trim() !== "") {
      filtered = filtered.filter((entry) =>
        entry.time.toLowerCase().includes(filters.text.toLowerCase())
      );
    }

    setFilteredData(filtered);
    setPage(1);
  }, [data, filters]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const goPrev = () => setPage((p) => Math.max(p - 1, 1));
  const goNext = () => setPage((p) => Math.min(p + 1, totalPages));

  const handleDownload = () => {
    const csv = [
      ["Time", "pH", "Turbidity", "Temperature", "TDS", "Status"],
      ...filteredData.map((row) => [
        row.time,
        row.ph,
        row.turbidity,
        row.temp,
        row.tds,
        isSafe(row) ? "Safe" : "Unsafe",
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "AquaCheck_History.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <Sidebar />
      <div className="history-content">
        {/* Header + Filters */}
        <div className="header-filters">
          <h2>📊 Water Quality History</h2>
          <div className="filter-controls">
            <label>
              Status:
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="all">All</option>
                <option value="safe">Safe</option>
                <option value="unsafe">Unsafe</option>
              </select>
            </label>

            <label>
              Date (YYYY or YYYY-MM-DD):
              <input
                type="text"
                placeholder="e.g. 2025 or 2025-08-10"
                value={filters.date}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, date: e.target.value.trim() }))
                }
              />
            </label>

            <label>
              Search Time:
              <input
                type="text"
                placeholder="Search timestamp..."
                value={filters.text}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, text: e.target.value.trim() }))
                }
              />
            </label>

            <button onClick={handleDownload}>⬇ Download CSV</button>
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="table-container" ref={tableContainerRef}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>pH</th>
                <th>Turbidity</th>
                <th>Temperature (°C)</th>
                <th>TDS (ppm)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    No data available.
                  </td>
                </tr>
              ) : (
                currentData.map((entry, index) => (
                  <tr key={index} className={isSafe(entry) ? "safe" : "unsafe"}>
                    <td>{entry.time}</td>
                    <td>{entry.ph}</td>
                    <td>{entry.turbidity}</td>
                    <td>{entry.temp}</td>
                    <td>{entry.tds}</td>
                    <td>{isSafe(entry) ? "Safe" : "Unsafe"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={goPrev} disabled={page === 1}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button onClick={goNext} disabled={page === totalPages}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataHistory;
