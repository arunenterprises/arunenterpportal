import React, { useEffect, useMemo, useState } from "react";
import { DateInput } from "../DateInput";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FilePlus2, Save, Pencil, Send, CheckCircle2, XCircle, Trash2, Download, Printer, Search } from "lucide-react";
import { apiOpsList, apiOpsSave, apiOpsDelete } from "../../lib/api";
import { can, OPS_DEPT } from "../../lib/acl";

export const STATUS_COLOR = { Draft: "#64748b", Submitted: "#d97706", Approved: "#15803d", Rejected: "#dc2626" };
const uid = () => `op_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);
const blank = (cfg) => ({ id: uid(), status: "Draft", ...Object.fromEntries(cfg.fields.map((f) => [f.k, f.type === "date" && f.req ? today() : f.options && f.req ? "" : f.options ? f.options[0] : ""])) });
const inp = { width: "100%", padding: "7px 9px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", boxSizing: "border-box" };
const btn = (bg, off) => ({ padding: "7px 12px", height: 32, background: off ? "#94a3b8" : bg, color: "#fff", border: "none", borderRadius: 5, cursor: off ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 });
const label = (cfg, k) => ({ docNo: "Permanent / Ref No", tempNo: "Temp No", status: "Status" }[k] || cfg.fields.find((f) => f.k === k)?.l || k);

const Field = ({ f, v, set, ro, lists, row }) => {
  const p = { value: v ?? "", disabled: ro || f.ro, "data-testid": `ops-f-${f.k}`, style: { ...inp, background: ro || f.ro ? "#f8fafc" : "#fff" }, onChange: (e) => set(f.k, e.target.value) };
  if (f.type === "select") return <select {...p}>{!f.options.includes(v) && <option value="">— Select —</option>}{f.options.map((o) => <option key={o}>{o}</option>)}</select>;
  if (f.type === "textarea") return <textarea rows={2} {...p} />;
  if (f.listOf) return <><input {...p} list={`ops-dl-${f.k}`} placeholder="Type / select" /><datalist id={`ops-dl-${f.k}`}>{f.listOf(row || {}).map((o) => <option key={o} value={o} />)}</datalist></>;
  const list = f.type === "project" ? "ops-projects" : f.type === "machine" ? "ops-machines" : f.type === "coreproject" ? "ops-core-projects" : undefined;
  if (f.type === "date") return <DateInput {...p} type="date" />;
  return <input {...p} list={list} type={f.type === "number" ? f.type : "text"} placeholder={list && lists ? "Type / select" : ""} />;
};

export default function OpsModule({ cfg }) {
  const [rows, setRows] = useState([]);
  const [cur, setCur] = useState(() => blank(cfg));
  const [locked, setLocked] = useState(false);
  const [q, setQ] = useState("");
  const [lists, setLists] = useState({ projects: [], machines: [], core: [] });
  const load = () => apiOpsList(cfg.kind).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load(); setCur(blank(cfg)); setLocked(false);
    Promise.all([apiOpsList("projects").catch(() => []), apiOpsList("machine").catch(() => []), cfg.kind.startsWith("core_") ? apiOpsList("core_project").catch(() => []) : []]).then(([p, m, c]) => setLists({ projects: p, machines: m, core: c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.kind]);
  const calc = (r) => (cfg.calc ? { ...r, ...cfg.calc(r) } : r);
  const set = (k, v) => setCur((c) => calc({ ...c, [k]: v }));
  const approved = cur.status === "Approved";
  const dept = OPS_DEPT[cfg.kind];
  const canApprove = () => can(dept, "a");
  const noCreate = !can(dept, "c");
  const ro = locked || approved || noCreate;

  const save = async (patch = {}, msg = "Saved") => {
    const miss = cfg.fields.find((f) => f.req && !String(cur[f.k] ?? "").trim());
    if (miss) { toast.error(`'${miss.l}' bharein`); return; }
    try {
      const s = await apiOpsSave(cfg.kind, { ...calc(cur), ...patch });
      setCur(s); setLocked(true); load(); toast.success(`${msg} · ${s.docNo}`);
    } catch (e) { toast.error(e.message); }
  };
  const approve = () => (canApprove() ? save({ status: "Approved" }, "Approved") : toast.error("Approval sirf Admin / SuperAdmin"));
  const reject = () => {
    if (!canApprove()) { toast.error("Reject sirf Admin / SuperAdmin"); return; }
    const r = window.prompt("Reject reason:"); if (r == null) return;
    save({ status: "Rejected", rejectReason: r || "Rejected" }, "Rejected");
  };
  const del = async () => {
    if (!can(dept, "d")) { toast.error("Delete ki permission nahi hai"); return; }
    if (!rows.some((r) => r.id === cur.id) || !window.confirm(`Delete ${cur.docNo}?`)) return;
    try { await apiOpsDelete(cfg.kind, cur.id); toast.success("Deleted"); setCur(blank(cfg)); setLocked(false); load(); } catch (e) { toast.error(e.message); }
  };
  const cols = ["docNo", "tempNo", ...cfg.columns.filter((c) => c !== "docNo"), "status"];
  const shown = useMemo(() => rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const excel = () => {
    const ws = XLSX.utils.json_to_sheet(shown.map((r) => Object.fromEntries([["Permanent / Ref No", r.permNo || r.docNo], ["Temp No", r.tempNo || ""], ...cfg.fields.map((f) => [f.l, r[f.k]]), ["Status", r.status], ["Approved By", r.approvedByName || ""]])));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, cfg.kind); XLSX.writeFile(wb, `${cfg.kind}_${today()}.xlsx`);
  };
  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const tr = cfg.fields.map((f) => `<tr><th>${f.l}</th><td>${cur[f.k] ?? ""}</td></tr>`).join("");
    w.document.write(`<html><head><title>${cur.docNo || cfg.title}</title><style>@page{size:A4 portrait;margin:14mm}body{font-family:Arial;font-size:12px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;text-align:left}th{width:35%;background:#f1f5f9}</style></head><body><h2>M/S ARUN ENTERPRISES</h2><h3>${cfg.title} · ${cur.docNo || "Draft"}</h3><table>${tr}<tr><th>Status</th><td>${cur.status}${cur.approvedByName ? ` · ${cur.approvedByName}` : ""}</td></tr></table><br/><br/><table style="border:0"><tr><td style="border:0">Prepared By</td><td style="border:0;text-align:right">Approved By</td></tr></table></body></html>`);
    w.document.close(); w.print();
  };
  const sc = STATUS_COLOR[cur.status] || "#64748b";

  return (
    <div data-testid={`ops-${cfg.kind}`}>
      <datalist id="ops-projects">{lists.projects.map((p) => <option key={p.id} value={p.name}>{p.code}</option>)}</datalist>
      <datalist id="ops-machines">{lists.machines.map((m) => <option key={m.id} value={m.machineCode}>{m.name}</option>)}</datalist>
      <datalist id="ops-core-projects">{lists.core.filter((p) => !cur.discipline || p.discipline === cur.discipline).map((p) => <option key={p.id} value={p.name}>{p.discipline} · {p.docNo}</option>)}</datalist>
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "9px 14px", background: cfg.color, color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>{cfg.title}</span>
          <span data-testid="ops-docno">{cur.tempNo ? `Temp: ${cur.tempNo}` : ""}{cur.permNo ? ` · Permanent: ${cur.permNo}` : cur.tempNo ? " · Permanent: approval par" : cur.docNo || "Temp No: Save par milega"} · <span style={{ background: "#fff", color: sc, padding: "1px 8px", borderRadius: 999 }} data-testid="ops-status">{cur.status}</span></span>
        </div>
        {cur.rejectReason && cur.status === "Rejected" && <div style={{ padding: "6px 14px", background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 700 }}>Rejected: {cur.rejectReason}</div>}
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "10px 12px" }}>
          {cfg.fields.map((f) => (
            <div key={f.k} style={{ gridColumn: `span ${f.span || 1}`, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>{f.l}{f.req && <span style={{ color: "#dc2626" }}> *</span>}</label>
              <Field f={f} v={cur[f.k]} set={set} ro={ro} lists row={cur} />
            </div>
          ))}
        </div>
      </div>
      <div data-testid="ops-action-row" style={{ margin: "12px 0", display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        <button data-testid="ops-new" onClick={() => { setCur(blank(cfg)); setLocked(false); }} style={btn("#0369a1")}><FilePlus2 size={13} /> New</button>
        <button data-testid="ops-edit" onClick={() => (!can(dept, "e") ? toast.error("Edit ki permission nahi hai") : approved && !canApprove() ? toast.error("Approved record sirf Admin badal sakte hain") : setLocked(false))} style={btn("#eab308")}><Pencil size={13} /> Edit</button>
        <button data-testid="ops-save" disabled={ro} onClick={() => save()} style={btn("#16a34a", ro)}><Save size={13} /> Save</button>
        <button data-testid="ops-submit" disabled={approved || noCreate} onClick={() => save({ status: "Submitted" }, "Submitted for GM Approval")} style={btn("#7c3aed", approved || noCreate)}><Send size={13} /> Submit</button>
        <button data-testid="ops-approve" disabled={approved} onClick={approve} style={btn("#15803d", approved)}><CheckCircle2 size={13} /> Approve</button>
        <button data-testid="ops-reject" disabled={approved} onClick={reject} style={btn("#b91c1c", approved)}><XCircle size={13} /> Reject</button>
        <button data-testid="ops-delete" onClick={del} style={btn("#991b1b")}><Trash2 size={13} /> Delete</button>
        <button data-testid="ops-excel" onClick={excel} style={btn("#0f766e")}><Download size={13} /> Excel</button>
        <button data-testid="ops-print" onClick={print} style={btn("#0f172a")}><Printer size={13} /> Print</button>
      </div>
      <div className="section" data-testid="ops-data-sheet" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#f1f5f9", fontWeight: 800, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>{cfg.title} · Data Sheet ({shown.length}) · Row click = Load</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Search size={13} /><input data-testid="ops-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" style={{ ...inp, width: 200 }} /></span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead><tr>{cols.map((c) => <th key={c} style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>{label(cfg, c)}</th>)}</tr></thead>
            <tbody>
              {!shown.length && <tr><td colSpan={cols.length} style={{ padding: 14, textAlign: "center", color: "#94a3b8" }}>Abhi koi record nahi</td></tr>}
              {shown.map((r) => {
                const a = cfg.alert?.(r);
                return (
                  <tr key={r.id} data-testid={`ops-row-${r.id}`} onClick={() => { setCur(r); setLocked(true); }} style={{ cursor: "pointer", background: r.id === cur.id ? "#eff6ff" : "#fff" }}>
                    {cols.map((c) => (
                      <td key={c} style={{ padding: 6, borderBottom: "1px solid #f1f5f9", fontWeight: c === "docNo" ? 700 : 400, color: c === "status" ? STATUS_COLOR[r.status] : "#0f172a" }}>
                        {String(r[c] ?? "")}{c === "docNo" && a && <span style={{ marginLeft: 6, background: "#dc2626", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>{a}</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
