import React, { useState, useEffect, useContext } from "react";
import Sidebar from "../components/Sidebar";
import { database } from "../firebase";
import { ref, onValue, remove, update } from "firebase/database";
import { AdminContext } from "../App";

const MasterAdmin = () => {
  const { isAdmin } = useContext(AdminContext);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const userList = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val,
        }));
        setUsers(userList);
      },
      (error) => setError(error.message)
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const handleDelete = (userId) => {
    if (window.confirm("Delete this user? This action cannot be undone.")) {
      remove(ref(database, `users/${userId}`)).catch((err) =>
        setError(err.message)
      );
    }
  };

  const toggleUserStatus = (userId, currentStatus) => {
    update(ref(database, `users/${userId}`), {
      disabled: !currentStatus,
    }).catch((err) => setError(err.message));
  };

  const handlePasswordChange = () => {
    if (!newPassword.trim()) {
      setPasswordMessage("Password cannot be empty.");
      return;
    }
    // TODO: Replace this with your actual backend call for secret admin password update
    setPasswordMessage("Secret admin password changed successfully!");
    setNewPassword("");
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMessage("");
    }, 2000);
  };

  if (!isAdmin) return <p style={{ padding: 20 }}>Access Denied</p>;

  return (
    <div className="container masteradmin-container">
      <Sidebar />
      <main className="main-content">
        <h1 className="masteradmin-header">Master Admin - User Management</h1>
        {error && <p className="masteradmin-error">{error}</p>}

        <button className="btn" onClick={() => setShowPasswordModal(true)}>
          Change Secret Admin Password
        </button>

        <table className="masteradmin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>
                  No users found.
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
                    >
                      {user.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!user.disabled}
                        onChange={() =>
                          toggleUserStatus(user.id, user.disabled || false)
                        }
                      />
                      <span className="slider"></span>
                    </label>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(user.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {showPasswordModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Change Secret Admin Password</h2>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              {passwordMessage && (
                <p
                  style={{
                    color: passwordMessage.includes("successfully")
                      ? "green"
                      : "red",
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
