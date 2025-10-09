import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import "../assets/datahistory.css";

// ✅ Per-sensor evaluation
const getSensorStatus = (type, value) => {
  if (value === null || value === undefined) return "unknown";
  const val = parseFloat(value);

  switch (type) {
    case "ph":
      if (val >= 6.5 && val <= 8.5) return "safe";
      if ((val >= 6 && val < 6.5) || (val > 8.5 && val <= 9)) return "caution";
      return "unsafe";
    case "turbidity":
      if (val <= 5) return "safe";
      if (val > 5 && val <= 10) return "caution";
      return "unsafe";
    case "temperature":
      if (val >= 24 && val <= 32) return "safe";
      if ((val >= 20 && val < 24) || (val > 32 && val <= 35)) return "caution";
      return "unsafe";
    case "tds":
      if (val <= 500) return "safe";
      if (val > 500 && val <= 1000) return "caution";
      return "unsafe";
    default:
      return "unknown";
  }
};

// ✅ Compute overall status
const getOverallStatus = (entry) => {
  const statuses = [
    getSensorStatus("ph", entry.ph),
    getSensorStatus("turbidity", entry.turbidity),
    getSensorStatus("temperature", entry.temperature),
    getSensorStatus("tds", entry.tds),
  ];

  if (statuses.includes("unsafe")) return "Unsafe";
  if (statuses.includes("caution")) return "Caution";
  if (statuses.every((s) => s === "safe")) return "Safe";
  return "Unknown";
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

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState("all");
  const [downloadDate, setDownloadDate] = useState("");

  const tableContainerRef = useRef(null);

  // ✅ Fetch Supabase data
  const fetchData = async () => {
    const { data: rows, error } = await supabase
      .from("dataset_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching data:", error.message);
    } else {
      setData(rows || []);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ Delete old entries older than 30 days
  useEffect(() => {
    const deleteOldData = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isoDate = thirtyDaysAgo.toISOString();

      const { error } = await supabase
        .from("dataset_history")
        .delete()
        .lt("created_at", isoDate);

      if (error) console.error("❌ Failed to delete old data:", error);
      else console.log("✅ Old dataset history deleted successfully.");
    };

    deleteOldData();
    const interval = setInterval(deleteOldData, 86400000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Apply filters
  useEffect(() => {
    let filtered = data;

    if (filters.status !== "all") {
      filtered = filtered.filter(
        (entry) => getOverallStatus(entry).toLowerCase() === filters.status
      );
    }
    if (filters.date.trim() !== "") {
      filtered = filtered.filter((entry) =>
        entry.created_at.startsWith(filters.date)
      );
    }
    if (filters.text.trim() !== "") {
      filtered = filtered.filter((entry) =>
        entry.created_at.toLowerCase().includes(filters.text.toLowerCase())
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

  // ✅ Download Helper
  const generateCSV = (rows) => {
    return [
      ["Time", "pH", "Turbidity", "Temperature", "TDS", "Status"],
      ...rows.map((row) => [
        row.created_at,
        row.ph,
        row.turbidity,
        row.temperature,
        row.tds,
        getOverallStatus(row),
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");
  };

  const handleDownload = () => {
    let downloadData = data;

    if (downloadMode === "safe") {
      downloadData = data.filter((entry) => getOverallStatus(entry) === "Safe");
    } else if (downloadMode === "caution") {
      downloadData = data.filter(
        (entry) => getOverallStatus(entry) === "Caution"
      );
    } else if (downloadMode === "unsafe") {
      downloadData = data.filter(
        (entry) => getOverallStatus(entry) === "Unsafe"
      );
    } else if (downloadMode === "date" && downloadDate) {
      downloadData = data.filter((entry) =>
        entry.created_at.startsWith(downloadDate)
      );
    }

    if (downloadData.length === 0) {
      alert("⚠ No matching records found for your selection.");
      return;
    }

    const csv = generateCSV(downloadData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "AquaCheck_History.csv";
    link.click();

    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  return (
    <div className="container">
      <Sidebar />
      <div className="history-content">
        {/* Header + Filters */}
        <div className="header-filters">
          <h2>Water Quality History</h2>
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
                <option value="caution">Caution</option>
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
                  setFilters((prev) => ({
                    ...prev,
                    date: e.target.value.trim(),
                  }))
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
                  setFilters((prev) => ({
                    ...prev,
                    text: e.target.value.trim(),
                  }))
                }
              />
            </label>

            <button onClick={() => setShowDownloadModal(true)}>
              ⬇ Download CSV
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
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
                currentData.map((entry, index) => {
                  const status = getOverallStatus(entry);
                  return (
                    <tr key={index} className={status.toLowerCase()}>
                      <td data-label="Time">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td data-label="pH">{entry.ph}</td>
                      <td data-label="Turbidity">{entry.turbidity}</td>
                      <td data-label="Temperature (°C)">
                        {entry.temperature}
                      </td>
                      <td data-label="TDS (ppm)">{entry.tds}</td>
                      <td data-label="Status">{status}</td>
                    </tr>
                  );
                })
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

        {/* Download Modal */}
        {showDownloadModal && (
          <div className="download-modal">
            <div className="modal-content">
              <h3>Download Options</h3>

              <label>
                Mode:
                <select
                  value={downloadMode}
                  onChange={(e) => setDownloadMode(e.target.value)}
                >
                  <option value="all">All Data</option>
                  <option value="date">By Date</option>
                  <option value="safe">Only Safe</option>
                  <option value="caution">Only Caution</option>
                  <option value="unsafe">Only Unsafe</option>
                </select>
              </label>

              {downloadMode === "date" && (
                <label>
                  Select Date:
                  <input
                    type="date"
                    value={downloadDate}
                    onChange={(e) => setDownloadDate(e.target.value)}
                  />
                </label>
              )}

              <div className="modal-actions">
                <button onClick={handleDownload}>Download</button>
                <button
                  className="cancel"
                  onClick={() => setShowDownloadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataHistory;
