import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Printer, FileSpreadsheet, ExternalLink } from "lucide-react";
import { getCompany } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, inr, num, crmReportRows, RA_STEPS, STEP_WF } from "./crmShared";

const LEAD_ST = (s) => s;
export const CRM_REPORTS = [
  { k: "ra_bills", hub: "crm_ra_bills", l: "RA / Milestone Bill Register", date: "billDate", status: (r) => RA_STEPS[r.step],
    cols: [["raNo", "Bill No"], ["type", "Type"], ["billDate", "Date"], ["clientName", "Client"], ["contractNo", "Contract"], ["basic", "Basic", 1], ["gstTotal", "GST Payable", 1], ["tdsAmt", "TDS", 1], ["retentionAmt", "Retention", 1], ["net", "Net", 1], ["_status", "Status"]] },
  { k: "mb", hub: "crm_mb", l: "Measurement Book Register", date: "date", status: (r) => STEP_WF[r.step],
    cols: [["mbNo", "MB No"], ["date", "Date"], ["contractNo", "Contract"], ["itemDesc", "Item"], ["location", "Location"], ["qty", "Qty"], ["unit", "Unit"], ["_status", "Status"]] },
  { k: "leads", hub: "crm_leads", l: "Leads & Enquiry Report", date: "createdAt", status: (r) => LEAD_ST(r.status),
    cols: [["leadNo", "Lead No"], ["name", "Client"], ["mobile", "Mobile"], ["projectType", "Type"], ["source", "Source"], ["value", "Est. Value", 1], ["_status", "Status"]] },
  { k: "clients", hub: "crm_clients", l: "Client Master", date: "createdAt", status: (r) => STEP_WF[r.step || 1],
    cols: [["clientCode", "Code"], ["tempRefId", "Temp ID"], ["name", "Name"], ["clientType", "Type"], ["mobile", "Mobile"], ["gst", "GSTIN"], ["_status", "Status"]] },
  { k: "contracts", hub: "crm_contracts", l: "Contract Register", date: "startDate", status: () => "",
    cols: [["contractNo", "Contract"], ["clientName", "Client"], ["projectName", "Project"], ["startDate", "Start"], ["contractValue", "Value", 1], ["retentionPct", "Ret. %"]] },
  { k: "change_orders", hub: "crm_change_orders", l: "Change Order Register", date: "date", status: (r) => STEP_WF[r.step],
    cols: [["coNo", "CO No"], ["date", "Date"], ["contractNo", "Contract"], ["description", "Description"], ["value", "Value", 1], ["_status", "Status"]] },
  { k: "retention", hub: "crm_retention", l: "Retention Money Register", date: "startDate", status: () => "",
    cols: [["contractNo", "Contract"], ["clientName", "Client"], ["projectName", "Project"], ["retentionPct", "Ret. %"], ["held", "Held", 1], ["released", "Released", 1], ["balance", "Balance", 1]] },
];

const cell = (r, [key, , money], rep) => (key === "_status" ? rep.status(r) || "" : money ? num(r[key]) : r[key] ?? "");

export const CrmReports = ({ data }) => {
  const nav = useNavigate();
  const [k, setK] = useState("ra_bills");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const rep = CRM_REPORTS.find((r) => r.k === k);
  const rows = useMemo(() => crmReportRows(k, data).filter((r) => {
    const d = String(r[rep.date] || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase());
  }), [k, data, from, to, q, rep]);
  const moneyCols = rep.cols.filter((c) => c[2]);
  const totals = moneyCols.map((c) => rows.reduce((s, r) => s + num(r[c[0]]), 0));

  const excel = () => {
    const sheet = rows.map((r) => Object.fromEntries(rep.cols.map((c) => [c[1], cell(r, c, rep)])));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Report");
    XLSX.writeFile(wb, `${rep.l.replace(/[^\w]+/g, "_")}.xlsx`);
  };
  const print = () => {
    const co = getCompany();
    const head = rep.cols.map((c) => `<th>${c[1]}</th>`).join("");
    const body = rows.map((r) => `<tr>${rep.cols.map((c) => `<td${c[2] ? " class=r" : ""}>${c[2] ? inr(cell(r, c, rep)) : cell(r, c, rep)}</td>`).join("")}</tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${rep.l}</title><style>body{font-family:Arial;font-size:11px;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #444;padding:4px}th{background:#dbeafe}.r{text-align:right}h2,h3{text-align:center;margin:3px}</style></head><body><h2>${co.name || ""}</h2><h3>${rep.l}${from || to ? ` (${from || "…"} to ${to || "…"})` : ""}</h3><table><tr>${head}</tr>${body}</table><p>Total records: ${rows.length}${moneyCols.map((c, i) => ` · ${c[1]}: ${inr(totals[i])}`).join("")}</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Card testid="crm-reports" title="Client & Revenue Reports" right={<>
      <Btn tone="ghost" data-testid="crm-report-excel" onClick={excel}><FileSpreadsheet size={14} /> Excel</Btn>
      <Btn tone="ghost" data-testid="crm-report-print" onClick={print}><Printer size={14} /> Print</Btn>
      <Btn data-testid="crm-report-hub" onClick={() => nav(`/reports-hub?dept=${rep.hub}`)}><ExternalLink size={14} /> Reports Hub</Btn>
    </>}>
      <Grid cols={4}>
        <Field label="Report"><Sel data-testid="crm-report-type" value={k} onChange={(e) => setK(e.target.value)} options={CRM_REPORTS.map((r) => ({ v: r.k, l: r.l }))} /></Field>
        <Field label="From"><Inp data-testid="crm-report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Inp data-testid="crm-report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Search"><Inp data-testid="crm-report-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client / bill / contract…" /></Field>
      </Grid>
      <div data-testid="crm-report-summary" style={{ margin: "12px 0", fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>
        {rows.length} records{moneyCols.map((c, i) => ` · ${c[1]}: ${inr(totals[i])}`).join("")}
      </div>
      <Table testid="crm-report-table" cols={rep.cols.map((c) => c[1])} rows={rows.map((r) => rep.cols.map((c) => (c[2] ? inr(cell(r, c, rep)) : String(cell(r, c, rep) || "—"))))} />
    </Card>
  );
};
