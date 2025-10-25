import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import "../assets/datahistory.css";

// ✅ Sensor status check
const getSensorStatus = (type, value) => {
  if (value === null || value === undefined || value === "N/A") return "unknown";
  const val = parseFloat(value);
  if (isNaN(val)) return "unknown";

  switch (type) {
    case "ph":
      if (val >= 6.5 && val <= 8.5) return "safe";
      if ((val >= 6 && val < 6.5) || (val > 8.5 && val <= 9)) return "moderate";
      return "unsafe";

    case "turbidity":
      if (val <= 5) return "safe";
      if (val > 5 && val <= 10) return "moderate";
      return "unsafe";

    case "temperature":
      if (val >= 24 && val <= 32) return "safe";
      if ((val >= 20 && val < 24) || (val > 32 && val <= 35)) return "moderate";
      return "unsafe";

    case "tds":
      if (val <= 500) return "safe";
      if (val > 500 && val <= 1000) return "moderate";
      return "unsafe";

    default:
      return "unknown";
  }
};

// ✅ Determine overall water quality
const getOverallStatus = (entry) => {
  const statuses = [
    getSensorStatus("ph", entry.ph),
    getSensorStatus("turbidity", entry.turbidity),
    getSensorStatus("temperature", entry.temperature),
    getSensorStatus("tds", entry.tds),
  ];

  if (statuses.includes("unknown")) return "Unknown";
  if (statuses.includes("unsafe")) return "Unsafe";
  if (statuses.includes("moderate")) return "Moderate";
  if (statuses.every((s) => s === "safe")) return "Safe";
  return "Unknown";
};

const DataHistory = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [filters, setFilters] = useState({ status: "all", date: "", text: "" });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState("all");
  const [downloadDate, setDownloadDate] = useState("");
  const tableContainerRef = useRef(null);

  // ✅ Fetch data
  const fetchData = async () => {
    const { data: rows, error } = await supabase
      .from("dataset_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setData(rows || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ Auto-delete data older than 30 days
  useEffect(() => {
    const deleteOldData = async () => {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      await supabase
        .from("dataset_history")
        .delete()
        .lt("created_at", limitDate.toISOString());
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
      filtered = filtered.filter((entry) => {
        const formatted = new Date(entry.created_at)
          .toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
          .toLowerCase();
        return formatted.includes(filters.text.toLowerCase());
      });
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

  // ✅ CSV download
  const generateCSV = (rows) => {
    return [
      ["Time", "pH", "Turbidity", "Temperature", "TDS", "Status"],
      ...rows.map((row) => [
        new Date(row.created_at).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
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

    if (downloadMode === "safe")
      downloadData = data.filter((e) => getOverallStatus(e) === "Safe");
    else if (downloadMode === "moderate")
      downloadData = data.filter((e) => getOverallStatus(e) === "Moderate");
    else if (downloadMode === "unsafe")
      downloadData = data.filter((e) => getOverallStatus(e) === "Unsafe");
    else if (downloadMode === "date" && downloadDate)
      downloadData = data.filter((e) => e.created_at.startsWith(downloadDate));

    if (downloadData.length === 0) {
      alert("⚠ No matching records found.");
      return;
    }

    const csv = generateCSV(downloadData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AquaCheck_History.csv";
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  return (
    <div className="container">
      <Sidebar />
      <div className="history-content">
        <div className="header-filters">
          <h2>Water Quality History</h2>
          <div className="filter-controls">
            <label>
              Status:
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="all">All</option>
                <option value="safe">Safe</option>
                <option value="moderate">Moderate</option>
                <option value="unsafe">Unsafe</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label>
              Select Date:
              <input
                type="date"
                value={filters.date}
                onChange={(e) =>
                  setFilters({ ...filters, date: e.target.value })
                }
              />
            </label>

            <label>
              Search Time:
              <input
                type="text"
                placeholder="e.g. 03:15 PM"
                value={filters.text}
                onChange={(e) =>
                  setFilters({ ...filters, text: e.target.value })
                }
              />
            </label>

            <button onClick={() => setShowDownloadModal(true)}>
              ⬇ Export CSV
            </button>
          </div>
        </div>

        <div className="table-container" ref={tableContainerRef}>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
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
                    No records found.
                  </td>
                </tr>
              ) : (
                currentData.map((entry, i) => {
                  const status = getOverallStatus(entry);
                  return (
                    <tr key={i} className={status.toLowerCase()}>
                      <td>
                        {new Date(entry.created_at).toLocaleString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td>{entry.ph || "N/A"}</td>
                      <td>{entry.turbidity || "N/A"}</td>
                      <td>{entry.temperature || "N/A"}</td>
                      <td>{entry.tds || "N/A"}</td>
                      <td>{status}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={goPrev} disabled={page === 1}>
              ◀ Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button onClick={goNext} disabled={page === totalPages}>
              Next ▶
            </button>
          </div>
        )}

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
                  <option value="all">All</option>
                  <option value="date">By Date</option>
                  <option value="safe">Safe</option>
                  <option value="moderate">Moderate</option>
                  <option value="unsafe">Unsafe</option>
                  <option value="unknown">Unknown</option>
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
