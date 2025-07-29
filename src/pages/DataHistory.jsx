import Sidebar from "../components/Sidebar";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const DataHistory = () => {
  const dataset = [
    { date: "2025-07-10", pH: 7.1, turbidity: 2.9, temperature: "25°C", tds: 430 },
    { date: "2025-07-09", pH: 7.3, turbidity: 3.0, temperature: "24°C", tds: 440 },
    { date: "2025-07-08", pH: 7.0, turbidity: 3.2, temperature: "26°C", tds: 460 },
  ];

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(dataset);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dataset History");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "dataset-history.xlsx");
  };

  const getAlertMessages = () => {
    return dataset
      .map((entry) => {
        const alerts = [];
        if (entry.tds > 450) {
          alerts.push(`🚨 High TDS detected on ${entry.date} (${entry.tds} ppm)`);
        }
        if (entry.turbidity > 3.0) {
          alerts.push(`🌫️ Turbidity slightly above normal on ${entry.date}`);
        }
        return alerts;
      })
      .flat();
  };

  const alertMessages = getAlertMessages();

  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>📊 Dataset History</h1>
        </header>

        <section className="history-section">
          <div className="table-wrapper">
            <table className="history-table" aria-label="Dataset history table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>pH</th>
                  <th>Turbidity (NTU)</th>
                  <th>Temperature (°C)</th>
                  <th>TDS (ppm)</th>
                </tr>
              </thead>
              <tbody>
                {dataset.map((data, index) => (
                  <tr key={index}>
                    <td>{data.date}</td>
                    <td>{data.pH}</td>
                    <td>{data.turbidity}</td>
                    <td>{data.temperature}</td>
                    <td>{data.tds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="download-wrapper-small">
            <button
              onClick={downloadExcel}
              className="download-btn-small"
              aria-label="Download dataset as Excel"
            >
              ⬇ Download
            </button>
          </div>
        </section>

        {alertMessages.length > 0 && (
          <section className="alert-section">
            <h2>⚠️ Critical Alerts</h2>
            {alertMessages.map((alert, idx) => (
              <div key={idx} className="alert fade-in" role="alert">
                {alert}
              </div>
            ))}
          </section>
        )}

        <footer>
          <p>© 2025 AquaCheck System. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default DataHistory;
