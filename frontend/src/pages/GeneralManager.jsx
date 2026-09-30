import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import {
  getVendors, getBills, getPayments, getExpenses, getBOQs, getWOs,
  canApprove,
  advanceVendorStep, advanceBillStep, advanceExpenseStep, advanceBOQStep, advanceWOStep,
  reapproveVendor, reapproveBill, reapproveExpense, reapproveBOQ, reapproveVoucher, reapproveWO,
  savePayments,
  currentUserProfile,
} from "../lib/store";

const StatTile = ({ label, value, tone, testid }) => (
  <div data-testid={testid} style={{
    background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${tone}`,
    borderRadius: 6, padding: "10px 14px", minWidth: 140, flex: 1,
  }}>
    <div style={{ fontSize: 11, color: "#64748b", letterSpacing: .4, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{value}</div>
  </div>
);

const InboxSection = ({ title, tone, items, onApprove, onOpen, colLabels, rowRender, testid, actionLabel = "Approve", actionIcon = "check" }) => (
  <div data-testid={testid} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.06)" }}>
    {/* Colored title bar */}
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px",
      background: tone, color: "#fff",
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase" }}>
        {title} ({items.length})
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
      <div style={{ padding: 18, textAlign: "center", color: "#94a3b8", fontSize: 11.5 }}>Nothing here</div>
    ) : (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            {colLabels.map((c, i) => (
              <th key={i} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>{c}</th>
            ))}
            <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#0f172a", borderBottom: "1px solid #e2e8f0", width: 130 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 8).map((it, ri) => (
            <tr key={it.id} style={{ background: ri % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
              {rowRender(it).map((cell, i) => (
                <td key={i} style={{ padding: "8px 12px", color: "#334155" }}>{cell}</td>
              ))}
              <td style={{ padding: "6px 8px", textAlign: "center" }}>
                <button
                  data-testid={`gm-${actionIcon}-${testid}-${it.id}`}
                  onClick={() => onApprove(it)}
                  style={{
                    padding: "5px 14px", background: tone, color: "#fff",
                    border: "none", borderRadius: 20, cursor: "pointer",
                    fontSize: 10.5, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 5,
                    boxShadow: `0 2px 6px ${tone}55`,
                  }}
                >
                  {actionIcon === "check" ? <CheckCircle2 size={12} /> : <RefreshCw size={12} />} {actionLabel}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export default function GeneralManager() {
  const nav = useNavigate();
  const canDo = canApprove();
  const me = currentUserProfile();
  const gmName = (me?.name || me?.user || "").trim();

  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState("pending");
  const bump = () => setTick((t) => t + 1);

  const vendors = getVendors();
  const bills = getBills();
  const payments = getPayments();
  const expenses = getExpenses();
  const boqs = getBOQs();
  const wos = getWOs();

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
    return { vendorPending, vendorApproved, billsPending, billsApproved, vouchersPending, vouchersApproved, expensesPending, expensesApproved, boqsPending, boqsApproved, wosPending, wosApproved };
  }, [vendors, bills, payments, expenses, boqs, wos, tick]);

  const totalPending = stats.vendorPending.length + stats.billsPending.length + stats.vouchersPending.length + stats.expensesPending.length + stats.boqsPending.length + stats.wosPending.length;
  const totalApproved = stats.vendorApproved.length + stats.billsApproved.length + stats.vouchersApproved.length + stats.expensesApproved.length + stats.boqsApproved.length + stats.wosApproved.length;

  const approveVendor = (v) => {
    if (!canDo) return toast.error("Not permitted");
    const next = advanceVendorStep(v);
    toast.success(`Vendor ${next.firmName || next.tempRefId} approved by ${next.approvedByName}`);
    bump();
  };
  const approveBill = (b) => {
    if (!canDo) return toast.error("Not permitted");
    const next = advanceBillStep(b);
    toast.success(`Bill ${next.permanentBillNo || next.refNo} approved by ${next.approverName}`);
    bump();
  };
  const approveVoucher = (p) => {
    if (!canDo) return toast.error("Not permitted");
    const list = getPayments().map((x) => x.id === p.id ? { ...x, status: "Approved", approvedByName: gmName, approvalDate: new Date().toISOString().slice(0, 10) } : x);
    savePayments(list);
    toast.success(`Voucher ${p.pvNo} approved by ${gmName}`);
    bump();
  };
  const approveExpense = (x) => {
    if (!canDo) return toast.error("Not permitted");
    const next = advanceExpenseStep(x);
    toast.success(`Expense ${next.permanentExpenseNo || next.refNo} approved by ${next.approvedByName}`);
    bump();
  };
  const approveBOQ = (b) => {
    if (!canDo) return toast.error("Not permitted");
    const next = advanceBOQStep({ ...b, step: 3 }); // ensure ≥ 3 first
    const done = advanceBOQStep(next);
    toast.success(`BOQ ${done.boqNo} approved by ${done.approvedByName}`);
    bump();
  };
  const approveWO = (w) => {
    if (!canDo) return toast.error("Not permitted");
    // ensure step ≥ 3 first, then advance to 4 to issue permanent woNo + approver name
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

  const DeptGroup = ({ title, tone, children }) => (
    <div style={{ background: "#f8fafc", border: `1px solid #e2e8f0`, borderLeft: `4px solid ${tone}`, borderRadius: 6, padding: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: tone, letterSpacing: .5, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
    </div>
  );

  const pendingInbox = (
    <div style={{ marginTop: 8 }} data-testid="gm-inbox-pending">
      <DeptGroup title="1. Vendor Management" tone="#0369a1">
        <InboxSection testid="inbox-vendors" title="Vendors pending" tone="#0369a1" items={stats.vendorPending} onOpen={() => nav("/vendor")} onApprove={approveVendor} colLabels={["Firm", "Contact", "PAN"]} rowRender={(v) => [v.firmName || v.tempRefId, v.contactPerson || "-", v.panNo || "-"]} />
        <div />
      </DeptGroup>

      <DeptGroup title="2. Purchase Department — BOQ & Work Orders" tone="#0ea5e9">
        <InboxSection testid="inbox-boq" title="BOQ pending" tone="#0ea5e9" items={stats.boqsPending} onOpen={() => nav("/purchase")} onApprove={approveBOQ} colLabels={["BOQ No.", "Project", "Total"]} rowRender={(b) => [b.boqNo, b.projectSite, `₹ ${Number(b.total || 0).toLocaleString("en-IN")}`]} />
        <InboxSection testid="inbox-wo" title="Work Orders pending" tone="#15803d" items={stats.wosPending} onOpen={() => nav("/purchase")} onApprove={approveWO} colLabels={["Ref (BOQ)", "Vendor", "Total"]} rowRender={(w) => [w.boqRefNo || "—", w.vendorName || w.vendorCode || "—", `₹ ${Number(w.total || 0).toLocaleString("en-IN")}`]} />
      </DeptGroup>

      <DeptGroup title="3. Accounts Department — Bills" tone="#16a34a">
        <InboxSection testid="inbox-bills" title="Bills pending" tone="#16a34a" items={stats.billsPending} onOpen={() => nav("/bill")} onApprove={approveBill} colLabels={["Bill Ref", "Vendor", "Amount"]} rowRender={(b) => [b.refNo || b.permanentBillNo, b.vendorSnapshot?.firmName || b.vendorCode, `₹ ${Number(b.basicAmount || 0).toLocaleString("en-IN")}`]} />
        <div />
      </DeptGroup>

      <DeptGroup title="4. Expenses Department" tone="#f59e0b">
        <InboxSection testid="inbox-expenses" title="Expenses pending" tone="#f59e0b" items={stats.expensesPending} onOpen={() => nav("/expense")} onApprove={approveExpense} colLabels={["Ref No.", "Paid To", "Amount"]} rowRender={(x) => [x.refNo || x.permanentExpenseNo, x.paidToName || "-", `₹ ${Number(x.basicAmount || 0).toLocaleString("en-IN")}`]} />
        <div />
      </DeptGroup>

      <DeptGroup title="5. Payment Vouchers" tone="#7c3aed">
        <InboxSection testid="inbox-vouchers" title="Payment Vouchers pending" tone="#7c3aed" items={stats.vouchersPending} onOpen={() => nav("/final")} onApprove={approveVoucher} colLabels={["PV No.", "Vendor", "Amount"]} rowRender={(p) => [p.pvNo, p.vendorSnapshot?.firmName || p.vendorCode, `₹ ${Number(p.amount || 0).toLocaleString("en-IN")}`]} />
        <div />
      </DeptGroup>
    </div>
  );

  const approvedInbox = (
    <div style={{ marginTop: 8 }} data-testid="gm-inbox-approved">
      <DeptGroup title="1. Vendor Management" tone="#0369a1">
        <InboxSection testid="reap-vendors" title="Vendors approved" tone="#0369a1" items={stats.vendorApproved} onOpen={() => nav("/vendor")} onApprove={doReapproveVendor} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["Vendor Code", "Firm", "Approved By"]} rowRender={(v) => [v.vendorCode, v.firmName, v.approvedByName || "-"]} />
        <div />
      </DeptGroup>

      <DeptGroup title="2. Purchase Department — BOQ & Work Orders" tone="#0ea5e9">
        <InboxSection testid="reap-boq" title="BOQ approved" tone="#0ea5e9" items={stats.boqsApproved} onOpen={() => nav("/purchase")} onApprove={doReapproveBOQ} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["BOQ No.", "Approved By", "Date"]} rowRender={(b) => [b.boqNo, b.approvedByName || "-", b.approvalDate || "-"]} />
        <InboxSection testid="reap-wo" title="Work Orders approved" tone="#15803d" items={stats.wosApproved} onOpen={() => nav("/purchase")} onApprove={doReapproveWO} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["WO No.", "Vendor", "Approved By"]} rowRender={(w) => [w.woNo || "—", w.vendorName || w.vendorCode || "—", w.approvedByName || "-"]} />
      </DeptGroup>

      <DeptGroup title="3. Accounts Department — Bills" tone="#16a34a">
        <InboxSection testid="reap-bills" title="Bills approved" tone="#16a34a" items={stats.billsApproved} onOpen={() => nav("/bill")} onApprove={doReapproveBill} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["Bill No.", "Vendor", "Approved By"]} rowRender={(b) => [b.permanentBillNo || b.refNo, b.vendorSnapshot?.firmName || b.vendorCode, b.approverName || "-"]} />
        <div />
      </DeptGroup>

      <DeptGroup title="4. Expenses Department" tone="#f59e0b">
        <InboxSection testid="reap-expenses" title="Expenses approved" tone="#f59e0b" items={stats.expensesApproved} onOpen={() => nav("/expense")} onApprove={doReapproveExpense} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["Ref No.", "Paid To", "Approved By"]} rowRender={(x) => [x.permanentExpenseNo || x.refNo, x.paidToName || "-", x.approvedByName || "-"]} />
        <div />
      </DeptGroup>

      <DeptGroup title="5. Payment Vouchers" tone="#7c3aed">
        <InboxSection testid="reap-vouchers" title="Payment Vouchers approved" tone="#7c3aed" items={stats.vouchersApproved} onOpen={() => nav("/final")} onApprove={doReapproveVoucher} actionLabel="Re-Approve" actionIcon="refresh" colLabels={["PV No.", "Amount", "Approved By"]} rowRender={(p) => [p.pvNo, `₹ ${Number(p.amount || 0).toLocaleString("en-IN")}`, p.approvedByName || "-"]} />
        <div />
      </DeptGroup>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <div className="a4" data-testid="gm-page">
          <Header formTitle="GENERAL MANAGER · CONSOLIDATED DASHBOARD" />

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }} data-testid="gm-stat-row">
            <StatTile testid="stat-total-pending" label="Total Pending" value={totalPending} tone="#ea580c" />
            <StatTile testid="stat-total-approved" label="Total Approved" value={totalApproved} tone="#16a34a" />
            <StatTile testid="stat-boqs" label="BOQs" value={`${stats.boqsApproved.length} / ${boqs.length}`} tone="#0ea5e9" />
            <StatTile testid="stat-wos" label="Work Orders" value={`${stats.wosApproved.length} / ${wos.length}`} tone="#15803d" />
            <StatTile testid="stat-vendors" label="Vendors" value={`${stats.vendorApproved.length} / ${vendors.length}`} tone="#0369a1" />
            <StatTile testid="stat-bills" label="Bills" value={`${stats.billsApproved.length} / ${bills.length}`} tone="#16a34a" />
            <StatTile testid="stat-vouchers" label="Vouchers" value={`${stats.vouchersApproved.length} / ${payments.length}`} tone="#7c3aed" />
            <StatTile testid="stat-expenses" label="Expenses" value={`${stats.expensesApproved.length} / ${expenses.length}`} tone="#f59e0b" />
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 6, borderBottom: "2px solid #e2e8f0" }} data-testid="gm-tabs">
            {[
              { id: "pending", label: `⏳ Pending Approval (${totalPending})`, tone: "#ea580c" },
              { id: "approved", label: `✓ Approved — Re-Approve (${totalApproved})`, tone: "#16a34a" },
            ].map((t) => (
              <button
                key={t.id}
                data-testid={`gm-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "8px 16px",
                  background: tab === t.id ? t.tone : "transparent",
                  color: tab === t.id ? "#fff" : "#334155",
                  border: "none",
                  borderRadius: "6px 6px 0 0",
                  cursor: "pointer",
                  fontWeight: 700, fontSize: 12,
                  letterSpacing: .3,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12.5, color: "#334155" }}>
            {tab === "pending" ? "Approve karne pe aapka naam auto-fill ho jayega." : "Re-Approve karne pe existing approver ka naam replace ho ke aapka naam save ho jayega + date bump hogi."}
          </div>
          {tab === "pending" ? pendingInbox : approvedInbox}
        </div>
      </div>
    </>
  );
}
