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
export const fyTag = () => getFY();
export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const inr = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (v) => Number(v) || 0;

// Loads all CRM collections once and exposes save/delete with auto-refresh.
export const useCrmData = () => {
  const names = ["leads", "clients", "comms", "contracts", "mb", "ra_bills", "milestones", "change_orders", "retention_releases"];
  const [data, setData] = useState(() => Object.fromEntries(names.map((n) => [n, []])));
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const lists = await Promise.all(names.map((n) => crmList(n)));
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
    if (!window.confirm("Delete this record?")) return;
    try { await crmDelete(name, id); await reload(); toast.success("Deleted"); }
    catch (e) { toast.error(e.message); }
  };
  return { data, loading, reload, save, remove };
};

export const STEP_WF = { 1: "Draft", 2: "Submitted", 3: "GM Approved" };
export const RA_STEPS = { 1: "Draft", 2: "Submitted", 3: "GM Approved", 4: "Sent to Client", 5: "Payment Received" };

// ---------- UI atoms ----------
export const C = { ink: "#0f172a", sub: "#475569", line: "#e2e8f0", brand: "#b45309", brandDark: "#78350f", soft: "#fffbeb" };

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
