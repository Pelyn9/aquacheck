import React, { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DataHistory from "./pages/DataHistory";
import AdminLogin from "./pages/AdminLogin";
import CreateAdmin from "./pages/CreateAdmin";

// Create context for admin login state
export const AdminContext = createContext();

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  // On mount, check if admin logged in from localStorage
  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, setIsAdmin }}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/dashboard" element={<Dashboard />} />  {/* Public dashboard */}

          <Route
            path="/admin"
            element={!isAdmin ? <AdminLogin /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/create-admin"
            element={!isAdmin ? <CreateAdmin /> : <Navigate to="/dashboard" />}
          />

          {/* Admin protected routes */}
          <Route
            path="/datahistory"
            element={isAdmin ? <DataHistory /> : <Navigate to="/admin" />}
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" />} />

          {/* Catch all redirects */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AdminContext.Provider>
  );
}

export default App;
