import React, { useState } from "react";
import { Save, Paperclip, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, uid, today, nameOf } from "./crmShared";

const TYPES = ["Agreement", "Approval", "Email", "Message", "Meeting", "Other"];
const blank = () => ({ id: "", clientId: "", date: today(), type: "Agreement", subject: "", notes: "", fileName: "", fileData: "" });

export const Comms = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const [filter, setFilter] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("File 500 KB se chhoti honi chahiye"); return; }
    const r = new FileReader();
    r.onload = () => setF((x) => ({ ...x, fileName: file.name, fileData: r.result }));
    r.readAsDataURL(file);
  };
  const onSave = async () => {
    if (!f.clientId || !f.subject.trim()) return alert("Client aur Subject zaroori hai");
    const out = await save("comms", { ...f, id: f.id || uid("cm") }, "Communication saved");
    if (out) setF(blank());
  };
  const list = data.comms.filter((c) => !filter || c.clientId === filter).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const clientOpts = [{ v: "", l: "— Select client —" }, ...data.clients.map((c) => ({ v: c.id, l: `${c.clientCode} · ${c.name}` }))];
  return (
    <>
      <Card testid="comm-form" title="Agreement / Approval / Email / Message Record">
        <Grid cols={4}>
          <Field label="Client *"><Sel data-testid="comm-client" value={f.clientId} onChange={set("clientId")} options={clientOpts} /></Field>
          <Field label="Date"><Inp data-testid="comm-date" type="date" value={f.date} onChange={set("date")} /></Field>
          <Field label="Type"><Sel data-testid="comm-type" value={f.type} onChange={set("type")} options={TYPES} /></Field>
          <Field label="Subject *"><Inp data-testid="comm-subject" value={f.subject} onChange={set("subject")} /></Field>
          <Field label="Details / Notes" span={3}><Inp data-testid="comm-notes" value={f.notes} onChange={set("notes")} /></Field>
          <Field label="Attachment (≤500 KB)">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <Paperclip size={14} /> {f.fileName || "Choose file"}
              <input data-testid="comm-file" type="file" style={{ display: "none" }} onChange={onFile} />
            </label>
          </Field>
        </Grid>
        <div style={{ marginTop: 12 }}><Btn data-testid="comm-save-btn" onClick={onSave}><Save size={14} /> Save Record</Btn></div>
      </Card>
      <Card title="Communication Timeline" right={<Sel data-testid="comm-filter" value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ v: "", l: "All clients" }, ...clientOpts.slice(1)]} style={{ width: 220 }} />}>
        <Table testid="comms-table" cols={["Date", "Client", "Type", "Subject", "Notes", "File", ""]}
          rows={list.map((c) => [c.date, nameOf(data.clients, c.clientId), <Badge text={c.type} tone="blue" />, c.subject, c.notes || "—",
            c.fileData ? <a data-testid={`comm-dl-${c.id}`} href={c.fileData} download={c.fileName}><Download size={14} /></a> : "—",
            canDelete() ? <Btn tone="red" data-testid={`comm-del-${c.id}`} onClick={() => remove("comms", c.id)}><Trash2 size={13} /></Btn> : null])} />
      </Card>
    </>
  );
};
