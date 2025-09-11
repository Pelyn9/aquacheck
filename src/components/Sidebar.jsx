// src/components/Sidebar.jsx
import React, { useState, useContext, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTachometerAlt,
  faHistory,
  faSignOutAlt,
  faBars,
  faTint,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/Sidebar.css";

import { AdminContext } from "../App";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return JSON.parse(localStorage.getItem("sidebarCollapsed")) || false;
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMasterLogin, setShowMasterLogin] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [attempts, setAttempts] = useState(0);

  const { isAdmin, setIsAdmin } = useContext(AdminContext);
  const navigate = useNavigate();

  const clickCount = useRef(0);
  const clickTimeout = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // When master password updates elsewhere, we can log/do something (optional)
  useEffect(() => {
    const onUpdate = (e) => {
      console.log("masterPasswordUpdated event:", e?.detail?.newPass ? "updated" : "updated (no detail)");
      // optionally auto-close modal or show message
    };
    window.addEventListener("masterPasswordUpdated", onUpdate);
    return () => window.removeEventListener("masterPasswordUpdated", onUpdate);
  }, []);

  // Autofocus password input when modal opens
  useEffect(() => {
    if (showMasterLogin && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [showMasterLogin]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const handleLogout = () => setShowConfirm(true);

  const confirmLogout = () => {
    localStorage.removeItem("isAdmin");
    setIsAdmin(false);
    setShowConfirm(false);
    navigate("/admin");
  };

  const cancelLogout = () => setShowConfirm(false);

  const handleDashboardClick = (e) => {
    e.preventDefault();
    clickCount.current += 1;

    if (clickCount.current === 7) {
      clickCount.current = 0;
      clearTimeout(clickTimeout.current);
      setShowMasterLogin(true);
      return;
    }

    clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => {
      clickCount.current = 0;
    }, 5000);

    if (clickCount.current === 1) {
      setTimeout(() => {
        if (clickCount.current === 1) {
          navigate("/dashboard");
          clickCount.current = 0;
        }
      }, 300);
    }
  };

  const handleMasterSubmit = () => {
    // Read the latest stored password
    const savedPassword = localStorage.getItem("masterPassword");

    // Helpful debug information
    console.debug("Trying master submit. savedPassword exists:", !!savedPassword);

    if (!savedPassword) {
      alert("No master password is set. Please set it in Master Admin first.");
      setMasterPasswordInput("");
      setShowMasterLogin(false);
      return;
    }

    if (masterPasswordInput.trim() === savedPassword) {
      setAttempts(0);
      setShowMasterLogin(false);
      setMasterPasswordInput("");
      navigate("/master-admin");
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 3) {
        alert("❌ Too many failed attempts. Logging out...");
        setShowMasterLogin(false);
        setMasterPasswordInput("");
        setAttempts(0);
        confirmLogout();
      } else {
        alert(`❌ Wrong password. Attempts left: ${3 - newAttempts}`);
        setMasterPasswordInput("");
      }
    }
  };

  return (
    <>
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <button className="hamburger" onClick={toggleSidebar}>
            <FontAwesomeIcon icon={faBars} />
          </button>
          {!isCollapsed && (
            <h2>
              <FontAwesomeIcon icon={faTint} style={{ marginRight: "5px" }} />
              AquaCheck
            </h2>
          )}
        </div>

        <ul className="nav-links">
          <li>
            <a
              href="/dashboard"
              className="nav-link"
              onClick={handleDashboardClick}
              style={{ cursor: "pointer", userSelect: "none" }}
            >
              <FontAwesomeIcon icon={faTachometerAlt} />
              {!isCollapsed && <span> Dashboard</span>}
            </a>
          </li>
          {isAdmin && (
            <>
              <li>
                <Link to="/datahistory" className="nav-link">
                  <FontAwesomeIcon icon={faHistory} />
                  {!isCollapsed && <span> Dataset History</span>}
                </Link>
              </li>
              <li>
                <button onClick={handleLogout} className="nav-link logout-button" type="button">
                  <FontAwesomeIcon icon={faSignOutAlt} />
                  {!isCollapsed && <span> Logout</span>}
                </button>
              </li>
            </>
          )}
        </ul>
      </aside>

      {/* Logout Modal */}
      {showConfirm && (
        <div className="overlay">
          <div className="logout-modal">
            <p>Are you sure you want to logout?</p>
            <div className="confirm-buttons">
              <button className="yes" onClick={confirmLogout}>Yes</button>
              <button className="no" onClick={cancelLogout}>No</button>
            </div>
          </div>
        </div>
      )}

      {/* Master Admin Modal */}
      {showMasterLogin && (
        <div className="overlay">
          <div className="master-modal">
            <h3>
              <FontAwesomeIcon icon={faLock} /> Master Admin Access
            </h3>
            <input
              ref={passwordInputRef}
              type="password"
              placeholder="Enter Master Password"
              value={masterPasswordInput}
              onChange={(e) => setMasterPasswordInput(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn primary" onClick={handleMasterSubmit}>Submit</button>
              <button className="btn secondary" onClick={() => { setShowMasterLogin(false); setMasterPasswordInput(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
