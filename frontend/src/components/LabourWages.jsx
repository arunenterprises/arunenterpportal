import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Send, Calculator, Printer, FileCheck2 } from "lucide-react";
import { apiOpsList, apiOpsSave } from "../lib/api";
import { getPayments, savePayments, nextPvNo, currentUser } from "../lib/store";
import { can } from "../lib/acl";
import OpsModule, { STATUS_COLOR } from "./ops/OpsModule";
import { OPS } from "./ops/opsConfig";

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
const inp = { padding: "7px 9px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 5 };
const btn = (bg, off) => ({ padding: "7px 12px", background: off ? "#94a3b8" : bg, color: "#fff", border: "none", borderRadius: 5, cursor: off ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 });
const td = { padding: 6, borderBottom: "1px solid #f1f5f9" };
const MARK = { P: 1, H: 0.5, A: 0 };
const inr = (v) => `₹${(Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const useLabour = (rev) => {
  const [d, setD] = useState({ labour: [], att: [], bills: [] });
  useEffect(() => {
    Promise.all(["labour", "labour_att", "labour_bill"].map((k) => apiOpsList(k).catch(() => []))).then(([labour, att, bills]) => setD({ labour, att, bills }));
  }, [rev]);
  return d;
};

const DailyAttendance = ({ data, onSaved }) => {
  const projects = [...new Set(data.labour.map((l) => l.project).filter(Boolean))];
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState(projects[0] || "");
  const id = `latt_${date}_${slug(project)}`;
  const crew = data.labour.filter((l) => l.project === project && l.lstatus !== "Left");
  const [rows, setRows] = useState({});
  useEffect(() => {
    const ex = data.att.find((a) => a.id === id);
    setRows(Object.fromEntries(crew.map((l) => [l.id, (ex?.rows || []).find((r) => r.labourId === l.id) || { labourId: l.id, name: l.name, mark: "P", ot: 0 }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data]);
  const set = (lid, patch) => setRows((r) => ({ ...r, [lid]: { ...r[lid], ...patch } }));
  const save = async () => {
    if (!project || !crew.length) { toast.error("Project chunein (Labour Master mein labour jodein)"); return; }
    try { await apiOpsSave("labour_att", { id, date, project, rows: Object.values(rows), present: Object.values(rows).filter((r) => r.mark !== "A").length, status: "Draft" }); toast.success(`${date} ki labour attendance saved`); onSaved(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div data-testid="labour-daily" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input data-testid="latt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
        <select data-testid="latt-project" value={project} onChange={(e) => setProject(e.target.value)} style={inp}><option value="">— Project —</option>{projects.map((p) => <option key={p}>{p}</option>)}</select>
        <span style={{ fontSize: 12, color: "#64748b" }}>P = Full day · H = Half day · A = Absent · OT ghante</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{["Labour", "Trade", "Wage", "Attendance", "OT (hr)"].map((h) => <th key={h} style={{ ...td, textAlign: "left", background: "#f8fafc" }}>{h}</th>)}</tr></thead>
        <tbody>
          {!crew.length && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>Is project mein koi labour nahi</td></tr>}
          {crew.map((l) => (
            <tr key={l.id}>
              <td style={td}><b>{l.name}</b></td><td style={td}>{l.trade}</td><td style={td}>{inr(l.dailyWage)}</td>
              <td style={td}>{["P", "H", "A"].map((m) => (
                <button key={m} data-testid={`latt-${l.id}-${m}`} onClick={() => set(l.id, { mark: m })} style={{ ...btn(rows[l.id]?.mark === m ? { P: "#16a34a", H: "#d97706", A: "#dc2626" }[m] : "#cbd5e1"), marginRight: 4, padding: "4px 10px" }}>{m}</button>
              ))}</td>
              <td style={td}><input data-testid={`latt-ot-${l.id}`} type="number" min="0" value={rows[l.id]?.ot ?? 0} onChange={(e) => set(l.id, { ot: e.target.value })} style={{ ...inp, width: 70 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}><button data-testid="latt-save" disabled={!can("hr", "c")} onClick={save} style={btn("#16a34a", !can("hr", "c"))}><Save size={13} /> Save Attendance</button></div>
    </div>
  );
};

const WageBill = ({ data, onSaved }) => {
  const projects = [...new Set(data.labour.map((l) => l.project).filter(Boolean))];
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [project, setProject] = useState(projects[0] || "");
  const id = `lbill_${month}_${slug(project)}`;
  const existing = data.bills.find((b) => b.id === id);
  const lines = useMemo(() => {
    if (existing && existing.status !== "Draft" && existing.status !== "Rejected") return existing.lines || [];
    const agg = {};
    data.att.filter((a) => a.project === project && (a.date || "").startsWith(month)).forEach((a) => (a.rows || []).forEach((r) => {
      const x = agg[r.labourId] || (agg[r.labourId] = { labourId: r.labourId, name: r.name, days: 0, ot: 0 });
      x.days += MARK[r.mark] ?? 0; x.ot += Number(r.ot) || 0;
    }));
    return Object.values(agg).map((x) => {
      const l = data.labour.find((y) => y.id === x.labourId) || {};
      const wage = Number(l.dailyWage) || 0, otRate = Number(l.otRate) || 0;
      return { ...x, trade: l.trade || "", wage, otRate, amount: +(x.days * wage + x.ot * otRate).toFixed(2) };
    });
  }, [data, project, month, existing]);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const locked = existing && ["Submitted", "Approved"].includes(existing.status);
  const save = async (status) => {
    if (!project || !lines.length) { toast.error("Is month ki koi attendance nahi mili"); return; }
    try {
      const s = await apiOpsSave("labour_bill", { id, month, project, lines, labourCount: lines.length, totalDays: lines.reduce((a, l) => a + l.days, 0), totalAmount: +total.toFixed(2), status });
      toast.success(`${s.docNo} ${status === "Submitted" ? "GM approval ko bheja" : "saved"}`); onSaved();
    } catch (e) { toast.error(e.message); }
  };
  const makePV = async () => {
    const payments = getPayments();
    const pvId = `pv_wage_${existing.id}`;
    const ex = payments.find((p) => p.id === pvId);
    if (ex) { toast.info(`Voucher pehle se bana hai: ${ex.pvNo}`); return; }
    const pvNo = nextPvNo();
    const now = new Date().toISOString();
    payments.push({
      id: pvId, pvNo, pvDate: now.slice(0, 10), source: "Labour Wages", sourceRef: existing.id, vendorCode: "AE-LABOUR",
      vendorSnapshot: { firmName: `Labour Wages · ${existing.project} · ${existing.month}` }, amount: Number(existing.totalAmount) || 0,
      remarks: `Auto from Wage Bill ${existing.docNo} · ${existing.labourCount} labour · ${existing.totalDays} man-days`, status: "Submitted", createdByName: currentUser(), createdAt: now,
    });
    savePayments(payments);
    try { await apiOpsSave("labour_bill", { ...existing, linkedPvNo: pvNo }); } catch {}
    toast.success(`Payment Voucher ${pvNo} ban gaya · Accounts → Payment Vouchers mein dekhein`); onSaved();
  };
  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const tr = lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.name}</td><td>${l.trade}</td><td>${l.days}</td><td>${l.wage}</td><td>${l.ot}</td><td>${l.otRate}</td><td style="text-align:right">${l.amount.toFixed(2)}</td><td></td></tr>`).join("");
    w.document.write(`<html><head><title>Wage Bill ${month}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px}th{background:#f1f5f9}</style></head><body><h2 style="margin:0">M/S ARUN ENTERPRISES</h2><h3>Labour Wage Bill · ${project} · ${month} ${existing?.docNo ? `· ${existing.docNo}` : ""}</h3><table><tr><th>#</th><th>Name</th><th>Trade</th><th>Days</th><th>Wage</th><th>OT hr</th><th>OT Rate</th><th>Amount ₹</th><th>Signature</th></tr>${tr}<tr><th colspan="7" style="text-align:right">Total</th><th style="text-align:right">${total.toFixed(2)}</th><th></th></tr></table><br/><br/>Prepared By ____________ &nbsp;&nbsp; Approved By ____________</body></html>`);
    w.document.close(); w.print();
  };
  return (
    <div data-testid="labour-bill" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input data-testid="lbill-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inp} />
        <select data-testid="lbill-project" value={project} onChange={(e) => setProject(e.target.value)} style={inp}><option value="">— Project —</option>{projects.map((p) => <option key={p}>{p}</option>)}</select>
        <span data-testid="lbill-status" style={{ fontWeight: 800, fontSize: 12, color: STATUS_COLOR[existing?.status] || "#64748b" }}><Calculator size={13} /> {existing ? `${existing.docNo} · ${existing.status}` : "Abhi bill nahi bana"}</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{["Labour", "Trade", "Man-days", "Wage", "OT hr", "OT Rate", "Amount"].map((h) => <th key={h} style={{ ...td, textAlign: "left", background: "#f8fafc" }}>{h}</th>)}</tr></thead>
        <tbody>
          {lines.map((l) => <tr key={l.labourId}><td style={td}><b>{l.name}</b></td><td style={td}>{l.trade}</td><td style={td}>{l.days}</td><td style={td}>{inr(l.wage)}</td><td style={td}>{l.ot}</td><td style={td}>{inr(l.otRate)}</td><td style={{ ...td, fontWeight: 700 }}>{inr(l.amount)}</td></tr>)}
          <tr><td colSpan={6} style={{ ...td, textAlign: "right", fontWeight: 900 }}>Total Wages</td><td data-testid="lbill-total" style={{ ...td, fontWeight: 900, color: "#9d174d" }}>{inr(total)}</td></tr>
        </tbody>
      </table>
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <button data-testid="lbill-save" disabled={locked || !can("hr", "c")} onClick={() => save("Draft")} style={btn("#16a34a", locked || !can("hr", "c"))}><Save size={13} /> Save Bill</button>
        <button data-testid="lbill-submit" disabled={locked || !can("hr", "c")} onClick={() => save("Submitted")} style={btn("#7c3aed", locked || !can("hr", "c"))}><Send size={13} /> Submit to GM</button>
        <button data-testid="lbill-print" onClick={print} style={btn("#0f172a")}><Printer size={13} /> Print</button>
        {existing?.status === "Approved" && (existing.linkedPvNo
          ? <span data-testid="lbill-pv" style={{ fontWeight: 800, fontSize: 12, color: "#15803d", alignSelf: "center" }}>Voucher: {existing.linkedPvNo}</span>
          : <button data-testid="lbill-make-pv" disabled={!can("accounts", "c")} onClick={makePV} style={btn("#0f766e", !can("accounts", "c"))}><FileCheck2 size={13} /> Payment Voucher banayein</button>)}
      </div>
    </div>
  );
};

export default function LabourWages() {
  const [sub, setSub] = useState("att");
  const [rev, setRev] = useState(0);
  const data = useLabour(rev);
  const tabs = [["att", "Daily Labour Attendance"], ["bill", "Monthly Wage Bill"], ["master", "Labour Master"], ["bills", "Wage Bills Register"]];
  return (
    <div data-testid="labour-wages" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(([k, l]) => <button key={k} data-testid={`labour-tab-${k}`} onClick={() => { setSub(k); setRev((v) => v + 1); }} style={{ ...btn(sub === k ? "#be185d" : "#fce7f3"), color: sub === k ? "#fff" : "#9d174d" }}>{l}</button>)}
      </div>
      {sub === "att" && <DailyAttendance data={data} onSaved={() => setRev((v) => v + 1)} />}
      {sub === "bill" && <WageBill data={data} onSaved={() => setRev((v) => v + 1)} />}
      {sub === "master" && <OpsModule cfg={OPS.labour} />}
      {sub === "bills" && <OpsModule cfg={OPS.labour_bill} />}
    </div>
  );
}
