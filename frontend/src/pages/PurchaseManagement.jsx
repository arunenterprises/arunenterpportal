import * as XLSX from "xlsx";
import { DateInput } from "../components/DateInput";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BillProcessing from "./BillProcessing";
import VendorRegistration from "./VendorRegistration";
import { Users, Scale, Warehouse } from "lucide-react";
import RfqCs from "../components/procurement/RfqCs";
import OpsModule from "../components/ops/OpsModule";
import { OPS } from "../components/ops/opsConfig";
import { uploadBig, openFile } from "../lib/bigFiles";
import { ContractSelect, contractRows } from "../components/ContractSelect";
const BOQ_TYPES = ["Client Master BOQ", "Sub-contractor Execution BOQ", "Vendor Supply BOQ"];
export const woGst = (w) => (w.items || []).reduce((s, it) => s + (Number(it.amount) || 0) * (Number(it.gstPct ?? w.gstSlab ?? 18) || 0) / 100, 0);
const norm = (s) => String(s || "").trim().toLowerCase();
// Sub-contractor / Vendor BOQ must stay within the approved Client Master BOQ of the same project
const boqBudgetGate = (b) => {
  const type = b.boqType || "Client Master BOQ";
  if (type === "Client Master BOQ") return "";
  if (type === "Sub-contractor Execution BOQ" && (!b.vendorCode || !String(b.projectSite || "").trim())) return "Sub-contractor BOQ ke liye Vendor Code aur Project Code zaroori";
  const master = getBOQs().find((x) => x.id !== b.id && (x.boqType || "Client Master BOQ") === "Client Master BOQ" && Number(x.step) >= 4 && norm(x.projectSite) === norm(b.projectSite));
  if (!master) return `Project '${b.projectSite}' ka Approved Client Master BOQ nahi mila`;
  for (const it of b.items || []) {
    if (!String(it.description || "").trim()) continue;
    const m = (master.items || []).find((x) => norm(x.description) === norm(it.description));
    if (!m) return `'${it.description}' Client Master BOQ mein nahi hai`;
    if (Number(it.qty) > Number(m.qty)) return `'${it.description}' qty ${it.qty} > Client approved ${m.qty}`;
    if (Number(it.rate) > Number(m.rate)) return `'${it.description}' rate ₹${it.rate} > Client approved ₹${m.rate}`;
  }
  return "";
};
import { Toaster, toast } from "sonner";
import { FileText, ClipboardList, Receipt, Wallet, ArrowRight, Info, Plus, Trash2, Save, Send, FilePlus2, Paperclip, Printer, ShoppingCart } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import { printWorkOrder } from "../lib/woPrint";
import HsnInput from "../components/HsnInput";
import HsnFinder from "../components/HsnFinder";
import AiWoButton from "../components/AiWoButton";
import {
  currentRole, canCreate, canApprove, canDelete, canDeleteApproved, currentUserProfile, currentUser,
  getBOQs, createBOQDraft, upsertBOQ, advanceBOQStep, computeBOQTotal, BOQ_STEP_LABEL, deleteBOQ,
  getWOs, saveWOs, createWODraft, upsertWO, advanceWOStep, computeWOTotal, WO_STEP_LABEL, deleteWO,
  UNITS_DEFAULT, fmtDMY, getVendors, amountToWords,
} from "../lib/store";

// Append a WO deletion audit entry so admin overrides are traceable.
const logWODeletion = (w, approved) => {
  try {
    const prof = currentUserProfile() || {};
    const actorName = prof.name || prof.user || currentUser() || "Unknown";
    const actorEmail = prof.user || "";
    const actorRole = currentRole() || "User";
    const entry = {
      at: new Date().toISOString(),
      woId: w.id,
      woNo: w.woNo || "",
      boqRefNo: w.boqRefNo || "",
      vendorName: w.vendorName || "",
      vendorCode: w.vendorCode || "",
      total: Number(w.total) || 0,
      step: Number(w.step) || 0,
      wasApproved: !!approved,
      actorName,
      actorEmail,
      actorRole,
    };
    const KEY = "ae_vm_wo_delete_log";
    const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
    prev.push(entry);
    // Keep latest 500 entries max to avoid runaway growth
    const trimmed = prev.slice(-500);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return { actorName, actorRole };
  } catch {
    return { actorName: currentUser() || "Unknown", actorRole: currentRole() || "User" };
  }
};

// Append a BOQ deletion audit entry so admin overrides are traceable.
const logBOQDeletion = (b, approved) => {
  try {
    const prof = currentUserProfile() || {};
    const actorName = prof.name || prof.user || currentUser() || "Unknown";
    const actorEmail = prof.user || "";
    const actorRole = currentRole() || "User";
    const entry = {
      at: new Date().toISOString(),
      boqId: b.id,
      boqNo: b.boqNo || b.tempRefId || "",
      projectSite: b.projectSite || "",
      clientName: b.clientName || "",
      total: Number(b.total) || 0,
      step: Number(b.step) || 0,
      wasApproved: !!approved,
      actorName,
      actorEmail,
      actorRole,
    };
    const KEY = "ae_vm_boq_delete_log";
    const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
    prev.push(entry);
    const trimmed = prev.slice(-500);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return { actorName, actorRole };
  } catch {
    return { actorName: currentUser() || "Unknown", actorRole: currentRole() || "User" };
  }
};

const TABS = [
  { id: "vendor", title: "Vendor Registration", subtitle: "KYC · Vendor Code", icon: Users, color: "#166534" },
  { id: "rfq", title: "RFQ & Comp. Stmt", subtitle: "L1 vendor · PO", icon: Scale, color: "#166534" },
  { id: "boq", title: "BOQ", subtitle: "Bid of Quantity", icon: ClipboardList, color: "#166534" },
  { id: "wo", title: "Work Order", subtitle: "WO Creation", icon: FileText, color: "#166534" },
  { id: "grn", title: "Store & GRN", subtitle: "Receipt · Stock Register", icon: Warehouse, color: "#166534" },
  { id: "billing", title: "Vendor Bill", subtitle: "3-Way Match · submit", icon: Receipt, color: "#166534" },
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
  const [boqSearch, setBoqSearch] = useState("");

  const refresh = () => { setList(getBOQs()); setVendors(getVendors().filter((v) => v.step === 3)); };
  useEffect(() => { refresh(); }, []);
  // REAL-TIME CROSS-USER SYNC: pull fresh state when App.js dispatches ae-sync-done.
  useEffect(() => {
    const onSync = () => refresh();
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const onAttach = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    const up = await uploadBig(f, 25);
    if (up) setBoq((p) => ({ ...p, attachmentData: "", attachmentName: up.name, attachmentFile: up }));
  };

  const handleSave = () => {
    if (!boq.projectSite.trim()) { toast.error("Project / Site required"); return false; }
    if (!boq.items?.length || boq.items.every((x) => !x.description.trim())) { toast.error("Add at least one line item"); return false; }
    const saved = upsertBOQ({ ...boq });
    setBoq(saved); setSaved(true); refresh();
    toast.success(`BOQ ${saved.boqNo} saved`);
    return true;
  };
  const handleSubmit = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    if (!saved && !handleSave()) return;
    // Re-Submit after reopen — BOQ was pushed back below step 3 with revision > 0
    if (Number(boq.step) < 3 && (boq.revision || 0) > 0) {
      const next = upsertBOQ({ ...boq, submittedDate: new Date().toISOString().slice(0, 10) });
      setBoq(next); setLocked(true); refresh();
      toast.success(`BOQ ${next.boqNo || next.tempRefId} re-submitted (Rev ${boq.revision})`);
      return;
    }
    if (Number(boq.step) >= 3) { toast.info("Already submitted"); return; }
    const gate = boqBudgetGate(boq);
    if (gate) { toast.error(`BUDGET GATE BLOCK · ${gate}`); return; }
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
  const loadBOQ = (b) => { setBoq(b); setSaved(true); setLocked(b.step >= 3); setSearchOpen(false); setBoqSearch(""); };

  // Lookup existing BOQ by boqNo / tempRefId / refNo and auto-load its full data
  const lookupBoqByCode = () => {
    const q = (boqSearch || "").trim();
    if (!q) { toast.error("Enter a BOQ No. to search"); return; }
    const low = q.toLowerCase();
    const match = list.find((b) =>
      (b.boqNo || "").toLowerCase() === low ||
      (b.tempRefId || "").toLowerCase() === low ||
      (b.refNo || "").toLowerCase() === low
    ) || list.find((b) =>
      (b.boqNo || "").toLowerCase().includes(low) ||
      (b.tempRefId || "").toLowerCase().includes(low) ||
      (b.refNo || "").toLowerCase().includes(low) ||
      (b.projectSite || "").toLowerCase().includes(low) ||
      (b.clientName || "").toLowerCase().includes(low)
    );
    if (!match) { toast.error(`No BOQ found matching "${q}"`); return; }
    loadBOQ(match);
    toast.success(`✓ Loaded ${match.boqNo || match.tempRefId} · ${match.projectSite || "—"}`);
  };

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
            <label>BOQ No. · Type &amp; Enter to Load {Number(boq.step) >= 4 && <span style={{ color: "#16a34a", fontSize: 10, marginLeft: 4 }}>✓ auto-issued</span>}</label>
            <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
              <input
                data-testid="boq-no"
                list="boq-lookup-list"
                value={boqSearch !== "" ? boqSearch : (boq.boqNo || boq.tempRefId || "")}
                onChange={(e) => setBoqSearch(e.target.value)}
                placeholder="Type BOQ no. / project / client & Enter to load"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupBoqByCode(); } }}
                onFocus={() => { if (boqSearch === "" && (boq.boqNo || boq.tempRefId)) setBoqSearch(boq.boqNo || boq.tempRefId); }}
                onBlur={() => setTimeout(() => setBoqSearch(""), 150)}
                title="Type an existing BOQ No. / Temp Ref / project / client and press Enter (or 🔍) to auto-load that BOQ's full data"
                style={
                  Number(boq.step) >= 4 && boq.boqNo
                    ? { background: "#dcfce7", fontWeight: 800, color: "#166534", border: "1.5px solid #16a34a", flex: 1 }
                    : { background: "#fef9c3", fontWeight: 700, color: "#78716c", flex: 1 }
                }
              />
              <button
                type="button"
                data-testid="boq-lookup"
                onClick={lookupBoqByCode}
                title="Lookup BOQ by code / project / client"
                style={{ padding: "6px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 800, fontSize: 12 }}
              >🔍</button>
            </div>
            <datalist id="boq-lookup-list">
              {list.map((b) => <option key={b.id} value={b.boqNo || b.tempRefId}>{`${b.projectSite || "—"} · ${b.clientName || ""} · ₹${Number(b.total || 0).toLocaleString("en-IN")}`}</option>)}
            </datalist>
          </div>
          <div className="field-b">
            <label>Date</label>
            <DateInput data-testid="boq-date" type="date" value={boq.date} onChange={(e) => set("date", e.target.value)} disabled={locked} />
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
            <ContractSelect testid="boq-project" value={boq.projectSite} disabled={locked} onChange={(v, m) => setBoq((p) => {
              const rows = contractRows(m);
              const blankGrid = !(p.items || []).some((x) => String(x.description || "").trim());
              const take = rows.length && (blankGrid || window.confirm(`Contract ${m.contractNo} ke ${rows.length} items (Item Code, Qty, Rate) grid mein load karein? Purani lines hat jayengi.`));
              const items = take ? rows.map((i) => ({ id: i.id, scheduleType: "USSOR Item", itemCode: i.itemCode, description: i.description, hsn: i.hsn, qty: i.qty, unit: i.unit, rate: i.rate, gstPct: i.gstPct, amount: i.amount })) : p.items;
              return { ...p, projectSite: v, contractId: m?.contractId || "", contractNo: m?.contractNo || "", projectLocation: m?.siteLocation || p.projectLocation || "", clientName: p.clientName || m?.client || "", items, total: (items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0) };
            })} />
            {boq.contractNo && <div data-testid="boq-contract-info" style={{ fontSize: 10.5, color: "#166534", marginTop: 3 }}>Contract {boq.contractNo} se items/rates linked</div>}
            <input data-testid="boq-location" value={boq.projectLocation || ""} onChange={(e) => set("projectLocation", e.target.value)} disabled={locked} placeholder="Location (sirf yeh bharein)" style={{ marginTop: 4 }} />
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
          <div className="field-b">
            <label>BOQ Type <span className="req">*</span></label>
            <select data-testid="boq-type" value={boq.boqType || "Client Master BOQ"} onChange={(e) => set("boqType", e.target.value)} disabled={locked}>
              {BOQ_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
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
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 120 }}>Schedule Type</th>
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1" }}>Description</th>
                <th style={{ padding: 6, textAlign: "center", border: "1px solid #cbd5e1", width: 130 }}>HSN / SAC</th>
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
                    <select data-testid={`boq-sched-${idx}`} value={it.scheduleType || "USSOR Item"} onChange={(e) => setItem(idx, "scheduleType", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", fontSize: 11.5 }}>{["USSOR Item", "NS Item", "Supply Item"].map((s) => <option key={s}>{s}</option>)}</select>
                  </td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}>
                    <input data-testid={`boq-desc-${idx}`} value={it.description} onChange={(e) => setItem(idx, "description", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }} />
                  </td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}>
                    <HsnInput value={it.hsn || ""} disabled={locked} testid={`boq-hsn-${idx}`} onChange={(v) => setItem(idx, "hsn", v)} onPick={(code, rec) => { setItem(idx, "hsn", code); if (!it.description) setItem(idx, "description", rec.desc); }} />
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
              <tr style={{ background: "#f1f5f9" }} data-testid="boq-amount-words">
                <td colSpan={7} style={{ padding: "7px 10px", border: "1px solid #cbd5e1", fontSize: 11.5, color: "#0f172a" }}>
                  <b>Amount in Words:</b> <i>{amountToWords(computeBOQTotal(boq))}</i>
                </td>
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
            <label>Attachment (PDF / Excel / Image, ≤ 25 MB)</label>
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
                <a href="#boq-file" onClick={(e) => { e.preventDefault(); openFile(boq.attachmentFile || { dataUrl: boq.attachmentData, name: boq.attachmentName }); }} style={{ color: "#1d4ed8" }}>View</a>
                <button
                  type="button"
                  onClick={() => openFile(boq.attachmentFile || { dataUrl: boq.attachmentData, name: boq.attachmentName }, true)}
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
      <div data-testid="boq-action-row" style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        <button data-testid="boq-btn-search" onClick={() => setSearchOpen(true)} style={{ padding: "8px 14px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          🔍 Search BOQ
        </button>
        <button data-testid="boq-btn-new" onClick={startNew} style={{ padding: "8px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FilePlus2 size={13} /> New
        </button>
        <button data-testid="boq-btn-edit" onClick={() => {
          const approved = Number(boq.step) >= 4;
          if (approved) {
            if (!canDeleteApproved()) { toast.error("Only Admin / SuperAdmin can re-open Approved BOQ"); return; }
            const label = boq.boqNo || boq.tempRefId || boq.projectSite || "this BOQ";
            if (!window.confirm(`⚠ Re-open APPROVED BOQ "${label}" for editing?\n\n• Status wapas "Submitted — Pending Approval" (step 3) ho jayega\n• BOQ number intact rahega\n• Changes ke baad Re-Approval zaruri hogi\n\nContinue?`)) return;
            const reopened = {
              ...boq,
              step: 3,
              approvedByName: "",
              approvalDate: "",
              history: [...(boq.history || []), { action: "Re-opened for Edit by Admin", at: new Date().toISOString() }],
            };
            const saved = upsertBOQ(reopened);
            setBoq(saved);
            setLocked(false);
            refresh();
            toast.success("BOQ re-opened. Make changes → Save → Re-Approve.");
            return;
          }
          if (!writeAllowed) { toast.error("Not permitted"); return; }
          if (!locked) { toast.success("Already in edit mode"); return; }
          setLocked(false); toast.success("Edit mode enabled");
        }} disabled={Number(boq.step) >= 4 ? !canDeleteApproved() : !writeAllowed} style={{ padding: "8px 14px", background: Number(boq.step) >= 4 ? (canDeleteApproved() ? "#b45309" : "#94a3b8") : "#eab308", color: "#fff", border: "none", borderRadius: 5, cursor: (Number(boq.step) >= 4 ? canDeleteApproved() : writeAllowed) ? "pointer" : "not-allowed", opacity: (Number(boq.step) >= 4 ? canDeleteApproved() : writeAllowed) ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          ✏ {Number(boq.step) >= 4 ? "Re-open & Edit (Admin)" : "Edit"}
        </button>
        <button data-testid="boq-btn-save" onClick={handleSave} disabled={!writeAllowed || locked} style={{ padding: "8px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Save size={13} /> Save
        </button>
        <button data-testid="boq-btn-submit" onClick={handleSubmit} disabled={!writeAllowed || locked || boq.step >= 3} style={{ padding: "8px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked && boq.step < 3 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Send size={13} /> Submit
        </button>
        {boq.id && canDelete() && (
          <button data-testid="boq-btn-delete-current" onClick={() => {
            const approved = Number(boq.step) >= 4;
            if (!canDelete()) { toast.error("Only Admin / SuperAdmin can delete"); return; }
            const label = boq.boqNo || boq.tempRefId || boq.projectSite || "this BOQ";
            const msg = approved
              ? `⚠ DANGER: Delete APPROVED BOQ "${label}"?\n\nThis permanently removes an approved BOQ and cannot be undone.\n\nPress OK only if you are absolutely sure.`
              : `Delete BOQ "${label}"?`;
            if (!window.confirm(msg)) return;
            const audit = logBOQDeletion(boq, approved);
            deleteBOQ(boq.id);
            toast.success(
              approved
                ? `Approved BOQ "${label}" deleted by ${audit.actorRole} (${audit.actorName})`
                : `BOQ deleted by ${audit.actorRole} (${audit.actorName})`
            );
            setList(getBOQs());
            startNew();
          }} title="Admin / SuperAdmin · Delete BOQ" style={{
            padding: "8px 14px",
            background: Number(boq.step) >= 4
              ? "linear-gradient(135deg, #7c2d12 0%, #450a0a 100%)"
              : "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
            color: "#fff", border: "none", borderRadius: 5, cursor: "pointer",
            fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: Number(boq.step) >= 4
              ? "0 2px 6px rgba(69,10,10,.45)"
              : "0 2px 6px rgba(190,24,93,.4)",
            textShadow: "0 1px 1px rgba(0,0,0,.15)",
          }}>
            <Trash2 size={13} /> {Number(boq.step) >= 4 ? "Delete (Admin Override)" : "Delete BOQ"}
          </button>
        )}
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
                          const approved = Number(b.step) >= 4;
                          if (!canDelete()) { toast.error("Only Admin / SuperAdmin can delete"); return; }
                          const label = b.boqNo || b.tempRefId || b.projectSite || "";
                          const msg = approved
                            ? `⚠ DANGER: Delete APPROVED BOQ ${label}?\n\nThis permanently removes an approved BOQ and cannot be undone.\n\nPress OK only if you are absolutely sure.`
                            : `Delete BOQ ${label}?`;
                          if (!window.confirm(msg)) return;
                          const audit = logBOQDeletion(b, approved);
                          deleteBOQ(b.id);
                          toast.success(
                            approved
                              ? `Approved BOQ ${label} deleted by ${audit.actorRole} (${audit.actorName})`
                              : `BOQ deleted by ${audit.actorRole} (${audit.actorName})`
                          );
                          setList(getBOQs());
                          if (boq && boq.id === b.id) startNew();
                        }}
                        title={canDelete() ? "Delete BOQ" : "Only Admin / SuperAdmin can delete"}
                        disabled={!canDelete()}
                        style={{
                          padding: "3px 8px",
                          background: !canDelete() ? "#f1f5f9" : "#fee2e2",
                          color: !canDelete() ? "#94a3b8" : "#991b1b",
                          border: `1px solid ${!canDelete() ? "#cbd5e1" : "#fca5a5"}`,
                          borderRadius: 3,
                          cursor: !canDelete() ? "not-allowed" : "pointer",
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
  const [woSearch, setWoSearch] = useState("");

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
        ? b.items.map((it) => ({ id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, itemCode: it.itemCode || "", description: it.description, hsn: it.hsn || "", qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount }))
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

  const onAttach = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    const up = await uploadBig(f, 25);
    if (up) setWo((p) => ({ ...p, attachmentData: "", attachmentName: up.name, attachmentFile: up }));
  };
  const downloadAttachment = () => openFile(wo.attachmentFile || { dataUrl: wo.attachmentData, name: wo.attachmentName }, true);

  const handleSave = () => {
    if (!wo.boqRefId) { toast.error("Select BOQ Reference"); return false; }
    if (!wo.vendorCode) { toast.error("Select Vendor Code"); return false; }
    if (!wo.items?.length || wo.items.every((x) => !x.description.trim())) { toast.error("Add at least one line item"); return false; }
    const s = upsertWO({ ...wo });
    setWo(s); setSaved(true); refresh();
    toast.success("Work Order draft saved");
    return true;
  };
  const handleSubmit = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    if (!saved && !handleSave()) return;
    const parent = getBOQs().find((b) => b.id === wo.boqRefId);
    const cap = parent ? computeBOQTotal(parent) : 0;
    const used = getWOs().filter((w) => w.id !== wo.id && w.boqRefId === wo.boqRefId && Number(w.step) !== 6).reduce((s, w) => s + computeWOTotal(w), 0);
    if (parent && used + computeWOTotal(wo) > cap + 0.01) { toast.error(`BUDGET BLOCK · Cumulative WO ₹${(used + computeWOTotal(wo)).toLocaleString("en-IN")} > BOQ budget ₹${cap.toLocaleString("en-IN")}`); return; }
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
  const loadWO = (w) => { setWo(w); setSaved(true); setLocked(w.step >= 3); setWoSearch(""); };

  // Lookup existing Work Order by woNo / boqRefNo / vendor / project and auto-load full data
  const lookupWoByCode = () => {
    const q = (woSearch || "").trim();
    if (!q) { toast.error("Enter a WO No. to search"); return; }
    const low = q.toLowerCase();
    const match = list.find((w) =>
      (w.woNo || "").toLowerCase() === low
    ) || list.find((w) =>
      (w.woNo || "").toLowerCase().includes(low) ||
      (w.boqRefNo || "").toLowerCase().includes(low) ||
      (w.vendorCode || "").toLowerCase().includes(low) ||
      (w.vendorName || "").toLowerCase().includes(low) ||
      (w.projectSite || "").toLowerCase().includes(low)
    );
    if (!match) { toast.error(`No Work Order found matching "${q}"`); return; }
    loadWO(match);
    toast.success(`✓ Loaded ${match.woNo || "draft"} · ${match.vendorName || match.projectSite || "—"}`);
  };

  if (!wo) return null;

  return (
    <div style={{ marginTop: 12 }} data-testid="wo-editor">
      {/* A. WO Details */}
      <div className="section">
        <div className="sec-head">A. Work Order Details</div>
        <div className="sec-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 14px" }}>
          <div>
            <label>WO No. · Type &amp; Enter to Load</label>
            <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
              <input
                data-testid="wo-no"
                list="wo-lookup-list"
                value={woSearch !== "" ? woSearch : (wo.woNo || "")}
                onChange={(e) => setWoSearch(e.target.value)}
                placeholder="Type WO no / vendor / project & Enter"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupWoByCode(); } }}
                onFocus={() => { if (woSearch === "" && wo.woNo) setWoSearch(wo.woNo); }}
                onBlur={() => setTimeout(() => setWoSearch(""), 150)}
                title="Type an existing WO no / vendor / project and press Enter (or 🔍) to auto-load that Work Order's full data"
                style={{ background: "#eef2ff", fontWeight: 700, color: wo.woNo ? "#166534" : "#64748b", flex: 1 }}
              />
              <button
                type="button"
                data-testid="wo-lookup"
                onClick={lookupWoByCode}
                title="Lookup WO by code / vendor / project"
                style={{ padding: "6px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 800, fontSize: 12 }}
              >🔍</button>
            </div>
            <datalist id="wo-lookup-list">
              {list.map((w) => <option key={w.id} value={w.woNo || w.id}>{`${w.vendorName || "—"} · ${w.projectSite || ""} · ₹${Number(w.total || 0).toLocaleString("en-IN")}`}</option>)}
            </datalist>
          </div>
          <div><label>WO Date</label><DateInput data-testid="wo-date" type="date" value={wo.woDate} onChange={(e) => set("woDate", e.target.value)} disabled={locked} /></div>
          <div><label>Expiry Date {wo.woNo ? "(locked)" : "*"}</label><DateInput data-testid="wo-expiry" type="date" value={wo.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} disabled={locked || wo.step >= 4} min={wo.woDate || undefined} /></div>
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
          <div><label>Project (Contract No)</label><ContractSelect testid="wo-project" value={wo.projectSite} onChange={(v, m) => setWo((p) => ({ ...p, projectSite: v, contractId: m?.contractId || "", projectLocation: m?.siteLocation || p.projectLocation || "" }))} disabled={locked} /><input data-testid="wo-location" value={wo.projectLocation || ""} onChange={(e) => set("projectLocation", e.target.value)} disabled={locked} placeholder="Location" style={{ marginTop: 4 }} /></div>

          <div style={{ gridColumn: "span 2" }}><label>Client Name</label><input data-testid="wo-client" value={wo.clientName} onChange={(e) => set("clientName", e.target.value)} disabled={locked} /></div>
          <div><label>GST (row-wise · auto)</label><input data-testid="wo-gst" value={`₹ ${woGst(wo).toFixed(2)}`} readOnly style={{ background: "#f1f5f9", fontWeight: 700 }} /></div>
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
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 130 }}>HSN / SAC</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 80 }}>Qty</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 90 }}>Unit</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 110 }}>Rate (₹)</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 90 }}>GST Slab</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 130 }}>Amount (₹)</th>
                <th style={{ padding: 6, border: "1px solid #cbd5e1", width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {(wo.items || []).map((it, idx) => (
                <tr key={it.id} data-testid={`wo-row-${idx}`}>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-desc-${idx}`} value={it.description} onChange={(e) => setItem(idx, "description", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><HsnInput value={it.hsn || ""} disabled={locked} testid={`wo-hsn-${idx}`} onChange={(v) => setItem(idx, "hsn", v)} onPick={(code, rec) => { setItem(idx, "hsn", code); if (!it.description) setItem(idx, "description", rec.desc); }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-qty-${idx}`} type="number" step="any" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12, textAlign: "right" }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-unit-${idx}`} list="ae-units" value={it.unit} onChange={(e) => setItem(idx, "unit", e.target.value)} disabled={locked} placeholder="Type or pick…" style={{ width: "100%", border: "none", padding: 4, fontSize: 12 }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><input data-testid={`wo-rate-${idx}`} type="number" step="any" value={it.rate} onChange={(e) => setItem(idx, "rate", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", padding: 4, fontSize: 12, textAlign: "right" }} /></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1" }}><select data-testid={`wo-gst-${idx}`} value={it.gstPct ?? String(wo.gstSlab ?? 18)} onChange={(e) => setItem(idx, "gstPct", e.target.value)} disabled={locked} style={{ width: "100%", border: "none", fontSize: 12 }}>{[["5", "5%"], ["12", "12%"], ["18", "18%"], ["28", "28%"], ["0", "Exempted"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "right", fontWeight: 700 }}>{Number(it.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: 4, border: "1px solid #cbd5e1", textAlign: "center" }}>{!locked && (<button data-testid={`wo-del-${idx}`} onClick={() => delRow(idx)} style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer" }}><Trash2 size={13} /></button>)}</td>
                </tr>
              ))}
              <tr style={{ background: "#f8fafc" }}>
                <td colSpan={6} style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 800 }}>TOTAL WO VALUE</td>
                <td style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 800 }} data-testid="wo-total">₹ {computeWOTotal(wo).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td style={{ border: "1px solid #cbd5e1" }} />
              </tr>
              <tr style={{ background: "#f8fafc" }}>
                <td colSpan={6} style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 700 }}>GST (row-wise slabs · ITC)</td>
                <td style={{ padding: 8, textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 700 }} data-testid="wo-gst-total">₹ {woGst(wo).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td style={{ border: "1px solid #cbd5e1" }} />
              </tr>
              <tr data-testid="wo-retention-banner">
                <td colSpan={8} style={{ padding: "12px 14px", border: "2px solid #dc2626", background: "#fef2f2", color: "#991b1b", fontWeight: 900, fontSize: 15, userSelect: "none" }}>
                  RETENTION AMOUNT LOCKED ({Number(wo.retentionPct) || 0}%): ₹ {(computeWOTotal(wo) * (Number(wo.retentionPct) || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 600 }}>· Finance bills par auto-deduct</span>
                </td>
              </tr>
              <tr style={{ background: "#f1f5f9" }} data-testid="wo-amount-words">
                <td colSpan={8} style={{ padding: "7px 10px", border: "1px solid #cbd5e1", fontSize: 11.5, color: "#0f172a" }}>
                  <b>Amount in Words:</b> <i>{amountToWords(computeWOTotal(wo))}</i>
                </td>
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
            <label>WO / Signed Contract Attachment (PDF · ≤ 25 MB)</label>
            {!locked && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                <Paperclip size={12} /> Upload
                <input data-testid="wo-attach" type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={onAttach} />
              </label>
            )}
            {wo.attachmentName && (
              <div style={{ marginTop: 6, fontSize: 11, display: "flex", gap: 8, alignItems: "center" }}>
                📎 {wo.attachmentName}
                <a href="#wo-file" onClick={(e) => { e.preventDefault(); openFile(wo.attachmentFile || { dataUrl: wo.attachmentData, name: wo.attachmentName }); }} style={{ color: "#1d4ed8" }}>View</a>
                <button onClick={downloadAttachment} data-testid="wo-attach-download" style={{ padding: "2px 8px", fontSize: 10, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontWeight: 700 }}>⬇ Download</button>
              </div>
            )}
          </div>
          <div><label>Approved By (GM / Admin)</label><input data-testid="wo-approved-by" value={wo.approvedByName || ""} readOnly placeholder="Auto-filled on Approval" style={{ background: "#f8fafc", fontWeight: 700, color: "#166534" }} /></div>
          <div><label>Approval Date</label><input data-testid="wo-approval-date" value={wo.approvalDate ? fmtDMY(wo.approvalDate) : ""} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} /></div>
        </div>
      </div>

      {/* Actions */}
      <div data-testid="wo-action-row" style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "nowrap", overflowX: "auto", whiteSpace: "nowrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        {/* Left group — Workflow */}
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center", flexShrink: 0 }}>
          <button data-testid="wo-btn-new" onClick={() => startNew()} style={{ padding: "7px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><FilePlus2 size={13} /> New</button>
          <button data-testid="wo-btn-edit" onClick={() => {
            const approved = Number(wo.step) >= 4;
            if (approved) {
              if (!canDeleteApproved()) { toast.error("Only Admin / SuperAdmin can re-open Approved WO"); return; }
              const label = wo.woNo || wo.boqRefNo || wo.vendorName || "this WO";
              if (!window.confirm(`⚠ Re-open APPROVED Work Order "${label}" for editing?\n\n• Status wapas "Submitted — Pending Approval" (step 3) ho jayega\n• WO number intact rahega\n• Changes ke baad Re-Approval zaruri hogi\n\nContinue?`)) return;
              const reopened = {
                ...wo,
                step: 3,
                approvedByName: "",
                approvalDate: "",
                history: [...(wo.history || []), { action: "Re-opened for Edit by Admin", at: new Date().toISOString() }],
              };
              const saved = upsertWO(reopened);
              setWo(saved);
              setLocked(false);
              setList(getWOs());
              toast.success("WO re-opened. Make changes → Save → Re-Approve.");
              return;
            }
            if (!writeAllowed) { toast.error("Not permitted"); return; }
            if (!locked) { toast.success("Already in edit mode"); return; }
            setLocked(false); toast.success("Edit mode enabled");
          }} disabled={Number(wo.step) >= 4 ? !canDeleteApproved() : !writeAllowed} style={{ padding: "7px 12px", background: Number(wo.step) >= 4 ? (canDeleteApproved() ? "#b45309" : "#94a3b8") : "#eab308", color: "#fff", border: "none", borderRadius: 5, cursor: (Number(wo.step) >= 4 ? canDeleteApproved() : writeAllowed) ? "pointer" : "not-allowed", opacity: (Number(wo.step) >= 4 ? canDeleteApproved() : writeAllowed) ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
            ✏ {Number(wo.step) >= 4 ? "Re-open & Edit (Admin)" : "Edit"}
          </button>
          <button data-testid="wo-btn-save" onClick={handleSave} disabled={!writeAllowed || locked} style={{ padding: "7px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Save size={13} /> Save</button>
          <button data-testid="wo-btn-submit" onClick={handleSubmit} disabled={!writeAllowed || locked || wo.step >= 3} style={{ padding: "7px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked && wo.step < 3 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Send size={13} /> Submit</button>
        </div>
        {/* Center group — Approval */}
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center", flexShrink: 0 }}>
          <button data-testid="wo-btn-approve" onClick={handleApprove} disabled={!approveAllowed || wo.step < 3 || wo.step >= 4} style={{ padding: "7px 14px", background: approveAllowed && wo.step >= 3 && wo.step < 4 ? "#dc2626" : "#94a3b8", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed && wo.step >= 3 && wo.step < 4 ? "pointer" : "not-allowed", opacity: approveAllowed && wo.step >= 3 && wo.step < 4 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>✓ Approval</button>
          <AiWoButton wo={wo} onApply={(d) => { const next = { ...wo, ...d }; setWo(next); if (writeAllowed) { upsertWO(next); setList(getWOs()); } }} />
        </div>
        {/* Right group — Export */}
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center", flexShrink: 0 }}>
          <button data-testid="wo-btn-download" onClick={() => downloadWOExcel()} style={{ padding: "7px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>⬇ Excel</button>
          <button data-testid="wo-btn-print" onClick={() => printWorkOrder(wo)} style={{ padding: "7px 12px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Printer size={13} /> {wo.step >= 4 ? "PDF for Vendor" : "Print PDF"}</button>
          {wo.id && canDelete() && (
            <button
              data-testid="wo-btn-delete-current"
              onClick={() => {
                const approved = Number(wo.step) >= 4;
                if (!canDelete()) { toast.error("Only Admin / SuperAdmin can delete"); return; }
                const label = wo.woNo || wo.boqRefNo || wo.vendorName || "this WO";
                const msg = approved
                  ? `⚠ DANGER: Delete APPROVED Work Order "${label}"?\n\nThis permanently removes an issued WO and cannot be undone.\n\nType-less confirm — Press OK only if you are absolutely sure.`
                  : `Delete Work Order "${label}"?`;
                if (!window.confirm(msg)) return;
                const audit = logWODeletion(wo, approved);
                deleteWO(wo.id);
                toast.success(
                  approved
                    ? `Approved WO "${label}" deleted by ${audit.actorRole} (${audit.actorName})`
                    : `Work Order deleted by ${audit.actorRole} (${audit.actorName})`
                );
                setList(getWOs());
                startNew();
              }}
              title="Admin / SuperAdmin · Delete WO"
              style={{
                padding: "7px 12px",
                background: Number(wo.step) >= 4 ? "#991b1b" : "#dc2626",
                color: "#fff", border: "none", borderRadius: 5, cursor: "pointer",
                fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5,
                boxShadow: Number(wo.step) >= 4 ? "0 1px 3px rgba(153,27,27,.4)" : "0 1px 3px rgba(220,38,38,.3)",
              }}
            >
              <Trash2 size={13} /> {Number(wo.step) >= 4 ? "Delete (Admin Override)" : "Delete WO"}
            </button>
          )}
        </div>
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
                          const approved = Number(w.step) >= 4;
                          if (!canDelete()) { toast.error("Only Admin / SuperAdmin can delete"); return; }
                          const label = w.woNo || w.boqRefNo || w.vendorName || "";
                          const msg = approved
                            ? `⚠ DANGER: Delete APPROVED Work Order ${label}?\n\nThis permanently removes an issued WO and cannot be undone.\n\nPress OK only if you are absolutely sure.`
                            : `Delete Work Order ${label}?`;
                          if (!window.confirm(msg)) return;
                          const audit = logWODeletion(w, approved);
                          deleteWO(w.id);
                          toast.success(
                            approved
                              ? `Approved WO ${label} deleted by ${audit.actorRole} (${audit.actorName})`
                              : `Work Order deleted by ${audit.actorRole} (${audit.actorName})`
                          );
                          setList(getWOs());
                          if (wo && wo.id === w.id) startNew();
                        }}
                        title={canDelete() ? "Admin / SuperAdmin · Delete WO" : "Only Admin / SuperAdmin can delete"}
                        disabled={!canDelete()}
                        style={{
                          padding: "3px 8px",
                          background: canDelete() ? (Number(w.step) >= 4 ? "#991b1b" : "#fee2e2") : "#f1f5f9",
                          color: canDelete() ? (Number(w.step) >= 4 ? "#fff" : "#991b1b") : "#94a3b8",
                          border: `1px solid ${canDelete() ? (Number(w.step) >= 4 ? "#991b1b" : "#fca5a5") : "#cbd5e1"}`,
                          borderRadius: 3,
                          cursor: canDelete() ? "pointer" : "not-allowed",
                          fontSize: 10, fontWeight: 700,
                        }}
                      >
                        🗑 {Number(w.step) >= 4 && canDelete() ? "Delete (Admin)" : "Delete"}
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
  const [active, setActive] = useState(() => new URLSearchParams(window.location.search).get("tab") || "vendor");
  const role = currentRole();
  const write = canCreate();
  const approve = canApprove();

  const openTab = (t) => {
    const y = window.scrollY;
    document.body.style.minHeight = `${y + window.innerHeight}px`;
    setActive(t.id);
    window.history.replaceState(null, "", t.id === "boq" ? "/purchase" : `/purchase?tab=${t.id}`);
    requestAnimationFrame(() => window.scrollTo(0, y));
  };
  useEffect(() => () => { document.body.style.minHeight = ""; }, []);
  const activeTab = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <div className="a4" data-testid="purchase-page">
          <ModuleHero
            tag="Procurement Management"
            title="BOQ · Work Orders · New Vendor Bill Creation · Procurement"
            subtitle="Line-item BOQs · Vendor WO · Auto-fill from BOQ · GST + Retention · GM approval"
            icon={ShoppingCart}
            gradient="linear-gradient(135deg,#14532d 0%,#166534 45%,#65a30d 100%)"
            shadowRgba="22,101,52,.28"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 6, marginTop: 10 }} data-testid="purchase-tabs">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`purchase-tab-${t.id}`}
                  onClick={() => openTab(t)}
                  style={{
                    minWidth: 0, minHeight: 58,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                    padding: "8px 6px", borderRadius: 8,
                    border: `1px solid ${isActive ? t.color : "#cbd5e1"}`,
                    background: isActive ? t.color : "#fff",
                    color: isActive ? "#fff" : "#0f172a",
                    cursor: "pointer",
                    fontWeight: 700, fontSize: 12,
                    letterSpacing: .2, textAlign: "center",
                  }}
                >
                  <Icon size={17} strokeWidth={2} />
                  <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                    <div style={{ fontSize: 9.5, opacity: .8, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }} data-testid="purchase-role-note">
            <Info size={13} />
            <span>Signed in as <b>{role}</b> · Purchase Management me sirf <b>Create / Prepare / Submit</b> permission hai — Final Approval Accounts / GM karega.</span>
          </div>

          {activeTab.id === "vendor" && <VendorRegistration embedded />}
          {activeTab.id === "boq" && <BOQEditor writeAllowed={write} approveAllowed={approve} />}
          {activeTab.id === "wo" && <WOEditor writeAllowed={write} approveAllowed={approve} />}
          {activeTab.id === "billing" && <div style={{ marginTop: 12 }} data-testid="three-way-register"><OpsModule cfg={OPS.proc_invoice} /></div>}
          {activeTab.id === "billing" && <BillProcessing key="create" mode="create" embedded />}
          {activeTab.id === "rfq" && <RfqCs />}
          {activeTab.id === "grn" && <div data-testid="store-grn-tab"><div style={{ marginTop: 12 }}><OpsModule cfg={OPS.proc_grn} /></div><div style={{ marginTop: 12 }}><OpsModule cfg={OPS.stock_count} /></div></div>}
          {["boq", "wo"].includes(activeTab.id) && <HsnFinder />}
          <UnitDataList />
        </div>
      </div>
    </>
  );
}
