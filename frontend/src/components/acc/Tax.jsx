import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Card, Grid, Field, Inp, Sel, Btn, Table, inr, num } from "../crm/crmShared";
import { accGet, accPost, fyStart, today, KPI, SubTabs, exportXlsx } from "./accShared";
import { can } from "../../lib/acl";

const inRange = (d, from, to) => d && d >= from && d <= to;

export const Tax = () => {
  const [sub, setSub] = useState("tds");
  const [d, setD] = useState({ tds: [], gstIn: [], gstOut: [], sections: {} });
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(today());
  const [sec, setSec] = useState("");
  const load = () => accGet("tax").then(setD).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const tds = d.tds.filter((r) => inRange(r.date, from, to) && (!sec || r.section === sec));
  const gin = d.gstIn.filter((r) => inRange(r.date, from, to));
  const gout = d.gstOut.filter((r) => inRange(r.date, from, to));
  const sum = (l, k) => l.reduce((s, r) => s + num(r[k]), 0);
  const months = useMemo(() => {
    const m = {};
    const add = (r, side) => { const k = r.date.slice(0, 7); m[k] ||= { month: k, outC: 0, outS: 0, outI: 0, inC: 0, inS: 0, inI: 0 }; m[k][`${side}C`] += num(r.cgst); m[k][`${side}S`] += num(r.sgst); m[k][`${side}I`] += num(r.igst); };
    gout.forEach((r) => add(r, "out")); gin.filter((r) => r.matched).forEach((r) => add(r, "in"));
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [gin, gout]);
  const match = async (r, matched, remarks = r.matchRemarks) => {
    try { await accPost("itc", { billKey: r.key, matched, remarks }); load(); } catch (e) { toast.error(e.message); }
  };
  const secSum = Object.keys(d.sections).map((s) => [s, sum(tds.filter((r) => r.section === s), "tds")]).filter(([, v]) => v);
  return (
    <>
      <Card testid="tax-filter">
        <Grid cols={4}>
          <Field label="From"><Inp data-testid="tax-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Inp data-testid="tax-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </Grid>
      </Card>
      <SubTabs prefix="tax-sub" value={sub} onChange={setSub} tabs={[["tds", "TDS Register (Income Tax Sections)"], ["gst", "GST Ledger"], ["itc", "Input Tax Credit Matching"]]} />
      {sub === "tds" && (
        <Card title="TDS deducted on Vendor Bills" testid="tds-register" right={<>
          <Sel data-testid="tds-section-filter" value={sec} onChange={(e) => setSec(e.target.value)} options={[{ v: "", l: "All Sections" }, ...Object.entries(d.sections).map(([k, v]) => ({ v: k, l: `${k} · ${v}` }))]} style={{ width: 220 }} />
          <Btn tone="ghost" data-testid="tds-export" onClick={() => exportXlsx("TDS_Register", tds.map((r) => ({ Date: r.date, "Bill Ref": r.refNo, Vendor: r.vendor, PAN: r.pan, Section: r.section, "Basic ₹": r.basic, "Rate %": r.rate, "TDS ₹": r.tds })))}><Download size={12} /> Excel</Btn></>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
            <KPI testid="tds-kpi-total" label="Total TDS Payable" value={inr(sum(tds, "tds"))} />
            {secSum.map(([s, v]) => <KPI key={s} testid={`tds-kpi-${s}`} label={`Section ${s}`} value={inr(v)} tone="#7c3aed" />)}
          </div>
          <Table testid="tds-table" cols={["Date", "Bill Ref", "Vendor", "PAN", "Section", "Basic", "Rate", "TDS"]}
            rows={tds.map((r) => [r.date, r.refNo, r.vendor || r.vendorCode, r.pan || "—", r.section, inr(r.basic), `${r.rate}%`, <b>{inr(r.tds)}</b>])} />
        </Card>
      )}
      {sub === "gst" && (
        <Card title="GST Ledger · Output Tax vs Input Tax Credit (matched ITC only)" testid="gst-ledger">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 12 }}>
            <KPI testid="gst-kpi-out" label="Output GST" value={inr(sum(gout, "cgst") + sum(gout, "sgst") + sum(gout, "igst"))} tone="#dc2626" />
            <KPI testid="gst-kpi-in" label="Eligible ITC (matched)" value={inr(sum(gin.filter((r) => r.matched), "gst"))} tone="#16a34a" />
            <KPI testid="gst-kpi-net" label="Net GST Payable" value={inr(sum(gout, "cgst") + sum(gout, "sgst") + sum(gout, "igst") - sum(gin.filter((r) => r.matched), "gst"))} />
          </div>
          <Table testid="gst-table" cols={["Month", "Output CGST", "Output SGST", "Output IGST", "ITC CGST", "ITC SGST", "ITC IGST", "Net Payable"]}
            rows={months.map((m) => [m.month, inr(m.outC), inr(m.outS), inr(m.outI), inr(m.inC), inr(m.inS), inr(m.inI), <b>{inr(m.outC + m.outS + m.outI - m.inC - m.inS - m.inI)}</b>])} />
        </Card>
      )}
      {sub === "itc" && (
        <Card title={`ITC Matching · ${gin.filter((r) => r.matched).length}/${gin.length} matched with GSTR-2B`} testid="itc-list">
          <Table testid="itc-table" cols={["Date", "Bill Ref", "Vendor", "GSTIN", "CGST", "SGST", "IGST", "Total GST", "Matched in 2B", "Remarks"]}
            rows={gin.map((r) => [r.date, r.refNo, r.vendor || r.vendorCode, r.gstin || <span style={{ color: "#b91c1c" }}>No GSTIN</span>, inr(r.cgst), inr(r.sgst), inr(r.igst), <b>{inr(r.gst)}</b>,
              <input type="checkbox" data-testid={`itc-match-${r.refNo}`} checked={r.matched} disabled={!can("accounting", "e")} onChange={(e) => match(r, e.target.checked)} />,
              <Inp data-testid={`itc-remarks-${r.refNo}`} defaultValue={r.matchRemarks} disabled={!can("accounting", "e")} onBlur={(e) => e.target.value !== r.matchRemarks && match(r, r.matched, e.target.value)} placeholder="e.g. 2B mein nahi" />])} />
        </Card>
      )}
    </>
  );
};
