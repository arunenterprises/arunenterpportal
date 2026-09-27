import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, FilePlus2, Save, Pencil, Printer, Download, ArrowRight, ChevronDown,
  ImageUp, ImageOff, LogOut, User, Send, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  logout, currentUser, setLogo, clearLogo, getLogo,
} from "../lib/store";

/**
 * Colored top action bar with all 7 workflow buttons:
 * Search + New + Save + Edit + Submit + Final Approval + Export (JSON/Excel) + Print
 * Plus Logo Upload button and user chip (logout).
 */
export const TopActionBar = ({
  searchPlaceholder = "Search Vendor Code / Temp ID / Name",
  searchLabel = "Search",
  onSearch,
  nextLabel,
  nextTo,
  onNew, onSave, onEdit, onSubmit, onApprove, onPrint,
  onExportJSON, onExportExcel,
  labels = {},
  variant = "light",
  disabled = {},
}) => {
  const [q, setQ] = useState("");
  const [openExport, setOpenExport] = useState(false);
  const [hasLogo, setHasLogo] = useState(!!getLogo());
  const ddRef = useRef(null);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const user = currentUser();

  useEffect(() => {
    const h = (e) => { if (ddRef.current && !ddRef.current.contains(e.target)) setOpenExport(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const submitSearch = (e) => { e?.preventDefault?.(); onSearch?.(q.trim()); };

  const pickLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/i.test(f.type)) {
      toast.error("Please choose an image file (PNG/JPG/SVG/WEBP)"); return;
    }
    if (f.size > 2 * 1024 * 1024) { toast.error("Logo must be smaller than 2 MB"); return; }
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
  const doLogout = () => { logout(); navigate("/login"); };

  return (
    <div className={`top-action ${variant === "dark" ? "dark" : ""}`} data-testid="top-action-bar">
      <form className="search-wrap" onSubmit={submitSearch}>
        <input
          data-testid="search-input"
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <button className="btn-color btn-search" data-testid="btn-search" onClick={submitSearch}>
        <Search size={14} /><span className="lbl">{searchLabel}</span>
      </button>

      {nextLabel && (
        <button className="btn-color btn-nav" data-testid="btn-page-nav" onClick={() => navigate(nextTo)}>
          <span className="lbl">{nextLabel}</span>
        </button>
      )}

      {/* 7-button workflow row (colored) */}
      <button className="btn-color btn-new" data-testid="btn-new" disabled={disabled.new} onClick={onNew}>
        <FilePlus2 size={14} /><span className="lbl">{labels.new || "New"}</span>
      </button>
      <button className="btn-color btn-save" data-testid="btn-save" disabled={disabled.save} onClick={onSave}>
        <Save size={14} /><span className="lbl">{labels.save || "Save"}</span>
      </button>
      <button className="btn-color btn-edit" data-testid="btn-edit" disabled={disabled.edit} onClick={onEdit}>
        <Pencil size={14} /><span className="lbl">{labels.edit || "Edit"}</span>
      </button>
      <button className="btn-color btn-submit" data-testid="btn-submit" disabled={disabled.submit} onClick={onSubmit}>
        <Send size={14} /><span className="lbl">{labels.submit || "Submit"}</span>
      </button>
      <button className="btn-color btn-approve" data-testid="btn-approve" disabled={disabled.approve} onClick={onApprove}>
        <CheckCircle2 size={14} /><span className="lbl">{labels.approve || "Final Approval"}</span>
      </button>

      <div className="dd-wrap" ref={ddRef}>
        <button
          className="btn-color btn-export"
          data-testid="btn-export"
          disabled={disabled.export}
          onClick={() => setOpenExport((v) => !v)}
        >
          <Download size={14} /><span className="lbl">Export<small>JSON / Excel</small></span>
          <ChevronDown size={12} />
        </button>
        {openExport && (
          <div className="dd-menu">
            <button data-testid="btn-export-json" onClick={() => { setOpenExport(false); onExportJSON?.(); }}>Export as JSON</button>
            <button data-testid="btn-export-excel" onClick={() => { setOpenExport(false); onExportExcel?.(); }}>Export as Excel</button>
          </div>
        )}
      </div>

      <button className="btn-color btn-print" data-testid="btn-print" disabled={disabled.print} onClick={onPrint}>
        <Printer size={14} /><span className="lbl">{labels.print || "Print"}</span>
      </button>

      {/* Logo upload button — visible in header */}
      <input ref={fileRef} type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        style={{ display: "none" }} onChange={pickLogo} data-testid="logo-file-input" />
      <button className="btn-color btn-logo" data-testid="btn-change-logo"
        onClick={() => fileRef.current?.click()} title="Upload company logo">
        <ImageUp size={14} /><span className="lbl">{hasLogo ? "Change Logo" : "Upload Logo"}</span>
      </button>
      {hasLogo && (
        <button className="btn-color btn-logo-remove" data-testid="btn-remove-logo"
          onClick={removeLogo} title="Remove logo">
          <ImageOff size={14} />
        </button>
      )}

      <div className="user-chip" data-testid="user-chip">
        <User size={12} /><b>{user || "admin"}</b>
        <button onClick={doLogout} title="Logout" data-testid="btn-logout">
          <LogOut size={12} />
        </button>
      </div>
    </div>
  );
};

export default TopActionBar;
