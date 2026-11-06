import React, { useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Home as HomeIcon, LogOut, ArrowLeft, ImageUp, ImageOff, Users, Store, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { logout, currentUser, currentUserProfile, isSuperAdmin, setLogo, clearLogo, getLogo, myPhotoUrl } from "../lib/store";
import AuthSplash from "./AuthSplash";
import { NotificationBell } from "./NotificationBell";

const HomeNavBar = ({ light = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const me = currentUserProfile();
  const superAdmin = isSuperAdmin(me?.user);
  const [goodbye, setGoodbye] = useState(null);
  const doLogout = () => {
    const nm = superAdmin ? "Ashish Srivastava" : (me?.name || me?.user?.split("@")[0] || "User");
    setGoodbye({ name: nm });
  };

  const fileRef = useRef(null);
  const [hasLogo, setHasLogo] = useState(!!getLogo());

  const pickLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/i.test(f.type)) { toast.error("Choose PNG/JPG/SVG/WEBP"); return; }
    if (f.size > 2 * 1024 * 1024) { toast.error("Logo must be < 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(reader.result); setHasLogo(true);
      window.dispatchEvent(new Event("ae-logo-changed"));
      toast.success("Logo updated");
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };
  const removeLogo = () => {
    clearLogo(); setHasLogo(false);
    window.dispatchEvent(new Event("ae-logo-changed"));
    toast.success("Logo removed");
  };

  const link = ({ isActive }) => "hn-link" + (isActive ? " active" : "");
  const onHome = location.pathname === "/home";

  return (
    <div className={"home-navbar" + (light ? " hn-light" : "")} data-testid="home-navbar">
      {goodbye && (
        <AuthSplash
          mode="goodbye"
          userName={goodbye.name}
          onDone={() => { logout(); navigate("/login"); }}
        />
      )}
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
        <NavLink to="/my-tasks" className={link} data-testid="hn-my-tasks">
          <ListTodo size={15} /> My Tasks
        </NavLink>
        {superAdmin && (
          <>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
              style={{ display: "none" }} onChange={pickLogo} data-testid="logo-file-input" />
            <button
              type="button"
              className="hn-link"
              onClick={() => fileRef.current?.click()}
              data-testid="btn-change-logo"
              title="Upload company logo (Super Admin only)"
              style={{ background: "transparent", cursor: "pointer" }}
            >
              <ImageUp size={15} /> Logo
            </button>
            {hasLogo && (
              <button
                type="button"
                className="hn-link"
                onClick={removeLogo}
                data-testid="btn-remove-logo"
                title="Remove logo (Super Admin only)"
                style={{ background: "transparent", cursor: "pointer", color: "#dc2626" }}
              >
                <ImageOff size={15} />
              </button>
            )}
          </>
        )}
      </nav>

      <div className="hn-right">
        <NotificationBell />
        <span className="hn-user" title={me?.user} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {(() => { const ph = myPhotoUrl(); return ph ? <img data-testid="hn-user-photo" src={ph} alt="" style={{ width: 24, height: 24, borderRadius: 999, objectFit: "cover" }} /> : null; })()}
          <b>{superAdmin ? "Ashish Srivastava" : (me?.name || currentUser())}</b>
          <span className={"hn-role " + (superAdmin ? "sa" : "usr")}>
            {superAdmin ? "SUPERADMIN" : (me?.role || "User").toUpperCase()}
          </span>
        </span>
        {["/", "/home"].includes(location.pathname) && <>
          <a href="https://employee-portal-366.emergent.host/" target="_blank" rel="noopener noreferrer" data-testid="hn-employee-portal" className="hn-portal"><Users size={13} /> Employee Portal</a>
          <a href="https://vendor-portal-458.emergent.host/" target="_blank" rel="noopener noreferrer" data-testid="hn-vendor-portal" className="hn-portal"><Store size={13} /> Vendor Portal</a>
        </>}
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
