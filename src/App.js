import React, { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DataHistory from "./pages/DataHistory";
import AdminLogin from "./pages/AdminLogin";
import CreateAdmin from "./pages/CreateAdmin";
import ForgotPassword from "./pages/forgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import MasterAdmin from "./pages/MasterAdmin";
import ManualScan from "./pages/ManualScan"; // ✅ Import ManualScan

export const AdminContext = createContext();

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, setIsAdmin }}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/admin"
            element={!isAdmin ? <AdminLogin /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/create-admin"
            element={!isAdmin ? <CreateAdmin /> : <Navigate to="/dashboard" />}
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Admin protected routes */}
          <Route
            path="/datahistory"
            element={isAdmin ? <DataHistory /> : <Navigate to="/admin" />}
          />
          <Route
            path="/master-admin"
            element={isAdmin ? <MasterAdmin /> : <Navigate to="/admin" />}
          />
          <Route
            path="/manual-scan"
            element={isAdmin ? <ManualScan /> : <Navigate to="/admin" />} // ✅ New Route
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AdminContext.Provider>
  );
}

export default App;
