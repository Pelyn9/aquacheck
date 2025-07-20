import Sidebar from "../components/Sidebar";

const Dashboard = () => {
  return (
    <div className="container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Welcome, Admin</h1>
        </header>
        <section className="sensor-section" id="dashboard">
          <h2>Real-Time Water Sensor Data</h2>
          <div className="sensor-grid">
            <div className="sensor-card"><h3>pH Level</h3><p id="ph">7.2</p></div>
            <div className="sensor-card"><h3>Turbidity</h3><p id="turbidity">3.5 NTU</p></div>
            <div className="sensor-card"><h3>Temperature</h3><p id="temp">26°C</p></div>
            <div className="sensor-card"><h3>TDS</h3><p id="tds">450 ppm</p></div>
          </div>
          <div id="water-status" className="status-card">Checking water safety...</div>
        </section>
        <footer>
          <p>© 2025 AquaCheck System. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
