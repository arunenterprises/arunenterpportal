import React, { useState } from "react";
import { Handshake, LayoutDashboard, Users, Building2, MessagesSquare, FileSignature, Ruler, Receipt, Flag, ShieldCheck, FilePlus2 } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import { useCrmData } from "../components/crm/crmShared";
import { CrmDashboard } from "../components/crm/CrmDashboard";
import { Leads } from "../components/crm/Leads";
import { Clients } from "../components/crm/Clients";
import { Comms } from "../components/crm/Comms";
import { Contracts } from "../components/crm/Contracts";
import { MBook } from "../components/crm/MBook";
import { RABills } from "../components/crm/RABills";
import { Milestones } from "../components/crm/Milestones";
import { Retention } from "../components/crm/Retention";
import { ChangeOrders } from "../components/crm/ChangeOrders";

const TABS = [
  { k: "dash", l: "Dashboard", icon: LayoutDashboard, C: CrmDashboard },
  { k: "leads", l: "Leads & Enquiry", icon: Users, C: Leads },
  { k: "clients", l: "Clients", icon: Building2, C: Clients },
  { k: "comms", l: "Communication", icon: MessagesSquare, C: Comms },
  { k: "contracts", l: "Contracts / Rates", icon: FileSignature, C: Contracts },
  { k: "mb", l: "Measurement Book", icon: Ruler, C: MBook },
  { k: "ra", l: "RA Bills", icon: Receipt, C: RABills },
  { k: "ms", l: "Milestones", icon: Flag, C: Milestones },
  { k: "ret", l: "Retention", icon: ShieldCheck, C: Retention },
  { k: "co", l: "Change Orders", icon: FilePlus2, C: ChangeOrders },
];

export default function ClientRevenue() {
  const [tab, setTab] = useState("dash");
  const crm = useCrmData();
  const Active = TABS.find((t) => t.k === tab).C;
  return (
    <>
      <HomeNavBar />
      <div data-testid="client-revenue-page" style={{ background: "#f8fafc", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px)" }}>
        <ModuleHero tag="Client & Revenue · CRM + RA Billing" title="Leads · Clients · MB · RA Bills · Retention" subtitle="Client se lekar kaam ke paise ki vasooli tak ka poora hisaab ek jagah"
          icon={Handshake} gradient="linear-gradient(135deg, #451a03 0%, #92400e 50%, #d97706 100%)" shadowRgba="146,64,14,.28" />
        <div data-testid="crm-tabs" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
          {TABS.map((t) => (
            <button key={t.k} data-testid={`crm-tab-${t.k}`} onClick={() => setTab(t.k)} className="crm-tab"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
                border: tab === t.k ? "1px solid #92400e" : "1px solid #e2e8f0", background: tab === t.k ? "#92400e" : "#fff", color: tab === t.k ? "#fff" : "#334155" }}>
              <t.icon size={14} /> {t.l}
            </button>
          ))}
        </div>
        {crm.loading ? <div data-testid="crm-loading" style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Loading…</div> : <Active {...crm} />}
      </div>
    </>
  );
}
