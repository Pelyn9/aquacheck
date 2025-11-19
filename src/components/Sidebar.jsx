import React, { useState, useContext, useRef, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTachometerAlt,
  faHistory,
  faSignOutAlt,
  faTint,
  faLock,
  faChartLine, // ✅ Added modern chart icon for Data Analytics
} from "@fortawesome/free-solid-svg-icons";
import "../assets/Sidebar.css";
import { AdminContext } from "../App";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth <= 768);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMasterLogin, setShowMasterLogin] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const { isAdmin, setIsAdmin } = useContext(AdminContext);
  const navigate = useNavigate();
  const location = useLocation();

  const clickCount = useRef(0);
  const clickTimeout = useRef(null);
  const passwordInputRef = useRef(null);

  // 🧭 Save route to localStorage whenever location changes
  useEffect(() => {
    try {
      localStorage.setItem("lastVisitedPage", location.pathname);
    } catch (e) {
      console.warn("Could not save last visited page:", e);
    }
  }, [location]);

  // 🏁 Restore last page on mount
  useEffect(() => {
    const lastPage = localStorage.getItem("lastVisitedPage");
    const current = window.location.pathname;
    const defaultPaths = ["/", "/admin", "/dashboard"];

    if (lastPage && current !== lastPage && defaultPaths.includes(current)) {
      setTimeout(() => {
        navigate(lastPage, { replace: true });
      }, 50);
    }

    const handleBeforeUnload = () => {
      try {
        localStorage.setItem("lastVisitedPage", window.location.pathname);
      } catch (e) {}
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [navigate]);

  // 📱 Handle screen resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsCollapsed(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔐 Focus password input when Master Login opens
  useEffect(() => {
    if (showMasterLogin && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [showMasterLogin]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    document.body.classList.toggle("sidebar-open", !isCollapsed);
  };

  const handleLogout = () => setShowConfirm(true);

  const confirmLogout = () => {
    try {
      localStorage.removeItem("isAdmin");
      localStorage.removeItem("lastVisitedPage");
    } catch (e) {}
    setIsAdmin(false);
    setShowConfirm(false);
    navigate("/admin");
  };

  const cancelLogout = () => setShowConfirm(false);

  const goTo = (path) => {
    try {
      localStorage.setItem("lastVisitedPage", path);
    } catch (e) {}
    navigate(path);
  };

  // 🧠 Dashboard hidden trigger (7 taps → Master Admin)
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
          goTo("/dashboard");
          clickCount.current = 0;
        }
      }, 300);
    }
  };

  // 🧩 Master Admin Password Logic
  const handleMasterSubmit = () => {
    const savedPassword = localStorage.getItem("masterPassword");
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
      goTo("/master-admin");
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
      {/* 🍔 Hamburger Button (Always visible on mobile) */}
      {isMobile && (
        <div
          className={`hamburger ${isCollapsed ? "" : "active"}`}
          onClick={toggleSidebar}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}

      {/* 🧭 Sidebar */}
      <aside className={`sidebar ${isCollapsed ? "" : "open"}`}>
        <div className="sidebar-header">
          {!isCollapsed && (
            <h2>
              <FontAwesomeIcon icon={faTint} style={{ marginRight: "5px" }} />
              SafeShore
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
                <Link
                  to="/datahistory"
                  className="nav-link"
                  onClick={() => goTo("/datahistory")}
                >
                  <FontAwesomeIcon icon={faHistory} />
                  {!isCollapsed && <span> Dataset History</span>}
                </Link>
              </li>

              <li>
                <Link
                  to="/data-analytics"
                  className="nav-link"
                  onClick={() => goTo("/data-analytics")}
                >
                  <FontAwesomeIcon icon={faChartLine} /> {/* ✅ New icon */}
                  {!isCollapsed && <span> Data Analytics</span>}
                </Link>
              </li>

              <li>
                <button
                  onClick={handleLogout}
                  className="nav-link logout-button"
                  type="button"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} />
                  {!isCollapsed && <span> Logout</span>}
                </button>
              </li>
            </>
          )}
        </ul>
      </aside>

      {/* 🕶 Overlay (Mobile) */}
      {!isCollapsed && isMobile && (
        <div className="menu-overlay" onClick={toggleSidebar}></div>
      )}

      {/* 🚪 Logout Confirmation Modal */}
      {showConfirm && (
        <div className="overlay">
          <div className="logout-modal">
            <p>Are you sure you want to logout?</p>
            <div className="confirm-buttons">
              <button className="yes" onClick={confirmLogout}>
                Yes
              </button>
              <button className="no" onClick={cancelLogout}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔒 Master Admin Access Modal */}
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
              <button className="btn primary" onClick={handleMasterSubmit}>
                Submit
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setShowMasterLogin(false);
                  setMasterPasswordInput("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
