import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTachometerAlt,
  faHistory,
  faSignOutAlt,
  faBars,
  faTint,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/Sidebar.css";

import { AdminContext } from "../App"; // import your context

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { isAdmin, setIsAdmin } = useContext(AdminContext);
  const navigate = useNavigate();

  // Removed useEffect that overrides isAdmin from localStorage here!

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleLogout = () => {
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("isAdmin");
    setIsAdmin(false);
    setShowConfirm(false);
    navigate("/admin");
  };

  const cancelLogout = () => {
    setShowConfirm(false);
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
            <Link to="/dashboard" className="nav-link">
              <FontAwesomeIcon icon={faTachometerAlt} />
              {!isCollapsed && <span> Dashboard</span>}
            </Link>
          </li>
          {isAdmin && (
            <>
              <li>
                <Link to="/datahistory" className="nav-link">
                  <FontAwesomeIcon icon={faHistory} />
                  {!isCollapsed && <span> Dataset History</span>}
                </Link>
              </li>
              <li onClick={handleLogout} style={{ cursor: "pointer" }}>
                <FontAwesomeIcon icon={faSignOutAlt} />
                {!isCollapsed && <span> Logout</span>}
              </li>
            </>
          )}
        </ul>
      </aside>

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
    </>
  );
}
