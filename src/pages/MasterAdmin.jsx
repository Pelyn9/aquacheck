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

  // Secret Admin password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showSecretPassword, setShowSecretPassword] = useState(false);

  // Master admin access password (persisted in localStorage)
  const defaultMasterPassword = "watercheck123"; // ✅ default password
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [currentMasterPassword, setCurrentMasterPassword] = useState(
    localStorage.getItem("masterPassword") || defaultMasterPassword
  );
  const [editedMasterPassword, setEditedMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Auto-save default password to localStorage if not set
  useEffect(() => {
    if (!localStorage.getItem("masterPassword")) {
      localStorage.setItem("masterPassword", defaultMasterPassword);
    }
  }, []);

  // Convert date safely
  const safeDate = (d) => {
    if (!d) return "—";
    const t = new Date(d);
    return isNaN(t.getTime()) ? "—" : t.toLocaleString();
  };

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/users`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      console.error(e);
      setError("Unexpected error fetching users.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Delete user
  const handleDelete = async (userId) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    setOpId(userId);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error(e);
      setError("Unexpected error deleting user.");
    } finally {
      setOpId(null);
    }
  };

  // Enable/Disable user
  const handleToggleUser = async (userId, currentlyDisabled) => {
    setOpId(userId);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: !currentlyDisabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchUsers();
    } catch (e) {
      console.error(e);
      setError("Failed to update user status.");
    } finally {
      setOpId(null);
    }
  };

  // Change secret admin password
  const handlePasswordChange = async () => {
    if (!newPassword.trim()) {
      setPasswordMessage("Password cannot be empty.");
      return;
    }

    try {
      const currentKey = prompt("Enter current secret admin key:");

      if (!currentKey) {
        setPasswordMessage("Current key is required.");
        return;
      }

      const res = await fetch(`${API_BASE}/change-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldKey: currentKey,
          newKey: newPassword.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setPasswordMessage("Failed to change password: " + (result.error || "Unknown error"));
      } else {
        setPasswordMessage("Secret admin password changed!");
        setNewPassword("");
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordMessage("");
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setPasswordMessage("Failed to change password.");
    }
  };

  // Save master admin password in localStorage
  const handleMasterUpdate = () => {
    if (!editedMasterPassword.trim()) {
      alert("Please enter a new master password before saving.");
      return;
    }
    const newPass = editedMasterPassword.trim();
    try {
      localStorage.setItem("masterPassword", newPass);
      setCurrentMasterPassword(newPass);

      window.dispatchEvent(
        new CustomEvent("masterPasswordUpdated", { detail: { newPass } })
      );

      alert("Master Admin password updated!");
      setEditedMasterPassword("");
      setShowAccessModal(false);
    } catch (e) {
      console.error("Failed to save master password", e);
      alert("Failed to update master password.");
    }
  };

  if (!isAdmin) {
    return <p style={{ textAlign: "center", color: "red" }}>Access Denied</p>;
  }

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
                  <td colSpan="5">Loading…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5">No users found 👀</td>
                </tr>
              ) : (
                users.map((u) => {
                  const disabled = u.app_metadata?.disabled === true;
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

        {/* Secret Admin Password Modal */}
        {showPasswordModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Change Secret Admin Password</h2>
              <input
                type={showSecretPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
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
                <button
                  className="modal-btn cancel"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Master Admin Access Modal */}
        {showAccessModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Master Admin Access</h2>
              <p>
                Current Master Password:{" "}
                <strong>
                  {currentMasterPassword || "Not set"}
                </strong>
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
              <div style={{ marginTop: 12 }}>
                <button className="modal-btn confirm" onClick={handleMasterUpdate}>
                  Save
                </button>
                <button
                  className="modal-btn cancel"
                  onClick={() => setShowAccessModal(false)}
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

export default MasterAdmin;
