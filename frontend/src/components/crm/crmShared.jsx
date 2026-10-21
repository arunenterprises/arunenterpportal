import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getToken } from "../../lib/api";
import { getFY } from "../../lib/store";

const BASE = process.env.REACT_APP_BACKEND_URL;

const req = async (path, opts = {}) => {
  const res = await fetch(`${BASE}/api/crm${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.detail || msg; } catch { /* noop */ }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json();
};

export const crmList = (name) => req(`/${name}`);
export const crmSave = (name, rec) => req(`/${name}`, { method: "POST", body: JSON.stringify(rec) });
export const crmDelete = (name, id) => req(`/${name}/${encodeURIComponent(id)}`, { method: "DELETE" });
export const crmNextNo = async (kind, prefix, pad = 4) => {
  const { serial } = await req(`/next-number/${encodeURIComponent(kind)}`, { method: "POST", body: "{}" });
  return `${prefix}${String(serial).padStart(pad, "0")}`;
};
export const crmParseWorkOrder = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => req("/parse-work-order", { method: "POST", body: JSON.stringify({ fileName: file.name, mimeType: file.type, data: r.result }) })
    .then((out) => resolve({ parsed: out, dataUrl: r.result })).catch(reject);
  r.onerror = () => reject(new Error("File read failed"));
  r.readAsDataURL(file);
});
export const fyTag = () => getFY();
export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const inr = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (v) => Number(v) || 0;

export const CRM_NAMES = ["leads", "clients", "comms", "contracts", "mb", "ra_bills", "milestones", "change_orders", "retention_releases"];

// Module-level cache so Reports Hub (sync getters) can read CRM data.
const CRM_LS = "ae_crm_cache";
const _lsCrm = (() => { try { return JSON.parse(localStorage.getItem(CRM_LS) || "{}"); } catch { return {}; } })();
export const crmCache = Object.fromEntries(CRM_NAMES.map((n) => [n, Array.isArray(_lsCrm[n]) ? _lsCrm[n] : []]));
export const crmCacheReady = () => !!localStorage.getItem(CRM_LS);
const _storeCrm = (lists) => {
  CRM_NAMES.forEach((n, i) => { crmCache[n] = lists[i]; });
  const lite = Object.fromEntries(CRM_NAMES.map((n) => [n, crmCache[n].map(({ fileData, woFileData, ...r }) => r)]));
  try { localStorage.setItem(CRM_LS, JSON.stringify(lite)); } catch { /* quota */ }
};
export const loadCrmCache = async () => {
  const lists = await Promise.all(CRM_NAMES.map((n) => crmList(n)));
  _storeCrm(lists);
  return crmCache;
};

// Enriched report rows (client name, contract no) shared by dept Reports tab and Reports Hub.
export const crmReportRows = (name, d = crmCache) => {
  const ct = (id) => d.contracts.find((c) => c.id === id) || {};
  const cl = (id) => d.clients.find((c) => c.id === id) || {};
  const rows = d[name] || [];
  if (name === "retention") {
    return d.contracts.map((k) => {
      const held = d.ra_bills.filter((b) => b.contractId === k.id && Number(b.step) >= 3).reduce((s, b) => s + num(b.retentionAmt), 0);
      const released = d.retention_releases.filter((r) => r.contractId === k.id).reduce((s, r) => s + num(r.amount), 0);
      return { id: k.id, contractNo: k.contractNo, projectName: k.projectName, clientName: cl(k.clientId).name || "", startDate: k.startDate, retentionPct: k.retentionPct, held, released, balance: +(held - released).toFixed(2) };
    });
  }
  return rows.map((r) => {
    const k = ct(r.contractId);
    return { ...r, contractNo: k.contractNo || r.contractNo || "", projectName: k.projectName || r.projectName || "", clientName: cl(r.clientId || k.clientId).name || r.name || "", fileData: undefined, woFileData: undefined };
  });
};

// Loads all CRM collections once and exposes save/delete with auto-refresh.
export const useCrmData = () => {
  const names = CRM_NAMES;
  const [data, setData] = useState(() => Object.fromEntries(names.map((n) => [n, []])));
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const lists = await Promise.all(names.map((n) => crmList(n)));
      _storeCrm(lists);
      setData(Object.fromEntries(names.map((n, i) => [n, lists[i]])));
    } catch (e) { toast.error(`Load failed: ${e.message}`); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const save = async (name, rec, msg = "Saved") => {
    try {
      const out = await crmSave(name, rec);
      await reload();
      if (msg) toast.success(msg);
      return out;
    } catch (e) { toast.error(e.message); return null; }
  };
  const remove = async (name, id) => {
    if (!window.confirm("Delete this record?")) return false;
    try { await crmDelete(name, id); await reload(); toast.success("Deleted"); return true; }
    catch (e) { toast.error(e.message); return false; }
  };
  return { data, loading, reload, save, remove };
};

export const STEP_WF = { 1: "Draft", 2: "Submitted", 3: "GM Approved" };
export const RA_STEPS = { 1: "Draft", 2: "Submitted", 3: "GM Approved", 4: "Sent to Client", 5: "Payment Received" };

// ---------- UI atoms ----------
export const C = { ink: "#0f172a", sub: "#475569", line: "#e2e8f0", brand: "#1d4ed8", brandDark: "#1e3a8a", soft: "#eff6ff", accent: "#0891b2" };

export const Field = ({ label, children, span = 1 }) => (
  <div style={{ gridColumn: `span ${span}`, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
    <label style={{ fontSize: 10.5, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
    {children}
  </div>
);

export const inputS = { padding: "7px 10px", fontSize: 12.5, border: "1px solid #cbd5e1", borderRadius: 6, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };

export const Inp = (p) => <input {...p} style={{ ...inputS, ...(p.style || {}) }} />;
export const Sel = ({ options, ...p }) => (
  <select {...p} style={{ ...inputS, ...(p.style || {}) }}>
    {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>))}
  </select>
);

export const Btn = ({ children, tone = "brand", ...p }) => {
  const tones = {
    brand: { background: C.brand, color: "#fff", border: "none" },
    dark: { background: C.ink, color: "#fff", border: "none" },
    ghost: { background: "#fff", color: C.ink, border: `1px solid ${C.line}` },
    green: { background: "#15803d", color: "#fff", border: "none" },
    red: { background: "#fff", color: "#b91c1c", border: "1px solid #fecaca" },
  };
  return (
    <button {...p} className="crm-btn" style={{ ...tones[tone], padding: "7px 13px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: p.disabled ? "not-allowed" : "pointer", opacity: p.disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6, ...(p.style || {}) }}>
      {children}
    </button>
  );
};

export const Card = ({ title, right, children, testid }) => (
  <div data-testid={testid} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
    {(title || right) && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{title}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div>
      </div>
    )}
    {children}
  </div>
);

export const Grid = ({ cols = 4, children }) => (
  <div className="crm-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>{children}</div>
);

export const Table = ({ cols, rows, testid, empty = "No records yet" }) => (
  <div style={{ overflowX: "auto" }}>
    <table data-testid={testid} style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>{cols.map((c) => <th key={c} style={{ textAlign: "left", padding: "8px 10px", background: "#f8fafc", color: C.sub, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 18, textAlign: "center", color: "#94a3b8" }}>{empty}</td></tr>}
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: `1px solid #f1f5f9` }}>
            {r.map((cell, j) => <td key={j} style={{ padding: "8px 10px", verticalAlign: "top" }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Badge = ({ text, tone = "slate" }) => {
  const t = { slate: ["#f1f5f9", "#334155"], amber: ["#fef3c7", "#92400e"], green: ["#dcfce7", "#166534"], blue: ["#dbeafe", "#1e40af"], red: ["#fee2e2", "#991b1b"] }[tone];
  return <span style={{ background: t[0], color: t[1], padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
};
export const stepTone = (s) => ({ 1: "slate", 2: "amber", 3: "blue", 4: "blue", 5: "green" }[Number(s)] || "slate");

export const nameOf = (list, id, key = "name") => (list.find((x) => x.id === id) || {})[key] || "—";
