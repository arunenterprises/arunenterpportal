import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Briefcase, ArrowRight, CheckCircle2 } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import {
  getVendors, getBills, getPayments, getExpenses, getBOQs,
  currentRole, canApprove,
  advanceVendorStep, advanceBillStep, advanceExpenseStep, advanceBOQStep,
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

const InboxSection = ({ title, tone, items, onApprove, onOpen, colLabels, rowRender, testid }) => (
  <div data-testid={testid} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: tone, fontWeight: 800, letterSpacing: .3, textTransform: "uppercase" }}>{title} ({items.length})</div>
      <button onClick={onOpen} style={{ padding: "4px 10px", background: tone, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
        Open module <ArrowRight size={11} />
      </button>
    </div>
    {items.length === 0 ? (
      <div style={{ padding: 12, textAlign: "center", color: "#94a3b8", fontSize: 11.5 }}>Nothing pending</div>
    ) : (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {colLabels.map((c, i) => <th key={i} style={{ padding: 5, textAlign: "left", border: "1px solid #e2e8f0" }}>{c}</th>)}
            <th style={{ padding: 5, border: "1px solid #e2e8f0", width: 100 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 5).map((it) => (
            <tr key={it.id}>
              {rowRender(it).map((cell, i) => <td key={i} style={{ padding: 5, border: "1px solid #e2e8f0" }}>{cell}</td>)}
              <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "center" }}>
                <button
                  data-testid={`gm-approve-${testid}-${it.id}`}
                  onClick={() => onApprove(it)}
                  style={{ padding: "3px 8px", background: tone, color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}
                >
                  <CheckCircle2 size={11} /> Approve
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
  const role = currentRole();
  const canDo = canApprove();
  const me = currentUserProfile();
  const gmName = (me?.name || me?.user || "").trim();

  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const vendors = getVendors();
  const bills = getBills();
  const payments = getPayments();
  const expenses = getExpenses();
  const boqs = getBOQs();

  const stats = useMemo(() => {
    const vendorPending = vendors.filter((v) => v.step === 2);
    const vendorApproved = vendors.filter((v) => v.step === 3).length;
    const billsPending = bills.filter((b) => Number(b.step) === 4);
    const billsApproved = bills.filter((b) => Number(b.step) === 5).length;
    const vouchersPending = payments.filter((p) => p.status === "Submitted");
    const vouchersApproved = payments.filter((p) => p.status === "Approved").length;
    const expensesPending = expenses.filter((x) => Number(x.step) === 3);
    const expensesApproved = expenses.filter((x) => Number(x.step) === 4).length;
    const boqsPending = boqs.filter((b) => Number(b.step) === 3);
    const boqsApproved = boqs.filter((b) => Number(b.step) === 4).length;
    return { vendorPending, vendorApproved, billsPending, billsApproved, vouchersPending, vouchersApproved, expensesPending, expensesApproved, boqsPending, boqsApproved };
  }, [vendors, bills, payments, expenses, boqs, tick]);

  const totalPending = stats.vendorPending.length + stats.billsPending.length + stats.vouchersPending.length + stats.expensesPending.length + stats.boqsPending.length;
  const totalApproved = stats.vendorApproved + stats.billsApproved + stats.vouchersApproved + stats.expensesApproved + stats.boqsApproved;

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

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <div className="a4" data-testid="gm-page">
          <Header formTitle="GENERAL MANAGER · CONSOLIDATED DASHBOARD" />

          <div style={{ marginTop: 10, padding: "10px 14px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }} data-testid="gm-role-note">
            <Briefcase size={14} />
            <span>Signed in as <b>{role} — {gmName || "unknown"}</b> · {canDo ? "Aap Approve / Re-Approve kar sakte hain, aapka naam Approved-By box me auto-fill hoga." : "Aap sirf view kar sakte hain (Admin/SuperAdmin only can approve)."}</span>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }} data-testid="gm-stat-row">
            <StatTile testid="stat-total-pending" label="Total Pending" value={totalPending} tone="#ea580c" />
            <StatTile testid="stat-total-approved" label="Total Approved" value={totalApproved} tone="#16a34a" />
            <StatTile testid="stat-boqs" label="BOQs" value={`${stats.boqsApproved} / ${boqs.length}`} tone="#0ea5e9" />
            <StatTile testid="stat-vendors" label="Vendors" value={`${stats.vendorApproved} / ${vendors.length}`} tone="#0369a1" />
            <StatTile testid="stat-bills" label="Bills" value={`${stats.billsApproved} / ${bills.length}`} tone="#16a34a" />
            <StatTile testid="stat-vouchers" label="Vouchers" value={`${stats.vouchersApproved} / ${payments.length}`} tone="#7c3aed" />
            <StatTile testid="stat-expenses" label="Expenses" value={`${stats.expensesApproved} / ${expenses.length}`} tone="#f59e0b" />
          </div>

          <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: .3 }}>
            Approval Inbox — Approve karne pe aapka naam ({gmName}) is item ke "Approved By" box me fill ho jayega
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} data-testid="gm-inbox">
            <InboxSection
              testid="inbox-boq"
              title="BOQ pending"
              tone="#0ea5e9"
              items={stats.boqsPending}
              onOpen={() => nav("/purchase")}
              onApprove={approveBOQ}
              colLabels={["BOQ No.", "Project", "Total"]}
              rowRender={(b) => [b.boqNo, b.projectSite, `₹ ${Number(b.total || 0).toLocaleString("en-IN")}`]}
            />
            <InboxSection
              testid="inbox-vendors"
              title="Vendors pending"
              tone="#0369a1"
              items={stats.vendorPending}
              onOpen={() => nav("/vendor")}
              onApprove={approveVendor}
              colLabels={["Firm", "Contact", "PAN"]}
              rowRender={(v) => [v.firmName || v.tempRefId, v.contactPerson || "-", v.panNo || "-"]}
            />
            <InboxSection
              testid="inbox-bills"
              title="Bills pending"
              tone="#16a34a"
              items={stats.billsPending}
              onOpen={() => nav("/bill")}
              onApprove={approveBill}
              colLabels={["Bill Ref", "Vendor", "Amount"]}
              rowRender={(b) => [b.refNo || b.permanentBillNo, b.vendorSnapshot?.firmName || b.vendorCode, `₹ ${Number(b.basicAmount || 0).toLocaleString("en-IN")}`]}
            />
            <InboxSection
              testid="inbox-vouchers"
              title="Payment Vouchers pending"
              tone="#7c3aed"
              items={stats.vouchersPending}
              onOpen={() => nav("/final")}
              onApprove={approveVoucher}
              colLabels={["PV No.", "Vendor", "Amount"]}
              rowRender={(p) => [p.pvNo, p.vendorSnapshot?.firmName || p.vendorCode, `₹ ${Number(p.amount || 0).toLocaleString("en-IN")}`]}
            />
            <InboxSection
              testid="inbox-expenses"
              title="Expenses pending"
              tone="#f59e0b"
              items={stats.expensesPending}
              onOpen={() => nav("/expense")}
              onApprove={approveExpense}
              colLabels={["Ref No.", "Paid To", "Amount"]}
              rowRender={(x) => [x.refNo || x.permanentExpenseNo, x.paidToName || "-", `₹ ${Number(x.basicAmount || 0).toLocaleString("en-IN")}`]}
            />
          </div>
        </div>
      </div>
    </>
  );
}
