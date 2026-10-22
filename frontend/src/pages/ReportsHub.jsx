import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Printer, FileSpreadsheet, Download, Filter, BarChart3, RefreshCw, Eye } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import {
  getVendors, getBills, getPayments, getExpenses, getBOQs, getWOs,
  getEmployees, getPayBills, getLoans, getAdvanceRequests,
  getExits, getRecruitments,
  listFYOptions, getActiveFYOverride, PAYBILL_STATUS, ADVANCE_REQ_STATUS, LOAN_STATUS,
  getCompany, getLogo, DEFAULT_COMPANY, currentUser, syncFromCloud,
} from "../lib/store";
import { loadCrmCache, crmReportRows, RA_STEPS, STEP_WF } from "../components/crm/crmShared";
import { CRM_REPORTS } from "../components/crm/CrmReports";

const CRM_AMOUNT = { ra_bills: "net", contracts: "contractValue", change_orders: "value", retention: "balance", leads: "value" };
const CRM_STATUS = { ra_bills: ["step", RA_STEPS], mb: ["step", STEP_WF], change_orders: ["step", STEP_WF], clients: ["step", STEP_WF], leads: ["status", null] };
const CRM_DEPTS = CRM_REPORTS.map((r) => ({
  id: r.hub, title: `CRM · ${r.l}`, icon: "◆",
  fetch: () => crmReportRows(r.k),
  dateKey: r.date,
  amountKey: CRM_AMOUNT[r.k] || null,
  statusKey: (CRM_STATUS[r.k] || [])[0],
  statusMap: (CRM_STATUS[r.k] || [])[1] || undefined,
  columns: r.cols.map(([key, label, money]) => ({ key, label, width: money ? 120 : 140, right: !!money })),
}));

// Alias — WO getter is exported as getWOs in store.js
const getWorkOrders = getWOs;

const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
const fyFromDate = (d) => {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt)) return "";
  const y = dt.getFullYear();
  const m = dt.getMonth();
  const s = m >= 3 ? y % 100 : (y - 1) % 100;
  return `${String(s).padStart(2, "0")}${String((s + 1) % 100).padStart(2, "0")}`;
};
const prettyFY = (fy) => (fy && fy.length === 4) ? `FY 20${fy.slice(0, 2)}-${fy.slice(2, 4)}` : fy;

// Shared CSS used by both the print window AND the in-page inline biodata panel.
// Classes are namespace-prefixed (.rh-ibi …) to avoid colliding with the rest of
// the React tree when rendered inline via dangerouslySetInnerHTML.
const BIODATA_CSS = `
  .rh-ibi * { box-sizing: border-box; }
  .rh-ibi { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
  .rh-ibi .bio-page { padding: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 10px; }
  .rh-ibi .lh { border: 2px solid #0f172a; padding: 10px 14px; display: flex; align-items: center; gap: 14px; background: #fff; }
  .rh-ibi .lh-logo { width: 70px; height: 70px; flex-shrink: 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; display:flex; align-items:center; justify-content:center; background:#fff }
  .rh-ibi .lh-logo img { max-width: 100%; max-height: 100%; object-fit: contain }
  .rh-ibi .lh-center { flex: 1; text-align: center; }
  .rh-ibi .lh-name { font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase; margin: 0; }
  .rh-ibi .lh-tag { font-size: 10.5px; font-style: italic; color: #475569; margin-top: 2px; }
  .rh-ibi .lh-pill { display: inline-block; background: #0f172a; color: #fff; font-size: 9.5px; font-weight: 700; padding: 2px 10px; border-radius: 10px; margin-top: 5px; text-transform: uppercase; }
  .rh-ibi .lh-addr { font-size: 10px; color: #334155; margin-top: 5px; }
  .rh-ibi .lh-contact { font-size: 9.5px; color: #0f172a; margin-top: 3px; }
  .rh-ibi .lh-right { width: 80px; text-align: right; font-size: 9px; color: #475569; flex-shrink: 0; }
  .rh-ibi .red-rule { height: 2px; background: #dc2626; margin: 2px 0 6px; }
  .rh-ibi .title-bar { background: linear-gradient(135deg,#1e293b,#4f46e5); color: #fff; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; margin: 4px 0 4px; border-radius: 3px; }
  .rh-ibi .title-bar h2 { margin: 0; font-size: 13px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
  .rh-ibi .title-bar .meta { font-size: 9.5px; opacity: .9; }
  .rh-ibi .bio-header-chips { display: flex; gap: 8px; margin: 6px 0 10px; flex-wrap: wrap; }
  .rh-ibi .hc { border: 1.5px solid #0f172a; border-radius: 4px; padding: 5px 10px; min-width: 150px; background: #fff; }
  .rh-ibi .hc-l { font-size: 8.5px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
  .rh-ibi .hc-v { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 1px; font-family: monospace; }
  .rh-ibi .hc-amt .hc-v { color: #166534; }
  .rh-ibi .hc-status { background: #fef3c7; border-color: #d97706; }
  .rh-ibi .hc-status .hc-v { color: #78350f; font-size: 11.5px; }
  .rh-ibi .bio-sec-title { font-size: 11px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; background: #e0e7ff; padding: 4px 10px; border-left: 4px solid #4f46e5; margin: 10px 0 6px; }
  .rh-ibi .img-strip { display: flex; gap: 14px; margin: 4px 0 10px; flex-wrap: wrap; }
  .rh-ibi .img-tile { border: 1.5px solid #0f172a; border-radius: 4px; padding: 4px 6px 6px; background: #fff; display: flex; flex-direction: column; align-items: center; }
  .rh-ibi .img-tile-l { font-size: 8.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
  .rh-ibi .img-tile-box { width: 85px; height: 100px; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .rh-ibi .img-tile-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .rh-ibi .fld-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #cbd5e1; border: 1px solid #cbd5e1; }
  .rh-ibi .fld { background: #fff; padding: 5px 8px; display: flex; flex-direction: column; min-height: 32px; }
  .rh-ibi .fld-l { font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
  .rh-ibi .fld-v { font-size: 10.5px; color: #0f172a; font-weight: 600; margin-top: 1px; word-break: break-word; }
  .rh-ibi .fld-v.amt { color: #166534; font-family: monospace; font-weight: 800; text-align: right; }
  .rh-ibi .lines-section { margin-top: 8px; }
  .rh-ibi .lines-title { font-size: 10.5px; font-weight: 900; color: #0f172a; margin-bottom: 3px; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
  .rh-ibi .lc-badge { background: #4f46e5; color: #fff; padding: 1px 7px; border-radius: 8px; font-size: 9px; font-weight: 800; }
  .rh-ibi .lines-tbl { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  .rh-ibi .lines-tbl th { background: #1e293b; color: #fff; padding: 4px 6px; font-size: 9px; text-transform: uppercase; border: 1px solid #000; font-weight: 800; text-align: left; }
  .rh-ibi .lines-tbl td { padding: 3px 6px; border: 1px solid #000; font-size: 9.5px; color: #0f172a; }
  .rh-ibi .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px; margin-top: 18px; }
  .rh-ibi .sig-box { text-align: center; font-size: 10px; }
  .rh-ibi .sig-box .name { font-size: 11px; color: #0f172a; font-weight: 700; padding: 0 4px 5px; border-bottom: 1.5px solid #0f172a; margin-bottom: 5px; min-height: 16px; }
  .rh-ibi .sig-box .role { font-weight: 900; letter-spacing: .6px; text-transform: uppercase; color: #0f172a; font-size: 10.5px; }
  .rh-ibi .footer-note { margin-top: 10px; padding-top: 6px; border-top: 1px dashed #94a3b8; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
`;

// Per-department config: how to extract date, amount, status; which columns to show
const DEPT_CONFIG = [
  {
    id: "vendors", title: "Vendor Register", icon: "🏢",
    fetch: getVendors,
    dateKey: "creationDate",
    amountKey: null,
    statusMap: { 1: "Draft", 2: "Submitted", 3: "Approved" },
    statusKey: "step",
    columns: [
      { key: "vendorCode", label: "Vendor Code", width: 130 },
      { key: "tempRefId", label: "Temp Ref", width: 110 },
      { key: "firmName", label: "Firm Name", width: 180 },
      { key: "contactPerson", label: "Contact", width: 130 },
      { key: "mobileNo", label: "Mobile", width: 110 },
      { key: "gstNo", label: "GST", width: 140 },
      { key: "panNo", label: "PAN", width: 110 },
      { key: "state", label: "State", width: 100 },
      { key: "creationDate", label: "Created", width: 100 },
      { key: "_status", label: "Status", width: 90 },
    ],
  },
  {
    id: "bills", title: "Bills Register", icon: "📄",
    fetch: getBills,
    dateKey: "billDate",
    amountKey: "_billAmount",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Measurement/Site", 3: "Purchase/WO Verify", 4: "Accounts Verify", 5: "Approved", 6: "Rejected" },
    columns: [
      { key: "permanentBillNo", fallbackKey: "refNo", label: "Bill No.", width: 140 },
      { key: "refNo", label: "Temp Ref", width: 110 },
      { key: "vendorCode", label: "Vendor Code", width: 130 },
      { key: "_vendorFirm", label: "Firm Name", width: 180 },
      { key: "billDate", label: "Bill Date", width: 100 },
      { key: "billNo", label: "Invoice No.", width: 120 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 150 },
    ],
  },
  {
    id: "payments", title: "Payment Vouchers", icon: "💰",
    fetch: getPayments,
    dateKey: "pvDate",
    amountKey: "amount",
    statusKey: "status",
    statusMap: { Draft: "Draft", Submitted: "Submitted", Approved: "Approved" },
    columns: [
      { key: "pvNo", label: "PV No.", width: 140 },
      { key: "pvDate", label: "Date", width: 100 },
      { key: "vendorCode", label: "Vendor", width: 130 },
      { key: "_vendorFirm", label: "Vendor Name", width: 180 },
      { key: "source", label: "Source", width: 130 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "utrNo", label: "UTR", width: 140 },
      { key: "paidAt", label: "Paid On", width: 100 },
      { key: "status", label: "Status", width: 100 },
    ],
  },
  {
    id: "expenses", title: "Expense Register", icon: "🧾",
    fetch: getExpenses,
    dateKey: "date",
    amountKey: "_expenseAmount",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Prepared", 3: "Checked", 4: "Approved & Paid" },
    columns: [
      { key: "permanentExpenseNo", fallbackKey: "refNo", label: "Exp. No.", width: 130 },
      { key: "refNo", label: "Temp Ref", width: 120 },
      { key: "date", label: "Date", width: 100 },
      { key: "category", label: "Category", width: 140 },
      { key: "paidToName", label: "Paid To", width: 160 },
      { key: "paymentMode", label: "Mode", width: 100 },
      { key: "_amount", label: "Net (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 130 },
    ],
  },
  {
    id: "boqs", title: "BOQ Register", icon: "📐",
    fetch: getBOQs,
    dateKey: "date",
    amountKey: "total",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "GM Reviewed", 4: "Approved" },
    columns: [
      { key: "boqNo", fallbackKey: "tempRefId", label: "BOQ No.", width: 140 },
      { key: "tempRefId", label: "Temp Ref", width: 130 },
      { key: "date", label: "Date", width: 100 },
      { key: "projectSite", label: "Project / Site", width: 160 },
      { key: "clientName", label: "Client", width: 140 },
      { key: "_lineCount", label: "Items", width: 70, right: true },
      { key: "_amount", label: "Total (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  {
    id: "work_orders", title: "Work Orders", icon: "📋",
    fetch: getWOs,
    dateKey: "woDate",
    amountKey: "total",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "GM Reviewed", 4: "Approved", 5: "Vendor Accepted" },
    columns: [
      { key: "woNo", fallbackKey: "tempRefId", label: "WO No.", width: 140 },
      { key: "tempRefId", label: "Temp Ref", width: 120 },
      { key: "woDate", label: "Date", width: 100 },
      { key: "expiryDate", label: "Expiry", width: 100 },
      { key: "vendorCode", label: "Vendor", width: 130 },
      { key: "scopeOfWork", label: "Scope", width: 220 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  {
    id: "paybills", title: "HR Pay Bills", icon: "💵",
    fetch: getPayBills,
    dateKey: "createdAt",
    amountKey: "totalNet",
    statusKey: "step",
    statusMap: PAYBILL_STATUS,
    columns: [
      { key: "refNo", label: "Ref No.", width: 140 },
      { key: "monthKey", label: "Month", width: 100 },
      { key: "_period", label: "Period", width: 160 },
      { key: "_empCount", label: "Employees", width: 90, right: true },
      { key: "totalGross", label: "Gross (₹)", width: 120, right: true },
      { key: "totalAdvance", label: "Adv (₹)", width: 110, right: true },
      { key: "_amount", label: "Net (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  {
    id: "advances", title: "Advance Requests", icon: "⚡",
    fetch: getAdvanceRequests,
    dateKey: "requestDate",
    amountKey: "amount",
    statusKey: "status",
    statusMap: ADVANCE_REQ_STATUS,
    columns: [
      { key: "refNo", label: "Ref No.", width: 150 },
      { key: "requestDate", label: "Date", width: 100 },
      { key: "empCode", label: "EMP Code", width: 100 },
      { key: "empName", label: "Employee", width: 170 },
      { key: "department", label: "Dept", width: 110 },
      { key: "_amount", label: "Amount (₹)", width: 110, right: true },
      { key: "repaymentMode", label: "Repay", width: 120 },
      { key: "linkedPvNo", label: "PV No.", width: 130 },
      { key: "_status", label: "Status", width: 130 },
    ],
  },
  {
    id: "loans", title: "Loan Register", icon: "🏦",
    fetch: getLoans,
    dateKey: "sanctionDate",
    amountKey: "amount",
    statusKey: "status",
    statusMap: LOAN_STATUS,
    columns: [
      { key: "refNo", label: "Ref No.", width: 140 },
      { key: "sanctionDate", label: "Date", width: 100 },
      { key: "empCode", label: "EMP Code", width: 100 },
      { key: "empName", label: "Employee", width: 170 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "emiMonths", label: "EMI m", width: 80, right: true },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  {
    id: "employees", title: "Employee Master", icon: "👥",
    fetch: getEmployees,
    dateKey: "doj",
    amountKey: "basic",
    statusKey: "status",
    statusMap: { Active: "Active", Draft: "Draft", Exited: "Exited" },
    columns: [
      { key: "photoUrl", label: "Photo", width: 60, image: true },
      { key: "empCode", label: "EMP Code", width: 110 },
      { key: "fullName", label: "Full Name", width: 170 },
      { key: "department", label: "Dept", width: 110 },
      { key: "designation", label: "Designation", width: 130 },
      { key: "doj", label: "DOJ", width: 100 },
      { key: "mobile", label: "Mobile", width: 110 },
      { key: "_amount", label: "Basic (₹)", width: 110, right: true },
      { key: "signatureUrl", label: "Signature", width: 90, image: true },
      { key: "status", label: "Status", width: 90 },
    ],
  },
  {
    id: "exits", title: "Exits (F&F)", icon: "🚪",
    fetch: getExits,
    dateKey: "lastWorkingDay",
    amountKey: "fnfNet",
    statusKey: "status",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "GM Approved", 4: "Settled" },
    columns: [
      { key: "empCode", label: "EMP Code", width: 100 },
      { key: "empName", label: "Employee", width: 170 },
      { key: "resignDate", label: "Resign", width: 100 },
      { key: "lastWorkingDay", label: "LWD", width: 100 },
      { key: "_amount", label: "F&F Net (₹)", width: 120, right: true },
      { key: "linkedPvNo", label: "PV No.", width: 130 },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  {
    id: "fooding", title: "Weekly Fooding", icon: "🍽️",
    fetch: () => { try { return JSON.parse(localStorage.getItem("ae_vm_fooding") || "[]"); } catch { return []; } },
    dateKey: "fromDate",
    amountKey: null,
    statusKey: "status",
    statusMap: { Draft: "Draft", Submitted: "Submitted", Approved: "Approved" },
    columns: [
      { key: "refNo", label: "Ref No.", width: 140 },
      { key: "month", label: "Month", width: 100 },
      { key: "year", label: "Year", width: 70, right: true },
      { key: "circle", label: "Circle", width: 110 },
      { key: "projectRef", label: "Project Ref", width: 150 },
      { key: "fromDate", label: "From", width: 100 },
      { key: "toDate", label: "To", width: 100 },
      { key: "fy", label: "FY", width: 70 },
      { key: "_lineCount", label: "Lines", width: 70, right: true },
      { key: "_totalAmt", label: "Total (₹)", width: 110, right: true },
      { key: "approvedBy", label: "Approver", width: 140 },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  {
    id: "recruitments", title: "Recruitment", icon: "🎯",
    fetch: getRecruitments,
    dateKey: "appliedDate",
    amountKey: null,
    statusKey: "status",
    statusMap: { 1: "Applied", 2: "Interview", 3: "Offered", 4: "Hired", 5: "Rejected" },
    columns: [
      { key: "refNo", label: "Ref", width: 140 },
      { key: "candidateName", label: "Candidate", width: 180 },
      { key: "appliedPost", label: "Applied Post", width: 140 },
      { key: "appliedDate", label: "Date", width: 100 },
      { key: "mobile", label: "Mobile", width: 110 },
      { key: "_status", label: "Status", width: 110 },
    ],
  },
  ...CRM_DEPTS,
];

const getCellValue = (row, col, cfg) => {
  // Computed columns
  if (col.key === "_amount") {
    // Specific per-dept computed amount fallbacks
    if (cfg.amountKey === "_billAmount") {
      // Bills: use grandTotal if present, else basic+gst-tds
      const basic = Number(row.basicAmount) || 0;
      const gst = +(basic * (Number(row.gstSlab) || 0) / 100).toFixed(2);
      const tds = +(basic * (Number(row.tdsRate) || 0) / 100).toFixed(2);
      const other = Number(row.otherDeductions) || 0;
      return Number(row.grandTotal) || Number(row.netPayable) || +(basic + gst - tds - other).toFixed(2);
    }
    if (cfg.amountKey === "_expenseAmount") {
      const basic = Number(row.basicAmount) || 0;
      const gst = +(basic * (Number(row.gstSlab) || 0) / 100).toFixed(2);
      const tds = +(basic * (Number(row.tdsRate) || 0) / 100).toFixed(2);
      const other = Number(row.otherDeductions) || 0;
      return Number(row.netPayable) || +(basic + gst - tds - other).toFixed(2);
    }
    return Number(row[cfg.amountKey] || 0);
  }
  if (col.key === "_status") return cfg.statusMap?.[row[cfg.statusKey]] || row[cfg.statusKey] || "—";
  if (col.key === "_empCount") return Array.isArray(row.lines) ? row.lines.filter((l) => !l.excluded).length : 0;
  if (col.key === "_lineCount") return Array.isArray(row.lines) ? row.lines.length : (Array.isArray(row.items) ? row.items.length : 0);
  if (col.key === "_totalAmt") return Array.isArray(row.lines) ? row.lines.reduce((s, l) => s + Number(l.amount || 0), 0) : 0;
  if (col.key === "_period" && row.month && row.year) {
    return `${new Date(row.year, row.month - 1).toLocaleString("en", { month: "long" })} ${row.year}`;
  }
  if (col.key === "_vendorFirm") return row.vendorFirmName || row.vendorName || row.vendorSnapshot?.firmName || "";
  // Direct key — try fallbackKey when the primary value is empty/null.
  // Used for Bills (permanentBillNo → refNo), Expenses, BOQ, WO where the
  // permanent number is issued only on approval. Prevents the entire column
  // from rendering "—" for drafts.
  const primary = row[col.key];
  if (primary === null || primary === undefined || primary === "") {
    if (col.fallbackKey) {
      const fb = row[col.fallbackKey];
      if (fb !== null && fb !== undefined && fb !== "") return fb;
    }
    return "";
  }
  return primary;
};

// Universal helpers for biodata rendering
const prettifyKey = (k) => String(k).replace(/[<>"'&]/g, "")
  .replace(/([A-Z])/g, " $1")
  .replace(/[_-]/g, " ")
  .replace(/^./, (s) => s.toUpperCase())
  .replace(/\bNo\b/, "No.")
  .replace(/\bId\b/, "ID")
  .replace(/\bGst\b/, "GST")
  .replace(/\bPan\b/, "PAN")
  .replace(/\bPv\b/, "PV")
  .replace(/\bWo\b/, "WO")
  .replace(/\bBoq\b/, "BOQ")
  .replace(/\bHr\b/, "HR")
  .replace(/\bUtr\b/, "UTR")
  .replace(/\bEmp\b/, "Emp")
  .replace(/\bFy\b/, "FY")
  .replace(/\bFnf\b/, "F&F")
  .replace(/\bIfsc\b/, "IFSC")
  .replace(/\bDoj\b/, "DOJ")
  .replace(/\bDob\b/, "DOB")
  .replace(/\bLwd\b/, "LWD")
  .replace(/\bEmi\b/, "EMI")
  .replace(/\bPf\b/, "PF")
  .replace(/\bEsi\b/, "ESI")
  .trim();

const isAmountKey = (k) => /amount|total|gross|net|basic|subtotal|amt|gstAmt|tds|cgst|sgst|igst|deduction|advance|balance|emi|salary|wage|fnf|rate|cost|price|hra|allowance|bonus|overtime|penalty/i.test(k);
const isSkipKey = (k) => /^(id|_id|__v|password|logo|avatar|attachment|docs)$/i.test(k) || k.startsWith("_");
// IMAGE field: either the key name hints at an image/signature, or the value is a data-URL / http(s) image.
const isImageKey = (k) => /^(photo|signature|photoUrl|signatureUrl|photo_url|signature_url|avatarUrl|avatar_url|idPhoto|idPhotoUrl)$/i.test(k) || /(^|_)(photo|signature|avatar)(_?url)?$/i.test(k);
const isImageValue = (v) => typeof v === "string" && (/^data:image\//i.test(v) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(v));
// Always hide IMAGE-type fields from the text grid — populated images show in the Photo & Signature strip;
// empty ones are simply omitted (prevents "Photo Url — —" placeholder rows in the biodata).
const isImageFieldAlwaysHide = (k) => isImageKey(k);
const isLineKey = (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null;
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const formatValue = (k, v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (isAmountKey(k) && (typeof v === "number" || !isNaN(Number(v)))) return "₹ " + inrN(v);
  return escHtml(v);
};

// Letterhead + title band (shared across summary + biodata pages)
const buildLetterhead = (co, logo, refNo, nowStr, cfg, selFlag = "") => `
  <div class="lh">
    <div class="lh-logo"><img src="${logo}" onerror="this.style.display='none'" alt="logo" /></div>
    <div class="lh-center">
      <div class="lh-name">${co.name}</div>
      ${co.tagline ? `<div class="lh-tag">${co.tagline}</div>` : ""}
      ${co.pillLine ? `<div class="lh-pill">${co.pillLine}</div>` : ""}
      ${co.address ? `<div class="lh-addr">${co.address}</div>` : ""}
      <div class="lh-contact">
        ${co.tollFree ? `<b>Phone:</b> ${co.tollFree} &nbsp;` : ""}
        ${co.email ? `&nbsp;•&nbsp; <b>Email:</b> ${co.email} &nbsp;` : ""}
        ${co.website ? `&nbsp;•&nbsp; <b>Web:</b> ${co.website}` : ""}
        ${(co.gst || co.pan) ? `<br><b>GST:</b> ${co.gst || "—"} &nbsp;•&nbsp; <b>PAN:</b> ${co.pan || "—"}${co.cin ? ` &nbsp;•&nbsp; <b>CIN:</b> ${co.cin}` : ""}` : ""}
      </div>
    </div>
    <div class="lh-right">
      <div style="font-weight:800;color:#0f172a;font-size:9.5px;letter-spacing:.4px;text-transform:uppercase">Ref No.</div>
      <div style="font-family:monospace;font-weight:800;color:#0f172a;font-size:10px;margin-top:2px;word-break:break-all">${refNo}</div>
      <div style="margin-top:6px;color:#64748b;font-size:9px">${new Date().toLocaleDateString("en-IN")}</div>
    </div>
  </div>
  <div class="red-rule"></div>
  <div class="title-bar">
    <h2>${cfg.icon} ${cfg.title}${selFlag}</h2>
    <div class="meta">Generated: ${nowStr}</div>
  </div>
`;

// 4-column sign panel (Feb-2026 user request):
// Created By · Prepared By · Checked By · Approved By — each column shows the ACTUAL
// Login ID name who took that step on the record. Falls back to the user who is
// printing the report (summary batch) when a per-record field is empty.
const buildSignaturePanel = (row, me) => {
  const dash = "— to be signed —";
  const printer = me || "";
  const createdBy  = row?.createdByName       || printer || dash;
  const preparedBy = row?.preparedByName      || row?.submittedByName || printer || dash;
  const checkedBy  = row?.checkedByName       || row?.verifiedByName  || row?.settledByName || dash;
  const approvedBy = row?.finalApprovedByName || row?.approvedByName  || row?.approvedBy    || row?.gmApprovedByName || dash;
  const cell = (role, name) => `<div class="sig-box"><div class="name">${escHtml(name)}</div><div class="role">${role}</div></div>`;
  return `<div class="sigs">
    ${cell("Created By",  createdBy)}
    ${cell("Prepared By", preparedBy)}
    ${cell("Checked By",  checkedBy)}
    ${cell("Approved By", approvedBy)}
  </div>`;
};

// Compact card (2-per-page biodata)
const buildCompactCard = (row, idx, total, cfg) => {
  const refNo = escHtml(row.pvNo || row.permanentBillNo || row.refNo || row.boqNo || row.woNo || row.expenseNo || row.vendorCode || row.empCode || `#${idx + 1}`);
  const statusLabel = escHtml(cfg.statusMap?.[row[cfg.statusKey]] || row[cfg.statusKey] || "");
  const allEntries = Object.entries(row).filter(([k, v]) => !isSkipKey(k) && !isLineKey(v) && typeof v !== "object" && !isImageFieldAlwaysHide(k));
  const imageEntries = Object.entries(row).filter(([k, v]) => isImageKey(k) && typeof v === "string" && v.trim() !== "");
  const fieldEntries = allEntries;
  const cells = fieldEntries.map(([k, v]) => {
    const isAmt = isAmountKey(k) && (typeof v === "number" || !isNaN(Number(v)));
    const val = formatValue(k, v);
    return `<div class="cc-f"><div class="cc-l">${prettifyKey(k)}</div><div class="cc-v${isAmt ? " amt" : ""}">${val}</div></div>`;
  }).join("");
  const imgHTML = imageEntries.length ? `<div class="cc-img-row">${imageEntries.map(([k, v]) => `
      <div class="cc-img-tile">
        <div class="cc-img-l">${prettifyKey(k).replace(/\s*Url$/i, "")}</div>
        <div class="cc-img-box"><img src="${/^(data:image\/|https?:\/\/|\/)/i.test(String(v)) ? escHtml(v) : ""}" onerror="this.style.display='none'" /></div>
      </div>`).join("")}</div>` : "";
  return `<div class="compact-card">
    <div class="cc-head"><b>${refNo}</b><span>${idx + 1} / ${total} · ${statusLabel}</span></div>
    ${imgHTML}
    <div class="cc-grid">${cells}</div>
  </div>`;
};

// Build the per-record biodata card HTML (letterhead + title + fields + line items + signatures)
const buildBiodataCard = (row, idx, total, cfg, co, logo, nowStr, pageBreak = true, me = "") => {
  const bioRefNo = escHtml(row.pvNo || row.permanentBillNo || row.refNo || row.boqNo || row.woNo || row.expenseNo || row.vendorCode || row.empCode || `${cfg.id.toUpperCase()}-${idx+1}`);
  // Filter fields: skip internal, skip object/line-items (will render separately)
  const allFieldEntries = Object.entries(row).filter(([k, v]) => !isSkipKey(k) && !isLineKey(v) && typeof v !== "object" && !isImageFieldAlwaysHide(k));
  // Separate image fields (photo / signature / avatar) from text fields
  const imageEntries = Object.entries(row).filter(([k, v]) => isImageKey(k) && typeof v === "string" && v.trim() !== "");
  const fieldEntries = allFieldEntries;
  // Build dedicated Photo / Signature strip at top of record details
  const imageStripHTML = imageEntries.length ? `
    <div class="bio-sec-title">PHOTO &amp; SIGNATURE</div>
    <div class="img-strip">
      ${imageEntries.map(([k, v]) => `
        <div class="img-tile">
          <div class="img-tile-l">${prettifyKey(k).replace(/\s*Url$/i, "")}</div>
          <div class="img-tile-box"><img src="${/^(data:image\/|https?:\/\/|\/)/i.test(String(v)) ? escHtml(v) : ""}" alt="${prettifyKey(k)}" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'color:#94a3b8;font-size:10px\\'>Image not available</span>'" /></div>
        </div>`).join("")}
    </div>
  ` : "";
  // Status derived label as first chip
  const statusLabel = escHtml(cfg.statusMap?.[row[cfg.statusKey]] || row[cfg.statusKey] || "");
  // Partition: amount/date/status fields come first (header strip), rest in grid
  const headerFields = [];
  if (cfg.amountKey && row[cfg.amountKey] != null) headerFields.push([cfg.amountKey, row[cfg.amountKey], true]);
  if (cfg.dateKey && row[cfg.dateKey]) headerFields.push([cfg.dateKey, row[cfg.dateKey], false]);
  const headerChips = headerFields.map(([k, v, isAmt]) => `
    <div class="hc ${isAmt ? "hc-amt" : ""}">
      <div class="hc-l">${prettifyKey(k)}</div>
      <div class="hc-v">${formatValue(k, v)}</div>
    </div>`).join("");
  const statusChip = statusLabel ? `<div class="hc hc-status"><div class="hc-l">Status</div><div class="hc-v">${statusLabel}</div></div>` : "";

  const fieldHTML = fieldEntries.map(([k, v]) => {
    const isAmt = isAmountKey(k) && (typeof v === "number" || !isNaN(Number(v)));
    const val = formatValue(k, v);
    return `<div class="fld"><div class="fld-l">${prettifyKey(k)}</div><div class="fld-v${isAmt ? " amt" : ""}">${val}</div></div>`;
  }).join("");

  // Line-items rendering (dynamic — any array of objects on the row)
  const lineEntries = Object.entries(row).filter(([k, v]) => isLineKey(v));
  const linesHTML = lineEntries.map(([lk, lines]) => {
    const cols = Object.keys(lines[0]).filter((c) => !isSkipKey(c));
    const header = cols.map((c) => `<th>${prettifyKey(c)}</th>`).join("");
    let runningTotal = 0;
    const body = lines.map((ln, i) => {
      const tds = cols.map((c) => {
        const v = ln[c];
        const isAmt = isAmountKey(c) && (typeof v === "number" || !isNaN(Number(v)));
        if (isAmt && v != null && v !== "") runningTotal += Number(v || 0);
        const txt = formatValue(c, v);
        return `<td style="${isAmt ? "text-align:right;font-family:monospace;font-weight:700;color:#166534" : ""}">${txt}</td>`;
      }).join("");
      return `<tr style="background:${i % 2 ? "#f8fafc" : "#fff"}">${tds}</tr>`;
    }).join("");
    // Attempt to find the first "amount-like" column for grand-total of the line section
    const amtCol = cols.find((c) => isAmountKey(c));
    const totalRow = amtCol ? `<tr><td colspan="${cols.length - 1}" style="text-align:right;background:#fef3c7;font-weight:900">LINE TOTAL (${lines.length})</td><td style="text-align:right;background:#fef3c7;font-weight:900;color:#166534;font-family:monospace">₹ ${inrN(runningTotal)}</td></tr>` : "";
    return `<div class="lines-section">
      <div class="lines-title">▸ ${prettifyKey(lk)} <span class="lc-badge">${lines.length}</span></div>
      <table class="lines-tbl"><thead><tr>${header}</tr></thead><tbody>${body}${totalRow}</tbody></table>
    </div>`;
  }).join("");

  return `<div class="bio-page" style="${pageBreak ? "page-break-after:always;" : ""}">
    ${buildLetterhead(co, logo, bioRefNo, nowStr, cfg, ` · Full Record Detail (${idx + 1}/${total})`)}
    <div class="bio-header-chips">${statusChip}${headerChips}</div>
    ${imageStripHTML}
    <div class="bio-sec-title">RECORD DETAILS</div>
    <div class="fld-grid">${fieldHTML}</div>
    ${linesHTML}
    ${buildSignaturePanel(row, me)}
    <div class="footer-note">
      <span>System-generated detail record · ${co.name}</span>
      <span>Record ${idx + 1} of ${total} · ${nowStr}</span>
    </div>
  </div>`;
};

const ReportsHub = () => {
  const nav = useNavigate();
  const [activeDept, setActiveDept] = useState(() => {
    const q = new URLSearchParams(window.location.search).get("dept");
    return DEPT_CONFIG.some((d) => d.id === q) ? q : "vendors";
  });
  const [refresh, setRefresh] = useState(0);
  const [fy, setFy] = useState(getActiveFYOverride() || "");
  const [month, setMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [printMode, setPrintMode] = useState("summary"); // summary | full | compact | both  (summary = ek process ek bar; "both" bar bar duplicate dikhata tha)
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  // Inline biodata view (shown directly inside the datasheet, no new tab).
  // `inlineAll` renders every filtered row as a card below the table.
  //   false       → nothing
  //   "selected"  → only checkbox-selected rows (requires selection)
  //   "all"       → every filtered row
  // `expandedKey` renders a single row's biodata as a details row below it.
  const [inlineAll, setInlineAll] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);

  // Pull fresh snapshot from backend — surfaces data created by other users
  // (cross-user sync). Also triggered automatically on tab change (silent).
  const doSync = async (silent = false) => {
    if (syncing) return;
    setSyncing(true);
    try {
      await Promise.all([syncFromCloud(), loadCrmCache().catch(() => null)]);
      setRefresh((v) => v + 1);
      setLastSyncAt(new Date());
      if (!silent) toast.success("✓ Latest data pulled from server");
    } catch (e) {
      if (!silent) toast.error("Sync failed · check network");
    } finally {
      setSyncing(false);
    }
  };

  // Silent background sync on first mount + every tab switch so data never looks stale.
  useEffect(() => { doSync(true); /* eslint-disable-next-line */ }, [activeDept]);

  // Row-key resolver — stable identity for selection + React key
  const rowKey = (r, i) => r.id || r.pvNo || r.refNo || r.boqNo || r.empCode || r.permanentBillNo || `idx-${i}`;

  // Cross-user real-time refresh
  useEffect(() => {
    const onSync = () => setRefresh((v) => v + 1);
    window.addEventListener("ae-sync-done", onSync);
    const onFy = () => setFy(getActiveFYOverride() || "");
    window.addEventListener("ae-fy-changed", onFy);
    return () => { window.removeEventListener("ae-sync-done", onSync); window.removeEventListener("ae-fy-changed", onFy); };
  }, []);

  const cfg = useMemo(() => DEPT_CONFIG.find((d) => d.id === activeDept), [activeDept]);
  const rawRows = useMemo(() => {
    try {
      const raw = cfg.fetch() || [];
      // Defensive de-dup — collapse rows that share the same unique process key.
      // Prevents the "same PV / Bill / BOQ showing 5× in a row" display bug.
      const seen = new Set();
      const out = [];
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i];
        const key = r?.pvNo || r?.permanentBillNo || r?.refNo || r?.boqNo || r?.woNo || r?.expenseNo || r?.vendorCode || r?.empCode || r?.id;
        if (!key) { out.push(r); continue; }
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(r);
      }
      return out;
    } catch { return []; }
  }, [cfg, refresh]);

  const filteredRows = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return rawRows.filter((r) => {
      // FY filter — matches row's date to FY range
      if (fy) {
        const rowFY = fyFromDate(r[cfg.dateKey]);
        if (rowFY && rowFY !== fy) return false;
      }
      // Month filter (YYYY-MM)
      if (month) {
        const d = r[cfg.dateKey];
        if (!d || !String(d).startsWith(month)) return false;
      }
      // Date range
      if (fromDate && (!r[cfg.dateKey] || r[cfg.dateKey] < fromDate)) return false;
      if (toDate && (!r[cfg.dateKey] || r[cfg.dateKey] > toDate)) return false;
      // Status
      if (statusFilter) {
        const sv = cfg.statusMap?.[r[cfg.statusKey]] || r[cfg.statusKey] || "";
        if (String(sv) !== statusFilter) return false;
      }
      // Search
      if (q) {
        const blob = Object.values(r).map((v) => String(v || "")).join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rawRows, cfg, fy, month, fromDate, toDate, statusFilter, search]);

  const totalAmount = useMemo(() => {
    if (!cfg.amountKey) return 0;
    return filteredRows.reduce((s, r) => s + Number(r[cfg.amountKey] || 0), 0);
  }, [filteredRows, cfg]);

  const statusOptions = useMemo(() => {
    if (!cfg.statusMap) return [];
    const vals = new Set();
    rawRows.forEach((r) => { const s = cfg.statusMap?.[r[cfg.statusKey]] || r[cfg.statusKey]; if (s) vals.add(String(s)); });
    return Array.from(vals);
  }, [rawRows, cfg]);

  // KPI dashboard tiles — computed from the currently-filtered rows so numbers
  // react live to FY/Month/Date-range/Status/Search filters. Classifies rows
  // into {draft, pending, approved} buckets using cfg.statusMap and renders
  // one tile per non-empty bucket plus a Count + optional Total-Amount tile.
  const kpis = useMemo(() => {
    const map = cfg.statusMap || {};
    const entries = Object.entries(map); // [[key, label], ...] in schema order
    const finalKey = entries.length ? entries[entries.length - 1][0] : null;
    const draftKey = entries.length ? entries[0][0] : null;
    // Count rows per status LABEL (so numeric-step and string-status both work)
    const perLabel = {};
    let draftCount = 0, approvedCount = 0, pendingCount = 0, rejectedCount = 0;
    for (const r of filteredRows) {
      const rawStatus = r[cfg.statusKey];
      const label = map[rawStatus] || rawStatus || "Unknown";
      perLabel[label] = (perLabel[label] || 0) + 1;
      const rs = String(rawStatus);
      if (finalKey != null && rs === String(finalKey)) approvedCount += 1;
      else if (draftKey != null && rs === String(draftKey)) draftCount += 1;
      else if (/reject/i.test(label)) rejectedCount += 1;
      else pendingCount += 1;
    }
    return { total: filteredRows.length, perLabel, draftCount, pendingCount, approvedCount, rejectedCount };
  }, [filteredRows, cfg]);

  const clearFilters = () => { setFy(""); setMonth(""); setFromDate(""); setToDate(""); setStatusFilter(""); setSearch(""); setSelectedIds(new Set()); setInlineAll(false); setExpandedKey(null); };

  // Shared values used by both the print window and the inline biodata renders.
  // Memoised so the inline-view HTML doesn't rebuild on every keystroke.
  const co = useMemo(() => ({ ...DEFAULT_COMPANY, ...(getCompany() || {}) }), []);
  const logo = useMemo(() => getLogo() || "/arun-logo.jpg", []);
  const me = useMemo(() => currentUser() || "", []);
  const nowStr = useMemo(() => new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }), [refresh]);

  // Rows that will actually be exported — if any selection is active use those,
  // otherwise fall back to the full filtered set.
  const exportRows = useMemo(() => {
    if (selectedIds.size === 0) return filteredRows;
    return filteredRows.filter((r, i) => selectedIds.has(rowKey(r, i)));
  }, [filteredRows, selectedIds]);
  const exportTotal = useMemo(() => {
    if (!cfg.amountKey) return 0;
    return exportRows.reduce((s, r) => s + Number(r[cfg.amountKey] || 0), 0);
  }, [exportRows, cfg]);

  const allPageIds = useMemo(() => filteredRows.map((r, i) => rowKey(r, i)), [filteredRows]);
  const allSelected = allPageIds.length > 0 && allPageIds.every((k) => selectedIds.has(k));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allPageIds));
  };
  const toggleRow = (key) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const exportExcel = () => {
    const rowsToUse = exportRows;
    const header = cfg.columns.map((c) => c.label);
    const rows = rowsToUse.map((r) => cfg.columns.map((c) => {
      // Avoid dumping multi-KB data-URLs into Excel cells
      if (c.image) {
        const v = getCellValue(r, c, cfg);
        return v && String(v).trim() !== "" ? "<attached>" : "";
      }
      return getCellValue(r, c, cfg);
    }));
    const data = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.title.slice(0, 28));
    const name = `${cfg.id}_${selectedIds.size ? "selected" : (fy || "all")}_${month || "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, name);
    toast.success(`Excel exported · ${rowsToUse.length} rows${selectedIds.size ? " (selected)" : ""}`);
  };

  const printReport = (modeOverride, customRows, viewOnly = false) => {
    const mode = modeOverride || printMode;
    const rowsToUse = customRows || exportRows;
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups"); return; }
    const co = { ...DEFAULT_COMPANY, ...(getCompany() || {}) };
    const logo = getLogo() || "/arun-logo.jpg";
    const me = currentUser() || "";
    const headerCells = cfg.columns.map((c) => `<th style="padding:5px 7px;background:#1e293b;color:#fff;font-size:9.5px;text-align:${c.right?'right':'left'};border:1px solid #000;letter-spacing:.3px;font-weight:800;text-transform:uppercase">${c.label}</th>`).join("");
    const bodyRows = rowsToUse.map((r, i) => {
      const tds = cfg.columns.map((c) => {
        const v = getCellValue(r, c, cfg);
        // IMAGE columns — render <img> in print (not raw data-URL text)
        if (c.image) {
          const url = v && String(v).trim() !== "" ? String(v).replace(/"/g, "&quot;") : "";
          const h = c.key === "signatureUrl" ? 22 : 36;
          const fit = c.key === "signatureUrl" ? "contain" : "cover";
          const imgCell = url
            ? `<img src="${url}" style="height:${h}px;max-width:${(c.width || 60) - 10}px;object-fit:${fit};border:1px solid #cbd5e1;border-radius:2px;background:#fff" alt="${c.label}" onerror="this.style.display='none'" />`
            : `<span style="color:#94a3b8;font-size:9px">—</span>`;
          return `<td style="padding:3px 5px;border:1px solid #000;text-align:center;background:${i%2?'#f8fafc':'#fff'}">${imgCell}</td>`;
        }
        const txt = c.key === "_amount" ? inrN(v) : String(v || "—");
        return `<td style="padding:4px 7px;border:1px solid #000;font-size:10px;text-align:${c.right?'right':'left'};background:${i%2?'#f8fafc':'#fff'};${c.key==='_amount'?'font-weight:700;color:#166534;font-family:monospace':''}">${txt}</td>`;
      }).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    const totalRow = cfg.amountKey ? `<tr>
      <td colspan="${cfg.columns.length - 1}" style="padding:6px 8px;background:#fef3c7;font-weight:900;text-align:right;border:1px solid #000;font-size:11px">GRAND TOTAL (${rowsToUse.length} rows${selectedIds.size ? " · SELECTED" : ""}):</td>
      <td style="padding:6px 8px;background:#fef3c7;font-weight:900;text-align:right;border:1px solid #000;font-size:11.5px;color:#166534;font-family:monospace">₹ ${inrN(exportTotal)}</td>
    </tr>` : "";
    const filterRows = [
      selectedIds.size && ["Selected Rows", `${selectedIds.size} of ${filteredRows.length}`],
      fy && ["Financial Year", prettyFY(fy)],
      month && ["Month", month],
      fromDate && ["From Date", fromDate],
      toDate && ["To Date", toDate],
      statusFilter && ["Status", statusFilter],
      search && ["Search", `"${search}"`],
    ].filter(Boolean);
    const filterSummary = filterRows.length
      ? filterRows.map(([k, v]) => `<tr><td style="padding:3px 8px;border:1px solid #cbd5e1;font-weight:700;background:#f1f5f9;width:140px;font-size:10px;letter-spacing:.3px;text-transform:uppercase;color:#334155">${k}</td><td style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px">${v}</td></tr>`).join("")
      : `<tr><td style="padding:3px 8px;border:1px solid #cbd5e1;font-size:10.5px;color:#64748b" colspan="2">All records — no filters applied</td></tr>`;
    const nowStr = new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" });
    const refNo = `RPT/${cfg.id.toUpperCase()}/${new Date().toISOString().slice(0,10).replace(/-/g,'')}/${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Build the Summary Table HTML (page 1 of combined-mode / sole page for summary-mode)
    const summaryHTML = `
      <div class="sum-page" ${mode === "both" ? 'style="page-break-after:always"' : ""}>
        ${buildLetterhead(co, logo, refNo, nowStr, cfg, " · Register (Summary)")}
        <div class="filter-block">
          <table class="filter-table">${filterSummary}</table>
          <div class="ref-box">
            <div class="lbl">Total Rows</div>
            <div class="val" style="font-size:14px">${rowsToUse.length}${selectedIds.size ? ` of ${filteredRows.length}` : ""}</div>
            ${cfg.amountKey ? `<div class="lbl" style="margin-top:4px">Grand Total</div><div class="val" style="color:#166534;font-size:13px">₹ ${inrN(exportTotal)}</div>` : ""}
          </div>
        </div>
        <table class="data"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>
        ${buildSignaturePanel(null, me)}
        <div class="footer-note">
          <span>System-generated register from ${co.name} · For internal filing &amp; audit records only.</span>
          <span>Printed: ${nowStr}</span>
        </div>
      </div>
    `;

    // Build full biodata pages (one record per A4)
    const fullBiodataHTML = rowsToUse.map((r, i) =>
      buildBiodataCard(r, i, rowsToUse.length, cfg, co, logo, nowStr, true, me)
    ).join("");

    // Build compact biodata (2 cards per A4 page — group pairs)
    const compactPagesHTML = (() => {
      const pages = [];
      for (let i = 0; i < rowsToUse.length; i += 2) {
        const r1 = rowsToUse[i];
        const r2 = rowsToUse[i + 1];
        const isLast = i + 2 >= rowsToUse.length;
        pages.push(`<div class="compact-page" ${!isLast ? 'style="page-break-after:always"' : ""}>
          ${buildLetterhead(co, logo, refNo, nowStr, cfg, ` · Compact Biodata (Page ${Math.floor(i / 2) + 1})`)}
          <div class="compact-grid">
            ${buildCompactCard(r1, i, rowsToUse.length, cfg)}
            ${r2 ? buildCompactCard(r2, i + 1, rowsToUse.length, cfg) : '<div class="compact-card compact-empty"></div>'}
          </div>
          ${buildSignaturePanel(null, me)}
          <div class="footer-note">
            <span>Compact biodata · ${co.name}</span>
            <span>Printed: ${nowStr}</span>
          </div>
        </div>`);
      }
      return pages.join("");
    })();

    // Decide what to render based on mode
    let bodyContent = "";
    if (mode === "summary") bodyContent = summaryHTML;
    else if (mode === "full") bodyContent = fullBiodataHTML || summaryHTML;
    else if (mode === "compact") bodyContent = compactPagesHTML || summaryHTML;
    else { // both — Summary first, then full biodata pages
      bodyContent = summaryHTML + fullBiodataHTML;
    }

    const isPortrait = mode === "full" || mode === "compact";

    win.document.write(`<!doctype html><html><head><title>${co.name} · ${cfg.title}</title>
      <style>
        @page { size: A4 ${isPortrait ? "portrait" : "landscape"}; margin: 10mm 10mm 14mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #0f172a; }
        .sum-page, .bio-page, .compact-page { padding: 2mm; }
        /* ---- Letterhead ---- */
        .lh { border: 2px solid #0f172a; padding: 10px 14px; display: flex; align-items: center; gap: 14px; background: #fff; }
        .lh-logo { width: 80px; height: 80px; flex-shrink: 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; display:flex; align-items:center; justify-content:center; background:#fff }
        .lh-logo img { max-width: 100%; max-height: 100%; object-fit: contain }
        .lh-center { flex: 1; text-align: center; }
        .lh-name { font-size: 22px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase; margin: 0; }
        .lh-tag { font-size: 10.5px; font-style: italic; color: #475569; margin-top: 2px; letter-spacing: .3px; }
        .lh-pill { display: inline-block; background: #0f172a; color: #fff; font-size: 9.5px; font-weight: 700; letter-spacing: .5px; padding: 2px 10px; border-radius: 10px; margin-top: 5px; text-transform: uppercase; }
        .lh-addr { font-size: 10px; color: #334155; margin-top: 5px; }
        .lh-contact { font-size: 9.5px; color: #0f172a; margin-top: 3px; }
        .lh-contact b { color: #0f172a; }
        .lh-right { width: 80px; text-align: right; font-size: 9px; color: #475569; flex-shrink: 0; }
        .red-rule { height: 2px; background: #dc2626; margin: 2px 0 6px; }
        /* ---- Title bar ---- */
        .title-bar { background: linear-gradient(135deg,#1e293b,#4f46e5); color: #fff; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; margin: 4px 0 4px; border-radius: 3px; }
        .title-bar h2 { margin: 0; font-size: 13px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
        .title-bar .meta { font-size: 9.5px; letter-spacing: .5px; opacity: .9; }
        /* ---- Filter summary ---- */
        .filter-block { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 6px; }
        .filter-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        .filter-table td { padding: 3px 8px; border: 1px solid #cbd5e1; }
        .ref-box { border: 1.5px solid #0f172a; padding: 5px 8px; font-size: 10px; }
        .ref-box .lbl { color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; font-size: 9px; }
        .ref-box .val { font-family: monospace; font-weight: 800; color: #0f172a; }
        /* ---- Data table ---- */
        table.data { width: 100%; border-collapse: collapse; margin-top: 2px; }
        table.data th, table.data td { border: 1px solid #000; }
        /* ---- Biodata card (Full detail) ---- */
        .bio-header-chips { display: flex; gap: 8px; margin: 6px 0 10px; flex-wrap: wrap; }
        .hc { border: 1.5px solid #0f172a; border-radius: 4px; padding: 5px 10px; min-width: 150px; background: #fff; }
        .hc-l { font-size: 8.5px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
        .hc-v { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 1px; font-family: monospace; }
        .hc-amt .hc-v { color: #166534; }
        .hc-status { background: #fef3c7; border-color: #d97706; }
        .hc-status .hc-v { color: #78350f; font-size: 11.5px; letter-spacing: .3px; }
        .bio-sec-title { font-size: 11px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; background: #e0e7ff; padding: 4px 10px; border-left: 4px solid #4f46e5; margin: 10px 0 6px; }
        /* ---- Photo & Signature strip ---- */
        .img-strip { display: flex; gap: 14px; margin: 4px 0 10px; flex-wrap: wrap; }
        .img-tile { border: 1.5px solid #0f172a; border-radius: 4px; padding: 4px 6px 6px; background: #fff; display: flex; flex-direction: column; align-items: center; }
        .img-tile-l { font-size: 8.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
        .img-tile-box { width: 85px; height: 100px; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .img-tile-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
        /* Signature tile is wider / shorter */
        .img-tile:has(.img-tile-l:is([data-sig])) .img-tile-box { width: 150px; height: 60px; }
        /* Compact biodata image row */
        .cc-img-row { display: flex; gap: 8px; margin: 4px 0 6px; justify-content: center; }
        .cc-img-tile { border: 1px solid #cbd5e1; border-radius: 3px; padding: 3px; display: flex; flex-direction: column; align-items: center; background: #fff; }
        .cc-img-l { font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 2px; }
        .cc-img-box { width: 54px; height: 60px; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .cc-img-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .fld-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #cbd5e1; border: 1px solid #cbd5e1; }
        .fld { background: #fff; padding: 5px 8px; display: flex; flex-direction: column; min-height: 32px; }
        .fld-l { font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
        .fld-v { font-size: 10.5px; color: #0f172a; font-weight: 600; margin-top: 1px; word-break: break-word; }
        .fld-v.amt { color: #166534; font-family: monospace; font-weight: 800; text-align: right; }
        /* ---- Line items table inside biodata ---- */
        .lines-section { margin-top: 8px; }
        .lines-title { font-size: 10.5px; font-weight: 900; color: #0f172a; margin-bottom: 3px; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
        .lc-badge { background: #4f46e5; color: #fff; padding: 1px 7px; border-radius: 8px; font-size: 9px; font-weight: 800; }
        .lines-tbl { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        .lines-tbl th { background: #1e293b; color: #fff; padding: 4px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; border: 1px solid #000; font-weight: 800; text-align: left; }
        .lines-tbl td { padding: 3px 6px; border: 1px solid #000; font-size: 9.5px; color: #0f172a; }
        /* ---- Compact (2-per-page) ---- */
        .compact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
        .compact-card { border: 1.5px solid #0f172a; border-radius: 4px; padding: 8px; background: #fff; }
        .compact-card .cc-head { background: linear-gradient(135deg,#4f46e5,#3730a3); color: #fff; padding: 4px 8px; border-radius: 3px; margin: -8px -8px 6px; display: flex; justify-content: space-between; align-items: center; }
        .compact-card .cc-head b { font-size: 11px; letter-spacing: .5px; font-family: monospace; }
        .compact-card .cc-head span { font-size: 9px; opacity: .9; }
        .compact-card .cc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; }
        .compact-card .cc-f { background: #fff; padding: 3px 6px; }
        .compact-card .cc-l { font-size: 7.5px; color: #64748b; font-weight: 700; text-transform: uppercase; }
        .compact-card .cc-v { font-size: 9.5px; color: #0f172a; font-weight: 600; }
        .compact-card .cc-v.amt { color: #166534; font-family: monospace; font-weight: 800; }
        .compact-empty { border: 1.5px dashed #cbd5e1; background: #f8fafc; }
        /* ---- Signatures / Footer ---- */
        /* Flipped layout (Feb-2026 user request): NAME on top → signature line → ROLE below. */
        .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px; margin-top: 22px; page-break-inside: avoid; }
        .sig-box { text-align: center; font-size: 10px; }
        .sig-box .name { font-size: 11px; color: #0f172a; font-weight: 700; padding: 0 4px 5px; border-bottom: 1.5px solid #0f172a; margin-bottom: 5px; min-height: 16px; letter-spacing: .2px; }
        .sig-box .role { font-weight: 900; letter-spacing: .6px; text-transform: uppercase; color: #0f172a; font-size: 10.5px; }
        .footer-note { margin-top: 10px; padding-top: 6px; border-top: 1px dashed #94a3b8; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
        /* Avoid breaking rows across pages */
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        .bio-page, .compact-page { page-break-inside: avoid; }
      </style></head><body>
      ${bodyContent}
      <script>${viewOnly ? "" : "setTimeout(()=>{window.print();},400);"}</script>
    </body></html>`);
    win.document.close();
  };

  const exportPDF = () => {
    // Use the same print window flow — users can "Save as PDF" from the print dialog.
    // Keeps bundle lean (no jspdf dep needed for landscape tables).
    printReport(printMode);
    const label = { summary: "Summary Only", full: "Full Biodata (1/page)", compact: "Compact (2/page)", both: "Summary + Full Biodata" }[printMode] || "Report";
    toast.info(`Print dialog opened · ${label} · choose 'Save as PDF'`);
  };

  const fyOpts = listFYOptions();

  return (
    <>
      <HomeNavBar />
      <Toaster position="top-right" richColors />
      <main style={{ padding: 18, maxWidth: 1500, margin: "0 auto" }}>
        <ModuleHero
          tag="Reports Hub"
          title="All Departments · Dept-wise Reports"
          subtitle="FY / Month / Date-range filters · Print A4 · PDF · Excel · 12 modules"
          icon={BarChart3}
          gradient="linear-gradient(135deg,#312e81 0%,#4f46e5 45%,#0ea5e9 100%)"
          shadowRgba="79,70,229,.28"
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2.5, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Dashboard · Department Reports</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 10 }}>
              <BarChart3 size={26} color="#4f46e5" /> Reports Hub
            </h1>
          </div>
          <button onClick={() => nav("/home")} style={{ padding: "7px 14px", background: "#e2e8f0", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <ArrowLeft size={13} /> Dashboard
          </button>
        </div>

        {/* Department tabs */}
        <div data-testid="rh-dept-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: 8, background: "#f1f5f9", borderRadius: 6, marginBottom: 14, border: "1px solid #e2e8f0" }}>
          {DEPT_CONFIG.map((d) => (
            <button
              key={d.id}
              data-testid={`rh-tab-${d.id}`}
              onClick={() => { setActiveDept(d.id); clearFilters(); setSelectedIds(new Set()); }}
              style={{ padding: "7px 12px", background: activeDept === d.id ? "linear-gradient(135deg,#4f46e5,#3730a3)" : "#fff", color: activeDept === d.id ? "#fff" : "#334155", border: `1.5px solid ${activeDept === d.id ? "#4f46e5" : "#cbd5e1"}`, borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: activeDept === d.id ? "0 2px 5px rgba(79,70,229,.4)" : "none" }}
            >
              <span>{d.icon}</span>
              {d.title}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ background: "#fff", border: "1.5px solid #c7d2fe", borderRadius: 6, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(120px, 1fr))", gap: 8, alignItems: "end", marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Financial Year</label>
              <select data-testid="rh-fy" value={fy} onChange={(e) => setFy(e.target.value)} style={{ marginTop: 3, width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11.5, fontWeight: 700, background: "#fff" }}>
                <option value="">All FY</option>
                {fyOpts.map((f) => <option key={f} value={f}>{prettyFY(f)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Month</label>
              <input data-testid="rh-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginTop: 3, width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11.5 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>From Date</label>
              <input data-testid="rh-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ marginTop: 3, width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11.5 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>To Date</label>
              <input data-testid="rh-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ marginTop: 3, width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11.5 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Status</label>
              <select data-testid="rh-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ marginTop: 3, width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11.5, fontWeight: 700, background: "#fff" }}>
                <option value="">All</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Search</label>
              <input data-testid="rh-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Any text…" style={{ marginTop: 3, width: "100%", padding: "6px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11.5 }} />
            </div>
          </div>
          {/* Action buttons on their own row — proper breathing room */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingTop: 10, borderTop: "1px dashed #e0e7ff" }}>
            <button data-testid="rh-sync" onClick={() => doSync(false)} disabled={syncing} title={lastSyncAt ? `Last sync: ${lastSyncAt.toLocaleTimeString("en-IN")}` : "Pull latest data from server"} style={{ padding: "7px 14px", background: syncing ? "#94a3b8" : "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 4, cursor: syncing ? "wait" : "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5, height: 32 }}>
              <RefreshCw size={12} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} /> {syncing ? "Syncing…" : "Sync"}
            </button>
            <button data-testid="rh-view-selected" onClick={() => {
              if (selectedIds.size === 0) { toast.error("Select at least one row (checkbox) to View"); return; }
              setInlineAll("selected");
              setExpandedKey(null);
              toast.success(`▸ Showing ${exportRows.length} selected record(s) inline — scroll below the table`);
            }} title="View only the checkbox-selected row(s) inline (below the table)" style={{ padding: "7px 14px", background: inlineAll === "selected" ? "linear-gradient(135deg,#dc2626,#991b1b)" : "linear-gradient(135deg,#4f46e5,#3730a3)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5, height: 32 }}>
              <Eye size={12} /> View {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </button>
            <button data-testid="rh-view-all" onClick={() => {
              if (!filteredRows.length) { toast.error("No records to view"); return; }
              const next = inlineAll === "all" ? false : "all";
              setInlineAll(next);
              setExpandedKey(null);
              if (next === "all") toast.success(`▸ Showing all ${filteredRows.length} record(s) inline — scroll below the table`);
            }} title={inlineAll === "all" ? "Hide inline View All" : "View ALL filtered records inline (below the table)"} style={{ padding: "7px 14px", background: inlineAll === "all" ? "linear-gradient(135deg,#dc2626,#991b1b)" : "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5, height: 32 }}>
              <Eye size={12} /> {inlineAll === "all" ? "Hide All" : `View All (${filteredRows.length})`}
            </button>
            <button data-testid="rh-clear" onClick={clearFilters} title="Clear all filters & inline views" style={{ padding: "7px 14px", background: "#fff", color: "#4338ca", border: "1.5px solid #c7d2fe", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5, height: 32, marginLeft: "auto" }}>
              <Filter size={12} /> Clear
            </button>
          </div>
        </div>

        {/* KPI tiles — live counts for the active department / filters */}
        <div data-testid="rh-kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
          <div data-testid="rh-kpi-total" style={{ background: "linear-gradient(135deg,#1e293b,#334155)", color: "#fff", padding: "10px 14px", borderRadius: 6, borderLeft: "4px solid #4f46e5" }}>
            <div style={{ fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase", opacity: 0.75, fontWeight: 800 }}>Total Records</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginTop: 2 }}>{kpis.total}</div>
            <div style={{ fontSize: 9, opacity: 0.65, marginTop: 1 }}>{cfg.icon} {cfg.title}</div>
          </div>
          {cfg.amountKey && (
            <div data-testid="rh-kpi-amount" style={{ background: "linear-gradient(135deg,#064e3b,#065f46)", color: "#fff", padding: "10px 14px", borderRadius: 6, borderLeft: "4px solid #10b981" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase", opacity: 0.75, fontWeight: 800 }}>Grand Total</div>
              <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "monospace", marginTop: 2 }}>₹ {inrN(totalAmount)}</div>
              <div style={{ fontSize: 9, opacity: 0.65, marginTop: 1 }}>Sum of {kpis.total} record(s)</div>
            </div>
          )}
          {kpis.draftCount > 0 && (
            <div data-testid="rh-kpi-draft" style={{ background: "#fff", color: "#334155", padding: "10px 14px", borderRadius: 6, border: "1.5px solid #cbd5e1", borderLeft: "4px solid #94a3b8" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>Draft</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginTop: 2, color: "#475569" }}>{kpis.draftCount}</div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>Not yet submitted</div>
            </div>
          )}
          {kpis.pendingCount > 0 && (
            <div data-testid="rh-kpi-pending" style={{ background: "#fff", color: "#78350f", padding: "10px 14px", borderRadius: 6, border: "1.5px solid #fde68a", borderLeft: "4px solid #d97706" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase", color: "#92400e", fontWeight: 800 }}>Pending</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginTop: 2, color: "#b45309" }}>{kpis.pendingCount}</div>
              <div style={{ fontSize: 9, color: "#a16207", marginTop: 1 }}>In workflow (mid-stage)</div>
            </div>
          )}
          {kpis.approvedCount > 0 && (
            <div data-testid="rh-kpi-approved" style={{ background: "#fff", color: "#166534", padding: "10px 14px", borderRadius: 6, border: "1.5px solid #86efac", borderLeft: "4px solid #16a34a" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase", color: "#166534", fontWeight: 800 }}>Approved</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginTop: 2, color: "#15803d" }}>{kpis.approvedCount}</div>
              <div style={{ fontSize: 9, color: "#4d7c0f", marginTop: 1 }}>Final-stage records</div>
            </div>
          )}
          {kpis.rejectedCount > 0 && (
            <div data-testid="rh-kpi-rejected" style={{ background: "#fff", color: "#991b1b", padding: "10px 14px", borderRadius: 6, border: "1.5px solid #fecaca", borderLeft: "4px solid #dc2626" }}>
              <div style={{ fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase", color: "#991b1b", fontWeight: 800 }}>Rejected</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", marginTop: 2, color: "#b91c1c" }}>{kpis.rejectedCount}</div>
              <div style={{ fontSize: 9, color: "#dc2626", marginTop: 1 }}>Returned / rejected</div>
            </div>
          )}
        </div>

        {/* Summary & actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <div data-testid="rh-summary" style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 700 }}>
            <b style={{ color: "#4f46e5" }}>{cfg.icon} {cfg.title}</b> · {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""}
            {cfg.amountKey && <> · Total: <b style={{ color: "#166534" }}>{inr(totalAmount)}</b></>}
            {selectedIds.size > 0 && (
              <>
                {" · "}
                <span data-testid="rh-selected-count" style={{ padding: "2px 10px", background: "linear-gradient(135deg,#4f46e5,#3730a3)", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>✓ {selectedIds.size} selected</span>
                {cfg.amountKey && <> · <b style={{ color: "#be185d" }}>Selected Total: {inr(exportTotal)}</b></>}
                <button data-testid="rh-clear-selection" onClick={() => setSelectedIds(new Set())} title="Clear selection" style={{ marginLeft: 8, padding: "2px 10px", background: "#fff", color: "#be185d", border: "1.5px solid #be185d", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 10.5 }}>Clear ✗</button>
              </>
            )}
          </div>
          <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "#f1f5f9", border: "1.5px solid #c7d2fe", borderRadius: 5 }}>
              <label style={{ fontSize: 10, color: "#4338ca", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Print Mode</label>
              <select data-testid="rh-print-mode" value={printMode} onChange={(e) => setPrintMode(e.target.value)} style={{ padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "#fff", color: "#0f172a" }}>
                <option value="summary">Summary Only · 1 row per record</option>
                <option value="full">Full Biodata · 1 A4 page per record</option>
                <option value="compact">Compact · 2 records per A4</option>
                <option value="both">Summary + Full Biodata (both)</option>
              </select>
            </div>
            <button data-testid="rh-print" onClick={() => printReport()} style={{ padding: "7px 14px", background: "linear-gradient(135deg,#64748b,#334155)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Printer size={13} /> Print A4
            </button>
            <button data-testid="rh-pdf" onClick={exportPDF} style={{ padding: "7px 14px", background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Download size={13} /> PDF
            </button>
            <button data-testid="rh-xlsx" onClick={exportExcel} style={{ padding: "7px 14px", background: "linear-gradient(135deg,#16a34a,#166534)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>

        {/* Data table */}
        <div style={{ background: "#fff", border: "1.5px solid #cbd5e1", borderRadius: 6, overflow: "auto", maxHeight: "65vh" }}>
          <table data-testid="rh-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ padding: "8px 8px", background: "linear-gradient(135deg,#1e293b,#334155)", color: "#fff", textAlign: "center", width: 40, borderBottom: "2px solid #4f46e5" }}>
                  <input
                    type="checkbox"
                    data-testid="rh-check-all"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    title={allSelected ? "Unselect all" : "Select all filtered rows"}
                    style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#4f46e5" }}
                  />
                </th>
                {cfg.columns.map((c) => (
                  <th key={c.key} style={{ padding: "8px 10px", background: "linear-gradient(135deg,#1e293b,#334155)", color: "#fff", textAlign: c.right ? "right" : "left", fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: "2px solid #4f46e5", minWidth: c.width || 100, whiteSpace: "nowrap" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={cfg.columns.length + 1} style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>No records match the current filters</td></tr>
              ) : filteredRows.map((r, i) => {
                const k = rowKey(r, i);
                const isSel = selectedIds.has(k);
                return (
                <React.Fragment key={k}>
                <tr data-testid={`rh-row-${i}`} style={{ background: isSel ? "#eef2ff" : (i % 2 ? "#f8fafc" : "#fff"), borderBottom: "1px solid #e2e8f0", borderLeft: isSel ? "3px solid #4f46e5" : "3px solid transparent" }}>
                  <td style={{ padding: "6px 4px", textAlign: "center", width: 60, whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      data-testid={`rh-check-row-${i}`}
                      checked={isSel}
                      onChange={() => toggleRow(k)}
                      title={isSel ? "Unselect this row" : "Select this row for export"}
                      style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#4f46e5", verticalAlign: "middle" }}
                    />
                    <button
                      data-testid={`rh-view-row-${i}`}
                      onClick={() => { setExpandedKey((k2) => k2 === k ? null : k); setInlineAll(false); }}
                      title={expandedKey === k ? "Hide this record" : "View full record inline"}
                      style={{ marginLeft: 6, padding: "2px 4px", background: expandedKey === k ? "#4f46e5" : "transparent", border: "none", color: expandedKey === k ? "#fff" : "#4f46e5", cursor: "pointer", verticalAlign: "middle", borderRadius: 3 }}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                  {cfg.columns.map((c) => {
                    const v = getCellValue(r, c, cfg);
                    const empty = v === null || v === undefined || v === "";
                    const txt = c.key === "_amount" ? inrN(v) : (empty ? "—" : String(v));
                    const isAmt = c.key === "_amount";
                    const isStatus = c.key === "_status" || c.key === "status";
                    // IMAGE columns (photoUrl / signatureUrl) — render thumbnail, not URL text
                    if (c.image) {
                      const url = v && String(v).trim() !== "" ? String(v) : "";
                      return (
                        <td key={c.key} style={{ padding: "4px 6px", textAlign: "center" }}>
                          {url ? (
                            <img
                              src={url}
                              alt={c.label}
                              data-testid={`rh-img-${c.key}-${i}`}
                              style={{ height: c.key === "signatureUrl" ? 28 : 40, maxWidth: c.width - 20, border: "1px solid #cbd5e1", borderRadius: 3, objectFit: c.key === "signatureUrl" ? "contain" : "cover", background: "#fff", display: "inline-block" }}
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                          ) : (
                            <span style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>—</span>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} style={{ padding: "6px 10px", textAlign: c.right ? "right" : "left", fontSize: 11, fontWeight: isAmt ? 700 : 500, color: isAmt ? "#166534" : "#0f172a", fontFamily: (c.key === "pvNo" || c.key === "utrNo" || c.key === "permanentBillNo" || c.key === "vendorCode" || c.key === "empCode") ? "monospace" : "inherit" }}>
                        {isStatus && txt !== "—" ? (
                          <span style={{ padding: "2px 8px", background: "#e0e7ff", color: "#3730a3", borderRadius: 10, fontSize: 10, fontWeight: 800, border: "1px solid #a5b4fc" }}>{txt}</span>
                        ) : txt}
                      </td>
                    );
                  })}
                </tr>
                {expandedKey === k && (
                  <tr data-testid={`rh-expanded-${i}`}>
                    <td colSpan={cfg.columns.length + 1} style={{ padding: 0, background: "#f1f5f9", borderBottom: "3px solid #4f46e5" }}>
                      <div className="rh-ibi" style={{ padding: 12 }} dangerouslySetInnerHTML={{ __html: `<style>${BIODATA_CSS}</style>${buildBiodataCard(r, 0, 1, cfg, co, logo, nowStr, false, me)}` }} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
            {cfg.amountKey && filteredRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={cfg.columns.length} style={{ padding: "8px 10px", background: "#fef3c7", textAlign: "right", fontWeight: 900, fontSize: 12, color: "#78350f", borderTop: "2px solid #f59e0b" }}>TOTAL ({selectedIds.size > 0 ? `${selectedIds.size} selected of ${filteredRows.length}` : `${filteredRows.length} rows`}):</td>
                  <td style={{ padding: "8px 10px", background: "#fef3c7", textAlign: "right", fontWeight: 900, fontSize: 12.5, color: "#166534", borderTop: "2px solid #f59e0b", fontFamily: "monospace" }}>₹ {inrN(selectedIds.size > 0 ? exportTotal : totalAmount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Inline biodata panel — shown directly inside the datasheet when the
            user clicks "View" (selected rows) or "View All" (all filtered). */}
        {inlineAll && (() => {
          const rows = inlineAll === "selected" ? exportRows : filteredRows;
          if (!rows.length) return null;
          const html = rows.map((r, i) => buildBiodataCard(r, i, rows.length, cfg, co, logo, nowStr, false, me)).join("");
          return (
            <div data-testid="rh-inline-biodata" style={{ marginTop: 14, border: "2px solid #4f46e5", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "8px 14px", background: "linear-gradient(135deg,#4f46e5,#3730a3)", color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>▸ Inline Biodata · {inlineAll === "selected" ? `${rows.length} Selected Record(s)` : `All ${rows.length} Record(s)`}</span>
                <button data-testid="rh-inline-close" onClick={() => setInlineAll(false)} style={{ padding: "3px 10px", background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.4)", color: "#fff", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>Close ✗</button>
              </div>
              <div className="rh-ibi" style={{ padding: 14, background: "#f8fafc", maxHeight: "80vh", overflow: "auto" }} dangerouslySetInnerHTML={{ __html: `<style>${BIODATA_CSS}</style>${html}` }} />
            </div>
          );
        })()}
      </main>
    </>
  );
};

export default ReportsHub;
