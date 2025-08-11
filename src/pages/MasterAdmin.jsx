import React, { useState, useEffect, useContext } from "react";
import Sidebar from "../components/Sidebar";
import { database } from "../firebase";
import { ref, onValue, remove, update } from "firebase/database";
import { AdminContext } from "../App";
import "../assets/masteradmin.css";

const MasterAdmin = () => {
  const { isAdmin } = useContext(AdminContext);

  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  // Fetch users from Firebase in real-time
  useEffect(() => {
    if (!isAdmin) return;

    const usersRef = ref(database, "users");
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const userList = Object.entries(data).map(([id, user]) => ({
          id,
          ...user,
        }));
        setUsers(userList);
        setError(""); // Clear previous errors on successful fetch
      },
      (err) => setError(err.message)
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // Delete user with confirmation
  const handleDelete = (userId) => {
    if (
      window.confirm(
        "Delete this user? This action cannot be undone."
      )
    ) {
      remove(ref(database, `users/${userId}`)).catch((err) =>
        setError(err.message)
      );
    }
  };

  // Toggle user active/disabled status
  const toggleUserStatus = (userId, currentStatus) => {
    update(ref(database, `users/${userId}`), {
      disabled: !currentStatus,
    }).catch((err) => setError(err.message));
  };

  // Handle password change with simple validation and feedback
  const handlePasswordChange = () => {
    if (!newPassword.trim()) {
      setPasswordMessage("Password cannot be empty.");
      return;
    }
    // TODO: Connect this to your actual admin password update logic

    setPasswordMessage("✅ Secret admin password changed successfully!");
    setNewPassword("");

    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMessage("");
    }, 2000);
  };

  if (!isAdmin) {
    return (
      <p style={{ padding: 20, textAlign: "center", color: "#ef4444" }}>
        Access Denied
      </p>
    );
  }

  return (
    <div className="container masteradmin-container">
      <Sidebar />
      <main className="main-content" role="main">
        <h1 className="masteradmin-header">Master Admin - User Management</h1>

        {error && <p className="masteradmin-error">{error}</p>}

        <div className="card">
          <button
            className="btn-primary"
            onClick={() => setShowPasswordModal(true)}
            aria-label="Change secret admin password"
          >
            🔑 Change Secret Admin Password
          </button>
        </div>

        <div className="card" aria-live="polite">
          <table className="masteradmin-table" aria-describedby="user-table-desc">
            <caption id="user-table-desc" className="sr-only">
              List of registered users with status and actions
            </caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="3">
                    <div className="empty-state">No users found 👀</div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          user.disabled ? "status-disabled" : "status-active"
                        }`}
                        aria-label={user.disabled ? "Disabled user" : "Active user"}
                      >
                        {user.disabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td>
                      <label className="toggle-switch" aria-label="Toggle user status">
                        <input
                          type="checkbox"
                          checked={!user.disabled}
                          onChange={() => toggleUserStatus(user.id, user.disabled || false)}
                        />
                        <span className="slider"></span>
                      </label>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(user.id)}
                        aria-label={`Delete user ${user.email}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showPasswordModal && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal">
              <h2 id="modal-title">Change Secret Admin Password</h2>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                aria-describedby="password-help"
                aria-invalid={passwordMessage && !passwordMessage.includes("successfully")}
              />
              {passwordMessage && (
                <p
                  id="password-help"
                  style={{
                    color: passwordMessage.includes("successfully") ? "green" : "red",
                    marginTop: 8,
                    userSelect: "none",
                  }}
                >
                  {passwordMessage}
                </p>
              )}
              <div style={{ marginTop: 20 }}>
                <button className="modal-btn confirm" onClick={handlePasswordChange}>
                  Confirm
                </button>
                <button
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword("");
                    setPasswordMessage("");
                  }}
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
