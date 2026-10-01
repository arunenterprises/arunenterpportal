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
    </div>
  );
};

export default TopActionBar;
