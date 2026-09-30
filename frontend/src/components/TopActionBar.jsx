import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Search, FilePlus2, Save, Pencil, Printer, Download, ChevronDown,
  ImageUp, ImageOff, LogOut, User, Send, CheckCircle2, ArrowLeft, ArrowRight,
  FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { logout, currentUser, currentUserProfile, setLogo, clearLogo, getLogo, isSuperAdmin, canApprove, canCreate, isReadOnly, currentRole } from "../lib/store";

export const TopActionBar = ({
  searchPlaceholder = "Vendor Code / ID / Name",
  searchLabel = "Query",
  onSearch,
  onQuery,
  prevLabel, prevTo,
  nextLabel, nextTo,
  onNew, onSave, onEdit, onSubmit, onApprove, onPrint,
  onExportJSON, onExportExcel,
  labels = {},
  variant = "light",
  disabled = {},
}) => {
  const [q, setQ] = useState("");
  const [openExport, setOpenExport] = useState(false);
  const [ddPos, setDdPos] = useState({ bottom: 0, right: 0 });
  const [hasLogo, setHasLogo] = useState(!!getLogo());
  const ddRef = useRef(null);
  const exportBtnRef = useRef(null);
  const menuRef = useRef(null);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const user = currentUser();

  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (ddRef.current && ddRef.current.contains(e.target)) return;
      setOpenExport(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggleExport = () => {
    if (!openExport && exportBtnRef.current) {
      const r = exportBtnRef.current.getBoundingClientRect();
      setDdPos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right });
    }
    setOpenExport((v) => !v);
  };

  const submitSearch = (e) => {
    e?.preventDefault?.();
    const term = q.trim();
    if (!term) return;
    // Try direct load first via onSearch; if it returns false (not found), open onQuery modal as fallback
    const loaded = onSearch ? onSearch(term) : null;
    if (loaded === false && onQuery) onQuery(term);
    else if (loaded == null && onQuery) onQuery(term);
  };
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
  const doLogout = () => { logout(); navigate("/login"); };
  const roleAllowsApprove = canApprove();
  const roleAllowsWrite = canCreate();
  const readOnly = isReadOnly();
  const roleTag = currentRole();

  // Merge caller-supplied `disabled` with role-based gates. Role wins if it says NO.
  const gated = {
    new: disabled.new || !roleAllowsWrite,
    save: disabled.save || !roleAllowsWrite,
    edit: disabled.edit || !roleAllowsWrite,
    submit: disabled.submit || !roleAllowsWrite,
    approve: disabled.approve || !roleAllowsApprove,
    export: disabled.export || false, // everyone can export/download
    print: disabled.print || false,
  };

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
        <FileSearch size={14} /><span className="lbl">{searchLabel}</span>
      </button>

      {prevLabel && (
        <button className="btn-color btn-prev" data-testid="btn-prev-page" onClick={() => navigate(prevTo)}>
          <ArrowLeft size={14} /><span className="lbl">{prevLabel}</span>
        </button>
      )}
      {nextLabel && (
        <button className="btn-color btn-nav" data-testid="btn-next-page" onClick={() => navigate(nextTo)}>
          <span className="lbl">{nextLabel}</span><ArrowRight size={14} />
        </button>
      )}

      <button className="btn-color btn-new" data-testid="btn-new" disabled={gated.new} onClick={onNew} title={gated.new && !roleAllowsWrite ? `${roleTag}: create not allowed` : undefined}>
        <FilePlus2 size={14} /><span className="lbl">{labels.new || "New"}</span>
      </button>
      <button className="btn-color btn-save" data-testid="btn-save" disabled={gated.save} onClick={onSave} title={gated.save && !roleAllowsWrite ? `${roleTag}: save not allowed` : undefined}>
        <Save size={14} /><span className="lbl">{labels.save || "Save"}</span>
      </button>
      <button className="btn-color btn-edit" data-testid="btn-edit" disabled={gated.edit} onClick={onEdit} title={gated.edit && !roleAllowsWrite ? `${roleTag}: edit not allowed` : undefined}>
        <Pencil size={14} /><span className="lbl">{labels.edit || "Edit"}</span>
      </button>
      <button className="btn-color btn-submit" data-testid="btn-submit" disabled={gated.submit} onClick={onSubmit} title={gated.submit && !roleAllowsWrite ? `${roleTag}: submit not allowed` : undefined}>
        <Send size={14} /><span className="lbl">{labels.submit || "Submit"}</span>
      </button>
      <button className="btn-color btn-approve" data-testid="btn-approve" disabled={gated.approve} onClick={onApprove} title={gated.approve && !roleAllowsApprove ? `${roleTag}: only Admin/SuperAdmin can approve` : undefined}>
        <CheckCircle2 size={14} /><span className="lbl">{labels.approve || "Final Approval"}</span>
      </button>

      <div className="dd-wrap" ref={ddRef}>
        <button ref={exportBtnRef} className="btn-color btn-export" data-testid="btn-export" disabled={disabled.export} onClick={toggleExport}>
          <Download size={14} /><span className="lbl">Export</span><ChevronDown size={12} />
        </button>
        {openExport && createPortal(
          <div
            ref={menuRef}
            className="dd-menu"
            style={{ position: "fixed", bottom: ddPos.bottom, right: ddPos.right }}
            data-testid="export-menu"
          >
            <button data-testid="btn-export-json" onClick={() => { setOpenExport(false); onExportJSON?.(); }}>Export as JSON</button>
            <button data-testid="btn-export-excel" onClick={() => { setOpenExport(false); onExportExcel?.(); }}>Export as Excel</button>
          </div>,
          document.body
        )}
      </div>

      <button className="btn-color btn-print" data-testid="btn-print" disabled={disabled.print} onClick={onPrint}>
        <Printer size={14} /><span className="lbl">{labels.print || "Print"}</span>
      </button>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        style={{ display: "none" }} onChange={pickLogo} data-testid="logo-file-input" />
      {isSuperAdmin(currentUserProfile()?.user) && (
        <>
          <button className="btn-color btn-logo" data-testid="btn-change-logo" onClick={() => fileRef.current?.click()} title="Upload company logo (Super Admin only)">
            <ImageUp size={14} /><span className="lbl">{hasLogo ? "Logo" : "Logo"}</span>
          </button>
          {hasLogo && (
            <button className="btn-color btn-logo-remove" data-testid="btn-remove-logo" onClick={removeLogo} title="Remove logo (Super Admin only)">
              <ImageOff size={14} />
            </button>
          )}
        </>
      )}

      <div className="user-chip" data-testid="user-chip">
        <User size={14} /><b style={{ fontSize: 13, letterSpacing: 0.3 }}>{user || "admin"}</b>
      </div>
    </div>
  );
};

export default TopActionBar;
