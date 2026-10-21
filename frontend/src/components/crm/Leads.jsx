import React, { useState } from "react";
import { Plus, Save, UserPlus, Trash2 } from "lucide-react";
import { canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, uid, today, inr, crmNextNo } from "./crmShared";

const STATUSES = ["New", "Contacted", "Quotation", "Won", "Lost"];
const SOURCES = ["Reference", "Walk-in", "Phone", "Website", "Tender", "Other"];
const blank = () => ({ id: "", leadNo: "", name: "", mobile: "", email: "", projectType: "", source: "Reference", value: 0, status: "New", notes: "", followUps: [] });
const tone = (s) => ({ New: "slate", Contacted: "amber", Quotation: "blue", Won: "green", Lost: "red" }[s]);

export const Leads = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const [fu, setFu] = useState({ date: today(), note: "", nextDate: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const onSave = async () => {
    if (!f.name.trim() || !f.mobile.trim()) return alert("Client name aur mobile zaroori hai");
    const rec = { ...f, id: f.id || uid("ld"), leadNo: f.leadNo || await crmNextNo("lead", "LD/") };
    const out = await save("leads", rec, `Lead ${rec.leadNo} saved`);
    if (out) setF(out);
  };
  const addFollowUp = () => {
    if (!fu.note.trim()) return;
    setF({ ...f, followUps: [...(f.followUps || []), { ...fu, id: uid("fu") }] });
    setFu({ date: today(), note: "", nextDate: "" });
  };
  const convert = async (l) => {
    if (l.clientId) return alert("Already converted");
    const client = { id: uid("cl"), clientCode: await crmNextNo("client", "CL/"), name: l.name, contactPerson: l.name, mobile: l.mobile, email: l.email, address: "", gst: "", pan: "", fromLead: l.leadNo };
    const c = await save("clients", client, `Client ${client.clientCode} created`);
    if (c) await save("leads", { ...l, status: "Won", clientId: c.id }, null);
  };

  return (
    <>
      <Card testid="lead-form" title={f.id ? `Edit Lead · ${f.leadNo}` : "New Lead / Enquiry"} right={<Btn tone="ghost" data-testid="lead-new-btn" onClick={() => setF(blank())}><Plus size={14} /> New</Btn>}>
        <Grid cols={4}>
          <Field label="Client Name *"><Inp data-testid="lead-name" value={f.name} onChange={set("name")} /></Field>
          <Field label="Mobile *"><Inp data-testid="lead-mobile" value={f.mobile} onChange={set("mobile")} /></Field>
          <Field label="Email"><Inp data-testid="lead-email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Project Type"><Inp data-testid="lead-project-type" value={f.projectType} onChange={set("projectType")} placeholder="Building / Road / Interior" /></Field>
          <Field label="Source"><Sel data-testid="lead-source" value={f.source} onChange={set("source")} options={SOURCES} /></Field>
          <Field label="Est. Value (₹)"><Inp data-testid="lead-value" type="number" value={f.value} onChange={set("value")} /></Field>
          <Field label="Status"><Sel data-testid="lead-status" value={f.status} onChange={set("status")} options={STATUSES} /></Field>
          <Field label="Notes"><Inp data-testid="lead-notes" value={f.notes} onChange={set("notes")} /></Field>
        </Grid>
        <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8 }}>FOLLOW-UP / MEETINGS</div>
          <Grid cols={4}>
            <Field label="Date"><Inp data-testid="fu-date" type="date" value={fu.date} onChange={(e) => setFu({ ...fu, date: e.target.value })} /></Field>
            <Field label="Discussion" span={2}><Inp data-testid="fu-note" value={fu.note} onChange={(e) => setFu({ ...fu, note: e.target.value })} /></Field>
            <Field label="Next Follow-up"><Inp data-testid="fu-next" type="date" value={fu.nextDate} onChange={(e) => setFu({ ...fu, nextDate: e.target.value })} /></Field>
          </Grid>
          <Btn tone="ghost" data-testid="fu-add-btn" style={{ marginTop: 8 }} onClick={addFollowUp}><Plus size={13} /> Add Follow-up</Btn>
          {(f.followUps || []).map((x) => (
            <div key={x.id} style={{ fontSize: 12, marginTop: 6 }}>• <b>{x.date}</b> — {x.note} {x.nextDate && <span style={{ color: "#0891b2" }}>(next: {x.nextDate})</span>}</div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}><Btn data-testid="lead-save-btn" onClick={onSave}><Save size={14} /> Save Lead</Btn></div>
      </Card>
      <Card title={`Leads (${data.leads.length})`}>
        <Table testid="leads-table" cols={["Lead No", "Client", "Mobile", "Type", "Value", "Next Follow-up", "Status", "Actions"]}
          rows={data.leads.slice().reverse().map((l) => {
            const next = (l.followUps || []).map((x) => x.nextDate).filter(Boolean).sort().pop() || "—";
            return [l.leadNo, l.name, l.mobile, l.projectType || "—", inr(l.value), next, <Badge text={l.status} tone={tone(l.status)} />,
              <div style={{ display: "flex", gap: 6 }}>
                <Btn tone="ghost" data-testid={`lead-edit-${l.id}`} onClick={() => setF({ ...blank(), ...l })}>Edit</Btn>
                {!l.clientId && l.status !== "Lost" && <Btn tone="green" data-testid={`lead-convert-${l.id}`} onClick={() => convert(l)}><UserPlus size={13} /> Client</Btn>}
                {canDelete() && <Btn tone="red" data-testid={`lead-del-${l.id}`} onClick={() => remove("leads", l.id)}><Trash2 size={13} /></Btn>}
              </div>];
          })} />
      </Card>
    </>
  );
};
