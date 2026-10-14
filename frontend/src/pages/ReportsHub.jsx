import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Printer, FileSpreadsheet, Download, Filter, BarChart3 } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import {
  getVendors, getBills, getPayments, getExpenses, getBOQs, getWOs,
  getEmployees, getPayBills, getLoans, getAdvanceRequests,
  getExits, getRecruitments,
  listFYOptions, getActiveFYOverride, PAYBILL_STATUS, ADVANCE_REQ_STATUS, LOAN_STATUS,
} from "../lib/store";

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
    amountKey: "grandTotal",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "Approved", 4: "Rejected" },
    columns: [
      { key: "permanentBillNo", label: "Bill No.", width: 140 },
      { key: "tempRef", label: "Temp Ref", width: 110 },
      { key: "vendorCode", label: "Vendor", width: 130 },
      { key: "vendorFirmName", label: "Firm Name", width: 180 },
      { key: "billDate", label: "Bill Date", width: 100 },
      { key: "invoiceNo", label: "Invoice No.", width: 120 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 90 },
    ],
  },
  {
    id: "payments", title: "Payment Vouchers", icon: "💰",
    fetch: getPayments,
    dateKey: "date",
    amountKey: "amount",
    statusKey: "status",
    statusMap: { Draft: "Draft", Submitted: "Submitted", Approved: "Approved" },
    columns: [
      { key: "pvNo", label: "PV No.", width: 140 },
      { key: "date", label: "Date", width: 100 },
      { key: "vendorCode", label: "Vendor", width: 130 },
      { key: "vendorName", label: "Vendor Name", width: 180 },
      { key: "billRef", label: "Bill Ref", width: 130 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "mode", label: "Mode", width: 100 },
      { key: "utrNo", label: "UTR", width: 140 },
      { key: "status", label: "Status", width: 100 },
    ],
  },
  {
    id: "expenses", title: "Expense Register", icon: "🧾",
    fetch: getExpenses,
    dateKey: "expenseDate",
    amountKey: "amount",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "Approved" },
    columns: [
      { key: "expenseNo", label: "Exp. No.", width: 140 },
      { key: "expenseDate", label: "Date", width: 100 },
      { key: "category", label: "Category", width: 140 },
      { key: "paidTo", label: "Paid To", width: 160 },
      { key: "project", label: "Project", width: 120 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 100 },
    ],
  },
  {
    id: "boqs", title: "BOQ Register", icon: "📐",
    fetch: getBOQs,
    dateKey: "boqDate",
    amountKey: "totalAmount",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "Approved" },
    columns: [
      { key: "boqNo", label: "BOQ No.", width: 140 },
      { key: "boqDate", label: "Date", width: 100 },
      { key: "projectCode", label: "Project", width: 120 },
      { key: "siteName", label: "Site", width: 140 },
      { key: "vendorCode", label: "Vendor", width: 130 },
      { key: "_amount", label: "Amount (₹)", width: 120, right: true },
      { key: "_status", label: "Status", width: 100 },
    ],
  },
  {
    id: "work_orders", title: "Work Orders", icon: "📋",
    fetch: getWorkOrders,
    dateKey: "woDate",
    amountKey: "totalAmount",
    statusKey: "step",
    statusMap: { 1: "Draft", 2: "Submitted", 3: "Approved", 4: "Vendor Accepted" },
    columns: [
      { key: "woNo", label: "WO No.", width: 140 },
      { key: "woDate", label: "Date", width: 100 },
      { key: "projectCode", label: "Project", width: 120 },
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
      { key: "empCode", label: "EMP Code", width: 110 },
      { key: "fullName", label: "Full Name", width: 180 },
      { key: "department", label: "Dept", width: 120 },
      { key: "designation", label: "Designation", width: 140 },
      { key: "doj", label: "DOJ", width: 100 },
      { key: "mobile", label: "Mobile", width: 110 },
      { key: "_amount", label: "Basic (₹)", width: 110, right: true },
      { key: "status", label: "Status", width: 100 },
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
];

const getCellValue = (row, col, cfg) => {
  if (col.key === "_amount") return Number(row[cfg.amountKey] || 0);
  if (col.key === "_status") return cfg.statusMap?.[row[cfg.statusKey]] || row[cfg.statusKey] || "—";
  if (col.key === "_empCount") return Array.isArray(row.lines) ? row.lines.filter((l) => !l.excluded).length : 0;
  if (col.key === "_period" && row.month && row.year) {
    return `${new Date(row.year, row.month - 1).toLocaleString("en", { month: "long" })} ${row.year}`;
  }
  return row[col.key] ?? "";
};

const ReportsHub = () => {
  const nav = useNavigate();
  const [activeDept, setActiveDept] = useState("vendors");
  const [refresh, setRefresh] = useState(0);
  const [fy, setFy] = useState(getActiveFYOverride() || "");
  const [month, setMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Cross-user real-time refresh
  useEffect(() => {
    const onSync = () => setRefresh((v) => v + 1);
    window.addEventListener("ae-sync-done", onSync);
    const onFy = () => setFy(getActiveFYOverride() || "");
    window.addEventListener("ae-fy-changed", onFy);
    return () => { window.removeEventListener("ae-sync-done", onSync); window.removeEventListener("ae-fy-changed", onFy); };
  }, []);

  const cfg = useMemo(() => DEPT_CONFIG.find((d) => d.id === activeDept), [activeDept]);
  const rawRows = useMemo(() => { try { return cfg.fetch() || []; } catch { return []; } }, [cfg, refresh]);

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

  const clearFilters = () => { setFy(""); setMonth(""); setFromDate(""); setToDate(""); setStatusFilter(""); setSearch(""); };

  const exportExcel = () => {
    const header = cfg.columns.map((c) => c.label);
    const rows = filteredRows.map((r) => cfg.columns.map((c) => getCellValue(r, c, cfg)));
    const data = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.title.slice(0, 28));
    const name = `${cfg.id}_${fy || "all"}_${month || "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, name);
    toast.success(`Excel exported · ${filteredRows.length} rows`);
  };

  const printReport = () => {
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups"); return; }
    const headerCells = cfg.columns.map((c) => `<th style="padding:6px 8px;background:#1e293b;color:#fff;font-size:10px;text-align:${c.right?'right':'left'};border:1px solid #334155;letter-spacing:.3px">${c.label}</th>`).join("");
    const bodyRows = filteredRows.map((r, i) => {
      const tds = cfg.columns.map((c) => {
        const v = getCellValue(r, c, cfg);
        const txt = c.key === "_amount" ? inrN(v) : String(v || "—");
        return `<td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10.5px;text-align:${c.right?'right':'left'};background:${i%2?'#f8fafc':'#fff'}">${txt}</td>`;
      }).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    const totalRow = cfg.amountKey ? `<tr><td colspan="${cfg.columns.length - 1}" style="padding:8px;background:#fef3c7;font-weight:900;text-align:right;border:1px solid #e2e8f0">TOTAL (${filteredRows.length} rows)</td><td style="padding:8px;background:#fef3c7;font-weight:900;text-align:right;border:1px solid #e2e8f0">₹ ${inrN(totalAmount)}</td></tr>` : "";
    const filterSummary = [
      fy && `FY: ${prettyFY(fy)}`,
      month && `Month: ${month}`,
      fromDate && `From: ${fromDate}`,
      toDate && `To: ${toDate}`,
      statusFilter && `Status: ${statusFilter}`,
      search && `Search: "${search}"`,
    ].filter(Boolean).join(" · ") || "All records";
    win.document.write(`<!doctype html><html><head><title>${cfg.title}</title>
      <style>
        @page{size:A4 landscape;margin:12mm}
        body{font-family:Arial,sans-serif;margin:0;padding:0;color:#0f172a}
        h1{font-size:16px;margin:0;color:#0f172a;letter-spacing:.5px}
        .meta{font-size:10px;color:#64748b;margin-top:3px}
        .filter{font-size:10.5px;color:#78350f;background:#fef3c7;padding:5px 10px;border:1px solid #fcd34d;border-radius:3px;margin:8px 0}
        table{width:100%;border-collapse:collapse;margin-top:6px}
      </style></head><body>
      <h1>${cfg.icon} Arun Enterprises · ${cfg.title}</h1>
      <div class="meta">Generated: ${new Date().toLocaleString("en-IN")}</div>
      <div class="filter"><b>Filters:</b> ${filterSummary}</div>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>
      <script>setTimeout(()=>{window.print();},300);</script>
    </body></html>`);
    win.document.close();
  };

  const exportPDF = () => {
    // Use the same print window flow — users can "Save as PDF" from the print dialog.
    // Keeps bundle lean (no jspdf dep needed for landscape tables).
    printReport();
    toast.info("Print dialog opened · choose 'Save as PDF' from destination");
  };

  const fyOpts = listFYOptions();

  return (
    <>
      <HomeNavBar />
      <Toaster position="top-right" richColors />
      <main style={{ padding: 18, maxWidth: 1500, margin: "0 auto" }}>
        <ModuleHero
          tag="Reports Hub · V1"
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
              onClick={() => { setActiveDept(d.id); clearFilters(); }}
              style={{ padding: "7px 12px", background: activeDept === d.id ? "linear-gradient(135deg,#4f46e5,#3730a3)" : "#fff", color: activeDept === d.id ? "#fff" : "#334155", border: `1.5px solid ${activeDept === d.id ? "#4f46e5" : "#cbd5e1"}`, borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: activeDept === d.id ? "0 2px 5px rgba(79,70,229,.4)" : "none" }}
            >
              <span>{d.icon}</span>
              {d.title}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ background: "#fff", border: "1.5px solid #c7d2fe", borderRadius: 6, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr) auto auto", gap: 8, alignItems: "end" }}>
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
            <button data-testid="rh-clear" onClick={clearFilters} title="Clear all filters" style={{ padding: "7px 12px", background: "#fff", color: "#4338ca", border: "1.5px solid #c7d2fe", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 4, height: 32 }}>
              <Filter size={12} /> Clear
            </button>
          </div>
        </div>

        {/* Summary & actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <div data-testid="rh-summary" style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 700 }}>
            <b style={{ color: "#4f46e5" }}>{cfg.icon} {cfg.title}</b> · {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""}
            {cfg.amountKey && <> · Total: <b style={{ color: "#166534" }}>{inr(totalAmount)}</b></>}
          </div>
          <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <button data-testid="rh-print" onClick={printReport} style={{ padding: "7px 14px", background: "linear-gradient(135deg,#64748b,#334155)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
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
                {cfg.columns.map((c) => (
                  <th key={c.key} style={{ padding: "8px 10px", background: "linear-gradient(135deg,#1e293b,#334155)", color: "#fff", textAlign: c.right ? "right" : "left", fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: "2px solid #4f46e5", minWidth: c.width || 100, whiteSpace: "nowrap" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={cfg.columns.length} style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>No records match the current filters</td></tr>
              ) : filteredRows.map((r, i) => (
                <tr key={r.id || r.pvNo || r.refNo || i} data-testid={`rh-row-${i}`} style={{ background: i % 2 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                  {cfg.columns.map((c) => {
                    const v = getCellValue(r, c, cfg);
                    const txt = c.key === "_amount" ? inrN(v) : String(v || "—");
                    const isAmt = c.key === "_amount";
                    const isStatus = c.key === "_status" || c.key === "status";
                    return (
                      <td key={c.key} style={{ padding: "6px 10px", textAlign: c.right ? "right" : "left", fontSize: 11, fontWeight: isAmt ? 700 : 500, color: isAmt ? "#166534" : "#0f172a", fontFamily: (c.key === "pvNo" || c.key === "utrNo" || c.key === "permanentBillNo" || c.key === "vendorCode" || c.key === "empCode") ? "monospace" : "inherit" }}>
                        {isStatus && txt !== "—" ? (
                          <span style={{ padding: "2px 8px", background: "#e0e7ff", color: "#3730a3", borderRadius: 10, fontSize: 10, fontWeight: 800, border: "1px solid #a5b4fc" }}>{txt}</span>
                        ) : txt}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {cfg.amountKey && filteredRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={cfg.columns.length - 1} style={{ padding: "8px 10px", background: "#fef3c7", textAlign: "right", fontWeight: 900, fontSize: 12, color: "#78350f", borderTop: "2px solid #f59e0b" }}>TOTAL ({filteredRows.length} rows):</td>
                  <td style={{ padding: "8px 10px", background: "#fef3c7", textAlign: "right", fontWeight: 900, fontSize: 12.5, color: "#166534", borderTop: "2px solid #f59e0b", fontFamily: "monospace" }}>₹ {inrN(totalAmount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </main>
    </>
  );
};

export default ReportsHub;
