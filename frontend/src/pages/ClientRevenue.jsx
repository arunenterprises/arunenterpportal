import React, { useState } from "react";
import { Toaster } from "sonner";
import { Handshake, LayoutDashboard, Users, Building2, MessagesSquare, FileSignature, Ruler, Receipt, Flag, ShieldCheck, FilePlus2, BarChart3, ChevronRight, FileText, BookOpen } from "lucide-react";
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
import { InvoiceRegister } from "../components/crm/InvoiceRegister";
import { Milestones } from "../components/crm/Milestones";
import { Retention } from "../components/crm/Retention";
import { ChangeOrders } from "../components/crm/ChangeOrders";
import { CrmReports } from "../components/crm/CrmReports";

const TABS = [
  { k: "dash", l: "Dashboard", icon: LayoutDashboard, C: CrmDashboard, c: "#1e3a8a" },
  { k: "leads", l: "Leads & Enquiry", icon: Users, C: Leads, c: "#0891b2" },
  { k: "clients", l: "Clients Master", icon: Building2, C: Clients, c: "#4f46e5" },
  { k: "comms", l: "Communication", icon: MessagesSquare, C: Comms, c: "#7c3aed" },
  { k: "contracts", l: "Contracts / Rates", icon: FileSignature, C: Contracts, c: "#c026d3" },
  { k: "mb", l: "Measurement Book", icon: Ruler, C: MBook, c: "#db2777" },
  { k: "ra", l: "RA Bills", icon: Receipt, C: RABills, c: "#dc2626" },
  { k: "inv", l: "Tax Invoice", icon: FileText, C: Invoices, c: "#ea580c" },
  { k: "invreg", l: "Invoice Register", icon: BookOpen, C: InvoiceRegister, c: "#d97706" },
  { k: "ms", l: "Milestones", icon: Flag, C: Milestones, c: "#65a30d" },
  { k: "co", l: "Change Orders", icon: FilePlus2, C: ChangeOrders, c: "#16a34a" },
  { k: "ret", l: "Retention", icon: ShieldCheck, C: Retention, c: "#0d9488" },
  { k: "reports", l: "Reports", icon: BarChart3, C: CrmReports, c: "#2563eb" },
];

const flowSteps = (d) => {
  const ra = (s) => d.ra_bills.filter((b) => Number(b.step) === s).length;
  const inv = (s) => d.invoices.filter((b) => Number(b.step) === s).length;
  return [
    { k: "leads", l: "1. Leads", n: d.leads.filter((x) => !["Won", "Lost"].includes(x.status)).length, h: "open" },
    { k: "clients", l: "2. Client", n: d.clients.length, h: "total" },
    { k: "contracts", l: "3. Contracts", n: d.contracts.length, h: "total" },
    { k: "mb", l: "4. MB Entry", n: d.mb.filter((m) => Number(m.step) < 3).length, h: "pending" },
    { k: "ra", l: "5. RA Bills", n: d.ra_bills.length, h: "total", sub: `Draft ${ra(1)} · Approved ${ra(3)}` },
    { k: "inv", l: "6. Invoice", n: d.invoices.length, h: "total", sub: `Draft ${inv(1)} · Sub ${inv(2)} · Appr ${inv(3)} · Sent ${inv(4)} · Paid ${inv(5)} · Cxl ${inv(6)}` },
    { k: "ra", l: "7. GM Approval", n: ra(2) + inv(2) + d.mb.filter((m) => Number(m.step) === 2).length, h: "pending", sub: `RA ${ra(2)} · Invoice ${inv(2)}` },
    { k: "invreg", l: "8. Payment Status", n: ra(3) + ra(4) + inv(3) + inv(4), h: "unpaid", sub: `Paid: RA ${ra(5)} · Invoice ${inv(5)}` },
    { k: "ret", l: "9. Retention Status", n: d.contracts.length, h: "contracts" },
  ];
};

const WorkflowStrip = ({ data, onGo }) => (
  <div data-testid="crm-workflow" className="crm-one-line-flex" style={{ display: "flex", alignItems: "stretch", gap: 3, background: "#fff", border: "1px solid #dbeafe", borderRadius: 12, padding: 8, marginBottom: 12 }}>
    {flowSteps(data).map((s, i, arr) => (
      <React.Fragment key={s.l}>
        <button data-testid={`crm-flow-${i + 1}`} onClick={() => onGo(s.k)} className="crm-tab"
          style={{ flex: "1 1 0", minWidth: 0, overflow: "hidden", border: "none", background: "#eff6ff", borderRadius: 9, padding: "7px 8px", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1e3a8a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.l}</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" }}>{s.n} <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{s.h}</span></div>
          {s.sub && <div data-testid={`crm-flow-sub-${i + 1}`} title={s.sub} style={{ fontSize: 9, color: "#475569", fontWeight: 600, lineHeight: 1.25, whiteSpace: "normal", wordBreak: "break-word" }}>{s.sub}</div>}
        </button>
        {i < arr.length - 1 && <ChevronRight size={12} color="#93c5fd" style={{ alignSelf: "center", flexShrink: 0 }} />}
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
        <div data-testid="crm-tabs" className="crm-one-line-flex" style={{ display: "flex", gap: 4, marginBottom: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 5 }}>
          {TABS.map((t) => (
            <button key={t.k} data-testid={`crm-tab-${t.k}`} onClick={() => setTab(t.k)} className="crm-tab"
              style={{ flex: "1 1 0", minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 4px", borderRadius: 7, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer",
                border: `1px solid ${t.c}${tab === t.k ? "" : "55"}`, background: tab === t.k ? t.c : `${t.c}14`, color: tab === t.k ? "#fff" : t.c }}>
              <t.icon size={12} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={t.l}>{t.l}</span>
            </button>
          ))}
        </div>
        {crm.loading ? <div data-testid="crm-loading" style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading…</div> : <Active {...crm} />}
        {["contracts", "co"].includes(tab) && <HsnFinder />}
      </div>
    </>
  );
}
