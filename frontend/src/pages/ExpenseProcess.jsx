import React, { useMemo, useState, useEffect } from "react";
import { DateInput } from "../components/DateInput";
import { toast, Toaster } from "sonner";
import * as XLSX from "xlsx";
import { Wallet, Search, FilePlus2, Save, Pencil, Send, Printer, Download, CheckCircle2 } from "lucide-react";
import Header from "../components/Header";
import ModuleHero from "../components/ModuleHero";
import { Receipt as ReceiptIcon } from "lucide-react";
import StepTabs from "../components/StepTabs";
import TopActionBar from "../components/TopActionBar";
import AccountsTabs from "../components/AccountsTabs";
import HomeNavBar from "../components/HomeNavBar";
import { uploadBig, openFile } from "../lib/bigFiles";
import {
  createExpenseDraft, computeExpense, upsertExpense, advanceExpenseStep, reserveExpenseRef,
  EXPENSE_STEP_LABEL, currentUser, exportJSON, getExpenses, amountToWords,
  canCreate, canApprove,
} from "../lib/store";

const F = ({ label, req, children }) => (
  <div className="field-b">
    <label>{label} {req && <span className="req">*</span>}</label>
    {children}
  </div>
);

const CATEGORIES = [
  "Site Expense / Petty Cash", "Office Expense", "Travel", "Fuel / Conveyance", "Utility (Power/Water/Internet)",
  "Rent", "Salary / Wages", "Marketing", "Printing & Stationery",
  "Repair & Maintenance", "Bank Charges", "Professional Fees", "Miscellaneous",
];
const PAYMENT_MODES = ["Cash", "Cheque", "NEFT / RTGS", "IMPS", "UPI", "Debit / Credit Card"];
const GST_SLABS = [0, 5, 12, 18, 28];

const PETTY = "Site Expense / Petty Cash";
const pmProjects = () => { try { return JSON.parse(localStorage.getItem("ae_vm_projects") || "[]"); } catch { return []; } };
const projLabel = (p) => [p.code, p.name, p.siteLocation].filter(Boolean).join(" · ");

export default function ExpenseProcess({ embedded = false }) {
  const [expense, setExpense] = useState(() => createExpenseDraft(false));
  const [locked, setLocked] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [searchQ, setSearchQ] = useState("");

  // REAL-TIME CROSS-USER SYNC: re-render on ae-sync-done.
  useEffect(() => {
    const onSync = () => setRefresh((v) => v + 1);
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  const comp = useMemo(() => computeExpense(expense), [expense]);
  const allExpenses = useMemo(() => getExpenses(), [refresh, expense.id]);

  const bind = (k, extra = {}) => ({
    value: expense[k] ?? "",
    onChange: (e) => setExpense({ ...expense, [k]: e.target.value }),
    readOnly: locked,
    "data-testid": `field-${k}`,
    ...extra,
  });

  const validate = () => {
    if (!String(expense.projectCode || "").trim()) { toast.error("Project Code & Site Location chunein"); return false; }
    if (!expense.description.trim()) { toast.error("Enter expense description"); return false; }
    if (!expense.paidToName.trim()) { toast.error("Enter 'Paid To' name"); return false; }
    if ((Number(expense.basicAmount) || 0) <= 0) { toast.error("Amount must be greater than 0"); return false; }
    if (expense.category === PETTY) {
      const p = pmProjects().find((x) => projLabel(x) === expense.projectCode);
      const limit = Number(p?.pettyFloat) || 0;
      if (!limit) { toast.error("Is project ki Petty Cash Float limit Projects Register mein set nahi hai"); return false; }
      const m = String(expense.date || "").slice(0, 7);
      const used = getExpenses().filter((x) => x.id !== expense.id && x.category === PETTY && x.projectCode === expense.projectCode && String(x.date || "").slice(0, 7) === m && x.status !== "Rejected").reduce((s, x) => s + computeExpense(x).netPayable, 0);
      const mine = computeExpense(expense).netPayable;
      if (used + mine > limit) { toast.error(`FLOAT LIMIT · Is mahine ₹${Math.round(used + mine).toLocaleString("en-IN")} > float ₹${limit.toLocaleString("en-IN")}`); return false; }
    }
    return true;
  };

  const handleNew = () => {
    setExpense(createExpenseDraft(false));
    setLocked(false);
    setRefresh((n) => n + 1);
    toast.success("New expense draft started");
  };

  const handleSave = async () => {
    if (!validate()) return;
    const base = await reserveExpenseRef(expense);
    const saved = upsertExpense({ ...base, createdByName: base.createdByName || currentUser() });
    setExpense(saved);
    setRefresh((n) => n + 1);
    toast.success(`Saved ${saved.refNo}`);
  };

  const handleEdit = () => {
    const step = Number(expense.step) || 1;
    const isApproved = step === 4 || !!expense.permanentExpenseNo;
    if (isApproved) {
      const label = expense.permanentExpenseNo || expense.refNo || "this expense";
      if (!window.confirm(`Reopen approved expense ${label} for editing? This requires Re-Approval.`)) return;
      const history = Array.isArray(expense.history) ? expense.history : [];
      history.push({ action: "Reopened", from: "Approved", by: currentUser(), at: new Date().toISOString() });
      const next = {
        ...expense, step: 3,
        revision: (expense.revision || 0) + 1,
        reopenedAt: new Date().toISOString(),
        reopenedBy: currentUser(),
        history,
      };
      const saved = upsertExpense(next);
      setExpense(saved); setLocked(false); setRefresh((n) => n + 1);
      toast.success(`${label} reopened (Rev ${next.revision}) · Awaiting Re-Approval`);
      return;
    }
    setLocked(false); toast.info("Editable");
  };

  const handleSubmit = async () => {
    const step = Number(expense.step) || 1;
    if (step >= 4) { toast.info("Already approved"); return; }
    if (!validate()) return;
    // Re-Submit after reopen — record is at step 3 with revision > 0, awaiting Re-Approval
    if (step === 3 && (expense.revision || 0) > 0) {
      const history = Array.isArray(expense.history) ? expense.history : [];
      history.push({ action: "Re-Submitted", by: currentUser(), at: new Date().toISOString() });
      const saved = upsertExpense({ ...expense, history, submittedAt: new Date().toISOString() });
      setExpense(saved); setRefresh((n) => n + 1);
      toast.success(`Re-Submitted (Rev ${expense.revision}) · Awaiting Re-Approval`);
      return;
    }
    if (step === 3) { toast.error("Use Final Approval to approve"); return; }
    if (step === 1 && !expense.preparedByName.trim()) { toast.error("Enter 'Prepared By' name"); return; }
    if (step === 2 && !expense.checkedByName.trim()) { toast.error("Enter 'Checked By' name"); return; }
    const next = advanceExpenseStep({ ...(await reserveExpenseRef(expense)) });
    setExpense(next); setRefresh((n) => n + 1);
    toast.success(`Advanced to ${EXPENSE_STEP_LABEL[next.step]}`);
  };

  const handleApprove = () => {
    const step = Number(expense.step) || 1;
    if (step === 4) { toast.info("Already approved & paid"); return; }
    if (step !== 3) { toast.error("Complete Prepared + Checked steps first (use Submit)"); return; }
    if (!validate()) return;
    if (!expense.approvedByName.trim()) { toast.error("Enter Approver Name first"); return; }
    const isReApproval = (expense.revision || 0) > 0;
    const history = Array.isArray(expense.history) ? expense.history : [];
    history.push({
      action: isReApproval ? "Re-Approved" : "Approved",
      by: currentUser(),
      at: new Date().toISOString(),
    });
    const next = { ...advanceExpenseStep({ ...expense }), history };
    const saved = upsertExpense(next);
    setExpense(saved); setLocked(true); setRefresh((n) => n + 1);
    toast.success(
      isReApproval
        ? `Re-Approved (Rev ${saved.revision}) · Expense No: ${saved.permanentExpenseNo} · Net ₹${comp.netPayable}`
        : `Final Approval · Expense recorded · Net ₹${comp.netPayable}`
    );
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allExpenses.map((x) => {
      const c = computeExpense(x);
      return {
        "Expense No": x.permanentExpenseNo || x.refNo,
        Date: x.date,
        Category: x.category,
        Description: x.description,
        "Paid To": x.paidToName,
        "Payment Mode": x.paymentMode,
        Basic: c.basic, GST: c.gst, TDS: c.tds,
        "Other Ded.": c.other, Net: c.netPayable,
        Step: EXPENSE_STEP_LABEL[Number(x.step) || 1] || x.step,
        "Prepared By": x.preparedByName || "",
        "Checked By": x.checkedByName || "",
        "Approved By": x.approvedByName || "",
        "Approval Date": x.approvalDate || "",
      };
    })), "Expenses");
    XLSX.writeFile(wb, `expenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Expenses exported to Excel");
  };
  const handleExportJSON = () => {
    exportJSON({ ...expense, computed: comp }, `expense_${(expense.refNo || "draft").replace(/\//g, "_")}.json`);
    toast.success("Expense exported as JSON");
  };
  const handlePrint = () => window.print();

  const handleWoFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    const up = await uploadBig(f, 5);
    if (up) setExpense((x) => ({ ...x, receiptFile: up }));
  };
  const removeReceipt = () => { setExpense({ ...expense, receiptFile: null }); toast.success("Receipt removed"); };

  const loadExpense = (x) => {
    const normalized = { ...x, step: Number(x.step) || 1 };
    setExpense(normalized);
    setLocked(normalized.step === 4);
    toast.success(`Loaded ${normalized.permanentExpenseNo || normalized.refNo}`);
  };

  const submitSearch = () => {
    const q = (searchQ || "").trim().toLowerCase();
    if (!q) { toast.info("Enter Ref/Expense No or Paid To"); return; }
    const hit = allExpenses.find((x) =>
      (x.refNo || "").toLowerCase() === q ||
      (x.permanentExpenseNo || "").toLowerCase() === q ||
      (x.paidToName || "").toLowerCase().includes(q) ||
      (x.description || "").toLowerCase().includes(q)
    );
    if (hit) { loadExpense(hit); } else { toast.error("No matching expense found"); }
  };

  return (
    <>
      {!embedded && <><Toaster richColors position="top-right" />
      <HomeNavBar /></>}
      <TopActionBar
        onNew={handleNew} onSave={handleSave} onEdit={handleEdit}
        onSubmit={handleSubmit} onApprove={handleApprove}
        onExportExcel={handleExportExcel} onExportJSON={handleExportJSON}
        onPrint={handlePrint}
        onSearch={submitSearch}
        searchQuery={searchQ}
        onSearchQueryChange={(v) => setSearchQ(v)}
        searchLabel="Search"
        searchPlaceholder="Ref / Expense No / Paid To"
        labels={{ approve: "Final Approval" }}
        prevLabel="Bill" prevTo="/bill"
        nextLabel="Reports" nextTo="/final"
      />
      <div className={embedded ? "" : "a4"} data-testid="expense-page">
        {!embedded && <>
        <div className="module-doc-header"><Header formTitle="ACCOUNTS DEPARTMENT" /></div>
        <ModuleHero
          tag="Finance Management"
          title="Vendor Bill Process · Expenses · Advance Reg. · Pay Bill · Weekly Fooding · Exit & F&F"
          subtitle="Expenses · Petty Cash · Reimbursements · 4-step approval · GM final sign-off"
          icon={ReceiptIcon}
          gradient="linear-gradient(135deg,#064e3b 0%,#065f46 45%,#14b8a6 100%)"
          shadowRgba="6,78,59,.28"
        />
        <AccountsTabs active="expense" />
        </>}
        <StepTabs step={Number(expense.step) || 1} labels={[EXPENSE_STEP_LABEL[1], EXPENSE_STEP_LABEL[2], EXPENSE_STEP_LABEL[3], EXPENSE_STEP_LABEL[4]]} />

        {/* 1. Expense Details */}
        <div className="section">
          <div className="sec-head">1. Expense Details</div>
          <div className="sec-body">
            <div className="row cols-4">
              <F label="Ref / Expense No"><input value={expense.permanentExpenseNo || expense.refNo} readOnly className="mono" /></F>
              <F label="Date" req><DateInput type="date" {...bind("date")} /></F>
              <F label="Category" req>
                <select {...bind("category")}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </F>
              <F label="Payment Mode" req>
                <select {...bind("paymentMode")}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </F>
            </div>
            <div className="row cols-2" style={{ marginTop: 10 }}>
              <F label="Project Code & Site Location" req>
                <select data-testid="expense-project" {...bind("projectCode")}>
                  <option value="">— Select Project —</option>
                  {pmProjects().map((p) => <option key={p.id} value={projLabel(p)}>{projLabel(p)}{p.pettyFloat ? ` (Float ₹${Number(p.pettyFloat).toLocaleString("en-IN")}/month)` : ""}</option>)}
                </select>
              </F>
            </div>
            <div className="row cols-2" style={{ marginTop: 10 }}>
              <F label="Paid To (Vendor / Party Name)" req>
                <input placeholder="e.g. Reliance Fuel Station" {...bind("paidToName")} />
              </F>
              <F label="Description / Purpose" req>
                <input placeholder="Describe the expense" {...bind("description")} />
              </F>
            </div>
            <div className="row cols-2" style={{ marginTop: 10 }}>
              <F label="Receipt Upload (PDF / Image · Max 5 MB)">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {!expense.receiptFile ? (
                    <input type="file" accept="application/pdf,image/*"
                      onChange={handleWoFile} disabled={locked}
                      data-testid="receipt-file-input"
                      style={{ flex: 1, padding: "4px 6px", fontSize: 10.5, border: "1px solid #cfd8e3", borderRadius: 4, background: "#fff", minWidth: 0 }} />
                  ) : (
                    <>
                      <a href="#receipt" onClick={(ev) => { ev.preventDefault(); openFile(expense.receiptFile); }}
                        data-testid="receipt-file-link"
                        style={{ flex: 1, padding: "6px 10px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 4, fontWeight: 600, fontSize: 11, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        title={`${expense.receiptFile.name} · ${Math.round(expense.receiptFile.size / 1024)}KB`}>
                        📎 {expense.receiptFile.name}
                      </a>
                      {!locked && (
                        <button type="button" onClick={removeReceipt} data-testid="receipt-file-remove"
                          style={{ padding: "5px 10px", fontSize: 10.5, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600, flex: "0 0 auto" }}>
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </F>
              <F label="Remarks (optional)">
                <input placeholder="Notes / justification" {...bind("remarks")} />
              </F>
            </div>
          </div>
        </div>

        {/* 2. Amount */}
        <div className="section">
          <div className="sec-head">2. Amount Calculation</div>
          <div className="sec-body">
            <div className="row cols-4">
              <F label="Basic Amount (₹)" req>
                <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("basicAmount")} />
              </F>
              <F label="GST Slab (%)">
                <select {...bind("gstSlab")}>
                  {GST_SLABS.map((g) => <option key={g} value={g}>{`${g}%`}</option>)}
                </select>
              </F>
              <F label="TDS Rate (%)">
                <input type="number" step="0.01" min="0" placeholder="0" {...bind("tdsRate")} />
              </F>
              <F label="Other Deductions (₹)">
                <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("otherDeductions")} />
              </F>
            </div>
            <div className="row cols-4" style={{ marginTop: 10 }}>
              <F label="GST Amount (auto)"><input value={comp.gst.toFixed(2)} readOnly className="num" /></F>
              <F label="Gross (auto)"><input value={comp.gross.toFixed(2)} readOnly className="num" /></F>
              <F label="TDS Deducted (auto)"><input value={comp.tds.toFixed(2)} readOnly className="num" /></F>
              <F label="Net Payable (auto)">
                <input value={comp.netPayable.toFixed(2)} readOnly className="num" style={{ background: "#dcfce7", fontWeight: 700, color: "#166534" }} data-testid="expense-net" />
              </F>
            </div>
            <div className="row cols-1" style={{ marginTop: 10 }}>
              <F label="Amount in Words">
                <input value={amountToWords(comp.netPayable)} readOnly style={{ fontStyle: "italic", color: "#334155" }} />
              </F>
            </div>
          </div>
        </div>

        {/* 3. Approvals */}
        <div className="section">
          <div className="sec-head">3. Approval Trail</div>
          <div className="sec-body">
            <div className="row cols-3">
              <F label="Prepared By (Step 1)"><input placeholder="Employee Name" {...bind("preparedByName")} /></F>
              <F label="Checked By (Step 2)"><input placeholder="Verifier Name" {...bind("checkedByName")} /></F>
              <F label="Approved By (Step 3)"><input placeholder="Approver Name" {...bind("approvedByName")} /></F>
            </div>
            <div className="row cols-2" style={{ marginTop: 10 }}>
              <F label="Approval Date"><DateInput type="date" value={expense.approvalDate} readOnly /></F>
              <F label="Current Status">
                <input value={EXPENSE_STEP_LABEL[Number(expense.step) || 1]} readOnly
                  style={{ background: (Number(expense.step) === 4) ? "#dcfce7" : "#fef3c7", fontWeight: 700, color: (Number(expense.step) === 4) ? "#166534" : "#92400e", textAlign: "center", letterSpacing: 0.5 }} />
              </F>
            </div>
          </div>
        </div>

        {/* 4. Expenses Data Sheet — action row shown first (order:-1), right after the form */}
        <div className="section" style={{ display: "flex", flexDirection: "column" }}>
          <div className="sec-head">Expenses Data Sheet · Click Load to open any row</div>
          <div className="sec-body">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" data-testid="expenses-table">
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th>Ref / Exp No</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Paid To</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Net (₹)</th>
                    <th>Step</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allExpenses.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", color: "#64748b", padding: 14 }}>No expenses recorded yet</td></tr>
                  )}
                  {allExpenses.map((x) => {
                    const c = computeExpense(x);
                    const isActive = expense.id === x.id;
                    const step = Number(x.step) || 1;
                    const stepLabel = EXPENSE_STEP_LABEL[step] || x.step;
                    const stepColor = step === 4 ? "#dcfce7" : step === 3 ? "#fef3c7" : step === 2 ? "#dbeafe" : "#e2e8f0";
                    const stepText = step === 4 ? "#166534" : step === 3 ? "#92400e" : step === 2 ? "#1e40af" : "#334155";
                    return (
                      <tr key={x.id} data-testid={`exp-row-${x.id}`} style={isActive ? { background: "#f0f9ff" } : {}}>
                        <td className="mono">{x.permanentExpenseNo || x.refNo}</td>
                        <td>{x.date}</td>
                        <td>{x.category}</td>
                        <td>{x.paidToName}</td>
                        <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.description}>{x.description}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{c.netPayable.toFixed(2)}</td>
                        <td>
                          <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: stepColor, color: stepText }}>{stepLabel}</span>
                          {x.revision > 0 && (
                            <span style={{ marginLeft: 4, padding: "1px 6px", fontSize: 9, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 999, fontWeight: 700 }} title={`Reopened ${x.revision} time(s)`}>
                              REV {x.revision}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => loadExpense(x)} data-testid={`exp-load-${x.id}`}
                            style={{ padding: "3px 10px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
                            Load
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inline Action Buttons — uniform left-to-right alignment */}
          <div style={{ order: -1, marginBottom: 12, display: "flex", justifyContent: "flex-start", alignItems: "stretch", gap: 6, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }} data-testid="exp-action-row">
            <button data-testid="exp-btn-new" onClick={handleNew} disabled={!canCreate()} style={{ padding: "7px 12px", height: 32, background: canCreate() ? "#0369a1" : "#94a3b8", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><FilePlus2 size={13} /> New Expense</button>
            <button data-testid="exp-btn-edit" onClick={handleEdit} disabled={!canCreate()} style={{ padding: "7px 12px", height: 32, background: "#eab308", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() ? "pointer" : "not-allowed", opacity: canCreate() ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><Pencil size={13} /> Edit</button>
            <button data-testid="exp-btn-save" onClick={handleSave} disabled={!canCreate()} style={{ padding: "7px 12px", height: 32, background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() ? "pointer" : "not-allowed", opacity: canCreate() ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><Save size={13} /> Save</button>
            <button data-testid="exp-btn-submit" onClick={handleSubmit} disabled={!canCreate()} style={{ padding: "7px 12px", height: 32, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() ? "pointer" : "not-allowed", opacity: canCreate() ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><Send size={13} /> Submit</button>
            <button data-testid="exp-btn-approve" onClick={handleApprove} disabled={!canApprove()} style={{ padding: "7px 12px", height: 32, background: canApprove() ? "#dc2626" : "#94a3b8", color: "#fff", border: "none", borderRadius: 5, cursor: canApprove() ? "pointer" : "not-allowed", opacity: canApprove() ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><CheckCircle2 size={13} /> Final Approval</button>
            <span style={{ width: 1, height: 24, background: "#cbd5e1", margin: "4px 6px", alignSelf: "center" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 1, textTransform: "uppercase", padding: "7px 12px", height: 32, background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", borderRadius: 5, boxShadow: "0 1px 3px rgba(79,70,229,.35)", display: "inline-flex", alignItems: "center", lineHeight: 1, boxSizing: "border-box" }}>Export</span>
            <button data-testid="exp-btn-export-json" onClick={handleExportJSON} style={{ padding: "7px 12px", height: 32, background: "#2563eb", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(37,99,235,.3)", lineHeight: 1 }}><Download size={13} /> JSON</button>
            <button data-testid="exp-btn-export-excel" onClick={handleExportExcel} style={{ padding: "7px 12px", height: 32, background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(5,150,105,.3)", lineHeight: 1 }}>⬇ Excel</button>
            <button data-testid="exp-btn-print" onClick={handlePrint} style={{ padding: "7px 12px", height: 32, background: "#ea580c", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(234,88,12,.3)", lineHeight: 1 }}><Printer size={13} /> Print</button>
          </div>
        </div>
      </div>
    </>
  );
}
