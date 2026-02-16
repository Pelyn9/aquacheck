import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabaseClient";
import "../assets/datahistory.css";

const getOverallStatus = (data) => {
  const scores = [];

  if (data.ph !== null && data.ph !== undefined) {
    const value = parseFloat(data.ph);
    scores.push(value >= 6.5 && value <= 8.5 ? 2 : 0);
  }

  if (data.turbidity !== null && data.turbidity !== undefined) {
    const value = parseFloat(data.turbidity);
    scores.push(value <= 5 ? 2 : value <= 10 ? 1 : 0);
  }

  if (data.temperature !== null && data.temperature !== undefined) {
    const value = parseFloat(data.temperature);
    scores.push(value >= 24 && value <= 32 ? 2 : 0);
  }

  if (data.tds !== null && data.tds !== undefined) {
    const value = parseFloat(data.tds);
    scores.push(value <= 500 ? 2 : 0);
  }

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  if (totalScore >= 7) return "Safe";
  if (totalScore >= 4) return "Moderate";
  return "Unsafe";
};

const formatSensorValue = (value, digits = 2) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return parsed.toFixed(digits);
};

const formatDateTime = (dateValue) =>
  new Date(dateValue).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

const DataHistory = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "all", date: "", text: "" });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState("all");
  const [downloadDate, setDownloadDate] = useState("");

  const itemsPerPage = 10;

  const fetchData = async () => {
    const { data: rows, error } = await supabase
      .from("dataset_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setData(rows || []);
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    let filtered = data;

    if (filters.status !== "all") {
      filtered = filtered.filter(
        (entry) => getOverallStatus(entry).toLowerCase() === filters.status
      );
    }

    if (filters.date) {
      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.created_at).toLocaleDateString("en-CA");
        return entryDate === filters.date;
      });
    }

    if (filters.text) {
      filtered = filtered.filter((entry) => {
        const timeString = new Date(entry.created_at)
          .toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
          .toLowerCase();
        return timeString.includes(filters.text.toLowerCase());
      });
    }

    setFilteredData(filtered);
    setPage(1);
  }, [data, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const currentData = filteredData.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const summary = filteredData.reduce(
    (totals, entry) => {
      const status = getOverallStatus(entry).toLowerCase();
      totals.total += 1;
      if (status === "safe") totals.safe += 1;
      if (status === "moderate") totals.moderate += 1;
      if (status === "unsafe") totals.unsafe += 1;
      return totals;
    },
    { total: 0, safe: 0, moderate: 0, unsafe: 0 }
  );

  const goPrev = () => setPage((current) => Math.max(current - 1, 1));
  const goNext = () => setPage((current) => Math.min(current + 1, totalPages));
  const clearFilters = () => setFilters({ status: "all", date: "", text: "" });

  const generateCSV = (rows) =>
    [
      ["Time", "pH", "Turbidity", "Temperature", "TDS", "Status"],
      ...rows.map((row) => [
        formatDateTime(row.created_at),
        row.ph,
        row.turbidity,
        row.temperature,
        row.tds,
        getOverallStatus(row),
      ]),
    ]
      .map((line) => line.join(","))
      .join("\n");

  const handleDownload = () => {
    let downloadData = data;

    if (downloadMode === "safe") {
      downloadData = data.filter((entry) => getOverallStatus(entry) === "Safe");
    } else if (downloadMode === "moderate") {
      downloadData = data.filter((entry) => getOverallStatus(entry) === "Moderate");
    } else if (downloadMode === "unsafe") {
      downloadData = data.filter((entry) => getOverallStatus(entry) === "Unsafe");
    } else if (downloadMode === "date" && downloadDate) {
      downloadData = data.filter((entry) => entry.created_at.startsWith(downloadDate));
    }

    if (!downloadData.length) {
      alert("No matching records found.");
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
    <div className="history-page">
      <Sidebar />
      <main className="history-content">
        <header className="history-header">
          <div>
            <h2>Dataset History</h2>
            <p>Review, filter, and export stored water quality records.</p>
          </div>
        </header>

        <section className="history-filters">
          <label className="filter-field" htmlFor="status-filter">
            <span>Status</span>
            <select
              id="status-filter"
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value })
              }
            >
              <option value="all">All</option>
              <option value="safe">Safe</option>
              <option value="moderate">Moderate</option>
              <option value="unsafe">Unsafe</option>
            </select>
          </label>

          <label className="filter-field" htmlFor="date-filter">
            <span>Date</span>
            <input
              id="date-filter"
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters({ ...filters, date: event.target.value })
              }
            />
          </label>

          <label className="filter-field" htmlFor="time-filter">
            <span>Search Time</span>
            <input
              id="time-filter"
              type="text"
              placeholder="e.g. 03:15 PM"
              value={filters.text}
              onChange={(event) =>
                setFilters({ ...filters, text: event.target.value })
              }
            />
          </label>

          <div className="filter-actions">
            <button type="button" className="filter-reset-btn" onClick={clearFilters}>
              Clear Filters
            </button>
            <button type="button" className="history-export-btn" onClick={() => setShowDownloadModal(true)}>
              Export CSV
            </button>
          </div>
        </section>

        <section className="history-summary">
          <span className="summary-chip">Records: {summary.total}</span>
          <span className="summary-chip safe">Safe: {summary.safe}</span>
          <span className="summary-chip moderate">Moderate: {summary.moderate}</span>
          <span className="summary-chip unsafe">Unsafe: {summary.unsafe}</span>
        </section>

        <div className="table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">Date and Time</th>
                <th scope="col">pH</th>
                <th scope="col">Turbidity</th>
                <th scope="col">Temperature (C)</th>
                <th scope="col">TDS (ppm)</th>
                <th scope="col">Status</th>
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
                currentData.map((entry, index) => {
                  const status = getOverallStatus(entry);
                  const statusClass = status.toLowerCase();

                  return (
                    <tr key={`${entry.created_at}-${index}`}>
                      <td data-label="Date and Time">{formatDateTime(entry.created_at)}</td>
                      <td data-label="pH">{formatSensorValue(entry.ph, 2)}</td>
                      <td data-label="Turbidity">{formatSensorValue(entry.turbidity, 2)}</td>
                      <td data-label="Temperature (C)">{formatSensorValue(entry.temperature, 2)}</td>
                      <td data-label="TDS (ppm)">{formatSensorValue(entry.tds, 0)}</td>
                      <td data-label="Status">
                        <span className={`status-badge ${statusClass}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredData.length > 0 && (
          <div className="pagination">
            <button type="button" onClick={goPrev} disabled={page === 1}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" onClick={goNext} disabled={page === totalPages}>
              Next
            </button>
          </div>
        )}

        {showDownloadModal && (
          <div className="download-modal" role="dialog" aria-modal="true">
            <div className="modal-content">
              <h3>Download Options</h3>

              <label className="modal-field" htmlFor="download-mode">
                <span>Mode</span>
                <select
                  id="download-mode"
                  value={downloadMode}
                  onChange={(event) => setDownloadMode(event.target.value)}
                >
                  <option value="all">All Records</option>
                  <option value="date">By Date</option>
                  <option value="safe">Safe Only</option>
                  <option value="moderate">Moderate Only</option>
                  <option value="unsafe">Unsafe Only</option>
                </select>
              </label>

              {downloadMode === "date" && (
                <label className="modal-field" htmlFor="download-date">
                  <span>Select Date</span>
                  <input
                    id="download-date"
                    type="date"
                    value={downloadDate}
                    onChange={(event) => setDownloadDate(event.target.value)}
                  />
                </label>
              )}

              <div className="modal-actions">
                <button type="button" onClick={handleDownload}>
                  Download
                </button>
                <button
                  type="button"
                  className="cancel"
                  onClick={() => setShowDownloadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DataHistory;
