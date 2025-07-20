import { useNavigate } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();

  const logout = () => {
    navigate("/");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2><i className="fas fa-water"></i> AquaCheck</h2>
      </div>
      <ul className="nav-links">
        <li onClick={() => navigate("/dashboard")}>
          <i className="fas fa-tachometer-alt"></i> Dashboard
        </li>
        <li onClick={() => navigate("/datahistory")}>
          <i className="fas fa-history"></i> Dataset History
        </li>
        <li onClick={logout}>
          <i className="fas fa-sign-out-alt"></i> Logout
        </li>
      </ul>
    </aside>
  );
};

export default Sidebar;
