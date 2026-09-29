import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home as HomeIcon, Users, ShoppingCart, Wallet, UserCog, LogOut, FileBarChart } from "lucide-react";
import { logout, currentUser, currentUserProfile, isSuperAdmin } from "../lib/store";

/**
 * Global horizontal navigation bar shown at the top of every authenticated page.
 * Provides one-click access to Home + all department modules + Logout.
 */
const HomeNavBar = () => {
  const navigate = useNavigate();
  const me = currentUserProfile();
  const superAdmin = isSuperAdmin(me?.user);
  const doLogout = () => { logout(); navigate("/login"); };

  const link = ({ isActive }) => "hn-link" + (isActive ? " active" : "");

  return (
    <div className="home-navbar" data-testid="home-navbar">
      <div className="hn-brand" onClick={() => navigate("/home")} data-testid="hn-brand">
        <HomeIcon size={14} /> <span>ARUN ENTERPRISES</span>
      </div>

      <nav className="hn-links">
        <NavLink to="/home" className={link} data-testid="hn-home">
          <HomeIcon size={13} /> Home
        </NavLink>
        <NavLink to="/vendor" className={link} data-testid="hn-vendor">
          <Users size={13} /> Vendor
        </NavLink>
        <NavLink to="/bill" className={link} data-testid="hn-bill">
          <ShoppingCart size={13} /> Bill
        </NavLink>
        <NavLink to="/expense" className={link} data-testid="hn-expense">
          <Wallet size={13} /> Expense
        </NavLink>
        <NavLink to="/final" className={link} data-testid="hn-reports">
          <FileBarChart size={13} /> Reports
        </NavLink>
        {superAdmin && (
          <NavLink to="/users" className={link} data-testid="hn-users">
            <UserCog size={13} /> Users
          </NavLink>
        )}
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
