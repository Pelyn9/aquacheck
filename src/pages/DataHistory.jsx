import Sidebar from "../components/Sidebar";

const DataHistory = () => {
  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Dataset History</h1>
        </header>

        <section className="history-section">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>pH</th>
                <th>Turbidity</th>
                <th>Temperature</th>
                <th>TDS</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>2025-07-10</td><td>7.1</td><td>2.9</td><td>25°C</td><td>430 ppm</td></tr>
              <tr><td>2025-07-09</td><td>7.3</td><td>3.0</td><td>24°C</td><td>440 ppm</td></tr>
              <tr><td>2025-07-08</td><td>7.0</td><td>3.2</td><td>26°C</td><td>460 ppm</td></tr>
            </tbody>
          </table>
        </section>

        <section className="alert-section">
          <h2>Critical Alerts</h2>
          <p className="alert">⚠️ High TDS level detected on 2025-07-08 (460 ppm)</p>
          <p className="alert">⚠️ Turbidity slightly above normal range on 2025-07-10</p>
        </section>

        <footer>
          <p>© 2025 AquaCheck System. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default DataHistory;
