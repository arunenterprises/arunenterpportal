import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Briefcase, ArrowRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import { getVendors, getBills, getPayments, getExpenses, currentRole, canApproveGM } from "../lib/store";

const StatTile = ({ label, value, tone, testid }) => (
  <div
    data-testid={testid}
    style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderLeft: `4px solid ${tone}`,
      borderRadius: 6,
      padding: "10px 14px",
      minWidth: 140,
      flex: 1,
    }}
  >
    <div style={{ fontSize: 11, color: "#64748b", letterSpacing: .4, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{value}</div>
  </div>
);

const InboxCard = ({ title, count, tone, to, onOpen, testid }) => (
  <div
    data-testid={testid}
    style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}
  >
    <div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, letterSpacing: .3, textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone, marginTop: 4 }}>{count}</div>
    </div>
    <button
      onClick={onOpen}
      style={{
        padding: "8px 14px", background: tone, color: "#fff", border: "none",
        borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12,
        display: "inline-flex", alignItems: "center", gap: 6,
      }}
    >
      Review <ArrowRight size={13} />
    </button>
  </div>
);

export default function GeneralManager() {
  const nav = useNavigate();
  const role = currentRole();
  const canApprove = canApproveGM();

  const vendors = getVendors();
  const bills = getBills();
  const payments = getPayments();
  const expenses = getExpenses();

  const stats = useMemo(() => {
    const vendorPendingApproval = vendors.filter((v) => v.step === 2).length;
    const vendorApproved = vendors.filter((v) => v.step === 3).length;
    const billsPendingApproval = bills.filter((b) => Number(b.step) === 4).length;
    const billsApproved = bills.filter((b) => Number(b.step) === 5).length;
    const vouchersPending = payments.filter((p) => p.status === "Submitted").length;
    const vouchersApproved = payments.filter((p) => p.status === "Approved").length;
    const expensesPending = expenses.filter((x) => Number(x.step) === 3).length;
    const expensesApproved = expenses.filter((x) => Number(x.step) === 4).length;
    return {
      vendorPendingApproval, vendorApproved,
      billsPendingApproval, billsApproved,
      vouchersPending, vouchersApproved,
      expensesPending, expensesApproved,
      totalPending: vendorPendingApproval + billsPendingApproval + vouchersPending + expensesPending,
      totalApproved: vendorApproved + billsApproved + vouchersApproved + expensesApproved,
    };
  }, [vendors, bills, payments, expenses]);

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <div className="a4" data-testid="gm-page">
          <Header formTitle="GENERAL MANAGER · CONSOLIDATED DASHBOARD" />

          <div style={{
            marginTop: 10, padding: "10px 14px", background: "#eef2ff",
            border: "1px solid #c7d2fe", borderRadius: 6, display: "flex",
            alignItems: "center", gap: 10, fontSize: 12,
          }} data-testid="gm-role-note">
            <Briefcase size={14} />
            <span>
              Signed in as <b>{role}</b> · GM ke paas <b>{canApprove ? "sabhi departments ki final approval + re-approval" : "sirf view"}</b> ka access hai.
            </span>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }} data-testid="gm-stat-row">
            <StatTile testid="stat-total-pending" label="Total Pending" value={stats.totalPending} tone="#ea580c" />
            <StatTile testid="stat-total-approved" label="Total Approved" value={stats.totalApproved} tone="#16a34a" />
            <StatTile testid="stat-vendors" label="Vendors" value={`${stats.vendorApproved} / ${vendors.length}`} tone="#0ea5e9" />
            <StatTile testid="stat-bills" label="Bills" value={`${stats.billsApproved} / ${bills.length}`} tone="#16a34a" />
            <StatTile testid="stat-vouchers" label="Vouchers" value={`${stats.vouchersApproved} / ${payments.length}`} tone="#7c3aed" />
            <StatTile testid="stat-expenses" label="Expenses" value={`${stats.expensesApproved} / ${expenses.length}`} tone="#f59e0b" />
          </div>

          <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: .3 }}>
            Approval Inbox
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }} data-testid="gm-inbox">
            <InboxCard
              testid="inbox-vendors"
              title="Vendors — pending final approval"
              count={stats.vendorPendingApproval}
              tone="#0ea5e9"
              onOpen={() => nav("/vendor")}
            />
            <InboxCard
              testid="inbox-bills"
              title="Bills — pending final approval"
              count={stats.billsPendingApproval}
              tone="#16a34a"
              onOpen={() => nav("/bill")}
            />
            <InboxCard
              testid="inbox-vouchers"
              title="Payment Vouchers — pending approval"
              count={stats.vouchersPending}
              tone="#7c3aed"
              onOpen={() => nav("/final")}
            />
            <InboxCard
              testid="inbox-expenses"
              title="Expenses — pending approval"
              count={stats.expensesPending}
              tone="#f59e0b"
              onOpen={() => nav("/expense")}
            />
          </div>

          <div style={{
            marginTop: 16, padding: "10px 14px",
            background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 6, fontSize: 11.5, color: "#334155", lineHeight: 1.6,
          }} data-testid="gm-note">
            <b>Note:</b> GM ke paas sabhi departments ke items ka read + approve access hai.
            Purchase Management ne Create + Submit karne ke baad Accounts Department check karta hai,
            aur final Approval / Re-Approval yahaan GM dashboard se hoti hai.
            {" "}
            {!canApprove && <span style={{ color: "#991b1b" }}> Aap logged in role me GM approve nahi kar sakte.</span>}
          </div>
        </div>
      </div>
    </>
  );
}
