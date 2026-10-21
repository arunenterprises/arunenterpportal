import React, { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Btn, Table, uid, crmNextNo } from "./crmShared";

const blank = () => ({ id: "", clientCode: "", name: "", contactPerson: "", mobile: "", email: "", address: "", gst: "", pan: "" });

export const Clients = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const onSave = async () => {
    if (!f.name.trim()) return alert("Client name zaroori hai");
    const rec = { ...f, id: f.id || uid("cl"), clientCode: f.clientCode || await crmNextNo("client", "CL/") };
    const out = await save("clients", rec, `Client ${rec.clientCode} saved`);
    if (out) setF(out);
  };
  return (
    <>
      <Card testid="client-form" title={f.id ? `Edit Client · ${f.clientCode}` : "New Client"} right={<Btn tone="ghost" data-testid="client-new-btn" onClick={() => setF(blank())}><Plus size={14} /> New</Btn>}>
        <Grid cols={4}>
          <Field label="Client / Firm Name *"><Inp data-testid="client-name" value={f.name} onChange={set("name")} /></Field>
          <Field label="Contact Person"><Inp data-testid="client-contact" value={f.contactPerson} onChange={set("contactPerson")} /></Field>
          <Field label="Mobile"><Inp data-testid="client-mobile" value={f.mobile} onChange={set("mobile")} /></Field>
          <Field label="Email"><Inp data-testid="client-email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Address" span={2}><Inp data-testid="client-address" value={f.address} onChange={set("address")} /></Field>
          <Field label="GSTIN"><Inp data-testid="client-gst" value={f.gst} onChange={set("gst")} /></Field>
          <Field label="PAN"><Inp data-testid="client-pan" value={f.pan} onChange={set("pan")} /></Field>
        </Grid>
        <div style={{ marginTop: 12 }}><Btn data-testid="client-save-btn" onClick={onSave}><Save size={14} /> Save Client</Btn></div>
      </Card>
      <Card title={`Client Master (${data.clients.length})`}>
        <Table testid="clients-table" cols={["Code", "Name", "Contact", "Mobile", "GSTIN", "Contracts", "Actions"]}
          rows={data.clients.map((c) => [c.clientCode, c.name, c.contactPerson || "—", c.mobile || "—", c.gst || "—",
            data.contracts.filter((k) => k.clientId === c.id).length,
            <div style={{ display: "flex", gap: 6 }}>
              <Btn tone="ghost" data-testid={`client-edit-${c.id}`} onClick={() => setF({ ...blank(), ...c })}>Edit</Btn>
              {canDelete() && <Btn tone="red" data-testid={`client-del-${c.id}`} onClick={() => remove("clients", c.id)}><Trash2 size={13} /></Btn>}
            </div>])} />
      </Card>
    </>
  );
};
