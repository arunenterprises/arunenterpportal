import React, { useState } from "react";
import { Toaster } from "sonner";
import { Handshake, LayoutDashboard, Users, Building2, MessagesSquare, FileSignature, Ruler, Receipt, Flag, ShieldCheck, FilePlus2, BarChart3, ChevronRight, FileText } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import HsnFinder from "../components/HsnFinder";
import { useCrmData } from "../components/crm/crmShared";
import { CrmDashboard } from "../components/crm/CrmDashboard";
import { Leads } from "../components/crm/Leads";
import { Clients } from "../components/crm/Clients";
import { Comms } from "../components/crm/Comms";
import { Contracts } from "../components/crm/Contracts";
import { MBook } from "../components/crm/MBook";
import { RABills } from "../components/crm/RABills";
import { Invoices } from "../components/crm/Invoices";
import { Milestones } from "../components/crm/Milestones";
import { Retention } from "../components/crm/Retention";
import { ChangeOrders } from "../components/crm/ChangeOrders";
import { CrmReports } from "../components/crm/CrmReports";

const TABS = [
  { k: "dash", l: "Dashboard", icon: LayoutDashboard, C: CrmDashboard },
  { k: "leads", l: "Leads & Enquiry", icon: Users, C: Leads },
  { k: "clients", l: "Clients Master", icon: Building2, C: Clients },
  { k: "comms", l: "Communication", icon: MessagesSquare, C: Comms },
  { k: "contracts", l: "Contracts / Rates", icon: FileSignature, C: Contracts },
  { k: "mb", l: "Measurement Book", icon: Ruler, C: MBook },
  { k: "ra", l: "RA Bills", icon: Receipt, C: RABills },
  { k: "inv", l: "Client Tax Invoice", icon: FileText, C: Invoices },
  { k: "ms", l: "Milestones", icon: Flag, C: Milestones },
  { k: "co", l: "Change Orders", icon: FilePlus2, C: ChangeOrders },
  { k: "ret", l: "Retention", icon: ShieldCheck, C: Retention },
  { k: "reports", l: "Reports", icon: BarChart3, C: CrmReports },
];

const flowSteps = (d) => {
  const ra = (s) => d.ra_bills.filter((b) => Number(b.step) === s).length;
  const inv = (s) => d.invoices.filter((b) => Number(b.step) === s).length;
  return [
    { k: "leads", l: "1. Lead / Enquiry", n: d.leads.filter((x) => !["Won", "Lost"].includes(x.status)).length, h: "open" },
    { k: "clients", l: "2. Client", n: d.clients.length, h: "total" },
    { k: "contracts", l: "3. Contract & Rates", n: d.contracts.length, h: "total" },
    { k: "mb", l: "4. MB Entry", n: d.mb.filter((m) => Number(m.step) < 3).length, h: "pending" },
    { k: "ra", l: "5. RA Bill Draft", n: ra(1), h: "draft" },
    { k: "ra", l: "6. GM Approval", n: ra(2), h: "pending" },
    { k: "ra", l: "7. Sent to Client", n: ra(3) + ra(4), h: "receivable" },
    { k: "ra", l: "8. Payment Received", n: ra(5), h: "paid" },
    { k: "ret", l: "9. Retention Release", n: d.contracts.length, h: "contracts" },
    { k: "inv", l: "10. Invoice Draft", n: inv(1), h: "draft" },
    { k: "inv", l: "11. Invoice Approval", n: inv(2), h: "pending" },
    { k: "inv", l: "12. Invoice Approved", n: inv(3), h: "approved" },
  ];
};

const WorkflowStrip = ({ data, onGo }) => (
  <div data-testid="crm-workflow" style={{ display: "flex", alignItems: "stretch", gap: 4, overflowX: "auto", background: "#fff", border: "1px solid #dbeafe", borderRadius: 12, padding: 10, marginBottom: 12 }}>
    {flowSteps(data).map((s, i, arr) => (
      <React.Fragment key={s.l}>
        <button data-testid={`crm-flow-${i + 1}`} onClick={() => onGo(s.k)} className="crm-tab"
          style={{ minWidth: 118, border: "none", background: "#eff6ff", borderRadius: 9, padding: "8px 10px", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1e3a8a", whiteSpace: "nowrap" }}>{s.l}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{s.n} <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{s.h}</span></div>
        </button>
        {i < arr.length - 1 && <ChevronRight size={16} color="#93c5fd" style={{ alignSelf: "center", flexShrink: 0 }} />}
      </React.Fragment>
    ))}
  </div>
);

export default function ClientRevenue() {
  const [tab, setTab] = useState("dash");
  const crm = useCrmData();
  const Active = TABS.find((t) => t.k === tab).C;
  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div data-testid="client-revenue-page" style={{ background: "#f1f5f9", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px) 110px" }}>
        <ModuleHero tag="Client & Revenue Management" title="CRM · Measurement Book · RA Billing · Retention" subtitle="Lead se lekar client payment aur retention release tak ka poora workflow"
          icon={Handshake} gradient="linear-gradient(135deg, #0b1f4d 0%, #1e3a8a 55%, #0891b2 100%)" shadowRgba="30,58,138,.28"
          rightSlot={<button data-testid="crm-hero-reports-btn" onClick={() => setTab("reports")} className="crm-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#1e3a8a", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            <BarChart3 size={15} /> Reports</button>} />
        {!crm.loading && <WorkflowStrip data={crm.data} onGo={setTab} />}
        <div data-testid="crm-tabs" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
          {TABS.map((t) => (
            <button key={t.k} data-testid={`crm-tab-${t.k}`} onClick={() => setTab(t.k)} className="crm-tab"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
                border: tab === t.k ? "1px solid #1e3a8a" : "1px solid #e2e8f0", background: tab === t.k ? "#1e3a8a" : "#fff", color: tab === t.k ? "#fff" : "#334155" }}>
              <t.icon size={14} /> {t.l}
            </button>
          ))}
        </div>
        {crm.loading ? <div data-testid="crm-loading" style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading…</div> : <Active {...crm} />}
        {["contracts", "co"].includes(tab) && <HsnFinder />}
      </div>
    </>
  );
}
