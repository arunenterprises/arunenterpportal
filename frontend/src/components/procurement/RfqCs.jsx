import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, CheckCircle2, ShoppingCart, Trash2 } from "lucide-react";
import OpsModule from "../ops/OpsModule";
import { OPS } from "../ops/opsConfig";
import { apiOpsList, apiOpsSave } from "../../lib/api";
import { can } from "../../lib/acl";

const uid = () => `cs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const n = (v) => Number(v) || 0;
const inr = (v) => `₹${n(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const th = { padding: 6, background: "#14532d", color: "#fff", fontSize: 11, textAlign: "left" };
const td = { padding: 4, borderBottom: "1px solid #e2e8f0", fontSize: 12 };
const inp = { width: "100%", boxSizing: "border-box", padding: "5px 6px", border: "1px solid #cbd5e1", borderRadius: 5, fontSize: 12 };
const blank = (i) => ({ id: uid(), status: "Draft", indentNo: i?.docNo || "", project: i?.project || "", vendors: [{ name: "", code: "" }, { name: "", code: "" }, { name: "", code: "" }],
  items: [{ desc: i?.material || "", qty: i?.qty || "", unit: i?.unit || "", gstPct: "18", rates: ["", "", ""] }] });
const l1 = (it) => { const r = it.rates.map(n).map((v, j) => [v, j]).filter(([v]) => v > 0); return r.length ? r.reduce((a, b) => (b[0] < a[0] ? b : a)) : null; };

export default function RfqCs() {
  const [indents, setIndents] = useState([]);
  const [all, setAll] = useState([]);
  const [cs, setCs] = useState(blank());
  const load = () => Promise.all([apiOpsList("indent"), apiOpsList("proc_cs")]).then(([i, c]) => { setIndents(i.filter((x) => x.status !== "Rejected")); setAll(c); }).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const ro = cs.status === "Approved" || cs.status === "Submitted";
  const setV = (j, k, v) => setCs((c) => ({ ...c, vendors: c.vendors.map((x, q) => (q === j ? { ...x, [k]: v } : x)) }));
  const setI = (i, k, v) => setCs((c) => ({ ...c, items: c.items.map((x, q) => (q === i ? { ...x, [k]: v } : x)) }));
  const setR = (i, j, v) => setCs((c) => ({ ...c, items: c.items.map((x, q) => (q === i ? { ...x, rates: x.rates.map((r, z) => (z === j ? v : r)) } : x)) }));
  const totals = cs.vendors.map((_, j) => cs.items.reduce((s, it) => s + n(it.qty) * n(it.rates[j]), 0));
  const full = cs.vendors.map((_, j) => cs.items.every((it) => n(it.rates[j]) > 0));
  const bestJ = totals.map((t, j) => [t, j]).filter(([, j]) => full[j] && cs.vendors[j].name).sort((a, b) => a[0] - b[0])[0]?.[1];
  const save = async (status) => {
    if (cs.vendors.filter((v) => v.name.trim()).length < 2) { toast.error("Kam se kam 2 vendors ke naam bharein"); return; }
    if (cs.items.some((it) => !it.desc.trim() || n(it.qty) <= 0 || !l1(it))) { toast.error("Har item ka description, qty aur kam se kam ek rate bharein"); return; }
    const l1v = bestJ !== undefined ? cs.vendors[bestJ] : {};
    try {
      const s = await apiOpsSave("proc_cs", { ...cs, status, material: cs.items.map((x) => x.desc).join(", "), l1Vendor: l1v.name || "", l1Code: l1v.code || "", l1Total: bestJ !== undefined ? totals[bestJ] : 0 });
      setCs(s); load(); toast.success(`${status} · ${s.docNo}`);
    } catch (e) { toast.error(e.message); }
  };
  const genPO = async () => {
    if (cs.status !== "Approved") { toast.error("Pehle CS Approve karwayein"); return; }
    try {
      for (const it of cs.items) {
        const [rate, j] = l1(it);
        const v = cs.vendors[j];
        if (!v.code.trim()) { toast.error(`${v.name || "L1 vendor"} ka Vendor Code bharein`); return; }
        await apiOpsSave("proc_po", { id: `po_${Date.now()}_${j}`, status: "Draft", project: cs.project, date: new Date().toISOString().slice(0, 10), indentNo: cs.indentNo, csNo: cs.docNo,
          vendorCode: v.code.trim().toUpperCase(), vendorName: v.name, material: it.desc, qty: n(it.qty), unit: it.unit, rate, gstPct: it.gstPct || "18", amount: +(n(it.qty) * rate).toFixed(2), total: +(n(it.qty) * rate * (1 + n(it.gstPct || 18) / 100)).toFixed(2) });
      }
      toast.success("L1 vendor ke PO draft ban gaye · neeche PO register mein authorize karein");
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div style={{ marginTop: 12 }} data-testid="rfq-cs-tab">
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, maxHeight: 520, overflowY: "auto" }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>Site Indents (Project Management)</div>
          {!indents.length && <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Koi indent nahi</div>}
          {indents.map((i) => (
            <button key={i.id} data-testid={`cs-indent-${i.id}`} onClick={() => setCs(blank(i))} style={{ display: "block", width: "100%", textAlign: "left", padding: 8, marginBottom: 5, border: `1px solid ${cs.indentNo === i.docNo ? "#166534" : "#e2e8f0"}`, background: cs.indentNo === i.docNo ? "#f0fdf4" : "#fff", borderRadius: 6, cursor: "pointer", fontSize: 11.5 }}>
              <b>{i.material}</b> · {i.qty} {i.unit}<div style={{ fontSize: 10, color: "#64748b" }}>{i.docNo} · {i.project}</div>
            </button>
          ))}
          <div style={{ fontWeight: 800, fontSize: 12, margin: "10px 0 6px" }}>Saved CS</div>
          {all.map((x) => <button key={x.id} data-testid={`cs-saved-${x.id}`} onClick={() => setCs(x)} style={{ display: "block", width: "100%", textAlign: "left", padding: 6, marginBottom: 4, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>{x.docNo} · {x.l1Vendor || "—"} · {x.status}</button>)}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13 }}>Comparative Statement {cs.docNo ? `· ${cs.docNo}` : ""}</b>
            <span style={{ fontSize: 11, color: "#64748b" }}>Indent: {cs.indentNo || "—"} · Project: {cs.project || "—"} · Status: <b data-testid="cs-status">{cs.status}</b></span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="cs-matrix">
            <thead>
              <tr><th style={th}>Item Description</th><th style={th}>Qty</th><th style={th}>Unit</th><th style={th}>GST %</th>
                {cs.vendors.map((v, j) => <th key={j} style={th}><input data-testid={`cs-vendor-name-${j}`} disabled={ro} placeholder={`Vendor ${"ABC"[j]} name`} value={v.name} onChange={(e) => setV(j, "name", e.target.value)} style={inp} /><input data-testid={`cs-vendor-code-${j}`} disabled={ro} placeholder="Vendor Code" value={v.code} onChange={(e) => setV(j, "code", e.target.value)} style={{ ...inp, marginTop: 3 }} /></th>)}
                <th style={{ ...th, background: "#15803d" }}>Lowest L1 Rate</th><th style={th} /></tr>
            </thead>
            <tbody>
              {cs.items.map((it, i) => {
                const best = l1(it);
                return (
                  <tr key={i} data-testid={`cs-row-${i}`}>
                    <td style={td}><input data-testid={`cs-desc-${i}`} disabled={ro} value={it.desc} onChange={(e) => setI(i, "desc", e.target.value)} style={inp} /></td>
                    <td style={td}><input data-testid={`cs-qty-${i}`} disabled={ro} type="number" value={it.qty} onChange={(e) => setI(i, "qty", e.target.value)} style={{ ...inp, width: 70 }} /></td>
                    <td style={td}><input disabled={ro} value={it.unit} onChange={(e) => setI(i, "unit", e.target.value)} style={{ ...inp, width: 60 }} /></td>
                    <td style={td}><select disabled={ro} value={it.gstPct} onChange={(e) => setI(i, "gstPct", e.target.value)} style={inp}>{["5", "12", "18", "28", "0"].map((g) => <option key={g}>{g}</option>)}</select></td>
                    {it.rates.map((r, j) => <td key={j} style={{ ...td, background: best && best[1] === j ? "#bbf7d0" : undefined }}><input data-testid={`cs-rate-${i}-${j}`} disabled={ro} type="number" value={r} onChange={(e) => setR(i, j, e.target.value)} style={{ ...inp, fontWeight: best && best[1] === j ? 800 : 400 }} /></td>)}
                    <td data-testid={`cs-l1-${i}`} style={{ ...td, background: "#16a34a", color: "#fff", fontWeight: 900, userSelect: "none" }}>{best ? `${inr(best[0])} · ${cs.vendors[best[1]].name || `Vendor ${"ABC"[best[1]]}`}` : "—"}</td>
                    <td style={td}>{!ro && cs.items.length > 1 && <button onClick={() => setCs((c) => ({ ...c, items: c.items.filter((_, q) => q !== i) }))} style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer" }}><Trash2 size={13} /></button>}</td>
                  </tr>
                );
              })}
              <tr><td colSpan={4} style={{ ...td, fontWeight: 800, textAlign: "right" }}>Total (Basic)</td>
                {totals.map((t, j) => <td key={j} data-testid={`cs-total-${j}`} style={{ ...td, fontWeight: 800, background: bestJ === j ? "#16a34a" : "#f1f5f9", color: bestJ === j ? "#fff" : "#0f172a" }}>{inr(t)}{bestJ === j ? " · L1" : ""}</td>)}<td style={td} colSpan={2} /></tr>
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {!ro && <button data-testid="cs-add-row" onClick={() => setCs((c) => ({ ...c, items: [...c.items, { desc: "", qty: "", unit: "", gstPct: "18", rates: ["", "", ""] }] }))} style={btn("#15803d", true)}><Plus size={13} /> Add Row</button>}
            {!ro && <button data-testid="cs-save" onClick={() => save("Draft")} style={btn("#0b1f4d")}><Save size={13} /> Save Draft</button>}
            {!ro && <button data-testid="cs-submit" onClick={() => save("Submitted")} style={btn("#0369a1")}>Submit for Approval</button>}
            {cs.status === "Submitted" && <button data-testid="cs-approve" onClick={() => (can("procurement", "a") ? save("Approved") : toast.error("CS approval ki permission nahi hai"))} style={btn("#16a34a")}><CheckCircle2 size={13} /> Approve CS</button>}
            <button data-testid="cs-generate-po" onClick={genPO} disabled={cs.status !== "Approved"} style={{ ...btn("#c2410c"), opacity: cs.status === "Approved" ? 1 : 0.45 }}><ShoppingCart size={13} /> Generate PO for L1 Vendor</button>
            <button data-testid="cs-new" onClick={() => setCs(blank())} style={btn("#64748b", true)}>New CS</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}><OpsModule cfg={OPS.proc_rfq} /></div>
      <div style={{ marginTop: 12 }}><OpsModule cfg={OPS.proc_po} /></div>
    </div>
  );
}
const btn = (c, outline) => ({ padding: "7px 14px", background: outline ? "#fff" : c, color: outline ? c : "#fff", border: `1px solid ${c}`, borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" });
