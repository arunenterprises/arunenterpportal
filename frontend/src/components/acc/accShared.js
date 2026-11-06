import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { req } from "../../lib/api";
import { num, inr } from "../crm/crmShared";

export const accGet = (p) => req(`/acc/${p}`);
export const accPost = (p, body) => req(`/acc/${p}`, { method: "POST", body: JSON.stringify(body) });
export const accDel = (p) => req(`/acc/${p}`, { method: "DELETE" });

export const useAcc = () => {
  const [d, setD] = useState({ entries: [], accounts: [] });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => accGet("entries").then(setD).catch((e) => toast.error(e.message)).finally(() => setLoading(false)), []);
  useEffect(() => { reload(); }, [reload]);
  return { ...d, loading, reload };
};

export const today = () => new Date().toISOString().slice(0, 10);
export const fyStart = (d = new Date()) => `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01`;
export const accLabel = (a) => (a ? `${a.code} · ${a.name}` : "—");
export const accOpts = (accounts, empty = "— Account —") => [{ v: "", l: empty }, ...accounts.map((a) => ({ v: a.id, l: accLabel(a) }))];
export const bal = (v) => `${inr(Math.abs(v))} ${v >= 0 ? "Dr" : "Cr"}`;
export const PL_GROUPS = ["Income", "Expenses"];

// Opening (before `from`) + period Dr/Cr + closing for every account. Positive = Debit.
export const balances = (accounts, entries, from, to) => accounts.map((a) => {
  let pre = (a.openingType === "Cr" ? -1 : 1) * num(a.opening), dr = 0, cr = 0;
  for (const e of entries) {
    if (e.accountId !== a.id || !e.date || e.date > to) continue;
    if (e.date < from) pre += e.dr - e.cr; else { dr += e.dr; cr += e.cr; }
  }
  return { ...a, open: pre, dr, cr, close: pre + dr - cr };
});

// FIFO outstanding of each party on one control account (creditors: Cr = bill, Dr = payment)
export const ageing = (entries, accountId, asOf, side = "cr") => {
  const by = {};
  for (const e of entries) {
    if (e.accountId !== accountId || !e.date || e.date > asOf) continue;
    const p = (by[e.party || "—"] ||= { docs: [], paid: 0 });
    const add = side === "cr" ? e.cr - e.dr : e.dr - e.cr;
    if (add > 0) p.docs.push({ date: e.date, amt: add, vno: e.vno }); else p.paid += -add;
  }
  const B = [["b0", 0, 30], ["b30", 31, 60], ["b60", 61, 90], ["b90", 91, 1e9]];
  return Object.entries(by).map(([party, p]) => {
    const row = { party, b0: 0, b30: 0, b60: 0, b90: 0, total: 0, advance: 0 };
    let left = p.paid;
    for (const d of p.docs.sort((x, y) => x.date.localeCompare(y.date))) {
      const open = Math.max(0, d.amt - left); left = Math.max(0, left - d.amt);
      if (!open) continue;
      const days = Math.floor((new Date(asOf) - new Date(d.date)) / 86400000);
      row[B.find(([, lo, hi]) => days >= lo && days <= hi)[0]] += open;
      row.total += open;
    }
    row.advance = left;
    return row;
  }).filter((r) => r.total > 0.009 || r.advance > 0.009);
};

export const exportXlsx = (name, rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 30));
  XLSX.writeFile(wb, `${name}.xlsx`);
};

export const KPI = ({ label, value, tone = "#0f766e", testid }) => (
  <div data-testid={testid} style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${tone}`, borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
  </div>
);

export const SubTabs = ({ tabs, value, onChange, prefix }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
    {tabs.map(([k, l]) => (
      <button key={k} data-testid={`${prefix}-${k}`} onClick={() => onChange(k)}
        style={{ padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: "pointer", border: "1px solid #0f766e", background: value === k ? "#0f766e" : "#fff", color: value === k ? "#fff" : "#0f766e", transition: "background-color .15s" }}>{l}</button>
    ))}
  </div>
);
