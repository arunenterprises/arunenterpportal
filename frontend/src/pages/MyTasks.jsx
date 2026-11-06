import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ListTodo, Send, PlayCircle, CheckCircle2, XCircle, Save, ExternalLink, Trash2, UserPlus } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import { DateInput } from "../components/DateInput";
import { apiTasks, apiTaskCreate, apiTaskUpdate, apiTaskDelete, apiUserDirectory } from "../lib/api";
import { currentRole, currentUserEmail } from "../lib/store";
import { TASK_LIB, TASK_DEPTS, SENIOR } from "../lib/taskTemplates";

const ST_C = { Assigned: "#0369a1", "In Progress": "#d97706", Submitted: "#7c3aed", Done: "#15803d", Rejected: "#dc2626" };
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 };
const inp = { width: "100%", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, boxSizing: "border-box" };
const btn = (c) => ({ padding: "7px 12px", background: c, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" });
const today = () => new Date().toISOString().slice(0, 10);
const Pill = ({ s }) => <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, color: "#fff", background: ST_C[s] || "#64748b" }}>{s}</span>;

const AssignForm = ({ users, onDone }) => {
  const [f, setF] = useState({ department: TASK_DEPTS[0], vertical: Object.keys(TASK_LIB[TASK_DEPTS[0]])[0], template: "", title: "", description: "", path: "", assignedTo: "", priority: "Medium", dueDate: today() });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pick = ([t, p] = ["", ""]) => setF((x) => ({ ...x, template: t, title: t || x.title, path: p, description: t ? `${x.department} › ${x.vertical}` : x.description }));
  const verts = Object.keys(TASK_LIB[f.department]);
  const list = TASK_LIB[f.department][f.vertical] || [];
  const submit = async () => {
    if (!f.title.trim() || !f.assignedTo) { toast.error("Task aur Employee chunein"); return; }
    const { vertical, ...body } = f;
    try { const t = await apiTaskCreate({ ...body, department: `${f.department} › ${vertical}` }); toast.success(`Task assign hua · ${t.taskNo}`); setF((x) => ({ ...x, template: "", title: "", description: "", path: "" })); onDone(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div style={{ ...card, marginBottom: 12 }} data-testid="task-assign-form">
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}><UserPlus size={15} /> Task Assign Karein (Seniors)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 700 }}>ERP Module<select data-testid="task-f-department" style={inp} value={f.department} onChange={(e) => setF((x) => ({ ...x, department: e.target.value, vertical: Object.keys(TASK_LIB[e.target.value])[0], template: "", path: "" }))}>{TASK_DEPTS.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 700 }}>Vertical / Work<select data-testid="task-f-vertical" style={inp} value={f.vertical} onChange={(e) => setF((x) => ({ ...x, vertical: e.target.value, template: "", path: "" }))}>{verts.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 700 }}>Default Task<select data-testid="task-f-template" style={inp} value={f.template} onChange={(e) => pick(list.find((x) => x[0] === e.target.value))}><option value="">— Select / khud likhein —</option>{list.map(([t]) => <option key={t}>{t}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 700 }}>Employee<select data-testid="task-f-assignee" style={inp} value={f.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}><option value="">— Select —</option>{users.map((u) => <option key={u.email} value={u.email}>{u.name || u.email} · {u.role}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 700, gridColumn: "span 2" }}>Task Title<input data-testid="task-f-title" style={inp} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label style={{ fontSize: 11, fontWeight: 700 }}>Priority<select data-testid="task-f-priority" style={inp} value={f.priority} onChange={(e) => set("priority", e.target.value)}>{["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 700 }}>Due Date<DateInput data-testid="task-f-due" type="date" style={inp} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></label>
        <label style={{ fontSize: 11, fontWeight: 700, gridColumn: "span 4" }}>Details / Instructions<textarea data-testid="task-f-desc" rows={2} style={inp} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
      </div>
      <div data-testid="task-library" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 2px" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", alignSelf: "center" }}>Default list · {f.vertical}:</span>
        {list.map(([t, p], i) => <button key={t} type="button" data-testid={`task-lib-${i}`} onClick={() => pick([t, p])} style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${f.template === t ? "#1d4ed8" : "#cbd5e1"}`, background: f.template === t ? "#1d4ed8" : "#fff", color: f.template === t ? "#fff" : "#0f172a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{t}</button>)}
      </div>
      <div style={{ marginTop: 10 }}><button data-testid="task-assign-btn" onClick={submit} style={btn("#1d4ed8")}><Send size={13} /> Assign Task</button></div>
    </div>
  );
};

const TaskDetail = ({ t, me, boss, onChange }) => {
  const nav = useNavigate();
  const [remarks, setRemarks] = useState(t.remarks || "");
  const [sr, setSr] = useState(t.seniorRemarks || "");
  useEffect(() => { setRemarks(t.remarks || ""); setSr(t.seniorRemarks || ""); }, [t.id, t.remarks, t.seniorRemarks]);
  const upd = async (patch, msg) => { try { await apiTaskUpdate(t.id, patch); toast.success(msg); onChange(); } catch (e) { toast.error(e.message); } };
  const mine = t.assignedTo === me;
  const closed = t.status === "Done";
  return (
    <div style={card} data-testid="task-detail">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div><div style={{ fontSize: 10.5, color: "#64748b", fontFamily: "monospace" }}>{t.taskNo} · {t.department}</div><div style={{ fontWeight: 900, fontSize: 15 }}>{t.title}</div></div>
        <Pill s={t.status} />
      </div>
      <div style={{ fontSize: 12, color: "#334155", margin: "8px 0", whiteSpace: "pre-wrap" }}>{t.description || "—"}</div>
      <div style={{ fontSize: 11, color: "#475569" }}>Diya: <b>{t.assignedByName}</b> · Kisko: <b>{t.assignedName}</b> · Priority: <b>{t.priority}</b> · Due: <b>{t.dueDate ? t.dueDate.split("-").reverse().join("/") : "—"}</b></div>
      {t.path && <button data-testid="task-open-work" onClick={() => nav(t.path)} style={{ ...btn("#0f766e"), marginTop: 10 }}><ExternalLink size={13} /> Kaam kholein (Open Work)</button>}
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginTop: 12 }}>Mera Kaam / Remarks<textarea data-testid="task-remarks" rows={3} style={inp} value={remarks} disabled={!mine || closed} onChange={(e) => setRemarks(e.target.value)} /></label>
      {mine && !closed && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <button data-testid="task-save" onClick={() => upd({ remarks }, "Saved")} style={btn("#475569")}><Save size={13} /> Save</button>
          <button data-testid="task-start" onClick={() => upd({ remarks, status: "In Progress" }, "Kaam shuru")} style={btn("#d97706")}><PlayCircle size={13} /> Start / Edit</button>
          <button data-testid="task-submit" onClick={() => upd({ remarks, status: "Submitted" }, "Submitted")} style={btn("#7c3aed")}><Send size={13} /> Submit</button>
        </div>
      )}
      {boss && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #cbd5e1" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700 }}>Senior Remarks<textarea data-testid="task-senior-remarks" rows={2} style={inp} value={sr} onChange={(e) => setSr(e.target.value)} /></label>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button data-testid="task-done" onClick={() => upd({ status: "Done", seniorRemarks: sr }, "Task Done")} style={btn("#15803d")}><CheckCircle2 size={13} /> Done</button>
            <button data-testid="task-send-back" onClick={() => upd({ status: "Rejected", seniorRemarks: sr }, "Wapas bheja")} style={btn("#dc2626")}><XCircle size={13} /> Reject</button>
            <button data-testid="task-reopen" onClick={() => upd({ status: "Assigned", seniorRemarks: sr }, "Reopen")} style={btn("#0369a1")}>Reopen</button>
            <button data-testid="task-delete" onClick={() => window.confirm("Task delete karein?") && apiTaskDelete(t.id).then(() => { toast.success("Deleted"); onChange(true); }).catch((e) => toast.error(e.message))} style={btn("#64748b")}><Trash2 size={13} /> Delete</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 10.5, color: "#64748b" }}>{(t.history || []).map((h, i) => <div key={i}>{new Date(h.at).toLocaleString("en-IN")} · {h.by} · {h.action}</div>)}</div>
    </div>
  );
};

export default function MyTasks() {
  const [sp] = useSearchParams();
  const role = currentRole();
  const me = currentUserEmail();
  const senior = SENIOR(role);
  const isBoss = ["SuperAdmin", "GM", "Admin"].includes(role);
  const [scope, setScope] = useState("mine");
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState(sp.get("task") || "");
  const [filter, setFilter] = useState("Open");
  const [loaded, setLoaded] = useState(false);
  const load = (clear) => {
    if (clear) setSel("");
    return apiTasks(scope).then((list) => {
      setTasks(list); setLoaded(true);
      if (sel && !list.find((t) => t.id === sel) && scope === "mine" && senior) setScope("assigned");
    }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { const t = sp.get("task"); if (t) { setSel(t); if (loaded && !tasks.find((x) => x.id === t) && scope === "mine" && senior) setScope("assigned"); } }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLoaded(false); load(); }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (senior) apiUserDirectory().then(setUsers).catch(() => {}); }, [senior]);
  const shown = useMemo(() => tasks.filter((t) => filter === "All" || (filter === "Open" ? !["Done"].includes(t.status) : filter === "Today" ? t.dueDate === today() && t.status !== "Done" : t.status === filter)), [tasks, filter]);
  const cur = tasks.find((t) => t.id === sel);
  const cnt = (f) => tasks.filter((t) => (f === "Open" ? t.status !== "Done" : f === "Today" ? t.dueDate === today() && t.status !== "Done" : t.status === f)).length;
  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div data-testid="my-tasks-page" style={{ background: "#f1f5f9", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px) 80px" }}>
        <ModuleHero tag="Task Management" title="My Tasks · Daily Task Allotment" subtitle="Aaj ke task chunein, kaam kholein, Save / Edit / Submit karein" icon={ListTodo} gradient="linear-gradient(135deg,#0b1f4d 0%,#0369a1 55%,#22c55e 100%)" shadowRgba="3,105,161,.28" />
        <div style={{ display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" }}>
          {[["mine", "Mere Task"], ...(senior ? [["assigned", "Task Allotment"]] : []), ...(isBoss ? [["all", "All Task"]] : [])].map(([k, l]) => (
            <button key={k} data-testid={`task-scope-${k}`} onClick={() => { setScope(k); setSel(""); }} style={{ ...btn(scope === k ? "#0b1f4d" : "#94a3b8") }}>{l}</button>
          ))}
        </div>
        {senior && scope !== "mine" && <AssignForm users={users} onDone={() => load()} />}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 12 }}>
          <div style={card}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {["Open", "Today", "Assigned", "In Progress", "Submitted", "Done", "Rejected", "All"].map((f) => (
                <button key={f} data-testid={`task-filter-${f.replace(/\s+/g, "-").toLowerCase()}`} onClick={() => setFilter(f)} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #cbd5e1", background: filter === f ? "#0f172a" : "#fff", color: filter === f ? "#fff" : "#0f172a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f} ({f === "All" ? tasks.length : cnt(f)})</button>
              ))}
            </div>
            {!shown.length && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Koi task nahi</div>}
            {shown.map((t) => (
              <button key={t.id} data-testid={`task-row-${t.id}`} onClick={() => setSel(t.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, borderRadius: 8, border: `1px solid ${sel === t.id ? "#1d4ed8" : "#e2e8f0"}`, borderLeft: `4px solid ${ST_C[t.status] || "#64748b"}`, background: sel === t.id ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><b style={{ fontSize: 12.5 }}>{t.title}</b><Pill s={t.status} /></div>
                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>{t.taskNo} · {t.department} · {scope === "mine" ? `Diya: ${t.assignedByName}` : `Kisko: ${t.assignedName}`} · Due {t.dueDate ? t.dueDate.split("-").reverse().join("/") : "—"} · {t.priority}</div>
              </button>
            ))}
          </div>
          <div>{cur ? <TaskDetail t={cur} me={me} boss={isBoss || cur.assignedBy === me} onChange={load} /> : <div style={{ ...card, color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 40 }}>Left side se task chunein</div>}</div>
        </div>
      </div>
    </>
  );
}
