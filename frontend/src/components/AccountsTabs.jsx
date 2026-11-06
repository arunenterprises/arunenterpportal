import React from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Wallet, Utensils, LogOut, FileCheck2, ListTree, NotebookPen, HandCoins, Percent, Landmark, Banknote, Coins } from "lucide-react";
import { can } from "../lib/acl";

const TABS = [
  { id: "acc-coa", label: "Chart of Accounts", icon: ListTree, acc: true },
  { id: "acc-jv", label: "Journal Entry", icon: NotebookPen, acc: true },
  { id: "acc-sales", label: "Sales & Receivables", icon: HandCoins, acc: true },
  { id: "vendor", label: "Vendor Bills", icon: Receipt },
  { id: "expense", label: "Expenses", icon: Wallet },
  { id: "advance", label: "Advance Reg.", icon: Coins },
  { id: "fooding", label: "Weekly Fooding", icon: Utensils },
  { id: "paybill", label: "Pay Bills Process", icon: Banknote },
  { id: "exit", label: "Exit & F&F", icon: LogOut },
  { id: "vouchers", label: "Payment Vouchers", icon: FileCheck2 },
  { id: "acc-bank", label: "Banking & BRS", icon: Landmark, acc: true },
  { id: "acc-tax", label: "GST ITC Matching", icon: Percent, acc: true },
];

// Finance Management tab bar — one row; every tab opens inside /bill (no separate page)
export const AccountsTabs = ({ active, onSelect }) => {
  const nav = useNavigate();
  const go = (id) => {
    if (onSelect) { onSelect(id); return; }
    nav(id === "vendor" ? "/bill" : `/bill?view=${id}`);
  };
  const list = TABS.filter((t) => !t.acc || can("accounting", "v"));
  return (
    <div data-testid="accounts-view-tabs" style={{ display: "flex", gap: 4, marginTop: 10, padding: 4, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, flexWrap: "nowrap" }}>
      {list.map((t) => {
        const Icon = t.icon; const on = active === t.id;
        return (
          <button key={t.id} data-testid={`accounts-tab-${t.id}`} onClick={() => go(t.id)}
            style={{ flex: "1 1 0", minWidth: 0, minHeight: 54, padding: "7px 4px", background: on ? "#065f46" : "#fff", color: on ? "#fff" : "#334155", border: `1px solid ${on ? "#065f46" : "#e2e8f0"}`, borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, letterSpacing: .1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, transition: "background-color .15s, color .15s" }}>
            <Icon size={15} /> <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AccountsTabs;
