import React from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Wallet, IndianRupee, Utensils, LogOut } from "lucide-react";

const TABS = [
  { id: "vendor", label: "Vendor Bill Process", tone: "#0369a1", icon: Receipt },
  { id: "expense", label: "Expenses", tone: "#7c3aed", icon: Wallet },
  { id: "advance", label: "Advance Reg.", tone: "#f59e0b", icon: Wallet },
  { id: "paybill", label: "Pay Bills Process", tone: "#be185d", icon: IndianRupee },
  { id: "fooding", label: "Weekly Fooding", tone: "#15803d", icon: Utensils },
  { id: "exit", label: "Exit & F&F", tone: "#991b1b", icon: LogOut },
];

// Shared Accounts department tab bar (same on /bill and /expense so the heading stays fixed).
export const AccountsTabs = ({ active, onSelect }) => {
  const nav = useNavigate();
  const go = (id) => {
    if (id === "expense") { if (active !== "expense") nav("/expense"); return; }
    if (onSelect) onSelect(id); else nav(`/bill?view=${id}`);
  };
  return (
    <div style={{ display: "flex", gap: 6, borderBottom: "2px solid #e2e8f0", marginTop: 8, flexWrap: "wrap" }} data-testid="accounts-view-tabs">
      {TABS.map((t) => {
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
};

export default AccountsTabs;
