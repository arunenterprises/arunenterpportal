import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { FileText, ClipboardList, Receipt, Wallet, ArrowRight, Info, Plus, Trash2, Save, Send, FilePlus2, Paperclip, Printer } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import {
  currentRole, canCreate, canApprove,
  getBOQs, createBOQDraft, upsertBOQ, advanceBOQStep, computeBOQTotal, BOQ_STEP_LABEL,
} from "../lib/store";

const TABS = [
  { id: "boq", title: "BOQ", subtitle: "Bill of Quantity", icon: ClipboardList, color: "#0ea5e9" },
  { id: "wo", title: "Work Order", subtitle: "WO Creation", icon: FileText, color: "#16a34a", route: "/bill" },
  { id: "billing", title: "Billing", subtitle: "Vendor Bill Submission", icon: Receipt, color: "#f59e0b", route: "/bill" },
  { id: "expense", title: "Expense", subtitle: "Petty Cash / Reimbursement", icon: Wallet, color: "#7c3aed", route: "/expense" },
];

const BOQEditor = ({ writeAllowed, approveAllowed }) => {
  const [boq, setBoq] = useState(null);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);
  const [list, setList] = useState([]);

  const refresh = () => setList(getBOQs());
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
    const next = advanceBOQStep({ ...boq, step: Math.max(boq.step, 2) });
    setBoq(next); setLocked(true); refresh();
    toast.success(`BOQ ${next.boqNo} submitted to Accounts (${BOQ_STEP_LABEL[next.step]})`);
  };
  const handleApprove = () => {
    if (!approveAllowed) { toast.error("Only Admin / SuperAdmin can approve"); return; }
    const next = advanceBOQStep({ ...boq, step: 3 });
    setBoq(next); refresh();
    toast.success(`BOQ ${next.boqNo} approved by ${next.approvedByName || "Admin"}`);
  };
  const handlePrint = () => window.print();
  const loadBOQ = (b) => { setBoq(b); setSaved(true); setLocked(b.step >= 3); };

  if (!boq) return null;

  return (
    <div style={{ marginTop: 12 }} data-testid="boq-editor">
      {/* Header row */}
      <div className="section">
        <div className="sec-head">A. BOQ Details</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <div><label>BOQ No.</label><input data-testid="boq-no" value={boq.boqNo} readOnly style={{ background: "#eef2ff", fontWeight: 700 }} /></div>
          <div><label>Date</label><input data-testid="boq-date" type="date" value={boq.date} onChange={(e) => set("date", e.target.value)} disabled={locked} /></div>
          <div><label>Project / Site *</label><input data-testid="boq-project" value={boq.projectSite} onChange={(e) => set("projectSite", e.target.value)} disabled={locked} placeholder="e.g. Kalindipuram Site A" /></div>
          <div><label>Client Name</label><input data-testid="boq-client" value={boq.clientName} onChange={(e) => set("clientName", e.target.value)} disabled={locked} /></div>
          <div><label>Reference No.</label><input data-testid="boq-ref" value={boq.refNo} onChange={(e) => set("refNo", e.target.value)} disabled={locked} /></div>
          <div><label>Prepared By</label><input data-testid="boq-prepared" value={boq.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} disabled={locked} /></div>
          <div><label>Submitted Date</label><input data-testid="boq-submitted" value={boq.submittedDate || "—"} readOnly style={{ background: "#f8fafc" }} /></div>
          <div><label>Status</label><input data-testid="boq-status" value={BOQ_STEP_LABEL[boq.step] || "-"} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} /></div>
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
                <th style={{ padding: 6, textAlign: "left", border: "1px solid #cbd5e1" }}>Description</th>
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
                    <select data-testid={`boq-unit-${idx}`} value={it.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }}>
                      {["Nos", "Kg", "Mtr", "Sq.Mtr", "Cu.Mtr", "Lump", "Tonne", "Ltr", "Hour", "Day"].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
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
              <div style={{ marginTop: 6, fontSize: 11, color: "#0f172a" }} data-testid="boq-attach-name">
                📎 {boq.attachmentName}
                {" "}
                <a href={boq.attachmentData} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>View</a>
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

      {/* Signature block (print-friendly) */}
      <div className="section boq-signblock" data-testid="boq-signature">
        <div className="sec-head">E. Signatures</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, padding: "20px 14px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #0f172a", paddingTop: 6, marginTop: 40 }}>
              <b style={{ fontSize: 12 }}>Prepared By</b>
              <div style={{ fontSize: 11, marginTop: 2 }}>{boq.preparedBy || "—"}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Purchase Department</div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #0f172a", paddingTop: 6, marginTop: 40 }}>
              <b style={{ fontSize: 12 }}>Checked By</b>
              <div style={{ fontSize: 11, marginTop: 2 }}>{boq.step >= 2 ? "________________" : "—"}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Accounts Department</div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #0f172a", paddingTop: 6, marginTop: 40 }}>
              <b style={{ fontSize: 12 }}>Approved By</b>
              <div style={{ fontSize: 11, marginTop: 2, color: "#166534", fontWeight: 700 }}>{boq.approvedByName || "—"}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{boq.approvalDate ? `Date: ${boq.approvalDate}` : "General Manager / Admin"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
                  <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} data-testid={`boq-list-row-${b.id}`}>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", fontWeight: 700 }}>{b.boqNo}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{b.projectSite}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{b.clientName || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "right" }}>₹ {Number(b.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1" }}>{BOQ_STEP_LABEL[b.step] || "-"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", color: "#166534", fontWeight: 700 }}>{b.approvedByName || "—"}</td>
                    <td style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "center" }}>
                      <button onClick={() => loadBOQ(b)} style={{ padding: "3px 8px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Open</button>
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
          <Header formTitle="PURCHASE MANAGEMENT · CREATE / PREPARE / SUBMIT" />

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
        </div>
      </div>
    </>
  );
}
