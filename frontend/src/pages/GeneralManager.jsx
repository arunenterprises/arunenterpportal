import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  ArrowRight, CheckCircle2, RefreshCw, ClipboardList, Users, FileText,
  Wallet, Receipt, CreditCard, Clock, TrendingUp, LayoutDashboard, ShieldCheck,
  UserCheck, Calendar, LogOut, Briefcase, Banknote, XCircle, Trash2, Handshake,
} from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import GmMasterView from "../components/GmMasterView";
import CrmGmPanel, { crmGmCounts } from "../components/crm/CrmGmPanel";
import { loadCrmCache, crmCache, crmCacheReady } from "../components/crm/crmShared";
import {
  getVendors, getBills, getPayments, getExpenses, getBOQs, getWOs,
  getEmployees, getLeaves, getExits, getRecruitments, getPayBills, savePayBills,
  canApprove, canDelete,
  advanceVendorStep, advanceBillStep, advanceExpenseStep, advanceBOQStep, advanceWOStep,
  advanceEmployeeStep, approveLeave, finalizeExit, advanceExitStep, upsertRecruit, advancePayBillStep,
  reapproveVendor, reapproveBill, reapproveExpense, reapproveBOQ, reapproveVoucher, reapproveWO,
  reapproveEmployee,
  savePayments, deletePaymentCloud,
  upsertVendor, upsertBill, upsertExpense, upsertBOQ, upsertWO,
  upsertEmployee, saveLeaves, deletePayBill, deleteAdvanceRequest, deleteExit, deleteRecruit,
  deleteBOQ, deleteWO, deleteBill, deleteExpense, deleteVendor, deleteEmployee,
  currentUserProfile,
  fixVendorCodeCollisions, isSuperAdmin, currentUserEmail,
} from "../lib/store";

// -----------------------------------------------------------------------------
//  Modern, dashboard-first General Manager view
// -----------------------------------------------------------------------------

// Small stat card with icon, count, progress bar (approved/total)
const KpiCard = ({ icon: Icon, label, tone, pending, approved, total, onOpen, testid }) => {
  const pct = total === 0 ? 0 : Math.round((approved / total) * 100);
  return (
    <div data-testid={testid} onClick={onOpen} style={{
      background: "#fff", borderRadius: 12, padding: 14,
      border: "1px solid #e2e8f0", cursor: "pointer",
      boxShadow: "0 1px 3px rgba(15,23,42,.05)",
      transition: "all .18s ease",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(15,23,42,.09)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,23,42,.05)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: `${tone}18`,
          color: tone, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} />
        </div>
        {pending > 0 && (
          <span style={{
            padding: "2px 8px", background: "#fef3c7", color: "#92400e",
            border: "1px solid #fcd34d", borderRadius: 999, fontSize: 10, fontWeight: 800,
          }}>{pending} pending</span>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: .4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{approved}</div>
        <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>/ {total}</div>
      </div>
      <div style={{ marginTop: 8, height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone, transition: "width .4s" }} />
      </div>
    </div>
  );
};

// Header hero — dark navy gradient with GM identity
const HeroHeader = ({ gmName, canDo, totalPending, totalApproved }) => (
  <div style={{
    background: "linear-gradient(135deg, #0b1a4d 0%, #1e3a8a 55%, #0f766e 100%)",
    color: "#fff", borderRadius: 14, padding: 20,
    boxShadow: "0 10px 40px rgba(15,23,42,.18)",
    position: "relative", overflow: "hidden",
  }}>
    {/* decorative watermark */}
    <div style={{
      position: "absolute", right: -30, top: -30, opacity: .08,
      transform: "rotate(-14deg)", pointerEvents: "none",
    }}>
      <LayoutDashboard size={220} />
    </div>

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(255,255,255,.25)",
        }}>
          <ShieldCheck size={26} />
        </div>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: 3, color: "#c7d2fe", fontWeight: 700, textTransform: "uppercase" }}>
            General Manager
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, letterSpacing: .3 }}>
            Consolidated Approval Dashboard
          </div>
          <div style={{ fontSize: 11.5, color: "#e0e7ff", marginTop: 4 }}>
            Signed in as <b>{gmName || "—"}</b> · {canDo
              ? <span style={{ color: "#a7f3d0" }}>Approve / Re-Approve enabled — aapka naam auto-fill hoga</span>
              : <span style={{ color: "#fde68a" }}>View-only — Admin / SuperAdmin only can approve</span>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 16px", minWidth: 110 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#fde68a", fontWeight: 700, letterSpacing: .5 }}>
            <Clock size={11} /> PENDING
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalPending}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 16px", minWidth: 110 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#a7f3d0", fontWeight: 700, letterSpacing: .5 }}>
            <TrendingUp size={11} /> APPROVED
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalApproved}</div>
        </div>
      </div>
    </div>
  </div>
);

// Inbox section — colored title bar with count pill + table (now with Reject + Delete)
const InboxSection = ({ title, tone, icon: Icon, items, onApprove, onReject, onDelete, onOpen, colLabels, rowRender, testid, actionLabel = "Approve", actionIcon = "check", canDoDelete = false }) => (
  <div data-testid={testid} style={{
    background: "#fff", borderRadius: 12, overflow: "hidden",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(15,23,42,.05)",
  }}>
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 16px", background: tone, color: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase" }}>
        {Icon && <Icon size={15} />}
        {title}
        <span style={{
          marginLeft: 4, padding: "1px 8px", background: "rgba(255,255,255,.22)",
          borderRadius: 999, fontSize: 11, fontWeight: 700,
        }}>{items.length}</span>
      </div>
      <button onClick={onOpen} style={{
        padding: "5px 12px", background: "rgba(255,255,255,.22)", color: "#fff",
        border: "1px solid rgba(255,255,255,.4)", borderRadius: 20,
        cursor: "pointer", fontSize: 10.5, fontWeight: 700,
        display: "inline-flex", alignItems: "center", gap: 5,
      }}>
        Open module <ArrowRight size={11} />
      </button>
    </div>
    {items.length === 0 ? (
      <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
        <CheckCircle2 size={22} style={{ margin: "0 auto 6px", display: "block", color: "#cbd5e1" }} />
        Sab clear! Kuch bhi pending nahi hai.
      </div>
    ) : (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {colLabels.map((c, i) => (
              <th key={i} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#0f172a", borderBottom: "1px solid #e2e8f0", fontSize: 11, letterSpacing: .3, textTransform: "uppercase" }}>{c}</th>
            ))}
            <th style={{ padding: "9px 14px", textAlign: "center", fontWeight: 700, color: "#0f172a", borderBottom: "1px solid #e2e8f0", width: 240, fontSize: 11, letterSpacing: .3, textTransform: "uppercase" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 8).map((it, ri) => (
            <tr key={it.id} style={{ background: ri % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
              {rowRender(it).map((cell, i) => (
                <td key={i} style={{ padding: "9px 14px", color: "#334155" }}>{cell}</td>
              ))}
              <td style={{ padding: "6px 8px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    data-testid={`gm-${actionIcon}-${testid}-${it.id}`}
                    onClick={() => onApprove(it)}
                    title={actionLabel}
                    style={{
                      padding: "5px 10px", background: tone, color: "#fff",
                      border: "none", borderRadius: 20, cursor: "pointer",
                      fontSize: 10.5, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", gap: 4,
                      boxShadow: `0 2px 6px ${tone}55`,
                    }}
                  >
                    {actionIcon === "check" ? <CheckCircle2 size={12} /> : <RefreshCw size={12} />} {actionLabel}
                  </button>
                  {onReject && (
                    <button
                      data-testid={`gm-reject-${testid}-${it.id}`}
                      onClick={() => onReject(it)}
                      title="Reject · send back to Draft with reason"
                      style={{
                        padding: "5px 10px", background: "#f59e0b", color: "#fff",
                        border: "none", borderRadius: 20, cursor: "pointer",
                        fontSize: 10.5, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", gap: 4,
                        boxShadow: "0 2px 6px rgba(245,158,11,.4)",
                      }}
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  )}
                  {onDelete && (
                    <button
                      data-testid={`gm-delete-${testid}-${it.id}`}
                      onClick={() => onDelete(it)}
                      title={canDoDelete ? "Delete permanently (cloud reconciled)" : "Only Admin / SuperAdmin can delete"}
                      style={{
                        padding: "5px 10px", background: canDoDelete ? "#dc2626" : "#94a3b8", color: "#fff",
                        border: "none", borderRadius: 20, cursor: "pointer",
                        fontSize: 10.5, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", gap: 4,
                        boxShadow: canDoDelete ? "0 2px 6px rgba(220,38,38,.4)" : "none",
                        opacity: canDoDelete ? 1 : 0.75,
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// Ordered department wrapper (numbered pill + title strip)
const DeptGroup = ({ index, title, tone, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, background: tone,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 12, boxShadow: `0 2px 6px ${tone}55`,
      }}>{index}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", letterSpacing: .5, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, #e2e8f0, transparent)" }} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 12 }}>
      {children}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
export default function GeneralManager() {
  const nav = useNavigate();
  const canDo = canApprove();
  const me = currentUserProfile();
  const gmName = (me?.name || me?.user || "").trim();

  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState("pending");
  const bump = () => setTick((t) => t + 1);
  const delOk = canDelete();
  const [crm, setCrm] = useState(() => (crmCacheReady() ? crmGmCounts(crmCache) : null));
  useEffect(() => { loadCrmCache().then((c) => setCrm(crmGmCounts(c))).catch(() => {}); }, [tick]);

  // REAL-TIME SYNC: auto-refresh when any user (admin/superadmin anywhere) commits a change.
  // App.js runs an 8-second global poll + focus-triggered pulls, which fire the
  // "ae-sync-done" window event — we listen and bump() to re-render inboxes.
  useEffect(() => {
    const onSync = () => bump();
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  // ZOMBIE-DUPLICATE FIX: dedupe arrays by id (older cross-device sync could
  // reintroduce stale copies after a GPV→PN rename or deleted record).
  const uniqById = (arr) => {
    const seen = new Set();
    return (arr || []).filter((x) => {
      const k = x?.id;
      if (!k || seen.has(k)) return !k;
      seen.add(k); return true;
    });
  };

  const vendors = uniqById(getVendors());
  const bills = uniqById(getBills());
  const payments = uniqById(getPayments());
  const expenses = uniqById(getExpenses());
  const boqs = uniqById(getBOQs());
  const wos = uniqById(getWOs());
  const employees = uniqById(getEmployees());
  const leaves = uniqById(getLeaves());
  const exits = uniqById(getExits());
  const recruits = uniqById(getRecruitments());
  const payBills = uniqById(getPayBills());

  const stats = useMemo(() => {
    const vendorPending = vendors.filter((v) => v.step === 2);
    const vendorApproved = vendors.filter((v) => v.step === 3);
    const billsPending = bills.filter((b) => Number(b.step) === 4);
    const billsApproved = bills.filter((b) => Number(b.step) === 5);
    const vouchersPending = payments.filter((p) => p.status === "Submitted");
    const vouchersApproved = payments.filter((p) => p.status === "Approved");
    const expensesPending = expenses.filter((x) => Number(x.step) === 3);
    const expensesApproved = expenses.filter((x) => Number(x.step) === 4);
    const boqsPending = boqs.filter((b) => Number(b.step) === 3);
    const boqsApproved = boqs.filter((b) => Number(b.step) === 4);
    const wosPending = wos.filter((w) => Number(w.step) === 3);
    const wosApproved = wos.filter((w) => Number(w.step) === 4);
    // HR items pending GM final approval
    const empsPending = employees.filter((e) => Number(e.step) === 4);
    const empsApproved = employees.filter((e) => Number(e.step) === 5);
    const leavesPending = leaves.filter((l) => Number(l.status) === 2);
    const leavesApproved = leaves.filter((l) => Number(l.status) === 3);
    const exitsPending = exits.filter((x) => Number(x.status) === 2);
    const exitsApproved = exits.filter((x) => Number(x.status) >= 3);
    const recruitsPending = recruits.filter((r) => Number(r.status) === 3);
    const recruitsApproved = recruits.filter((r) => Number(r.status) >= 4);
    const payBillsPending = payBills.filter((p) => Number(p.step) === 2);
    const payBillsApproved = payBills.filter((p) => Number(p.step) >= 3);
    return { vendorPending, vendorApproved, billsPending, billsApproved, vouchersPending, vouchersApproved, expensesPending, expensesApproved, boqsPending, boqsApproved, wosPending, wosApproved, empsPending, empsApproved, leavesPending, leavesApproved, exitsPending, exitsApproved, recruitsPending, recruitsApproved, payBillsPending, payBillsApproved };
  }, [vendors, bills, payments, expenses, boqs, wos, employees, leaves, exits, recruits, payBills, tick]);

  const totalPending = stats.vendorPending.length + stats.billsPending.length + stats.vouchersPending.length + stats.expensesPending.length + stats.boqsPending.length + stats.wosPending.length + stats.empsPending.length + stats.leavesPending.length + stats.exitsPending.length + stats.recruitsPending.length + stats.payBillsPending.length;
  const totalApproved = stats.vendorApproved.length + stats.billsApproved.length + stats.vouchersApproved.length + stats.expensesApproved.length + stats.boqsApproved.length + stats.wosApproved.length + stats.empsApproved.length + stats.leavesApproved.length + stats.exitsApproved.length + stats.recruitsApproved.length + stats.payBillsApproved.length;

  const approveVendor = async (v) => { if (!canDo) return toast.error("Not permitted"); const next = await advanceVendorStep(v); toast.success(`Vendor ${next.firmName || next.tempRefId} approved by ${next.approvedByName}`); bump(); };
  const approveBill = (b) => { if (!canDo) return toast.error("Not permitted"); const next = advanceBillStep(b); toast.success(`Bill ${next.permanentBillNo || next.refNo} approved by ${next.approverName}`); bump(); };
  const approveVoucher = (p) => {
    if (!canDo) return toast.error("Not permitted");
    const list = getPayments().map((x) => x.id === p.id ? { ...x, status: "Approved", approvedByName: gmName, approvalDate: new Date().toISOString().slice(0, 10) } : x);
    savePayments(list);
    toast.success(`Voucher ${p.pvNo} approved by ${gmName}`);
    bump();
  };
  const approveExpense = (x) => { if (!canDo) return toast.error("Not permitted"); const next = advanceExpenseStep(x); toast.success(`Expense ${next.permanentExpenseNo || next.refNo} approved by ${next.approvedByName}`); bump(); };
  const approveBOQ = (b) => {
    if (!canDo) return toast.error("Not permitted");
    const next = advanceBOQStep({ ...b, step: 3 });
    const done = advanceBOQStep(next);
    toast.success(`BOQ ${done.boqNo} approved by ${done.approvedByName}`);
    bump();
  };
  const approveWO = (w) => {
    if (!canDo) return toast.error("Not permitted");
    const staged = advanceWOStep({ ...w, step: Math.max(Number(w.step) || 1, 2) });
    const done = advanceWOStep(staged);
    toast.success(`Work Order ${done.woNo} approved by ${done.approvedByName}`);
    bump();
  };

  const doReapproveVendor = (v) => { if (!canDo) return toast.error("Not permitted"); const n = reapproveVendor(v); toast.success(`Vendor ${n.firmName} re-approved by ${n.approvedByName}`); bump(); };
  const doReapproveBill = (b) => { if (!canDo) return toast.error("Not permitted"); const n = reapproveBill(b); toast.success(`Bill ${n.permanentBillNo || n.refNo} re-approved by ${n.approverName}`); bump(); };
  const doReapproveVoucher = (p) => { if (!canDo) return toast.error("Not permitted"); const n = reapproveVoucher(p); toast.success(`Voucher ${n.pvNo} re-approved by ${n.approvedByName}`); bump(); };
  const doReapproveExpense = (x) => { if (!canDo) return toast.error("Not permitted"); const n = reapproveExpense(x); toast.success(`Expense ${n.permanentExpenseNo || n.refNo} re-approved by ${n.approvedByName}`); bump(); };
  const doReapproveBOQ = (b) => { if (!canDo) return toast.error("Not permitted"); const n = reapproveBOQ(b); toast.success(`BOQ ${n.boqNo} re-approved by ${n.approvedByName}`); bump(); };
  const doReapproveWO = (w) => { if (!canDo) return toast.error("Not permitted"); const n = reapproveWO(w); toast.success(`Work Order ${n.woNo} re-approved by ${n.approvedByName}`); bump(); };

  // ----- HR actions (new) -----
  const approveEmployee = (e) => {
    if (!canDo) return toast.error("Not permitted");
    let cur = { ...e, doj: e.doj || new Date().toISOString().slice(0, 10) };
    while (Number(cur.step) < 5) cur = advanceEmployeeStep(cur);
    toast.success(`Employee ${cur.fullName} finalized · EMP Code: ${cur.empCode}`); bump();
  };
  const approveLeaveGM = (l) => {
    if (!canDo) return toast.error("Not permitted");
    approveLeave(l.id, true);
    toast.success(`Leave of ${l.empName || l.empCode || "employee"} approved`); bump();
  };
  const approveExitGM = (x) => {
    if (!canDo) return toast.error("Not permitted");
    const n = advanceExitStep(x);
    toast.success(`Exit of ${n.empName || n.empCode || "employee"} GM-approved · sent to Accounts`); bump();
  };
  const approveRecruitGM = (r) => {
    if (!canDo) return toast.error("Not permitted");
    upsertRecruit({ ...r, status: 4, offerApprovedByName: gmName, offerApprovedAt: new Date().toISOString() });
    toast.success(`Offer released for ${r.candidateName}`); bump();
  };
  const doReapproveEmp = (e) => {
    if (!canDo) return toast.error("Not permitted");
    const n = reapproveEmployee(e);
    toast.success(`Employee ${n.fullName} re-approved`); bump();
  };
  const approvePayBillGM = (pb) => {
    if (!canDo) return toast.error("Not permitted");
    const n = advancePayBillStep(pb);
    toast.success(`Pay Bill ${n.refNo} approved · Net ₹${Number(n.totalNet || 0).toLocaleString("en-IN")}`); bump();
  };

  // ----- REJECT handlers (send back to Draft with reason, cloud-synced) -----
  const askReason = (label) => {
    const r = window.prompt(`Reject ${label} — reason:`);
    return r == null ? null : (r.trim() || "Rejected by GM");
  };
  const rejectVendor = (v) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(v.firmName || v.tempRefId); if (r == null) return; upsertVendor({ ...v, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`Vendor rejected · reason: ${r}`); bump(); };
  const rejectBill = (b) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(b.permanentBillNo || b.refNo); if (r == null) return; upsertBill({ ...b, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`Bill rejected · reason: ${r}`); bump(); };
  const rejectVoucher = (p) => {
    if (!canDo) return toast.error("Not permitted");
    const r = askReason(p.pvNo); if (r == null) return;
    const list = getPayments().map((x) => x.id === p.id ? { ...x, status: "Rejected", rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() } : x);
    savePayments(list); toast.success(`Voucher ${p.pvNo} rejected · reason: ${r}`); bump();
  };
  const rejectExpense = (x) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(x.permanentExpenseNo || x.refNo); if (r == null) return; upsertExpense({ ...x, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`Expense rejected · reason: ${r}`); bump(); };
  const rejectBOQ = (b) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(b.boqNo); if (r == null) return; upsertBOQ({ ...b, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`BOQ rejected · reason: ${r}`); bump(); };
  const rejectWO = (w) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(w.woNo || w.boqRefNo); if (r == null) return; upsertWO({ ...w, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`Work Order rejected · reason: ${r}`); bump(); };
  const rejectEmployee = (e) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(e.fullName); if (r == null) return; upsertEmployee({ ...e, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`Employee rejected · reason: ${r}`); bump(); };
  const rejectLeave = (l) => {
    if (!canDo) return toast.error("Not permitted");
    const r = askReason(`${l.empName || l.empCode} leave`); if (r == null) return;
    const list = getLeaves().map((x) => x.id === l.id ? { ...x, status: 4, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() } : x);
    saveLeaves(list); toast.success(`Leave rejected · reason: ${r}`); bump();
  };
  const rejectExit = (x) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(x.empName || x.empCode); if (r == null) return; const list = getExits().map((y) => y.id === x.id ? { ...y, status: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() } : y); if (typeof window !== "undefined") { localStorage.setItem("ae_vm_exits", JSON.stringify(list)); } upsertRecruit; bump(); toast.success(`Exit rejected · reason: ${r}`); };
  const rejectRecruit = (rc) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(rc.candidateName); if (r == null) return; upsertRecruit({ ...rc, status: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() }); toast.success(`Offer rejected · reason: ${r}`); bump(); };
  const rejectPayBill = (pb) => { if (!canDo) return toast.error("Not permitted"); const r = askReason(pb.refNo); if (r == null) return; const list = getPayBills().map((x) => x.id === pb.id ? { ...x, step: 1, rejectReason: r, rejectedByName: gmName, rejectedAt: new Date().toISOString() } : x); try { savePayBills(list); } catch {} bump(); toast.success(`Pay Bill rejected · reason: ${r}`); };

  // ----- DELETE handlers (Admin / SuperAdmin only · cloud reconciled) -----
  const confirmDel = (label) => window.confirm(`Delete ${label}?\n\nAction is permanent and will be reconciled across all devices.`);
  const delVendor = (v) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(v.firmName || v.tempRefId)) return; deleteVendor(v.id); toast.success("Vendor deleted"); bump(); };
  const delBill = (b) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(b.permanentBillNo || b.refNo)) return; deleteBill(b.id); toast.success("Bill deleted"); bump(); };
  const delVoucher = (p) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(p.pvNo)) return; deletePaymentCloud(p.pvNo); toast.success("Voucher deleted · cloud synced"); bump(); };
  const delExpense = (x) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(x.permanentExpenseNo || x.refNo)) return; deleteExpense(x.id); toast.success("Expense deleted"); bump(); };
  const delBOQ = (b) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(b.boqNo)) return; deleteBOQ(b.id); toast.success("BOQ deleted"); bump(); };
  const delWO = (w) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(w.woNo || w.boqRefNo)) return; deleteWO(w.id); toast.success("Work Order deleted"); bump(); };
  const delEmployee = (e) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(e.fullName)) return; deleteEmployee(e.id); toast.success("Employee deleted"); bump(); };
  const delExit = (x) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(x.empName || x.empCode)) return; deleteExit(x.id); toast.success("Exit record deleted"); bump(); };
  const delRecruit = (r) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(r.candidateName)) return; deleteRecruit(r.id); toast.success("Recruitment deleted"); bump(); };
  const delPayBill = (pb) => { if (!delOk) return toast.error("Only Admin / SuperAdmin can delete"); if (!confirmDel(pb.refNo)) return; deletePayBill(pb.id); toast.success("Pay Bill deleted"); bump(); };

  const pendingInbox = (
    <div data-testid="gm-inbox-pending">
      <DeptGroup index={1} title="Vendor Management" tone="#0369a1">
        <InboxSection testid="inbox-vendors" title="Vendors pending" tone="#0369a1" icon={Users} items={stats.vendorPending} onOpen={() => nav("/vendor")} onApprove={approveVendor} onReject={rejectVendor} onDelete={delVendor} canDoDelete={delOk} colLabels={["Firm", "Contact", "PAN"]} rowRender={(v) => [v.firmName || v.tempRefId, v.contactPerson || "-", v.panNo || "-"]} />
      </DeptGroup>
      <DeptGroup index={2} title="Purchase — BOQ & Work Orders" tone="#0ea5e9">
        <InboxSection testid="inbox-boq" title="BOQ pending" tone="#0ea5e9" icon={ClipboardList} items={stats.boqsPending} onOpen={() => nav("/purchase")} onApprove={approveBOQ} onReject={rejectBOQ} onDelete={delBOQ} canDoDelete={delOk} colLabels={["BOQ No.", "Project", "Total"]} rowRender={(b) => [b.boqNo, b.projectSite, `₹ ${Number(b.total || 0).toLocaleString("en-IN")}`]} />
        <InboxSection testid="inbox-wo" title="Work Orders pending" tone="#15803d" icon={FileText} items={stats.wosPending} onOpen={() => nav("/purchase")} onApprove={approveWO} onReject={rejectWO} onDelete={delWO} canDoDelete={delOk} colLabels={["Ref (BOQ)", "Vendor", "Total"]} rowRender={(w) => [w.boqRefNo || "—", w.vendorName || w.vendorCode || "—", `₹ ${Number(w.total || 0).toLocaleString("en-IN")}`]} />
      </DeptGroup>
      <DeptGroup index={3} title="Accounts — Bills" tone="#16a34a">
        <InboxSection testid="inbox-bills" title="Bills pending" tone="#16a34a" icon={Receipt} items={stats.billsPending} onOpen={() => nav("/bill")} onApprove={approveBill} onReject={rejectBill} onDelete={delBill} canDoDelete={delOk} colLabels={["Bill Ref", "Vendor", "Amount"]} rowRender={(b) => [b.refNo || b.permanentBillNo, b.vendorSnapshot?.firmName || b.vendorCode, `₹ ${Number(b.basicAmount || 0).toLocaleString("en-IN")}`]} />
      </DeptGroup>
      <DeptGroup index={4} title="Expenses" tone="#f59e0b">
        <InboxSection testid="inbox-expenses" title="Expenses pending" tone="#f59e0b" icon={Wallet} items={stats.expensesPending} onOpen={() => nav("/expense")} onApprove={approveExpense} onReject={rejectExpense} onDelete={delExpense} canDoDelete={delOk} colLabels={["Ref No.", "Paid To", "Amount"]} rowRender={(x) => [x.refNo || x.permanentExpenseNo, x.paidToName || "-", `₹ ${Number(x.basicAmount || 0).toLocaleString("en-IN")}`]} />
      </DeptGroup>
      <DeptGroup index={5} title="Payment Vouchers" tone="#7c3aed">
        <InboxSection testid="inbox-vouchers" title="Payment Vouchers pending" tone="#7c3aed" icon={CreditCard} items={stats.vouchersPending} onOpen={() => nav("/final")} onApprove={approveVoucher} onReject={rejectVoucher} onDelete={delVoucher} canDoDelete={delOk} colLabels={["PV No.", "Vendor", "Amount"]} rowRender={(p) => [p.pvNo, p.vendorSnapshot?.firmName || p.vendorCode, `₹ ${Number(p.amount || 0).toLocaleString("en-IN")}`]} />
      </DeptGroup>
      <DeptGroup index={6} title="HR Management — Employees, Leaves, Recruitment, Exit" tone="#c026d3">
        <InboxSection testid="inbox-emps" title="Employees pending Final Approval" tone="#c026d3" icon={UserCheck} items={stats.empsPending} onOpen={() => nav("/hr")} onApprove={approveEmployee} onReject={rejectEmployee} onDelete={delEmployee} canDoDelete={delOk} colLabels={["Temp Code", "Name", "Applied Post"]} rowRender={(e) => [e.tempCode || "—", e.fullName || "—", e.appliedPost || e.designation || "—"]} />
        <InboxSection testid="inbox-leaves" title="Leave Applications pending" tone="#f59e0b" icon={Calendar} items={stats.leavesPending} onOpen={() => nav("/hr")} onApprove={approveLeaveGM} onReject={rejectLeave} canDoDelete={false} colLabels={["Employee", "Type", "Days (From → To)"]} rowRender={(l) => [l.empName || l.empCode || "—", l.type || "—", `${l.days || 0} days · ${l.from || "—"} → ${l.to || "—"}`]} />
        <InboxSection testid="inbox-recruits" title="Recruitment Offers pending release" tone="#16a34a" icon={Briefcase} items={stats.recruitsPending} onOpen={() => nav("/hr")} onApprove={approveRecruitGM} onReject={rejectRecruit} onDelete={delRecruit} canDoDelete={delOk} colLabels={["Candidate", "Position", "Offer CTC"]} rowRender={(r) => [r.candidateName || "—", `${r.position || "—"} · ${r.department || "—"}`, `₹ ${Number(r.offerCTC || 0).toLocaleString("en-IN")}`]} />
        <InboxSection testid="inbox-exits" title="Exit & F&F pending GM approval" tone="#991b1b" icon={LogOut} items={stats.exitsPending} onOpen={() => nav("/hr")} onApprove={approveExitGM} onReject={rejectExit} onDelete={delExit} canDoDelete={delOk} colLabels={["Employee", "LWD", "Net F&F"]} rowRender={(x) => [x.empName || x.empCode || "—", x.lastWorkingDay || "—", `₹ ${Number(x.fnfNet || 0).toLocaleString("en-IN")}`]} />
        <InboxSection testid="inbox-paybills" title="Monthly Pay Bills pending approval" tone="#be185d" icon={Receipt} items={stats.payBillsPending} onOpen={() => nav("/hr")} onApprove={approvePayBillGM} onReject={rejectPayBill} onDelete={delPayBill} canDoDelete={delOk} colLabels={["Ref No.", "Period", "Employees · Net"]} rowRender={(p) => [p.refNo || "—", `${new Date(p.year, p.month - 1).toLocaleString("en", { month: "short" })} ${p.year}`, `${p.lines?.length || 0} emps · ₹${Number(p.totalNet || 0).toLocaleString("en-IN")}`]} />
      </DeptGroup>
    </div>
  );

  const approvedInbox = (
    <div data-testid="gm-inbox-approved">
      <DeptGroup index={1} title="Vendor Management" tone="#0369a1">
        <InboxSection testid="reap-vendors" title="Vendors approved" tone="#0369a1" icon={Users} items={stats.vendorApproved} onOpen={() => nav("/vendor")} onApprove={doReapproveVendor} onReject={rejectVendor} onDelete={delVendor} canDoDelete={delOk} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["Vendor Code", "Firm", "Approved By"]} rowRender={(v) => [v.vendorCode, v.firmName, v.approvedByName || "-"]} />
      </DeptGroup>
      <DeptGroup index={2} title="Purchase — BOQ & Work Orders" tone="#0ea5e9">
        <InboxSection testid="reap-boq" title="BOQ approved" tone="#0ea5e9" icon={ClipboardList} items={stats.boqsApproved} onOpen={() => nav("/purchase")} onApprove={doReapproveBOQ} onReject={rejectBOQ} onDelete={delBOQ} canDoDelete={delOk} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["BOQ No.", "Approved By", "Date"]} rowRender={(b) => [b.boqNo, b.approvedByName || "-", b.approvalDate || "-"]} />
        <InboxSection testid="reap-wo" title="Work Orders approved" tone="#15803d" icon={FileText} items={stats.wosApproved} onOpen={() => nav("/purchase")} onApprove={doReapproveWO} onReject={rejectWO} onDelete={delWO} canDoDelete={delOk} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["WO No.", "Vendor", "Approved By"]} rowRender={(w) => [w.woNo || "—", w.vendorName || w.vendorCode || "—", w.approvedByName || "-"]} />
      </DeptGroup>
      <DeptGroup index={3} title="Accounts — Bills" tone="#16a34a">
        <InboxSection testid="reap-bills" title="Bills approved" tone="#16a34a" icon={Receipt} items={stats.billsApproved} onOpen={() => nav("/bill")} onApprove={doReapproveBill} onReject={rejectBill} onDelete={delBill} canDoDelete={delOk} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["Bill No.", "Vendor", "Approved By"]} rowRender={(b) => [b.permanentBillNo || b.refNo, b.vendorSnapshot?.firmName || b.vendorCode, b.approverName || "-"]} />
      </DeptGroup>
      <DeptGroup index={4} title="Expenses" tone="#f59e0b">
        <InboxSection testid="reap-expenses" title="Expenses approved" tone="#f59e0b" icon={Wallet} items={stats.expensesApproved} onOpen={() => nav("/expense")} onApprove={doReapproveExpense} onReject={rejectExpense} onDelete={delExpense} canDoDelete={delOk} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["Ref No.", "Paid To", "Approved By"]} rowRender={(x) => [x.permanentExpenseNo || x.refNo, x.paidToName || "-", x.approvedByName || "-"]} />
      </DeptGroup>
      <DeptGroup index={5} title="Payment Vouchers" tone="#7c3aed">
        <InboxSection testid="reap-vouchers" title="Payment Vouchers approved" tone="#7c3aed" icon={CreditCard} items={stats.vouchersApproved} onOpen={() => nav("/final")} onApprove={doReapproveVoucher} onReject={rejectVoucher} onDelete={delVoucher} canDoDelete={delOk} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["PV No.", "Amount", "Approved By"]} rowRender={(p) => [p.pvNo, `₹ ${Number(p.amount || 0).toLocaleString("en-IN")}`, p.approvedByName || "-"]} />
      </DeptGroup>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div style={{ minHeight: "100vh", background: "#f1f5f9", paddingBottom: 40 }}>
        <div style={{ maxWidth: "100%", margin: "0 auto", padding: "18px 24px" }} data-testid="gm-page">
          {/* Hero header */}
          <HeroHeader gmName={gmName} canDo={canDo} totalPending={totalPending} totalApproved={totalApproved} />

          <GmMasterView tick={tick} canDo={canDo} expenses={expenses} approvals={[
            ...stats.vendorPending.map((v) => ({ key: `ven-${v.id}`, type: "Vendor", no: v.tempRefId || v.vendorCode, party: v.firmName || "", amt: "", view: () => nav("/purchase"), ok: () => approveVendor(v), no2: () => rejectVendor(v) })),
            ...stats.boqsPending.map((b) => ({ key: `boq-${b.id}`, type: "BOQ", no: b.boqNo, party: b.projectSite || b.projectName || "", amt: b.grandTotal ?? b.total ?? "", view: () => nav("/purchase?tab=boq"), ok: () => approveBOQ(b), no2: () => rejectBOQ(b) })),
            ...stats.billsPending.map((b) => ({ key: `bill-${b.id}`, type: "Bill", no: b.permanentBillNo || b.refNo, party: b.vendorSnapshot?.firmName || b.vendorCode || "", amt: (Number(b.basicAmount) || 0) * (1 + (Number(b.gstSlab) || 0) / 100), view: () => nav("/bill"), ok: () => approveBill(b), no2: () => rejectBill(b) })),
            ...stats.vouchersPending.map((p) => ({ key: `pv-${p.id}`, type: "Voucher", no: p.pvNo, party: p.vendorName || p.payeeName || p.paidTo || "", amt: p.amount ?? p.netAmount ?? p.netPayable ?? "", view: () => nav("/final"), ok: () => approveVoucher(p), no2: () => rejectVoucher(p) })),
            ...stats.wosPending.map((w) => ({ key: `wo-${w.id}`, type: "Work Order", no: w.woNo || w.boqRefNo, party: w.vendorName || "", amt: w.total ?? "", view: () => nav("/purchase"), ok: () => approveWO(w), no2: () => rejectWO(w) })),
            ...stats.expensesPending.map((x) => ({ key: `exp-${x.id}`, type: "Expense", no: x.permanentExpenseNo || x.refNo, party: x.description || x.category || "", amt: (Number(x.basicAmount) || 0) + (Number(x.gstAmount) || 0), view: () => nav("/expense"), ok: () => approveExpense(x), no2: () => rejectExpense(x) })),
          ]} />

          {/* KPI grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 16 }} data-testid="gm-kpi-grid">
            <KpiCard testid="kpi-vendors"  icon={Users}         label="Vendors"          tone="#0369a1" pending={stats.vendorPending.length}    approved={stats.vendorApproved.length}   total={vendors.length}   onOpen={() => nav("/vendor")} />
            <KpiCard testid="kpi-boqs"     icon={ClipboardList} label="BOQs"             tone="#0ea5e9" pending={stats.boqsPending.length}      approved={stats.boqsApproved.length}     total={boqs.length}      onOpen={() => nav("/purchase")} />
            <KpiCard testid="kpi-wos"      icon={FileText}      label="Work Orders"      tone="#15803d" pending={stats.wosPending.length}       approved={stats.wosApproved.length}      total={wos.length}       onOpen={() => nav("/purchase")} />
            <KpiCard testid="kpi-bills"    icon={Receipt}       label="Bills"            tone="#16a34a" pending={stats.billsPending.length}     approved={stats.billsApproved.length}    total={bills.length}     onOpen={() => nav("/bill")} />
            <KpiCard testid="kpi-expenses" icon={Wallet}        label="Expenses"         tone="#f59e0b" pending={stats.expensesPending.length}  approved={stats.expensesApproved.length} total={expenses.length}  onOpen={() => nav("/expense")} />
            <KpiCard testid="kpi-vouchers" icon={CreditCard}    label="Payment Vouchers" tone="#7c3aed" pending={stats.vouchersPending.length}  approved={stats.vouchersApproved.length} total={payments.length}  onOpen={() => nav("/final")} />
            <KpiCard testid="kpi-hr-emps"  icon={UserCheck}     label="HR · Employees"   tone="#c026d3" pending={stats.empsPending.length}      approved={stats.empsApproved.length}     total={employees.length} onOpen={() => nav("/hr")} />
            <KpiCard testid="kpi-hr-leaves" icon={Calendar}     label="HR · Leaves"      tone="#f59e0b" pending={stats.leavesPending.length}    approved={stats.leavesApproved.length}   total={leaves.length}    onOpen={() => nav("/hr")} />
            <KpiCard testid="kpi-hr-recruits" icon={Briefcase}  label="HR · Recruitment" tone="#16a34a" pending={stats.recruitsPending.length}  approved={stats.recruitsApproved.length} total={recruits.length}  onOpen={() => nav("/hr")} />
            <KpiCard testid="kpi-hr-exits"  icon={LogOut}       label="HR · Exit & F&F"  tone="#991b1b" pending={stats.exitsPending.length}     approved={stats.exitsApproved.length}    total={exits.length}     onOpen={() => nav("/hr")} />
            <KpiCard testid="kpi-hr-paybills" icon={Banknote}   label="HR · Pay Bills"   tone="#be185d" pending={stats.payBillsPending.length}  approved={stats.payBillsApproved.length} total={payBills.length}  onOpen={() => nav("/hr")} />
            {crm && [
              ["leads", "CRM · Leads", TrendingUp, "#0891b2"],
              ["clients", "CRM · Clients", Handshake, "#1e3a8a"],
              ["mb", "CRM · Measurement Book", ClipboardList, "#0f766e"],
              ["ra", "CRM · RA Bills", Receipt, "#1d4ed8"],
              ["co", "CRM · Change Orders", FileText, "#4338ca"],
            ].map(([k, label, Icon, tone]) => (
              <KpiCard key={k} testid={`kpi-crm-${k}`} icon={Icon} label={label} tone={tone} pending={crm[k].pending} approved={crm[k].approved} total={crm[k].total} onOpen={() => nav("/client-revenue")} />
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 12 }}>
            {/* Vendor Code Doctor — SuperAdmin only, fixes legacy collisions */}
            {isSuperAdmin(currentUserEmail()) && (
              <button
                data-testid="vendor-code-doctor"
                onClick={() => {
                  if (!window.confirm("Vendor Code Doctor चलाना है?\n\n• Duplicate vendorCode wale records detect karega\n• Har group ka OLDEST record keep karega\n• Baaki ke codes strip karke Step-2 par bhej dega (re-approval par fresh code milega)\n• Counter ko max used + 1 par realign karega\n\nSafe hai — koi record delete nahi hoga, sirf duplicate codes clean honge.")) return;
                  const r = fixVendorCodeCollisions();
                  bump();
                  if (r.collisions === 0 && !r.counterFixed) {
                    toast.success("✓ Sab clean hai — koi duplicate vendor code nahi mila aur counter already correct hai");
                  } else {
                    const msgLines = [];
                    if (r.collisions > 0) msgLines.push(`${r.collisions} collision group(s) · ${r.stripped.length} record(s) ko Step-2 par wapas bhej diya`);
                    if (r.counterFixed) msgLines.push(`Counter realigned: ${r.counterBefore} → ${r.counterAfter}`);
                    toast.success(msgLines.join(" · "), { duration: 7000 });
                    try { console.table(r.stripped); console.table(r.kept); } catch {}
                  }
                }}
                title="Repair any duplicate vendorCode entries and realign the serial counter"
                style={{ padding: "8px 14px", background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 800, fontSize: 11.5, letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}
              >
                <ShieldCheck size={14} /> Vendor Code Doctor
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
