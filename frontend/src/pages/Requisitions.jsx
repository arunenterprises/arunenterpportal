import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ClipboardCheck, Send, CheckCircle2, XCircle, MessagesSquare, Paperclip, Lock, Download } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import { apiReqList, apiReqCreate, apiReqAction, apiReqDiscSetup, apiReqDiscComment, apiReqDiscConclude, apiReqFileUpload, apiReqFileGet } from "../lib/api";
import { currentRole, currentUserEmail } from "../lib/store";
import { MEMBER_DISC, loadCoreConfig } from "../components/ops/opsConfig";

const MANAGERS = ["Sr. Site Operation Manager", "Accounts Manager", "Purchase Manager"];
const ST_C = { Pending: "#0369a1", Discussion: "#b45309", Approved: "#15803d", Rejected: "#dc2626" };
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 };
const inp = { width: "100%", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, boxSizing: "border-box" };
const btn = (c, dis) => ({ padding: "7px 12px", background: dis ? "#cbd5e1" : c, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: dis ? "not-allowed" : "pointer", display: "inline-flex", gap: 5, alignItems: "center" });
const inr = (v) => `\u20b9${Number(v || 0).toLocaleString("en-IN")}`;
const lbl = { fontSize: 11, fontWeight: 700, color: "#334155" };
const Pill = ({ s }) => <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, color: "#fff", background: ST_C[s] || "#64748b" }}>{s}</span>;
const FILE_OK = ["application/pdf", "image/png", "image/jpeg", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

const CreateForm = ({ onDone }) => {
  const [f, setF] = useState({ rtype: "Material", title: "", project: "", discipline: "", amount: "", description: "" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const discs = [...new Set(Object.values(MEMBER_DISC).flat())];
  const amt = Number(f.amount) || 0;
  const submit = async () => {
    if (f.title.trim().length < 3) return toast.error("Title kam se kam 3 akshar");
    if (f.rtype === "Material" && !f.discipline) return toast.error("Discipline chunein");
    if (f.rtype === "Finance" && amt <= 0) return toast.error("Finance requisition mein amount zaroori");
    try { const r = await apiReqCreate({ ...f, amount: amt }); toast.success(`${r.reqNo} bani \u00b7 ${r.status}`); setF((x) => ({ ...x, title: "", amount: "", description: "" })); onDone(r.id); } catch (e) { toast.error(e.message); }
  };
  return (
    <div style={{ ...card, marginBottom: 12 }} data-testid="req-create-form">
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Nayi Requisition</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <label style={lbl}>Type *<select data-testid="req-f-type" style={inp} value={f.rtype} onChange={(e) => set("rtype", e.target.value)}>{["Material", "Finance", "Machinery"].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label style={{ ...lbl, gridColumn: "span 2" }}>Title *<input data-testid="req-f-title" style={inp} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label style={lbl}>Project / Site<input data-testid="req-f-project" style={inp} value={f.project} onChange={(e) => set("project", e.target.value)} /></label>
        {f.rtype === "Material" && <label style={lbl}>Discipline *<select data-testid="req-f-discipline" style={inp} value={f.discipline} onChange={(e) => set("discipline", e.target.value)}><option value="">\u2014 Select \u2014</option>{discs.map((d) => <option key={d}>{d}</option>)}</select></label>}
        <label style={lbl}>Amount (\u20b9){f.rtype === "Finance" ? " *" : ""}<input data-testid="req-f-amount" type="number" min="0" style={inp} value={f.amount} onChange={(e) => set("amount", e.target.value)} /></label>
        <label style={{ ...lbl, gridColumn: "span 2" }}>Details<textarea data-testid="req-f-desc" rows={2} style={inp} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
      </div>
      {amt > 3000000 && <div data-testid="req-threshold-warn" style={{ marginTop: 8, fontSize: 11.5, color: "#b45309", fontWeight: 700 }}><Lock size={12} /> \u20b930 lakh se zyada: requisition lock hokar Discussion Window mein jayegi.</div>}
      <div style={{ marginTop: 10 }}><button data-testid="req-submit" onClick={submit} style={btn("#1d4ed8")}><Send size={13} /> Submit</button></div>
    </div>
  );
};

const Stepper = ({ r }) => (
  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "10px 0" }} data-testid="req-stepper">
    {r.stages.map((s, i) => {
      const done = i < r.stage || r.status === "Approved";
      const cur = i === r.stage && r.status === "Pending";
      return <div key={i} style={{ padding: "5px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, border: `1px solid ${done ? "#16a34a" : cur ? "#1d4ed8" : "#cbd5e1"}`, background: done ? "#dcfce7" : cur ? "#dbeafe" : "#f8fafc" }}>{i + 1}. {s.label}<div style={{ fontWeight: 500, color: "#475569" }}>{s.role}</div></div>;
    })}
  </div>
);

const Discussion = ({ r, role, onChange }) => {
  const d = r.discussion || {};
  const [topic, setTopic] = useState(d.topic || "");
  const [deps, setDeps] = useState(d.departments || []);
  const [text, setText] = useState("");
  const [decision, setDecision] = useState("Approve");
  const [amount, setAmount] = useState("");
  const [summary, setSummary] = useState("");
  const gm = role === "GM";
  const mine = gm || (d.departments || []).includes(role);
  const run = async (fn, msg) => { try { await fn(); toast.success(msg); onChange(); } catch (e) { toast.error(e.message); } };
  return (
    <div style={{ marginTop: 12, padding: 12, border: "1.5px solid #f59e0b", borderRadius: 8, background: "#fffbeb" }} data-testid="req-discussion">
      <div style={{ fontWeight: 800, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><MessagesSquare size={15} /> Discussion Window {d.concluded && "(Concluded)"}</div>
      {gm && !d.concluded && (
        <div style={{ marginTop: 8 }}>
          <label style={lbl}>Topic *<input data-testid="req-disc-topic" style={inp} value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
          <div style={{ ...lbl, marginTop: 6 }}>Working Departments *</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[...Object.keys(MEMBER_DISC), ...MANAGERS].map((m) => <label key={m} style={{ fontSize: 11, display: "inline-flex", gap: 4, alignItems: "center", padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 999, background: deps.includes(m) ? "#fef3c7" : "#fff" }}><input type="checkbox" data-testid={`req-disc-dep-${m.replace(/[^a-z]/gi, "")}`} checked={deps.includes(m)} onChange={() => setDeps((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))} />{m}</label>)}
          </div>
          <button data-testid="req-disc-save" onClick={() => run(() => apiReqDiscSetup(r.id, { topic, departments: deps }), "Discussion set")} style={{ ...btn("#b45309"), marginTop: 8 }}>Topic & Departments Save</button>
        </div>
      )}
      {d.topic && <div style={{ fontSize: 12, marginTop: 8 }}><b>Topic:</b> {d.topic} \u00b7 <b>Departments:</b> {(d.departments || []).join(", ")}</div>}
      {(d.comments || []).map((c, i) => <div key={i} style={{ marginTop: 6, padding: "6px 8px", background: "#fff", borderLeft: "3px solid #f59e0b", fontSize: 11.5 }}><b>{c.by}</b> ({c.role}) \u00b7 {c.decision} {c.amount ? `\u00b7 ${inr(c.amount)}` : ""}<div>{c.text}</div></div>)}
      {d.topic && mine && !d.concluded && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, marginTop: 8, alignItems: "end" }}>
          <label style={lbl}>Working Decision *<input data-testid="req-disc-text" style={inp} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label style={lbl}>Mat<select data-testid="req-disc-decision" style={inp} value={decision} onChange={(e) => setDecision(e.target.value)}>{["Approve", "Modify", "Reject"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label style={lbl}>Financial Limit (\u20b9)<input data-testid="req-disc-amount" type="number" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <button data-testid="req-disc-comment" onClick={() => run(() => apiReqDiscComment(r.id, { text, decision, amount }), "Decision added").then(() => setText(""))} style={btn("#0f766e")}>Add</button>
        </div>
      )}
      {gm && !d.concluded && d.topic && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "end" }}>
          <label style={{ ...lbl, flex: 1 }}>Final Summary *<input data-testid="req-disc-summary" style={inp} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
          <button data-testid="req-disc-conclude" disabled={!(d.comments || []).length} onClick={() => run(() => apiReqDiscConclude(r.id, { summary }), "Discussion concluded \u2014 approval shuru")} style={btn("#15803d", !(d.comments || []).length)}>Conclude</button>
        </div>
      )}
    </div>
  );
};

const Files = ({ r, onChange }) => {
  const up = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!FILE_OK.includes(file.type)) return toast.error("Sirf PDF, Excel ya JPG/PNG");
    if (file.size > 2 * 1024 * 1024) return toast.error("File 2 MB se chhoti ho");
    const rd = new FileReader();
    rd.onload = () => apiReqFileUpload(r.id, { name: file.name, type: file.type, data: String(rd.result).split(",")[1] }).then(() => { toast.success("Upload ho gaya"); onChange(); }).catch((x) => toast.error(x.message));
    rd.readAsDataURL(file);
  };
  const open = async (f) => { try { const x = await apiReqFileGet(r.id, f.id); const a = document.createElement("a"); a.href = `data:${x.type};base64,${x.data}`; a.download = x.name; a.click(); } catch (e) { toast.error(e.message); } };
  return (
    <div style={{ marginTop: 12 }} data-testid="req-files">
      <div style={{ ...lbl, display: "flex", gap: 6, alignItems: "center" }}><Paperclip size={13} /> Evidence (PDF / Excel / Photo)
        <label style={{ ...btn("#475569"), padding: "4px 10px" }}>Upload<input data-testid="req-file-input" type="file" accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png" onChange={up} style={{ display: "none" }} /></label>
      </div>
      {(r.files || []).map((f) => <button key={f.id} data-testid={`req-file-${f.id}`} onClick={() => open(f)} style={{ display: "inline-flex", gap: 4, alignItems: "center", margin: "6px 6px 0 0", padding: "3px 8px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", cursor: "pointer" }}><Download size={11} /> {f.name}</button>)}
    </div>
  );
};

const Detail = ({ r, role, me, onChange }) => {
  const [remarks, setRemarks] = useState("");
  const stg = r.stages[r.stage];
  const canAct = r.status === "Pending" && !r.locked && stg && (stg.role === role || role === "GM") && (r.requestedBy !== me || role === "GM");
  const act = async (action) => {
    if (action === "reject" && remarks.trim().length < 5) return toast.error("Reject ka kaaran likhein (min 5 akshar)");
    if (!window.confirm(`${action === "approve" ? "Approve" : "Reject"} karein?`)) return;
    try { await apiReqAction(r.id, { action, remarks }); toast.success(action === "approve" ? "Approved" : "Rejected"); setRemarks(""); onChange(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div style={card} data-testid="req-detail">
      <div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 10.5, fontFamily: "monospace", color: "#64748b" }}>{r.reqNo} \u00b7 {r.rtype}{r.discipline ? ` \u00b7 ${r.discipline}` : ""}</div><div style={{ fontWeight: 900, fontSize: 15 }}>{r.title}</div></div><Pill s={r.status} /></div>
      <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>Amount: <b>{inr(r.amount)}</b> \u00b7 Project: <b>{r.project || "\u2014"}</b> \u00b7 By: <b>{r.requestedByName}</b></div>
      {r.description && <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>{r.description}</div>}
      <Stepper r={r} />
      {canAct && (
        <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
          <label style={{ ...lbl, flex: 1 }}>Remarks (Reject par zaroori)<input data-testid="req-remarks" style={inp} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
          <button data-testid="req-approve" onClick={() => act("approve")} style={btn("#15803d")}><CheckCircle2 size={13} /> {stg.label}</button>
          <button data-testid="req-reject" onClick={() => act("reject")} style={btn("#dc2626")}><XCircle size={13} /> Reject</button>
        </div>
      )}
      {r.status === "Pending" && !canAct && stg && <div style={{ fontSize: 11.5, color: "#64748b" }}>Abhi {stg.role} ke paas ({stg.label})</div>}
      {r.discussion && <Discussion r={r} role={role} onChange={onChange} />}
      <Files r={r} onChange={onChange} />
      <div style={{ marginTop: 10, fontSize: 10.5, color: "#64748b" }}>{(r.history || []).map((h, i) => <div key={i}>{new Date(h.at).toLocaleString("en-IN")} \u00b7 {h.by}{h.role ? ` (${h.role})` : ""} \u00b7 {h.action}{h.remarks ? ` \u2014 ${h.remarks}` : ""}</div>)}</div>
    </div>
  );
};

export default function Requisitions() {
  const [sp] = useSearchParams();
  const role = currentRole();
  const me = currentUserEmail();
  const [scope, setScope] = useState("inbox");
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(sp.get("id") || "");
  const [, setRev] = useState(0);
  const load = () => apiReqList(scope).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { loadCoreConfig().then(() => setRev((v) => v + 1)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = sp.get("id"); if (id) { setSel(id); setScope(["GM", "Admin", "SuperAdmin", ...MANAGERS].includes(role) || /^Member /.test(role) ? "all" : "mine"); } }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = rows.find((r) => r.id === sel);
  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div data-testid="requisitions-page" style={{ background: "#f1f5f9", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px) 80px" }}>
        <ModuleHero tag="Centralized Requisition" title="Requisitions \u00b7 Material / Finance / Machinery" subtitle="Site \u2192 Manager verification \u2192 Core Member \u2192 GM \u00b7 \u20b930 lakh se upar Discussion Window" icon={ClipboardCheck} gradient="linear-gradient(135deg,#0b1f4d 0%,#1d4ed8 55%,#f59e0b 100%)" shadowRgba="29,78,216,.28" />
        <div style={{ display: "flex", gap: 6, margin: "14px 0" }}>
          {[["inbox", "Meri Approval (Inbox)"], ["mine", "Meri Requisitions"], ["all", "Sabhi"]].map(([k, l]) => <button key={k} data-testid={`req-scope-${k}`} onClick={() => setScope(k)} style={btn(scope === k ? "#0b1f4d" : "#94a3b8")}>{l}</button>)}
        </div>
        {scope === "mine" && <CreateForm onDone={(id) => { load(); setSel(id); }} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12 }}>
          <div style={card}>
            {!rows.length && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Koi requisition nahi</div>}
            {rows.map((r) => (
              <button key={r.id} data-testid={`req-row-${r.id}`} onClick={() => setSel(r.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, borderRadius: 8, border: `1px solid ${sel === r.id ? "#1d4ed8" : "#e2e8f0"}`, borderLeft: `4px solid ${ST_C[r.status]}`, background: sel === r.id ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b style={{ fontSize: 12.5 }}>{r.title}</b><Pill s={r.status} /></div>
                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>{r.reqNo} \u00b7 {r.rtype} \u00b7 {inr(r.amount)} \u00b7 {r.status === "Pending" && r.stages[r.stage] ? `${r.stages[r.stage].role}` : r.status}</div>
              </button>
            ))}
          </div>
          <div>{cur ? <Detail r={cur} role={role} me={me} onChange={load} /> : <div style={{ ...card, color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 40 }}>Left side se requisition chunein</div>}</div>
        </div>
      </div>
    </>
  );
}
