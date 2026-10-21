import React from "react";
import { Users, Receipt, Wallet, ShieldCheck, Ruler, FilePlus2, Percent, Landmark } from "lucide-react";
import { Card, Table, Badge, RA_STEPS, stepTone, inr, num, nameOf } from "./crmShared";
import { retentionSummary } from "./Retention";

const Tile = ({ icon: Icon, label, value, sub, testid }) => (
  <div data-testid={testid} className="crm-tile" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#e0f2fe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} /></div>
    <div>
      <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b" }}>{sub}</div>}
    </div>
  </div>
);

export const CrmDashboard = ({ data }) => {
  const month = new Date().toISOString().slice(0, 7);
  const approved = data.ra_bills.filter((b) => Number(b.step) >= 3);
  const monthBilling = approved.filter((b) => String(b.billDate).startsWith(month)).reduce((s, b) => s + num(b.net), 0);
  const receivable = data.ra_bills.filter((b) => [3, 4].includes(Number(b.step))).reduce((s, b) => s + num(b.net), 0);
  const retention = retentionSummary(data).reduce((s, r) => s + r.balance, 0);
  const openLeads = data.leads.filter((l) => !["Won", "Lost"].includes(l.status)).length;
  const pendingMB = data.mb.filter((m) => Number(m.step) === 2).length;
  const pendingCO = data.change_orders.filter((c) => Number(c.step) === 2).length;
  const tdsTotal = approved.reduce((s, b) => s + num(b.tdsAmt), 0);
  const gstPayable = approved.reduce((s, b) => s + num(b.gstTotal), 0);
  const due = data.leads.flatMap((l) => (l.followUps || []).filter((f) => f.nextDate).map((f) => ({ l, f }))).filter((x) => x.f.nextDate <= new Date().toISOString().slice(0, 10) && !["Won", "Lost"].includes(x.l.status));
  return (
    <>
      <div className="crm-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 14 }}>
        <Tile testid="kpi-open-leads" icon={Users} label="Open Leads" value={openLeads} sub={`${due.length} follow-up due`} />
        <Tile testid="kpi-month-billing" icon={Receipt} label="Is Mahine ki Billing" value={inr(monthBilling)} sub="GM approved RA/Milestone" />
        <Tile testid="kpi-receivable" icon={Wallet} label="Baki Receivable" value={inr(receivable)} sub="Approved / sent, payment pending" />
        <Tile testid="kpi-retention" icon={ShieldCheck} label="Retention Held" value={inr(retention)} sub="Client ke paas ruka" />
        <Tile testid="kpi-pending-mb" icon={Ruler} label="MB Approval Pending" value={pendingMB} />
        <Tile testid="kpi-pending-co" icon={FilePlus2} label="Change Orders Pending" value={pendingCO} />
        <Tile testid="kpi-tds" icon={Percent} label="Total TDS Kata" value={inr(tdsTotal)} sub="Client ne kata (approved bills)" />
        <Tile testid="kpi-gst-payable" icon={Landmark} label="GST Payable (Govt.)" value={inr(gstPayable)} sub="Approved bills ka GST" />
      </div>
      <Card title="Bill-wise TDS & GST">
        <Table testid="dash-tax-table" cols={["Bill No", "Client", "Date", "Basic", "TDS %", "TDS Kata", "GST Payable", "Net Payable", "Status"]}
          rows={data.ra_bills.slice().reverse().map((b) => [b.raNo, nameOf(data.clients, b.clientId), b.billDate, inr(b.basic), `${num(b.tdsPct)}%`, inr(b.tdsAmt),
            <b style={{ color: "#b91c1c" }}>{inr(b.gstTotal)}</b>, inr(b.net), <Badge text={RA_STEPS[b.step]} tone={stepTone(b.step)} />])} />
      </Card>
      <Card title="Recent Bills">
        <Table testid="dash-ra-table" cols={["Bill No", "Client", "Date", "Net", "Status"]}
          rows={data.ra_bills.slice(-8).reverse().map((b) => [b.raNo, nameOf(data.clients, b.clientId), b.billDate, inr(b.net), <Badge text={RA_STEPS[b.step]} tone={stepTone(b.step)} />])} />
      </Card>
      <Card title="Follow-ups Due">
        <Table testid="dash-followups-table" empty="Koi follow-up due nahi" cols={["Lead", "Client", "Next Date", "Last Note"]}
          rows={due.map(({ l, f }) => [l.leadNo, l.name, f.nextDate, f.note])} />
      </Card>
    </>
  );
};
