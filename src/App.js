import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import DataHistory from "./pages/DataHistory";
import './assets/datahistory.css';
import './assets/databoard.css';
import './assets/login.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/datahistory" element={<DataHistory />} />
      </Routes>
    </Router>
  );
}

export default App;
