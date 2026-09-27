import React, { useEffect, useRef, useState } from "react";
import {
  FilePlus2, Save, Pencil, Send, CheckCircle2, Download, Printer, ChevronDown,
} from "lucide-react";

/**
 * 7-button action bar shown as fixed footer on every page.
 * Props: handlers keyed by name. Provide onExportJSON + onExportExcel for split menu.
 */
export const ActionBar = ({
  onNew, onSave, onEdit, onSubmit, onApprove,
  onExportJSON, onExportExcel, onPrint,
  disabled = {},
}) => {
  const [openExport, setOpenExport] = useState(false);
  const ddRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setOpenExport(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="doc-foot" data-testid="action-bar">
      <div className="bar">
        <button className="btn" data-testid="btn-new" disabled={disabled.new} onClick={onNew}>
          <FilePlus2 size={14} /> New
        </button>
        <button className="btn solid" data-testid="btn-save" disabled={disabled.save} onClick={onSave}>
          <Save size={14} /> Save
        </button>
        <button className="btn ghost" data-testid="btn-edit" disabled={disabled.edit} onClick={onEdit}>
          <Pencil size={14} /> Edit
        </button>
        <button className="btn warn" data-testid="btn-submit" disabled={disabled.submit} onClick={onSubmit}>
          <Send size={14} /> Submit
        </button>
        <button className="btn ok" data-testid="btn-approve" disabled={disabled.approve} onClick={onApprove}>
          <CheckCircle2 size={14} /> Final Approval
        </button>

        <div className="dd-wrap" ref={ddRef}>
          <button
            className="btn"
            data-testid="btn-export"
            disabled={disabled.export}
            onClick={() => setOpenExport((v) => !v)}
          >
            <Download size={14} /> Export <ChevronDown size={12} />
          </button>
          {openExport && (
            <div className="dd-menu">
              <button data-testid="btn-export-json" onClick={() => { setOpenExport(false); onExportJSON?.(); }}>
                Export as JSON
              </button>
              <button data-testid="btn-export-excel" onClick={() => { setOpenExport(false); onExportExcel?.(); }}>
                Export as Excel
              </button>
            </div>
          )}
        </div>

        <button className="btn ghost" data-testid="btn-print" disabled={disabled.print} onClick={onPrint}>
          <Printer size={14} /> Print
        </button>
      </div>
    </div>
  );
};

export default ActionBar;
