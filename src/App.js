import React, { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { supabase } from "./supabaseClient.js";

// Pages
import VisitorPage from "./pages/VisitorPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DataHistory from "./pages/DataHistory.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import CreateAdmin from "./pages/CreateAdmin.jsx";
import ForgotPassword from "./pages/forgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import MasterAdmin from "./pages/MasterAdmin.jsx";
import ManualScan from "./pages/ManualScan.jsx";
import UpdatePassword from "./pages/UpdatePassword.jsx";

// Contexts
import { AutoScanProvider } from "./context/AutoScanContext.js";

export const AdminContext = createContext();

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);

    // 🔑 Kick out disabled accounts if already logged in
    const checkDisabled = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.app_metadata?.disabled) {
        await supabase.auth.signOut();
        setIsAdmin(false);
        localStorage.removeItem("isAdmin");
        alert("🚫 Your account has been disabled.");
      }
    };

    checkDisabled();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user;
        if (user?.app_metadata?.disabled) {
          await supabase.auth.signOut();
          setIsAdmin(false);
          localStorage.removeItem("isAdmin");
          alert("🚫 Your account has been disabled.");
        }
      }
    );

    return () => subscription?.subscription.unsubscribe();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, setIsAdmin }}>
      <AutoScanProvider>
        <Router>
          <Routes>
            <Route path="/visitor" element={<VisitorPage />} />

            <Route
              path="/dashboard"
              element={isAdmin ? <Dashboard isAdminProp={true} /> : <Navigate to="/admin" replace />}
            />

            <Route path="/admin" element={!isAdmin ? <AdminLogin /> : <Navigate to="/dashboard" replace />} />
            <Route path="/create-admin" element={!isAdmin ? <CreateAdmin /> : <Navigate to="/dashboard" replace />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />

            <Route path="/datahistory" element={isAdmin ? <DataHistory /> : <Navigate to="/admin" replace />} />
            <Route path="/master-admin" element={isAdmin ? <MasterAdmin /> : <Navigate to="/admin" replace />} />
            <Route path="/manual-scan" element={isAdmin ? <ManualScan /> : <Navigate to="/admin" replace />} />

            <Route path="/" element={<Navigate to="/visitor" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AutoScanProvider>
    </AdminContext.Provider>
  );
}

export default App;
