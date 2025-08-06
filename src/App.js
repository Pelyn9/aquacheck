import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import DataHistory from "./pages/DataHistory";
import './assets/datahistory.css';
import './assets/databoard.css';
import './assets/login.css';
import CreateAdmin from "./pages/CreateAdmin";
import AuthForm from "./pages/AuthForm";
import AdminLogin from "./pages/AdminLogin";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/" element={<AuthForm />} /> 
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/datahistory" element={<DataHistory />} />
        <Route path="/create-admin" element={<CreateAdmin />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
