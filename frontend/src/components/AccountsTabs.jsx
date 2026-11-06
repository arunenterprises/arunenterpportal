import React from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Wallet, IndianRupee, Utensils, LogOut, FileCheck2, ListTree, NotebookPen, HandCoins, Percent, Landmark, BarChart3 } from "lucide-react";
import { can } from "../lib/acl";

const TABS = [
  { id: "vendor", label: "Vendor Bill Process", tone: "#065f46", icon: Receipt },
  { id: "expense", label: "Expenses", tone: "#065f46", icon: Wallet },
  { id: "advance", label: "Advance Reg.", tone: "#065f46", icon: Wallet },
  { id: "paybill", label: "Pay Bills Process", tone: "#065f46", icon: IndianRupee },
  { id: "fooding", label: "Weekly Fooding", tone: "#065f46", icon: Utensils },
  { id: "exit", label: "Exit & F&F", tone: "#065f46", icon: LogOut },
  { id: "vouchers", label: "Payment Vouchers", tone: "#065f46", icon: FileCheck2 },
];
// Accounting & Ledger (double entry) — part of Finance Management
const ACC_TABS = [
  { id: "acc-coa", label: "Chart of Accounts", tone: "#0f766e", icon: ListTree },
  { id: "acc-jv", label: "Journal Entry", tone: "#0f766e", icon: NotebookPen },
  { id: "acc-sales", label: "Sales & Receivables", tone: "#0f766e", icon: HandCoins },
  { id: "acc-tax", label: "GST / TDS", tone: "#0f766e", icon: Percent },
  { id: "acc-bank", label: "Banking & BRS", tone: "#0f766e", icon: Landmark },
  { id: "acc-reports", label: "Financial Reports", tone: "#0f766e", icon: BarChart3 },
];

// Shared Accounts department tab bar (same on /bill and /expense so the heading stays fixed).
export const AccountsTabs = ({ active, onSelect }) => {
  const nav = useNavigate();
  const go = (id) => {
    if (id === "vouchers") { nav("/final"); return; }
    if (onSelect) { onSelect(id); return; }
    nav(id === "vendor" ? "/bill" : `/bill?view=${id}`);
  };
  const Row = ({ list, testid, title }) => (
    <div style={{ display: "flex", gap: 6, borderBottom: "2px solid #e2e8f0", marginTop: 8, flexWrap: "wrap", alignItems: "center" }} data-testid={testid}>
      {title && <span style={{ fontSize: 10.5, fontWeight: 900, color: "#0f766e", letterSpacing: .5, padding: "0 6px" }}>{title}</span>}
      {list.map((t) => {
        const Icon = t.icon; const on = active === t.id;
        return (
          <button key={t.id} data-testid={`accounts-tab-${t.id}`} onClick={() => go(t.id)}
            style={{ padding: "8px 16px", background: on ? t.tone : "transparent", color: on ? "#fff" : "#334155", border: "none", borderRadius: "6px 6px 0 0", cursor: "pointer", fontWeight: 700, fontSize: 12, letterSpacing: .3, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon size={13} /> {t.label}
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      <Row list={TABS} testid="accounts-view-tabs" />
      {can("accounting", "v") && <Row list={ACC_TABS} testid="accounting-view-tabs" title="ACCOUNTING & LEDGER" />}
    </>
  );
};

export default AccountsTabs;
