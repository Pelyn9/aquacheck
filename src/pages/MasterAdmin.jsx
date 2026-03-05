import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBars,
  FaKey,
  FaShieldAlt,
  FaSyncAlt,
  FaUserShield,
} from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { AdminContext } from "../App";
import "../assets/masteradmin.css";

const DEFAULT_MASTER_PASSWORD = "watercheck123";

const normalizeBase = (value) => value.replace(/\/+$/, "");

const buildApiCandidates = () => {
  const candidates = [];
  const envBase = process.env.REACT_APP_API_URL?.trim();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  candidates.push("/api/admin");
  if (isLocalHost && envBase) candidates.push(`${normalizeBase(envBase)}/api/admin`);
  if (isLocalHost) candidates.push("http://localhost:4000/api/admin");

  return [...new Set(candidates)];
};

const buildRequestUrls = (base, path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const urls = base.endsWith("/api/admin")
    ? [
        `${base}?path=${encodeURIComponent(normalizedPath)}`,
        `${base}${normalizedPath}`,
      ]
    : [`${base}${normalizedPath}`];

  return [...new Set(urls)];
};

const getServerMessage = (payload, status) => {
  if (payload && typeof payload === "object") {
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.message === "string") return payload.message;
  }
  return `Server error (${status})`;
};

const parseResponsePayload = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text ? { message: text } : null;
};

export default function MasterAdmin() {
  const { isAdmin } = useContext(AdminContext);
  const navigate = useNavigate();

  const apiCandidates = useMemo(() => buildApiCandidates(), []);
  const [apiBaseInUse, setApiBaseInUse] = useState("");

  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [opId, setOpId] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentKeyInput, setCurrentKeyInput] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showSecretPassword, setShowSecretPassword] = useState(false);

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [currentMasterPassword, setCurrentMasterPassword] = useState(
    localStorage.getItem("masterPassword") || DEFAULT_MASTER_PASSWORD
  );
  const [editedMasterPassword, setEditedMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [masterMessage, setMasterMessage] = useState("");

  const [showMenu, setShowMenu] = useState(false);

  const requestAdmin = useCallback(
    async (path, options = {}, behavior = {}) => {
      const { retryNotFound = true } = behavior;
      const orderedBases = apiBaseInUse
        ? [apiBaseInUse, ...apiCandidates.filter((base) => base !== apiBaseInUse)]
        : apiCandidates;
      const requestAttempts = orderedBases.flatMap((base) =>
        buildRequestUrls(base, path).map((url) => ({ base, url }))
      );

      let lastError = null;

      for (let index = 0; index < requestAttempts.length; index += 1) {
        const { base, url } = requestAttempts[index];
        const isLastCandidate = index === requestAttempts.length - 1;

        try {
          const response = await fetch(url, {
            cache: "no-store",
            ...options,
            headers: {
              ...(options.body ? { "Content-Type": "application/json" } : {}),
              ...(options.headers || {}),
            },
          });

          const contentType = response.headers.get("content-type") || "";
          const payload = await parseResponsePayload(response);

          if (response.ok && !contentType.includes("application/json")) {
            const nonJsonError = new Error("Unexpected non-JSON response from admin API.");
            if (!isLastCandidate) {
              lastError = nonJsonError;
              continue;
            }
            throw nonJsonError;
          }

          if (!response.ok) {
            const serverMessage = getServerMessage(payload, response.status);
            const canFallback =
              !isLastCandidate &&
              (response.status >= 500 ||
                (retryNotFound &&
                  (response.status === 404 || response.status === 405)));

            if (canFallback) {
              lastError = new Error(serverMessage);
              continue;
            }

            const finalError = new Error(serverMessage);
            finalError.isFinal = true;
            throw finalError;
          }

          if (apiBaseInUse !== base) setApiBaseInUse(base);
          return payload;
        } catch (requestError) {
          if (requestError?.isFinal) throw requestError;

          const message = requestError?.message || "Request failed";
          const isNetworkFailure =
            requestError?.name === "TypeError" ||
            /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message);

          if (!isLastCandidate && isNetworkFailure) {
            lastError = requestError;
            continue;
          }

          lastError = requestError;
          break;
        }
      }

      const baseMessage = lastError?.message || "Unable to connect to admin API.";
      const candidatesText = requestAttempts.map((attempt) => attempt.url).join(", ");
      throw new Error(`${baseMessage} (Tried: ${candidatesText})`);
    },
    [apiBaseInUse, apiCandidates]
  );

  const safeDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  };

  const normalizeUsers = (payload) => {
    if (Array.isArray(payload?.users)) return payload.users;
    if (Array.isArray(payload)) return payload;
    return [];
  };

  const initializeMasterPassword = useCallback(async () => {
    const localPassword = localStorage.getItem("masterPassword");
    if (!localPassword) {
      localStorage.setItem("masterPassword", DEFAULT_MASTER_PASSWORD);
      setCurrentMasterPassword(DEFAULT_MASTER_PASSWORD);
    } else {
      setCurrentMasterPassword(localPassword);
    }

    try {
      const payload = await requestAdmin("/master-password", { method: "GET" });
      const serverPassword = payload?.password || payload?.master_password;
      if (typeof serverPassword === "string" && serverPassword.trim() !== "") {
        setCurrentMasterPassword(serverPassword);
        localStorage.setItem("masterPassword", serverPassword);
      }
    } catch (requestError) {
      console.warn("Master password endpoint unavailable:", requestError.message);
    }
  }, [requestAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const payload = await requestAdmin("/users", { method: "GET" });
      const allUsers = normalizeUsers(payload).map((user) => ({
        ...user,
        disabled: Boolean(
          user.disabled || (user.banned_until && user.banned_until !== "none")
        ),
      }));

      setUsers(allUsers);
      setNotice(`Loaded ${allUsers.length} user${allUsers.length === 1 ? "" : "s"} successfully.`);
    } catch (requestError) {
      console.error("Error fetching users:", requestError);
      setError(`Failed to fetch users: ${requestError.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, requestAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    initializeMasterPassword();
    fetchUsers();
  }, [isAdmin, initializeMasterPassword, fetchUsers]);

  const handleDelete = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    setError("");
    setNotice("");
    setOpId(userId);

    try {
      await requestAdmin(`/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      setNotice("User deleted successfully.");
    } catch (requestError) {
      console.error("Delete failed:", requestError);
      setError(`Error deleting user: ${requestError.message}`);
    } finally {
      setOpId(null);
    }
  };

  const handleToggleUser = async (userId, currentlyDisabled) => {
    setError("");
    setNotice("");
    setOpId(userId);

    try {
      await requestAdmin(`/users/${userId}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enable: currentlyDisabled }),
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, disabled: !currentlyDisabled } : user
        )
      );
      setNotice(currentlyDisabled ? "User enabled successfully." : "User disabled successfully.");
    } catch (requestError) {
      console.error("Toggle failed:", requestError);
      setError(`Failed to update user status: ${requestError.message}`);
    } finally {
      setOpId(null);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) {
      setPasswordMessage("Password cannot be empty.");
      return;
    }
    if (!currentKeyInput.trim()) {
      setPasswordMessage("Current key is required.");
      return;
    }

    try {
      await requestAdmin("/change-key", {
        method: "POST",
        body: JSON.stringify({
          oldKey: currentKeyInput.trim(),
          newKey: newPassword.trim(),
        }),
      });

      setPasswordMessage("Secret admin password changed.");
      setNewPassword("");
      setCurrentKeyInput("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage("");
      }, 1200);
    } catch (requestError) {
      console.error("Change key failed:", requestError);
      setPasswordMessage(`Error: ${requestError.message}`);
    }
  };

  const handleMasterUpdate = async () => {
    if (!editedMasterPassword.trim()) {
      setMasterMessage("Please enter a new master password.");
      return;
    }

    const newValue = editedMasterPassword.trim();

    try {
      localStorage.setItem("masterPassword", newValue);
      setCurrentMasterPassword(newValue);

      await requestAdmin("/master-password", {
        method: "PUT",
        body: JSON.stringify({ password: newValue }),
      });

      window.dispatchEvent(
        new CustomEvent("masterPasswordUpdated", { detail: { newPass: newValue } })
      );
      setMasterMessage("Master password updated.");
      setEditedMasterPassword("");
      setTimeout(() => {
        setShowAccessModal(false);
        setMasterMessage("");
      }, 1200);
    } catch (requestError) {
      console.error("Master password update failed:", requestError);
      setMasterMessage(`Saved locally. API sync failed: ${requestError.message}`);
    }
  };

  const handleManualScanClick = () => {
    navigate("/manual-scan");
    setShowMenu(false);
  };

  if (!isAdmin) return <p style={{ textAlign: "center", color: "red" }}>Access Denied</p>;

  return (
    <div className="container masteradmin-container">
      <Sidebar />

      <main className="main-content masteradmin-main">
        <header className="masteradmin-head">
          <div>
            <h1 className="masteradmin-title">Master Admin Access</h1>
            <p className="masteradmin-subtitle">
              Manage admin credentials and authenticated users from one page.
            </p>
          </div>
          <div className="masteradmin-source-chip">
            <span>API Source</span>
            <strong>{apiBaseInUse || "Not connected yet"}</strong>
          </div>
        </header>

        {error && <p className="masteradmin-error">{error}</p>}
        {!error && notice && <p className="masteradmin-notice">{notice}</p>}

        <section className="card masteradmin-toolbar">
          <button
            type="button"
            className="ma-icon-btn"
            onClick={() => setShowMenu((prev) => !prev)}
            title="Toggle quick menu"
            aria-label="Toggle quick menu"
          >
            <FaBars />
          </button>

          <button
            type="button"
            className="ma-btn ma-btn-primary"
            onClick={() => setShowPasswordModal(true)}
          >
            <FaKey /> Change Secret Admin Password
          </button>

          <button
            type="button"
            className="ma-btn ma-btn-primary"
            onClick={() => setShowAccessModal(true)}
          >
            <FaShieldAlt /> Master Admin Password
          </button>

          <button
            type="button"
            className="ma-btn ma-btn-secondary"
            onClick={fetchUsers}
            disabled={loading}
          >
            <FaSyncAlt /> {loading ? "Refreshing..." : "Refresh Users"}
          </button>
        </section>

        {showMenu && (
          <section className="card masteradmin-quick-actions">
            <button
              type="button"
              className="ma-btn ma-btn-primary"
              onClick={handleManualScanClick}
            >
              <FaUserShield /> Manual Scan
            </button>
          </section>
        )}

        <section className="card masteradmin-table-card">
          <div className="masteradmin-table-head">
            <h2>Auth Users</h2>
            <span>{users.length} total</span>
          </div>

          <div className="masteradmin-table-wrap">
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
                    <td colSpan={5}>Loading...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No users found.</td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const disabled = Boolean(user.disabled);
                    const rowBusy = opId === user.id;

                    return (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.email}</td>
                        <td>{safeDate(user.created_at)}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              disabled ? "status-disabled" : "status-active"
                            }`}
                          >
                            {disabled ? "Disabled" : "Active"}
                          </span>
                        </td>
                        <td className="masteradmin-actions">
                          <button
                            type="button"
                            className="ma-btn ma-btn-danger"
                            onClick={() => handleDelete(user.id)}
                            disabled={rowBusy}
                          >
                            {rowBusy ? "Working..." : "Delete"}
                          </button>
                          <button
                            type="button"
                            className={`ma-btn ${disabled ? "ma-btn-success" : "ma-btn-warning"}`}
                            onClick={() => handleToggleUser(user.id, disabled)}
                            disabled={rowBusy}
                          >
                            {rowBusy ? "Working..." : disabled ? "Enable" : "Disable"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showPasswordModal && (
          <div className="modal-backdrop">
            <div className="masteradmin-modal">
              <h2>Change Secret Admin Password</h2>
              <input
                type={showSecretPassword ? "text" : "password"}
                value={currentKeyInput}
                onChange={(event) => setCurrentKeyInput(event.target.value)}
                placeholder="Enter current secret key"
              />
              <input
                type={showSecretPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new secret password"
              />
              <label>
                <input
                  type="checkbox"
                  checked={showSecretPassword}
                  onChange={() => setShowSecretPassword((prev) => !prev)}
                />{" "}
                Show password
              </label>
              {passwordMessage && <p className="masteradmin-modal-message">{passwordMessage}</p>}
              <div className="masteradmin-modal-actions">
                <button type="button" className="modal-btn confirm" onClick={handlePasswordChange}>
                  Confirm
                </button>
                <button
                  type="button"
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordMessage("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAccessModal && (
          <div className="modal-backdrop">
            <div className="masteradmin-modal">
              <h2>Master Admin Password</h2>
              <p className="masteradmin-current-password">
                Current: <strong>{currentMasterPassword || "Not set"}</strong>
              </p>
              <input
                type={showMasterPassword ? "text" : "password"}
                placeholder="Enter new master password"
                value={editedMasterPassword}
                onChange={(event) => setEditedMasterPassword(event.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={showMasterPassword}
                  onChange={() => setShowMasterPassword((prev) => !prev)}
                />{" "}
                Show password
              </label>
              {masterMessage && <p className="masteradmin-modal-message">{masterMessage}</p>}
              <div className="masteradmin-modal-actions">
                <button type="button" className="modal-btn confirm" onClick={handleMasterUpdate}>
                  Save
                </button>
                <button
                  type="button"
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowAccessModal(false);
                    setMasterMessage("");
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
}
