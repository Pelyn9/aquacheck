// src/pages/MasterAdmin.jsx
import React, { useState, useEffect, useContext, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { AdminContext } from "../App";
import "../assets/masteradmin.css";

const API_BASE =
  process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/admin`
    : "http://localhost:4000/api/admin";

const MasterAdmin = () => {
  const { isAdmin } = useContext(AdminContext);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [opId, setOpId] = useState(null);

  // Secret Admin Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentKeyInput, setCurrentKeyInput] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showSecretPassword, setShowSecretPassword] = useState(false);

  // Master Admin Access Modal
  const defaultMasterPassword = "watercheck123";
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [currentMasterPassword, setCurrentMasterPassword] = useState(
    localStorage.getItem("masterPassword") || defaultMasterPassword
  );
  const [editedMasterPassword, setEditedMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [masterMessage, setMasterMessage] = useState("");

  // Initialize Master Password
  const initializeMasterPassword = async () => {
    const localPass = localStorage.getItem("masterPassword");
    if (!localPass) {
      localStorage.setItem("masterPassword", defaultMasterPassword);
      setCurrentMasterPassword(defaultMasterPassword);
    }

    try {
      const res = await fetch(`${API_BASE}/master-password`, { cache: "no-store" });
      if (!res.ok) return; // backend might not respond yet
      const data = await res.json().catch(() => ({}));
      if (data.password) setCurrentMasterPassword(data.password);
    } catch (err) {
      console.error("Error fetching Master Password:", err);
    }
  };

  useEffect(() => {
    initializeMasterPassword();
  }, []);

  // Utility
  const safeDate = (d) => {
    if (!d) return "—";
    const t = new Date(d);
    return isNaN(t.getTime()) ? "—" : t.toLocaleString();
  };

  // ✅ FIXED Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text}`);
      }

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Unexpected response format from server");
      }

      if (Array.isArray(data.users)) {
        setUsers(data.users);
      } else if (Array.isArray(data)) {
        setUsers(data);
      } else {
        throw new Error("Invalid user data format");
      }
    } catch (e) {
      console.error("Error fetching users:", e);
      setError("Failed to fetch users: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  // User Actions
  const handleDelete = async (userId) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    setOpId(userId);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete user");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error(e);
      setError("Unexpected error deleting user: " + e.message);
    } finally {
      setOpId(null);
    }
  };

  const handleToggleUser = async (userId, currentlyDisabled) => {
    setOpId(userId);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: !currentlyDisabled }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to toggle user status");
      }
      await fetchUsers();
    } catch (e) {
      console.error(e);
      setError("Failed to update user status: " + e.message);
    } finally {
      setOpId(null);
    }
  };

  // Secret Admin Password
  const handlePasswordChange = async () => {
    if (!newPassword.trim()) return setPasswordMessage("Password cannot be empty.");
    if (!currentKeyInput.trim()) return setPasswordMessage("Current key is required.");

    try {
      const res = await fetch(`${API_BASE}/change-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldKey: currentKeyInput, newKey: newPassword.trim() }),
      });

      const contentType = res.headers.get("content-type");
      let result = contentType && contentType.includes("application/json")
        ? await res.json()
        : {};

      if (!res.ok) {
        throw new Error(result.error || "Failed to change password");
      }

      setPasswordMessage("Secret admin password changed!");
      setNewPassword("");
      setCurrentKeyInput("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage("");
      }, 1200);
    } catch (err) {
      console.error(err);
      setPasswordMessage("Failed to change password: " + err.message);
    }
  };

  // Master Admin Password
  const handleMasterUpdate = async () => {
    if (!editedMasterPassword.trim()) return setMasterMessage("Please enter a new master password.");
    const newPass = editedMasterPassword.trim();

    try {
      localStorage.setItem("masterPassword", newPass);
      setCurrentMasterPassword(newPass);

      const res = await fetch(`${API_BASE}/master-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPass }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || "Failed to update master password in DB");
      }

      window.dispatchEvent(new CustomEvent("masterPasswordUpdated", { detail: { newPass } }));
      setMasterMessage("Master Admin password updated!");
      setEditedMasterPassword("");
      setTimeout(() => setShowAccessModal(false), 1200);
    } catch (e) {
      console.error("Failed to save master password", e);
      setMasterMessage("Failed to update master password: " + e.message);
    }
  };

  // Render
  if (!isAdmin) return <p style={{ textAlign: "center", color: "red" }}>Access Denied</p>;

  return (
    <div className="container masteradmin-container">
      <Sidebar />
      <main className="main-content">
        <h1>Master Admin - Auth Users</h1>
        {error && <p className="masteradmin-error">{error}</p>}

        {/* Controls */}
        <div className="card">
          <button className="btn-primary" onClick={() => setShowPasswordModal(true)}>
            Change Secret Admin Password
          </button>
          <button
            className="btn-primary"
            style={{ marginLeft: "10px" }}
            onClick={() => setShowAccessModal(true)}
          >
            Master Admin Access
          </button>
          <button className="btn" onClick={fetchUsers} disabled={loading}>
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* Users Table */}
        <div className="card">
          <table className="masteradmin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5}>No users found</td>
                </tr>
              ) : (
                users.map((u) => {
                  const disabled = u.disabled;
                  return (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.email}</td>
                      <td>{safeDate(u.created_at)}</td>
                      <td>{disabled ? "Disabled" : "Active"}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(u.id)}
                          disabled={opId === u.id}
                        >
                          {opId === u.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          className={`btn ${disabled ? "btn-success" : "btn-warning"}`}
                          onClick={() => handleToggleUser(u.id, disabled)}
                          disabled={opId === u.id}
                          style={{ marginLeft: 8 }}
                        >
                          {opId === u.id
                            ? disabled
                              ? "Enabling…"
                              : "Disabling…"
                            : disabled
                            ? "Enable"
                            : "Disable"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Secret Admin Modal */}
        {showPasswordModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Change Secret Admin Password</h2>
              <input
                type={showSecretPassword ? "text" : "password"}
                value={currentKeyInput}
                onChange={(e) => setCurrentKeyInput(e.target.value)}
                placeholder="Enter current secret key"
              />
              <input
                type={showSecretPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{ marginTop: "8px" }}
              />
              <label style={{ display: "block", marginTop: "6px" }}>
                <input
                  type="checkbox"
                  checked={showSecretPassword}
                  onChange={() => setShowSecretPassword(!showSecretPassword)}
                />{" "}
                Show password
              </label>
              {passwordMessage && <p>{passwordMessage}</p>}
              <div>
                <button className="modal-btn confirm" onClick={handlePasswordChange}>
                  Confirm
                </button>
                <button className="modal-btn cancel" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Master Admin Modal */}
        {showAccessModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Master Admin Access</h2>
              <p>
                Current Master Password: <strong>{currentMasterPassword || "Not set"}</strong>
              </p>

              <input
                type={showMasterPassword ? "text" : "password"}
                placeholder="Enter new master password"
                value={editedMasterPassword}
                onChange={(e) => setEditedMasterPassword(e.target.value)}
              />
              <label style={{ display: "block", marginTop: "6px" }}>
                <input
                  type="checkbox"
                  checked={showMasterPassword}
                  onChange={() => setShowMasterPassword(!showMasterPassword)}
                />{" "}
                Show password
              </label>
              {masterMessage && <p>{masterMessage}</p>}
              <div style={{ marginTop: 12 }}>
                <button className="modal-btn confirm" onClick={handleMasterUpdate}>
                  Save
                </button>
                <button className="modal-btn cancel" onClick={() => setShowAccessModal(false)}>
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

export default MasterAdmin;
