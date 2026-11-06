import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { Card, Grid, Field, Inp, Btn, Table, inr, num } from "../crm/crmShared";
import { accGet, accPost, fyStart, today, KPI } from "./accShared";
import { can } from "../../lib/acl";

// GST Input Tax Credit matching against GSTR-2B (registers are in Reports Management)
export const Tax = () => {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(today());
  const load = () => accGet("tax").then((d) => setRows(d.gstIn)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const gin = rows.filter((r) => r.date && r.date >= from && r.date <= to);
  const sum = (l) => l.reduce((s, r) => s + num(r.gst), 0);
  const match = async (r, matched, remarks = r.matchRemarks) => {
    try { await accPost("itc", { billKey: r.key, matched, remarks }); load(); } catch (e) { toast.error(e.message); }
  };
  return (
    <Card title={`GST Input Tax Credit Matching · ${gin.filter((r) => r.matched).length}/${gin.length} matched with GSTR-2B`} testid="itc-list"
      right={<Btn tone="ghost" data-testid="itc-open-reports" onClick={() => nav("/reports-hub?dept=acc_tds")}><BarChart3 size={12} /> TDS / GST Registers (Reports)</Btn>}>
      <Grid cols={4}>
        <Field label="From"><Inp data-testid="tax-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Inp data-testid="tax-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </Grid>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, margin: "12px 0" }}>
        <KPI testid="gst-kpi-in" label="Eligible ITC (matched)" value={inr(sum(gin.filter((r) => r.matched)))} tone="#16a34a" />
        <KPI testid="gst-kpi-pending" label="ITC pending match" value={inr(sum(gin.filter((r) => !r.matched)))} tone="#d97706" />
      </div>
      <Table testid="itc-table" cols={["Date", "Bill Ref", "Vendor", "GSTIN", "CGST", "SGST", "IGST", "Total GST", "Matched in 2B", "Remarks"]}
        rows={gin.map((r) => [r.date, r.refNo, r.vendor || r.vendorCode, r.gstin || <span style={{ color: "#b91c1c" }}>No GSTIN</span>, inr(r.cgst), inr(r.sgst), inr(r.igst), <b>{inr(r.gst)}</b>,
          <input type="checkbox" data-testid={`itc-match-${r.refNo}`} checked={r.matched} disabled={!can("accounting", "e")} onChange={(e) => match(r, e.target.checked)} />,
          <Inp data-testid={`itc-remarks-${r.refNo}`} defaultValue={r.matchRemarks} disabled={!can("accounting", "e")} onBlur={(e) => e.target.value !== r.matchRemarks && match(r, r.matched, e.target.value)} placeholder="e.g. 2B mein nahi" />])} />
    </Card>
  );
};
