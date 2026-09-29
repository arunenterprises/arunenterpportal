import React, { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout, currentUser, currentUserProfile, setLogo, clearLogo, getLogo, isSuperAdmin } from "../lib/store";
import { LogOut, User, ImageUp, ImageOff } from "lucide-react";
import { toast } from "sonner";

export const TopNav = () => {
  const navigate = useNavigate();
  const user = currentUser();
  const fileRef = useRef(null);
  const [hasLogo, setHasLogo] = useState(!!getLogo());

  const doLogout = () => { logout(); navigate("/login"); };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/i.test(f.type)) {
      toast.error("Please choose an image file (PNG/JPG/SVG/WEBP)");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo must be smaller than 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(reader.result);
      setHasLogo(true);
      window.dispatchEvent(new Event("ae-logo-changed"));
      toast.success("Logo updated");
    };
    reader.onerror = () => toast.error("Could not read the file");
    reader.readAsDataURL(f);
    e.target.value = ""; // allow re-selecting same file later
  };

  const removeLogo = () => {
    clearLogo();
    setHasLogo(false);
    window.dispatchEvent(new Event("ae-logo-changed"));
    toast.success("Logo removed");
  };

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
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={onPickFile}
          data-testid="logo-file-input"
        />
        {isSuperAdmin(currentUserProfile()?.email) && (
          <>
            <button onClick={() => fileRef.current?.click()} data-testid="btn-change-logo" title="Upload company logo (Super Admin only)">
              <ImageUp size={11} /> {hasLogo ? "Change Logo" : "Upload Logo"}
            </button>
            {hasLogo && (
              <button onClick={removeLogo} data-testid="btn-remove-logo" title="Remove logo (Super Admin only)">
                <ImageOff size={11} /> Remove
              </button>
            )}
          </>
        )}
        <span><User size={12} style={{ verticalAlign: "-2px" }} /> <b>{user}</b></span>
        <button
          onClick={doLogout}
          data-testid="btn-logout"
          style={{
            border: "1px solid #fca5a5",
            background: "#fee2e2",
            color: "#991b1b",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            padding: "6px 14px",
            borderRadius: 5,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: 0.3,
          }}
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
};

export default TopNav;
