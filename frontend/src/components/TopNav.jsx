import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout, currentUser } from "../lib/store";
import { LogOut, User } from "lucide-react";

export const TopNav = () => {
  const navigate = useNavigate();
  const user = currentUser();
  const doLogout = () => { logout(); navigate("/login"); };
  return (
    <div className="top-nav" data-testid="top-nav">
      <div className="tabs">
        <NavLink to="/vendor" className={({ isActive }) => isActive ? "active" : ""} data-testid="nav-vendor">
          Page 1 · Vendor Registration
        </NavLink>
        <NavLink to="/bill" className={({ isActive }) => isActive ? "active" : ""} data-testid="nav-bill">
          Page 2 · Bill Processing
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => isActive ? "active" : ""} data-testid="nav-reports">
          Page 3 · Reports & Voucher
        </NavLink>
      </div>
      <div className="who">
        <span><User size={12} style={{ verticalAlign: "-2px" }} /> <b>{user}</b></span>
        <button onClick={doLogout} data-testid="btn-logout"><LogOut size={11} /> Logout</button>
      </div>
    </div>
  );
};

export default TopNav;
