import React from "react";
import * as XLSX from "xlsx";
import { FilePlus2, Save, Pencil, Send, CheckCircle2, Trash2, FileSpreadsheet, Printer } from "lucide-react";
import { canCreate, canDelete, canApprove, getCompany } from "../../lib/store";

const exportExcel = ({ title, cols, rows }) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols, ...rows]), "Data");
  XLSX.writeFile(wb, `${title.replace(/[^\w]+/g, "_")}.xlsx`);
};
const printList = ({ title, cols, rows }) => {
  const w = window.open("", "_blank");
  if (!w) return;
  const co = getCompany();
  w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;font-size:11px;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #444;padding:4px;text-align:left}th{background:#dbeafe}h2,h3{text-align:center;margin:3px}</style></head><body><h2>${co.name || ""}</h2><h3>${title}</h3><table><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("")}</table><p>Total records: ${rows.length}</p><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
};

const B = ({ icon: Icon, label, bg, on, off, testid }) => (
  <button data-testid={testid} onClick={on} disabled={off || !on} className="crm-btn"
    style={{ padding: "7px 12px", height: 32, background: off || !on ? "#94a3b8" : bg, color: "#fff", border: "none", borderRadius: 6, cursor: off || !on ? "not-allowed" : "pointer", opacity: off || !on ? 0.55 : 1, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
    <Icon size={13} /> {label}
  </button>
);

// Standard department action bar: New · Save · Edit · Submit · Final Approval · Delete · Excel · Print
export const CrmActionBar = ({ name, status, onNew, onSave, onEdit, onSubmit, onApprove, onDelete, list, labels = {}, disabled = {} }) => (
  <div data-testid={`crm-actionbar-${name}`} style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap", background: "#0b1f4d", padding: "9px 14px", borderTop: "2px solid #1d4ed8", boxShadow: "0 -6px 18px rgba(11,31,77,.25)" }}>
    <B testid={`${name}-btn-new`} icon={FilePlus2} label={labels.new || "New"} bg="#0369a1" on={onNew} off={disabled.new || !canCreate()} />
    <B testid={`${name}-btn-save`} icon={Save} label={labels.save || "Save"} bg="#16a34a" on={onSave} off={disabled.save || !canCreate()} />
    <B testid={`${name}-btn-edit`} icon={Pencil} label={labels.edit || "Edit"} bg="#0891b2" on={onEdit} off={disabled.edit} />
    <B testid={`${name}-btn-submit`} icon={Send} label={labels.submit || "Submit"} bg="#7c3aed" on={onSubmit} off={disabled.submit || !canCreate()} />
    {canApprove() && <B testid={`${name}-btn-approve`} icon={CheckCircle2} label={labels.approve || "Final Approval"} bg="#dc2626" on={onApprove} off={disabled.approve} />}
    <B testid={`${name}-btn-delete`} icon={Trash2} label="Delete" bg="#9f1239" on={onDelete} off={disabled.delete || !canDelete()} />
    <B testid={`${name}-btn-excel`} icon={FileSpreadsheet} label="Excel" bg="#15803d" on={list ? () => exportExcel(list) : null} />
    <B testid={`${name}-btn-print`} icon={Printer} label="Print" bg="#475569" on={list ? () => printList(list) : null} />
    {status && <span data-testid={`${name}-bar-status`} style={{ color: "#bfdbfe", fontSize: 11.5, fontWeight: 700, marginLeft: 10 }}>{status}</span>}
  </div>
);

export const FormLock = ({ editing, children }) => (
  <fieldset disabled={!editing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: editing ? 1 : 0.85 }}>{children}</fieldset>
);
