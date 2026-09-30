import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Home as HomeIcon, LogOut, ArrowLeft } from "lucide-react";
import { logout, currentUser, currentUserProfile, isSuperAdmin } from "../lib/store";

/**
 * Global horizontal navigation bar shown at the top of every authenticated page.
 * Exposes: Back (non-home only), Home, signed-in user + role, Logout.
 * All department modules must be opened via the Home dashboard cards.
 */
const HomeNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const me = currentUserProfile();
  const superAdmin = isSuperAdmin(me?.user);
  const doLogout = () => { logout(); navigate("/login"); };

  const link = ({ isActive }) => "hn-link" + (isActive ? " active" : "");
  const onHome = location.pathname === "/home";

  return (
    <div className="home-navbar" data-testid="home-navbar">
      <div className="hn-brand" onClick={() => navigate("/home")} data-testid="hn-brand">
        <HomeIcon size={16} /> <span>ARUN ENTERPRISES</span>
      </div>

      <nav className="hn-links">
        {!onHome && (
          <button
            type="button"
            className="hn-link"
            onClick={() => navigate(-1)}
            data-testid="hn-back"
            style={{ background: "transparent", cursor: "pointer" }}
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}
        <NavLink to="/home" className={link} data-testid="hn-home">
          <HomeIcon size={15} /> Home
        </NavLink>
      </nav>

      <div className="hn-right">
        <span className="hn-user" title={me?.user}>
          <b>{me?.name || currentUser()}</b>
          <span className={"hn-role " + (superAdmin ? "sa" : "usr")}>
            {superAdmin ? "SUPERADMIN" : (me?.role || "User").toUpperCase()}
          </span>
        </span>
        <button
          onClick={doLogout}
          data-testid="hn-logout"
          className="hn-logout"
        >
          <LogOut size={13} /> Logout
        </button>
      </div>
    </div>
  );
};

export default HomeNavBar;
