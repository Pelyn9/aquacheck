import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt,
  faHistory,
  faSignOutAlt,
  faBars,
  faTint
} from '@fortawesome/free-solid-svg-icons';
import '../assets/Sidebar.css';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleLogout = () => {
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    navigate('/');
  };

  const cancelLogout = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button className="hamburger" onClick={toggleSidebar}>
            <FontAwesomeIcon icon={faBars} />
          </button>
          {!isCollapsed && (
            <h2>
              <FontAwesomeIcon icon={faTint} style={{ marginRight: '5px' }} />
              AquaCheck
            </h2>
          )}
        </div>

        <ul className="nav-links">
          <li onClick={() => navigate('/dashboard')}>
            <FontAwesomeIcon icon={faTachometerAlt} />
            {!isCollapsed && <span> Dashboard</span>}
          </li>
          <li onClick={() => navigate('/datahistory')}>
            <FontAwesomeIcon icon={faHistory} />
            {!isCollapsed && <span> Dataset History</span>}
          </li>
          <li onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            {!isCollapsed && <span> Logout</span>}
          </li>
        </ul>
      </aside>

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
    </>
  );
}
