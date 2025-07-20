import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWater, faTachometerAlt, faHistory, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

export default function Sidebar() {
  const navigate = useNavigate();

  const logout = () => {
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2><FontAwesomeIcon icon={faWater} /> AquaCheck</h2>
      </div>
      <ul className="nav-links">
        <li onClick={() => navigate('/dashboard')}>
          <FontAwesomeIcon icon={faTachometerAlt} /> Dashboard
        </li>
        <li onClick={() => navigate('/datahistory')}>
          <FontAwesomeIcon icon={faHistory} /> Dataset History
        </li>
        <li onClick={logout}>
          <FontAwesomeIcon icon={faSignOutAlt} /> Logout
        </li>
      </ul>
    </aside>
  );
}
