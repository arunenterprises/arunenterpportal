import * as XLSX from "xlsx";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { FileText, ClipboardList, Receipt, Wallet, ArrowRight, Info, Plus, Trash2, Save, Send, FilePlus2, Paperclip, Printer } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import { printWorkOrder } from "../lib/woPrint";
import {
  currentRole, canCreate, canApprove,
  getBOQs, createBOQDraft, upsertBOQ, advanceBOQStep, computeBOQTotal, BOQ_STEP_LABEL, deleteBOQ,
  getWOs, createWODraft, upsertWO, advanceWOStep, computeWOTotal, WO_STEP_LABEL, deleteWO,
  UNITS_DEFAULT, fmtDMY, getVendors,
} from "../lib/store";

const TABS = [
  { id: "boq", title: "BOQ", subtitle: "Bid of Quantity", icon: ClipboardList, color: "#0ea5e9" },
  { id: "wo", title: "Work Order", subtitle: "WO Creation", icon: FileText, color: "#16a34a" },
  { id: "billing", title: "Billing", subtitle: "Vendor Bill Submission", icon: Receipt, color: "#f59e0b", route: "/bill" },
  { id: "expense", title: "Expense", subtitle: "Petty Cash / Reimbursement", icon: Wallet, color: "#7c3aed", route: "/expense" },
];

// Shared datalist for units. Users can type any custom unit that isn't listed.
const UnitDataList = () => (
  <datalist id="ae-units">
    {UNITS_DEFAULT.map((u) => <option key={u} value={u} />)}
  </datalist>
);

const BOQEditor = ({ writeAllowed, approveAllowed }) => {
  const [boq, setBoq] = useState(null);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);
  const [list, setList] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = () => { setList(getBOQs()); setVendors(getVendors().filter((v) => v.step === 3)); };
  useEffect(() => { refresh(); }, []);

  const startNew = () => {
    const draft = createBOQDraft();
    setBoq(draft); setSaved(false); setLocked(false);
  };

  useEffect(() => { if (!boq) startNew(); /* eslint-disable-next-line */ }, []);

  const set = (k, v) => setBoq((p) => ({ ...p, [k]: v }));
  const setItem = (idx, k, v) => setBoq((p) => {
    const items = [...(p.items || [])];
    items[idx] = { ...items[idx], [k]: v };
    if (k === "qty" || k === "rate") {
      items[idx].amount = +(Number(items[idx].qty || 0) * Number(items[idx].rate || 0)).toFixed(2);
    }
    return { ...p, items, total: items.reduce((s, it) => s + (Number(it.amount) || 0), 0) };
  });
  const addRow = () => setBoq((p) => ({
    ...p,
    items: [...(p.items || []), { id: `it_${Date.now()}`, description: "", qty: 0, unit: "Nos", rate: 0, amount: 0 }],
  }));
  const delRow = (idx) => setBoq((p) => {
    const items = (p.items || []).filter((_, i) => i !== idx);
    return { ...p, items, total: items.reduce((s, it) => s + (Number(it.amount) || 0), 0) };
  });

  const onAttach = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^(application\/pdf|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|image\/)/i.test(f.type)) {
      toast.error("Choose PDF / Excel / Image only"); return;
    }
    if (f.size > 500 * 1024) { toast.error("File must be ≤ 500 KB"); return; }
    const r = new FileReader();
    r.onload = () => set("attachmentData", r.result) || set("attachmentName", f.name);
    r.onload = () => { setBoq((p) => ({ ...p, attachmentData: r.result, attachmentName: f.name })); };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const handleSave = () => {
    if (!boq.projectSite.trim()) { toast.error("Project / Site required"); return; }
    if (!boq.items?.length || boq.items.every((x) => !x.description.trim())) { toast.error("Add at least one line item"); return; }
    const saved = upsertBOQ({ ...boq });
    setBoq(saved); setSaved(true); refresh();
    toast.success(`BOQ ${saved.boqNo} saved`);
  };
  const handleSubmit = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    if (!saved) handleSave();
    // Re-Submit after reopen — BOQ was pushed back below step 3 with revision > 0
    if (Number(boq.step) < 3 && (boq.revision || 0) > 0) {
      const next = upsertBOQ({ ...boq, submittedDate: new Date().toISOString().slice(0, 10) });
      setBoq(next); setLocked(true); refresh();
      toast.success(`BOQ ${next.boqNo || next.tempRefId} re-submitted (Rev ${boq.revision})`);
      return;
    }
    if (Number(boq.step) >= 3) { toast.info("Already submitted"); return; }
    const next = advanceBOQStep({ ...boq, step: Math.max(boq.step, 2) });
    setBoq(next); setLocked(true); refresh();
    toast.success(`BOQ ${next.boqNo || next.tempRefId} submitted to Accounts (${BOQ_STEP_LABEL[next.step]})`);
  };
  const handleApprove = () => {
    if (!approveAllowed) { toast.error("Only Admin / SuperAdmin can approve"); return; }
    const next = advanceBOQStep({ ...boq, step: 3 });
    setBoq(next); refresh();
    toast.success(`BOQ ${next.boqNo} approved by ${next.approvedByName || "Admin"}`);
  };
  const handlePrint = () => window.print();
  const loadBOQ = (b) => { setBoq(b); setSaved(true); setLocked(b.step >= 3); setSearchOpen(false); };

  const filteredSearchList = () => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) =>
      (b.boqNo || "").toLowerCase().includes(q) ||
      (b.projectSite || "").toLowerCase().includes(q) ||
      (b.clientName || "").toLowerCase().includes(q) ||
      (b.refNo || "").toLowerCase().includes(q)
    );
  };

  if (!boq) return null;

  return (
    <div style={{ marginTop: 12 }} data-testid="boq-editor">
      {/* Header row */}
      <div className="section">
        <div className="sec-head">A. BOQ Details</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px 10px" }}>
          {/* Row 1 — Identifiers */}
          <div className="field-b">
            <label>BOQ No. {Number(boq.step) >= 4 && <span style={{ color: "#16a34a", fontSize: 10, marginLeft: 4 }}>✓ auto-issued</span>}</label>
            <input
              data-testid="boq-no"
              value={boq.boqNo || boq.tempRefId || ""}
              readOnly
              placeholder="Will auto-generate on approval"
              style={
                Number(boq.step) >= 4 && boq.boqNo
                  ? { background: "#dcfce7", fontWeight: 800, color: "#166534", border: "1.5px solid #16a34a" }
                  : { background: "#fef9c3", fontWeight: 700, color: "#78716c", fontStyle: boq.boqNo ? "normal" : "italic" }
              }
            />
          </div>
          <div className="field-b">
            <label>Date</label>
            <input data-testid="boq-date" type="date" value={boq.date} onChange={(e) => set("date", e.target.value)} disabled={locked} />
          </div>
          <div className="field-b">
            <label>Reference No.</label>
            <input data-testid="boq-ref" value={boq.refNo} onChange={(e) => set("refNo", e.target.value)} disabled={locked} placeholder="Optional" />
          </div>
          <div className="field-b">
            <label>Status</label>
            <input data-testid="boq-status" value={BOQ_STEP_LABEL[boq.step] || "-"} readOnly style={{ background: "#f0fdf4", fontWeight: 700, color: "#166534" }} />
          </div>

          {/* Row 2 — Project + Vendor */}
          <div className="field-b">
            <label>Project / Site <span className="req">*</span></label>
            <input data-testid="boq-project" value={boq.projectSite} onChange={(e) => set("projectSite", e.target.value)} disabled={locked} placeholder="e.g. Kalindipuram Site A" />
          </div>
          <div className="field-b">
            <label>Client Name</label>
            <input data-testid="boq-client" value={boq.clientName} onChange={(e) => set("clientName", e.target.value)} disabled={locked} placeholder="e.g. XYZ Constructions" />
          </div>
          <div className="field-b" style={{ minWidth: 0 }}>
            <label>Vendor Code <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></label>
            <select
              data-testid="boq-vendor-select"
              value={boq.vendorCode || ""}
              onChange={(e) => {
                const code = e.target.value;
                if (!code) { setBoq((p) => ({ ...p, vendorCode: "", vendorName: "" })); return; }
                const v = vendors.find((x) => x.vendorCode === code);
                if (v) setBoq((p) => ({ ...p, vendorCode: v.vendorCode, vendorName: v.firmName || "" }));
              }}
              disabled={locked}
              style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
            >
              <option value="">— None —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.vendorCode}>
                  {`${v.vendorCode} · ${v.firmName}`}
                </option>
              ))}
            </select>
          </div>
          <div className="field-b">
            <label>Vendor Name <span style={{ color: "#64748b", fontWeight: 400 }}>(auto)</span></label>
            <input data-testid="boq-vendor-name" value={boq.vendorName || ""} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} placeholder="—" />
          </div>

          {/* Row 3 — Preparation info */}
          <div className="field-b">
            <label>Prepared By</label>
            <input data-testid="boq-prepared" value={boq.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} disabled={locked} placeholder="Employee name" />
          </div>
          <div className="field-b">
            <label>Submitted Date</label>
            <input data-testid="boq-submitted" value={boq.submittedDate ? fmtDMY(boq.submittedDate) : "—"} readOnly style={{ background: "#f8fafc" }} />
          </div>
          <div className="field-b" />
          <div className="field-b" />
        </div>
      </div>

      {/* Line items */}
      <div className="section">
        <div className="sec-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>B. Line Items</span>
          {!locked && (
            <button data-testid="boq-add-row" onClick={addRow} style={{ padding: "4px 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add Row
            </button>
          )}
        </div>
        <div className="sec-body">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 40 }}>#</th>
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1" }}>Description</th>
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 80 }}>Qty</th>
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 80 }}>Unit</th>
                <th style={{ padding: 6, textAlign: "right", border: "1px solid #cbd5e1", width: 110 }}>Rate (₹)</th>
                <th style={{ padding: 6, textAlign: "right", border: "1px solid #cbd5e1", width: 130 }}>Amount (₹)</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {(boq.items || []).map((it, idx) => (
                <tr key={it.id} data-testid={`boq-row-${idx}`}>
                  <td style={{ padding: 4, textAlign: "center", border: "1px solid #cbd5e1" }}>{idx + 1}</td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}>
                    <input data-testid={`boq-desc-${idx}`} value={it.description} onChange={(e) => setItem(idx, "description", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }} />
                  </td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}>
                    <input data-testid={`boq-qty-${idx}`} type="number" step="any" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12, textAlign: "right" }} />
                  </td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}>
                    <input
                      data-testid={`boq-unit-${idx}`}
                      list="ae-units"
                      value={it.unit}
                      onChange={(e) => setItem(idx, "unit", e.target.value)}
                      disabled={locked}
                      placeholder="Type or pick…"
                      style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}>
                    <input data-testid={`boq-rate-${idx}`} type="number" step="any" value={it.rate} onChange={(e) => setItem(idx, "rate", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12, textAlign: "right" }} />
                  </td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "right", fontWeight: 700 }}>
                    {Number(it.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: 4, textAlign: "center", border: "1px solid #cbd5e1" }}>
                    {!locked && (
                      <button data-testid={`boq-del-${idx}`} onClick={() => delRow(idx)} style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer" }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#f8fafc" }}>
                <td colSpan={5} style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 800 }}>TOTAL</td>
                <td style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 800, color: "#0f172a" }} data-testid="boq-total">
                  ₹ {computeBOQTotal(boq).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td style={{ border: "1px solid #cbd5e1" }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Attachment + Approved by */}
      <div className="section">
        <div className="sec-head">C. Attachment & Approval</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "start" }}>
          <div>
            <label>Attachment (PDF / Excel / Image, ≤ 500 KB)</label>
            {!locked && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                <Paperclip size={12} /> Upload
                <input data-testid="boq-attach" type="file" accept="application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*" style={{ display: "none" }} onChange={onAttach} />
              </label>
            )}
            {boq.attachmentName && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }} data-testid="boq-attach-name">
                📎 {boq.attachmentName}
                {" "}
                <a href={boq.attachmentData} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>View</a>
                <button
                  type="button"
                  onClick={downloadAttachment}
                  data-testid="boq-attach-download"
                  style={{ padding: "3px 10px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
                >
                  ⬇ Download
                </button>
              </div>
            )}
          </div>
          <div>
            <label>Approved By (GM / Admin)</label>
            <input
              data-testid="boq-approved-by"
              value={boq.approvedByName || ""}
              readOnly
              placeholder="Auto-filled on Approval"
              style={{ background: "#f8fafc", fontWeight: 700, color: "#166534" }}
            />
          </div>
          <div>
            <label>Remarks</label>
            <textarea data-testid="boq-remarks" value={boq.remarks} onChange={(e) => set("remarks", e.target.value)} disabled={locked} style={{ width: "100%", minHeight: 44, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button data-testid="boq-btn-search" onClick={() => setSearchOpen(true)} style={{ padding: "8px 14px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          🔍 Search BOQ
        </button>
        <button data-testid="boq-btn-new" onClick={startNew} style={{ padding: "8px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FilePlus2 size={13} /> New
        </button>
        <button data-testid="boq-btn-save" onClick={handleSave} disabled={!writeAllowed || locked} style={{ padding: "8px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Save size={13} /> Save
        </button>
        <button data-testid="boq-btn-submit" onClick={handleSubmit} disabled={!writeAllowed || locked || boq.step >= 3} style={{ padding: "8px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked && boq.step < 3 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Send size={13} /> Submit
        </button>
        <button data-testid="boq-btn-approve" onClick={handleApprove} disabled={!approveAllowed || boq.step < 3 || boq.step >= 4} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", opacity: approveAllowed && boq.step >= 3 && boq.step < 4 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          Final Approval
        </button>
        <button data-testid="boq-btn-print" onClick={handlePrint} style={{ padding: "8px 14px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Printer size={13} /> Print
        </button>
      </div>

      {/* BOQ list */}
      {list.length > 0 && (
        <div className="section" style={{ marginTop: 14 }}>
          <div className="sec-head">D. All BOQs ({list.length})</div>
          <div className="sec-body" style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>BOQ No.</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Project</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Client</th>
                  <th style={{ padding: 6, textAlign: "right", border: "1px solid #cbd5e1" }}>Total</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Status</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Approved By</th>
                  <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} data-testid={`boq-list-row-${b.id}`}>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", fontWeight: 700 }}>{b.boqNo || b.tempRefId || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{b.projectSite}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{b.clientName || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "right" }}>₹ {Number(b.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{BOQ_STEP_LABEL[b.step] || "-"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", color: "#166534", fontWeight: 700 }}>{b.approvedByName || "—"}</td>
                    <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button
                        data-testid={`boq-list-edit-${b.id}`}
                        onClick={() => loadBOQ(b)}
                        title="Edit / Open this BOQ"
                        style={{ padding: "3px 8px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}
                      >
                        ✏ Edit
                      </button>
                      <button
                        data-testid={`boq-list-delete-${b.id}`}
                        onClick={() => {
                          if (!writeAllowed) { toast.error("Not permitted"); return; }
                          if (Number(b.step) >= 4) { toast.error("Approved BOQ delete nahi kar sakte"); return; }
                          if (!window.confirm(`Delete BOQ ${b.boqNo || b.tempRefId || b.projectSite}?`)) return;
                          deleteBOQ(b.id);
                          toast.success("BOQ deleted");
                          setList(getBOQs());
                          if (boq && boq.id === b.id) startNew();
                        }}
                        title={Number(b.step) >= 4 ? "Approved BOQ cannot be deleted" : "Delete this BOQ"}
                        disabled={!writeAllowed || Number(b.step) >= 4}
                        style={{
                          padding: "3px 8px",
                          background: (!writeAllowed || Number(b.step) >= 4) ? "#f1f5f9" : "#fee2e2",
                          color: (!writeAllowed || Number(b.step) >= 4) ? "#94a3b8" : "#991b1b",
                          border: `1px solid ${(!writeAllowed || Number(b.step) >= 4) ? "#cbd5e1" : "#fca5a5"}`,
                          borderRadius: 3,
                          cursor: (!writeAllowed || Number(b.step) >= 4) ? "not-allowed" : "pointer",
                          fontSize: 10, fontWeight: 700,
                        }}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOQ Search Modal */}
      {searchOpen && (
        <div
          data-testid="boq-search-modal"
          onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ background: "#fff", borderRadius: 8, padding: 18, minWidth: 720, maxWidth: 960, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 40px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: .3 }}>🔍 Search Bill of Quantities</div>
              <button onClick={() => setSearchOpen(false)} data-testid="boq-search-close" style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>✕ Close</button>
            </div>
            <input
              data-testid="boq-search-input"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="BOQ number / project / client / reference no."
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 5 }}
            />
            <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>{filteredSearchList().length} of {list.length} match</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginTop: 8 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>BOQ No.</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Project</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Client</th>
                  <th style={{ padding: 6, textAlign: "right", border: "1px solid #cbd5e1" }}>Total</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Status</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Date</th>
                  <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {filteredSearchList().length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#94a3b8", border: "1px solid #cbd5e1" }}>No BOQ found</td></tr>
                ) : filteredSearchList().map((b) => (
                  <tr key={b.id} data-testid={`boq-search-row-${b.id}`}>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", fontWeight: 700 }}>{b.boqNo}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{b.projectSite}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{b.clientName || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "right" }}>₹ {Number(b.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{BOQ_STEP_LABEL[b.step] || "-"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{fmtDMY(b.date) || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "center" }}>
                      <button data-testid={`boq-search-open-${b.id}`} onClick={() => loadBOQ(b)} style={{ padding: "4px 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10.5, fontWeight: 700 }}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Work Order Editor — 4-step flow (Draft → Prepared → Submitted → Approved)
// WO No is issued only on approval (AEWO####{FY}). Expiry date auto-set +1 yr.
// ============================================================================
const WOEditor = ({ writeAllowed, approveAllowed }) => {
  const [wo, setWo] = useState(null);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);
  const [list, setList] = useState([]);
  const [boqs, setBoqs] = useState([]);
  const [vendors, setVendors] = useState([]);

  const refresh = () => { setList(getWOs()); setBoqs(getBOQs()); setVendors(getVendors().filter((v) => v.step === 3)); };
  useEffect(() => { refresh(); }, []);

  const startNew = (fromBoq = null) => {
    const draft = createWODraft(fromBoq);
    setWo(draft); setSaved(false); setLocked(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!wo) startNew(); }, []);

  const set = (k, v) => setWo((p) => ({ ...p, [k]: v }));
  const setItem = (idx, k, v) => setWo((p) => {
    const items = [...(p.items || [])];
    items[idx] = { ...items[idx], [k]: v };
    if (k === "qty" || k === "rate") {
      items[idx].amount = +(Number(items[idx].qty || 0) * Number(items[idx].rate || 0)).toFixed(2);
    }
    return { ...p, items, total: items.reduce((s, it) => s + (Number(it.amount) || 0), 0) };
  });
  const addRow = () => setWo((p) => ({
    ...p,
    items: [...(p.items || []), { id: `it_${Date.now()}`, description: "", qty: 0, unit: "Nos", rate: 0, amount: 0 }],
  }));
  const delRow = (idx) => setWo((p) => {
    const items = (p.items || []).filter((_, i) => i !== idx);
    return { ...p, items, total: items.reduce((s, it) => s + (Number(it.amount) || 0), 0) };
  });

  const pickBoq = (boqId) => {
    if (!boqId) { set("boqRefId", ""); set("boqRefNo", ""); return; }
    const b = boqs.find((x) => x.id === boqId);
    if (!b) return;
    setWo((p) => ({
      ...p,
      boqRefId: b.id,
      boqRefNo: b.boqNo,
      projectSite: p.projectSite || b.projectSite,
      clientName: p.clientName || b.clientName,
      items: (b.items && b.items.length > 0)
        ? b.items.map((it) => ({ id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, description: it.description, qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount }))
        : p.items,
      total: (b.items && b.items.length > 0) ? b.items.reduce((s, it) => s + Number(it.amount || 0), 0) : p.total,
    }));
    toast.success(`Auto-filled from BOQ ${b.boqNo}`);
  };

  const pickVendor = (vcode) => {
    if (!vcode) { set("vendorCode", ""); set("vendorName", ""); return; }
    const v = vendors.find((x) => x.vendorCode === vcode);
    if (!v) return;
    setWo((p) => ({
      ...p,
      vendorCode: v.vendorCode,
      vendorName: v.firmName || v.vendorName || "",
    }));
    toast.success(`Vendor ${v.vendorCode} selected`);
  };

  const onAttach = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500 * 1024) { toast.error("File must be ≤ 500 KB"); return; }
    const r = new FileReader();
    r.onload = () => { setWo((p) => ({ ...p, attachmentData: r.result, attachmentName: f.name })); };
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const downloadAttachment = () => {
    if (!wo.attachmentData) { toast.error("No attachment"); return; }
    const a = document.createElement("a");
    a.href = wo.attachmentData; a.download = wo.attachmentName || "wo-attachment";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSave = () => {
    if (!wo.boqRefId) { toast.error("Select BOQ Reference"); return; }
    if (!wo.vendorCode) { toast.error("Select Vendor Code"); return; }
    if (!wo.items?.length || wo.items.every((x) => !x.description.trim())) { toast.error("Add at least one line item"); return; }
    const s = upsertWO({ ...wo });
    setWo(s); setSaved(true); refresh();
    toast.success("Work Order draft saved");
  };
  const handleSubmit = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    if (!saved) handleSave();
    const next = advanceWOStep({ ...wo, step: Math.max(wo.step, 2) });
    setWo(next); setLocked(true); refresh();
    toast.success(`Work Order submitted (${WO_STEP_LABEL[next.step]})`);
  };
  const handleApprove = () => {
    if (!approveAllowed) { toast.error("Only Admin / SuperAdmin can approve"); return; }
    const stepUpTo3 = advanceWOStep({ ...wo, step: Math.max(wo.step, 2) });
    const done = advanceWOStep(stepUpTo3);
    setWo(done); refresh();
    toast.success(`Work Order ${done.woNo} issued & approved by ${done.approvedByName}`);
  };
  const handlePrint = () => window.print();
  const downloadWOExcel = (target = wo) => {
    if (!target || (!target.woNo && !target.id)) { toast.error("Save WO first"); return; }
    const wb = XLSX.utils.book_new();
    const meta = [
      ["Work Order No", target.woNo || "— pending approval —"],
      ["WO Date", fmtDMY(target.woDate)],
      ["Expiry Date", fmtDMY(target.expiryDate)],
      ["BOQ Reference", target.boqRefNo || ""],
      ["Project / Site", target.projectSite || ""],
      ["Client", target.clientName || ""],
      ["Vendor Code", target.vendorCode || ""],
      ["Vendor Name", target.vendorName || ""],
      ["GST Slab %", target.gstSlab],
      ["Retention %", target.retentionPct],
      ["Total (₹)", Number(target.total || 0)],
      ["Status", WO_STEP_LABEL[target.step] || ""],
      ["Prepared By", target.preparedBy || ""],
      ["Submitted Date", fmtDMY(target.submittedDate)],
      ["Approved By", target.approvedByName || ""],
      ["Approval Date", fmtDMY(target.approvalDate)],
      [],
      ["Scope of Work"],
      [target.scopeOfWork || ""],
      [],
      ["Payment Terms"], [target.paymentTerms || ""],
      ["Delivery Terms"], [target.deliveryTerms || ""],
      ["Penalty Clause"], [target.penaltyClause || ""],
      ["Warranty Clause"], [target.warrantyClause || ""],
      ["General Terms"], [target.termsAndConditions || ""],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Work Order");
    const items = (target.items || []).map((it, i) => ({
      "#": i + 1,
      Description: it.description,
      Qty: it.qty,
      Unit: it.unit,
      "Rate (₹)": Number(it.rate || 0),
      "Amount (₹)": Number(it.amount || 0),
    }));
    if (items.length) {
      items.push({ "#": "", Description: "TOTAL", Qty: "", Unit: "", "Rate (₹)": "", "Amount (₹)": Number(target.total || 0) });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), "Line Items");
    }
    const fname = `${target.woNo || `WO-${target.id}`}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`Downloaded ${fname}`);
  };
  const loadWO = (w) => { setWo(w); setSaved(true); setLocked(w.step >= 3); };

  if (!wo) return null;

  return (
    <div style={{ marginTop: 12 }} data-testid="wo-editor">
      {/* A. WO Details */}
      <div className="section">
        <div className="sec-head">A. Work Order Details</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 14px" }}>
          <div><label>WO No. (auto on approval)</label><input data-testid="wo-no" value={wo.woNo || "— will be issued on approval —"} readOnly style={{ background: "#eef2ff", fontWeight: 700, color: wo.woNo ? "#166534" : "#64748b" }} /></div>
          <div><label>WO Date</label><input data-testid="wo-date" type="date" value={wo.woDate} onChange={(e) => set("woDate", e.target.value)} disabled={locked} /></div>
          <div><label>Expiry Date {wo.woNo ? "(locked)" : "*"}</label><input data-testid="wo-expiry" type="date" value={wo.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} disabled={locked || wo.step >= 4} min={wo.woDate || undefined} /></div>
          <div><label>Status</label><input data-testid="wo-status" value={WO_STEP_LABEL[wo.step] || "-"} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} /></div>

          <div style={{ gridColumn: "span 2" }}>
            <label>BOQ Reference * (auto-fill from)</label>
            <select data-testid="wo-boqref" value={wo.boqRefId} onChange={(e) => pickBoq(e.target.value)} disabled={locked}>
              <option value="">— Select BOQ —</option>
              {boqs.map((b) => (
                <option key={b.id} value={b.id}>{`${b.boqNo} · ${b.projectSite}`}</option>
              ))}
            </select>
          </div>
          <div><label>BOQ Ref No. (auto)</label><input data-testid="wo-boqrefno" value={wo.boqRefNo || "—"} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} /></div>
          <div><label>Project / Site</label><input data-testid="wo-project" value={wo.projectSite} onChange={(e) => set("projectSite", e.target.value)} disabled={locked} /></div>

          <div style={{ gridColumn: "span 2" }}><label>Client Name</label><input data-testid="wo-client" value={wo.clientName} onChange={(e) => set("clientName", e.target.value)} disabled={locked} /></div>
          <div><label>GST Slab (%)</label><input data-testid="wo-gst" type="number" value={wo.gstSlab} onChange={(e) => set("gstSlab", Number(e.target.value))} disabled={locked} /></div>
          <div><label>Retention (%)</label><input data-testid="wo-ret" type="number" value={wo.retentionPct} onChange={(e) => set("retentionPct", Number(e.target.value))} disabled={locked} /></div>

          <div style={{ gridColumn: "span 3" }}>
            <label>Vendor Code * (approved only)</label>
            <select data-testid="wo-vendor-select" value={wo.vendorCode} onChange={(e) => pickVendor(e.target.value)} disabled={locked}>
              <option value="">— Select Vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.vendorCode}>
                  {`${v.vendorCode} · ${v.firmName}${v.gstNo ? ` · GST ${v.gstNo}` : ""}${v.contactPerson ? ` · ${v.contactPerson}` : ""}`}
                </option>
              ))}
            </select>
          </div>
          <div><label>Vendor Name (auto)</label><input data-testid="wo-vendor" value={wo.vendorName} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} /></div>
        </div>
      </div>

      {/* B. Scope + Line items */}
      <div className="section">
        <div className="sec-head">B. Scope of Work</div>
        <div className="sec-body">
          <textarea data-testid="wo-scope" value={wo.scopeOfWork} onChange={(e) => set("scopeOfWork", e.target.value)} disabled={locked} placeholder="Describe scope, deliverables, exclusions…" style={{ width: "100%", minHeight: 60, padding: 8, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
        </div>
      </div>

      <div className="section">
        <div className="sec-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>C. Line Items (auto from BOQ, editable)</span>
          {!locked && (
            <button data-testid="wo-add-row" onClick={addRow} style={{ padding: "4px 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add Row
            </button>
          )}
        </div>
        <div className="sec-body">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 40 }}>#</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", textAlign: "left" }}>Description</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 80 }}>Qty</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 90 }}>Unit</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 110 }}>Rate (₹)</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 130 }}>Amount (₹)</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {(wo.items || []).map((it, idx) => (
                <tr key={it.id} data-testid={`wo-row-${idx}`}>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-desc-${idx}`} value={it.description} onChange={(e) => setItem(idx, "description", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-qty-${idx}`} type="number" step="any" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12, textAlign: "right" }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-unit-${idx}`} list="ae-units" value={it.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} disabled={locked} placeholder="Type or pick…" style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-rate-${idx}`} type="number" step="any" value={it.rate} onChange={(e) => setItem(idx, "rate", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12, textAlign: "right" }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "right", fontWeight: 700 }}>{Number(it.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "center" }}>{!locked && (<button data-testid={`wo-del-${idx}`} onClick={() => delRow(idx)} style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer" }}><Trash2 size={13} /></button>)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f8fafc" }}>
                <td colSpan={5} style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 800 }}>TOTAL WO VALUE</td>
                <td style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 800 }} data-testid="wo-total">₹ {computeWOTotal(wo).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td style={{ border: "1px solid #cbd5e1" }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* D. Terms & Conditions */}
      <div className="section">
        <div className="sec-head">D. Terms &amp; Conditions</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label>Payment Terms</label><textarea data-testid="wo-pay-terms" value={wo.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} disabled={locked} style={{ width: "100%", minHeight: 44, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} /></div>
          <div><label>Delivery Terms</label><textarea data-testid="wo-del-terms" value={wo.deliveryTerms} onChange={(e) => set("deliveryTerms", e.target.value)} disabled={locked} style={{ width: "100%", minHeight: 44, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} /></div>
          <div><label>Penalty Clause</label><textarea data-testid="wo-penalty" value={wo.penaltyClause} onChange={(e) => set("penaltyClause", e.target.value)} disabled={locked} style={{ width: "100%", minHeight: 44, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} /></div>
          <div><label>Warranty Clause</label><textarea data-testid="wo-warranty" value={wo.warrantyClause} onChange={(e) => set("warrantyClause", e.target.value)} disabled={locked} style={{ width: "100%", minHeight: 44, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label>General Terms &amp; Conditions</label><textarea data-testid="wo-terms" value={wo.termsAndConditions} onChange={(e) => set("termsAndConditions", e.target.value)} disabled={locked} style={{ width: "100%", minHeight: 90, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} /></div>
        </div>
      </div>

      {/* E. Attachment + Approval */}
      <div className="section">
        <div className="sec-head">E. Attachment &amp; Approval</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label>WO Attachment (PDF · ≤ 500 KB)</label>
            {!locked && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                <Paperclip size={12} /> Upload
                <input data-testid="wo-attach" type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={onAttach} />
              </label>
            )}
            {wo.attachmentName && (
              <div style={{ marginTop: 6, fontSize: 11, display: "flex", gap: 8, alignItems: "center" }}>
                📎 {wo.attachmentName}
                <a href={wo.attachmentData} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8" }}>View</a>
                <button onClick={downloadAttachment} data-testid="wo-attach-download" style={{ padding: "2px 8px", fontSize: 10, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontWeight: 700 }}>⬇ Download</button>
              </div>
            )}
          </div>
          <div><label>Approved By (GM / Admin)</label><input data-testid="wo-approved-by" value={wo.approvedByName || ""} readOnly placeholder="Auto-filled on Approval" style={{ background: "#f8fafc", fontWeight: 700, color: "#166534" }} /></div>
          <div><label>Approval Date</label><input data-testid="wo-approval-date" value={wo.approvalDate ? fmtDMY(wo.approvalDate) : ""} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} /></div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <button data-testid="wo-btn-new" onClick={() => startNew()} style={{ padding: "8px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><FilePlus2 size={13} /> New</button>
        {locked && wo.step < 4 && writeAllowed && (
          <button data-testid="wo-btn-reopen" onClick={() => { setLocked(false); toast.success("Edit mode enabled"); }} style={{ padding: "8px 14px", background: "#eab308", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>✏ Reopen · Edit</button>
        )}
        <button data-testid="wo-btn-save" onClick={handleSave} disabled={!writeAllowed || locked} style={{ padding: "8px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Save size={13} /> Save</button>
        <button data-testid="wo-btn-submit" onClick={handleSubmit} disabled={!writeAllowed || locked || wo.step >= 3} style={{ padding: "8px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked && wo.step < 3 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Send size={13} /> Submit</button>
        <button data-testid="wo-btn-approve" onClick={handleApprove} disabled={!approveAllowed || wo.step < 3 || wo.step >= 4} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", opacity: approveAllowed && wo.step >= 3 && wo.step < 4 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>Final Approval (issue WO No.)</button>
        <button data-testid="wo-btn-download" onClick={() => downloadWOExcel()} style={{ padding: "8px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>⬇ Download Excel</button>
        <button data-testid="wo-btn-print" onClick={() => printWorkOrder(wo)} style={{ padding: "8px 14px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Printer size={13} /> Print PDF (A4)</button>
      </div>

      {/* All WOs list */}
      {list.length > 0 && (
        <div className="section" style={{ marginTop: 14 }}>
          <div className="sec-head">G. All Work Orders ({list.length})</div>
          <div className="sec-body" style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>WO No.</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>BOQ Ref</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Vendor</th>
                  <th style={{ padding: 6, textAlign: "right", border: "1px solid #cbd5e1" }}>Total</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Expiry</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Status</th>
                  <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Approved By</th>
                  <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 190 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} data-testid={`wo-list-row-${w.id}`}>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", fontWeight: 700, color: w.woNo ? "#166534" : "#94a3b8" }}>{w.woNo || "— draft —"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{w.boqRefNo || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{w.vendorName || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "right" }}>₹ {Number(w.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{fmtDMY(w.expiryDate) || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{WO_STEP_LABEL[w.step] || "-"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", color: "#166534", fontWeight: 700 }}>{w.approvedByName || "—"}</td>
                    <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button data-testid={`wo-list-edit-${w.id}`} onClick={() => loadWO(w)} title="Edit / Open this WO" style={{ padding: "3px 8px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✏ Edit</button>
                      <button data-testid={`wo-list-download-${w.id}`} onClick={() => downloadWOExcel(w)} style={{ padding: "3px 8px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>⬇ Excel</button>
                      <button
                        data-testid={`wo-list-delete-${w.id}`}
                        onClick={() => {
                          if (!writeAllowed) { toast.error("Not permitted"); return; }
                          if (Number(w.step) >= 4) { toast.error("Approved Work Order delete nahi kar sakte"); return; }
                          if (!window.confirm(`Delete Work Order ${w.woNo || w.boqRefNo || w.vendorName || ""}?`)) return;
                          deleteWO(w.id);
                          toast.success("Work Order deleted");
                          setList(getWOs());
                          if (wo && wo.id === w.id) startNew();
                        }}
                        title={Number(w.step) >= 4 ? "Approved WO cannot be deleted" : "Delete this WO"}
                        disabled={!writeAllowed || Number(w.step) >= 4}
                        style={{
                          padding: "3px 8px",
                          background: (!writeAllowed || Number(w.step) >= 4) ? "#f1f5f9" : "#fee2e2",
                          color: (!writeAllowed || Number(w.step) >= 4) ? "#94a3b8" : "#991b1b",
                          border: `1px solid ${(!writeAllowed || Number(w.step) >= 4) ? "#cbd5e1" : "#fca5a5"}`,
                          borderRadius: 3,
                          cursor: (!writeAllowed || Number(w.step) >= 4) ? "not-allowed" : "pointer",
                          fontSize: 10, fontWeight: 700,
                        }}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default function PurchaseManagement() {
  const nav = useNavigate();
  const [active, setActive] = useState("boq");
  const role = currentRole();
  const write = canCreate();
  const approve = canApprove();

  const openTab = (t) => { if (t.route) { nav(t.route); return; } setActive(t.id); };
  const activeTab = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <div className="a4" data-testid="purchase-page">
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }} data-testid="purchase-tabs">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`purchase-tab-${t.id}`}
                  onClick={() => openTab(t)}
                  style={{
                    flex: 1, minWidth: 180,
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 6,
                    border: `1px solid ${isActive ? t.color : "#cbd5e1"}`,
                    background: isActive ? t.color : "#fff",
                    color: isActive ? "#fff" : "#0f172a",
                    cursor: "pointer",
                    fontWeight: 700, fontSize: 12.5,
                    letterSpacing: .3,
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                  <div style={{ textAlign: "left" }}>
                    <div>{t.title}</div>
                    <div style={{ fontSize: 10, opacity: .8, fontWeight: 500 }}>{t.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }} data-testid="purchase-role-note">
            <Info size={13} />
            <span>Signed in as <b>{role}</b> · Purchase Management me sirf <b>Create / Prepare / Submit</b> permission hai — Final Approval Accounts / GM karega.</span>
          </div>

          {activeTab.id === "boq" && <BOQEditor writeAllowed={write} approveAllowed={approve} />}
          {activeTab.id === "wo" && <WOEditor writeAllowed={write} approveAllowed={approve} />}
          <UnitDataList />
        </div>
      </div>
    </>
  );
}
