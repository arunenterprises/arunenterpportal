import React from "react";
import { Lock } from "lucide-react";
import { useAcc } from "../components/acc/accShared";
import { Coa } from "../components/acc/Coa";
import { Journal } from "../components/acc/Journal";
import { Sales } from "../components/acc/Sales";
import { Tax } from "../components/acc/Tax";
import { Banking } from "../components/acc/Banking";
import { FinReports } from "../components/acc/FinReports";
import { can } from "../lib/acl";

const VIEWS = { "acc-coa": Coa, "acc-jv": Journal, "acc-sales": Sales, "acc-tax": Tax, "acc-bank": Banking, "acc-reports": FinReports };

const Panel = ({ view }) => {
  const acc = useAcc();
  const Active = VIEWS[view] || Coa;
  return acc.loading ? <div data-testid="acc-loading" style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading ledger…</div> : <Active {...acc} />;
};

// Finance Management → Accounting & Ledger views (double-entry, auto-posted from approved vouchers)
export default function AccountingPanel({ view }) {
  if (!can("accounting", "v")) {
    return (
      <div data-testid="acc-locked" style={{ margin: "20px 0", padding: 24, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <Lock size={28} color="#dc2626" />
        <div style={{ fontWeight: 900, marginTop: 6 }}>Accounting & Ledger ki permission nahi hai</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>SuperAdmin, GM, Accounts Manager, Member Financial ya jinhe SuperAdmin permission de.</div>
      </div>
    );
  }
  return <div data-testid="accounting-page" style={{ marginTop: 12 }}><Panel key={view} view={view} /></div>;
}
