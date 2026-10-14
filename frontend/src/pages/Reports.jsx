import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import TopActionBar from "../components/TopActionBar";
import HomeNavBar from "../components/HomeNavBar";
import VendorQueryModal from "../components/VendorQueryModal";
import SuperAdminDelete from "../components/SuperAdminDelete";
import { exportBankTransferXLSX, printBankTransferAdvice, printBulkBankAdvice } from "../lib/bankTransfer";
import {
  getBills, getVendors, computeBill, getPayments, savePayments, deletePaymentCloud, nextPvNo, toApprovedPvNo,
  currentUser, exportJSON, amountToWords,
  canFinalApprove, currentUserEmail, APPROVER_EMAIL, APPROVER_NAME,
  getPayBills, advancePayBillStep, deletePayBill, upsertPayBill, PAYBILL_STATUS,
  getAdvanceRegister,
  upsertBill,
  canApprove, canDelete, currentRole,
} from "../lib/store";

const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Reports contextual action bar button style
const bbtn = (bg) => ({ padding: "6px 12px", background: bg, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11, letterSpacing: .3, boxShadow: "0 1px 3px rgba(15,23,42,.15)" });

const F = ({ label, children }) => (
  <div className="field-b"><label>{label}</label>{children}</div>
);

export default function Reports() {
  const nav = useNavigate();
  const fileInputRef = React.useRef(null);
  const pbFileInputRef = React.useRef(null);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [pv, setPv] = useState(null);
  const [refresh, setRefresh] = useState(0);

  // REAL-TIME CROSS-USER SYNC: re-render whenever App.js dispatches ae-sync-done.
  // Ensures Admin/User actions from other devices propagate to this page within ~8s.
  useEffect(() => {
    const onSync = () => setRefresh((v) => v + 1);
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);
  const [filter, setFilter] = useState("");
  const [queryOpen, setQueryOpen] = useState(false);
  const [queryCode, setQueryCode] = useState("");
  const [selectedPvs, setSelectedPvs] = useState(() => new Set());
  const [selectedDueBills, setSelectedDueBills] = useState(() => new Set());
  const [selectedPayBills, setSelectedPayBills] = useState(() => new Set());
  const [viewBill, setViewBill] = useState(null);
  const [advDetail, setAdvDetail] = useState(null); // {r, filter: "settled"|"autoAdj"|"inPB"|"all"}
  const [reportsTab, setReportsTab] = useState("vouchers");
  const _now = new Date();
  const [dueMonth, setDueMonth] = useState(_now.getMonth() + 1);
  const [dueYear, setDueYear] = useState(_now.getFullYear());

  const bills = useMemo(() => getBills(), [refresh]);
  const vendors = useMemo(() => getVendors(), [refresh]);
  const payments = useMemo(() => getPayments(), [refresh]);
  // Vendor-only PVs for the Payment Vouchers tab — HR-origin PVs (payroll / advance / F&F)
  // are shown in Salary Bills + Employee Advances tabs instead.
  const vendorPayments = useMemo(
    () => payments.filter((p) => {
      const isHrSource = /^(PV|GPV|PN)\/(HR|ADV|HR-FNF)/i.test(String(p.pvNo || ""))
        || ["AE-HR-PAYROLL", "AE-HR-ADVANCE", "AE-HR-FNF"].includes(p.vendorCode)
        || (p.source && /HR|Advance|Pay Bill/i.test(p.source));
      return !isHrSource;
    }),
    [payments]
  );

  const approvedBills = bills.filter((b) => b.step === 5);
  const vouchersByBill = useMemo(() => {
    const m = {};
    payments.forEach((p) => { if (p.billId) m[p.billId] = p; });
    return m;
  }, [payments]);
  const today = new Date().toISOString().slice(0, 10);

  const dueRows = approvedBills.map((b) => {
    const c = computeBill(b);
    // Only Approved vouchers count as paid; Draft/Submitted don't reduce due
    const paid = payments
      .filter((p) => p.billId === b.id && p.status === "Approved")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = +(c.netPayable - paid).toFixed(2);
    const isOverdue = b.dueDate && b.dueDate < today && balance > 0;
    return {
      id: b.id,
      refNo: b.permanentBillNo || b.refNo,
      tempRef: b.refNo,
      vendorCode: b.vendorCode,
      vendorName: b.vendorSnapshot?.firmName || "",
      billNo: b.billNo, billDate: b.billDate, dueDate: b.dueDate,
      basic: c.basic, gst: c.gst, tds: c.tds, net: c.netPayable, paid, balance,
      status: balance <= 0 ? "Paid" : (isOverdue ? "Overdue" : "Due"),
    };
  });

  const filtered = filter
    ? dueRows.filter((r) => `${r.refNo} ${r.vendorCode} ${r.vendorName} ${r.billNo}`.toLowerCase().includes(filter.toLowerCase()))
    : dueRows;

  // ---- Due List Hold/Pay toggle (gates which approved bills flow into PV tab) ----
  const setBillPaymentStatus = (billId, newStatus, extras = {}) => {
    const b = bills.find((x) => x.id === billId);
    if (!b) return;
    const dmKey = `${dueYear}${String(dueMonth).padStart(2, "0")}`;
    const updated = { ...b, paymentStatus: newStatus, decisionMonth: newStatus ? dmKey : (b.decisionMonth || ""), ...extras };
    upsertBill(updated);
    setRefresh((v) => v + 1);
    if (!extras.silent) toast.success(newStatus === "Hold" ? `Bill marked HOLD` : newStatus === "MarkedPay" ? `Bill marked PAY` : newStatus === "Reject" ? `Bill marked REJECT` : `Decision cleared`);
  };

  // ---- Consolidated dues for selected month (vendor bills + pay bills) ----
  const monthKey = `${dueYear}${String(dueMonth).padStart(2, "0")}`;
  const monthLabel = new Date(dueYear, dueMonth - 1).toLocaleString("en", { month: "long", year: "numeric" });
  const payBillsAll = useMemo(() => getPayBills(), [refresh]);

  const consolidatedDues = useMemo(() => {
    const rows = [];
    // Vendor bills only — Pay Bills ki apni dedicated Salary Bills tab + HR module hai
    approvedBills.forEach((b) => {
      const c = computeBill(b);
      const paid = payments.filter((p) => p.billId === b.id && p.status === "Approved").reduce((s, p) => s + Number(p.amount || 0), 0);
      const balance = +(c.netPayable - paid).toFixed(2);
      if (balance <= 0) return;
      const dMonth = (b.billDate || b.dueDate || "").slice(0, 7); // "YYYY-MM"
      const want = `${dueYear}-${String(dueMonth).padStart(2, "0")}`;
      if (dMonth !== want) return;
      rows.push({
        key: `V:${b.id}`,
        source: "Vendor Bill",
        srcTone: "#0369a1",
        id: b.id,
        refNo: b.permanentBillNo || b.refNo,
        party: b.vendorSnapshot?.firmName || b.vendorCode || "—",
        partyCode: b.vendorCode || "",
        billNo: b.billNo || "",
        billDate: b.billDate || "",
        dueDate: b.dueDate || "",
        net: c.netPayable, paid, balance,
        decision: b.paymentStatus || "",
        scheduledPay: Number(b.scheduledPayAmount || 0),
        holdReason: b.holdReason || "",
      });
    });
    return rows;
  }, [approvedBills, payments, dueMonth, dueYear]);

  const monthSummary = useMemo(() => ({
    total: consolidatedDues.length,
    totalDue: consolidatedDues.reduce((s, r) => s + r.balance, 0),
    markedPayCount: consolidatedDues.filter((r) => r.decision === "MarkedPay").length,
    markedPaySum: consolidatedDues.filter((r) => r.decision === "MarkedPay").reduce((s, r) => s + (r.scheduledPay > 0 ? r.scheduledPay : r.balance), 0),
    holdCount: consolidatedDues.filter((r) => r.decision === "Hold").length,
    rejectCount: consolidatedDues.filter((r) => r.decision === "Reject").length,
    undecided: consolidatedDues.filter((r) => !r.decision).length,
  }), [consolidatedDues]);

  // ---- Decision Excel: Download / Upload workflow ----
  const downloadDecisionExcel = () => {
    if (!consolidatedDues.length) { toast.error(`No dues for ${monthLabel}`); return; }
    const aoa = [
      [`M/s ARUN ENTERPRISES · DECISION SHEET · ${monthLabel.toUpperCase()}`],
      [`Rows: ${consolidatedDues.length} · Total Due: ₹ ${monthSummary.totalDue.toLocaleString("en-IN")} · Edit "Decision" (Pay/Hold/Reject), "Pay Amount" (₹) & "Hold Reason" columns, then re-upload`],
      [],
      ["Row Key", "Source", "Ref No", "Party", "Party Code", "Bill No", "Bill Date", "Due Date", "Net (₹)", "Paid (₹)", "Balance (₹)", "Decision", "Pay Amount (₹)", "Hold Reason"],
      ...consolidatedDues.map((r) => [r.key, r.source, r.refNo, r.party, r.partyCode, r.billNo, r.billDate, r.dueDate, r.net, r.paid, r.balance, r.decision, r.scheduledPay || "", r.holdReason]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Decisions");
    XLSX.writeFile(wb, `DecisionSheet_${monthKey}.xlsx`);
    toast.success(`Decision sheet downloaded · ${consolidatedDues.length} rows for ${monthLabel}`);
  };

  const uploadDecisionExcel = async (file) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Find header row — first row that contains "Row Key"
      const headerIdx = rows.findIndex((r) => Array.isArray(r) && r.some((c) => String(c).trim() === "Row Key"));
      if (headerIdx < 0) { toast.error("Invalid file — 'Row Key' header not found"); return; }
      const header = rows[headerIdx];
      const idxKey = header.indexOf("Row Key");
      const idxDecision = header.indexOf("Decision");
      const idxPayAmt = header.indexOf("Pay Amount (₹)");
      const idxReason = header.indexOf("Hold Reason");
      let applied = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i]; if (!Array.isArray(row) || !row[idxKey]) continue;
        const key = String(row[idxKey]);
        const [kind, id] = key.split(":");
        const decRaw = String(row[idxDecision] || "").trim();
        const payAmt = Number(row[idxPayAmt] || 0);
        const reason = String(row[idxReason] || "").trim();
        const normDec = /^pay$|^✓.*pay|markedpay/i.test(decRaw) ? "MarkedPay"
                       : /^hold$|^⏸/i.test(decRaw) ? "Hold"
                       : /^reject$|^✗/i.test(decRaw) ? "Reject" : "";
        if (kind === "V") {
          const b = bills.find((x) => x.id === id); if (!b) continue;
          upsertBill({ ...b, paymentStatus: normDec, scheduledPayAmount: payAmt, holdReason: reason, decisionMonth: monthKey });
          applied += 1;
        }
        // Pay Bill decisions do not need to be stored — they already flow via step/UTR
      }
      setRefresh((v) => v + 1);
      toast.success(`Decisions applied · ${applied} vendor bills updated for ${monthLabel}`);
    } catch (e) {
      toast.error(`Upload failed: ${e.message || e}`);
    }
  };

  // ---- Bulk process: generate PVs or print bulk advice for "Marked Pay" rows ----
  const processSinglePVs = () => {
    const toPay = consolidatedDues.filter((r) => r.decision === "MarkedPay");
    if (!toPay.length) { toast.error("No vendor bills marked 'Pay' for this month"); return; }
    if (!window.confirm(`Generate ${toPay.length} party-wise Payment Voucher(s) for ${monthLabel}?\n\nEach vendor gets a separate PV draft. Review & approve in Payment Vouchers tab.`)) return;
    let created = 0;
    toPay.forEach((r) => {
      const b = bills.find((x) => x.id === r.id); if (!b) return;
      const amt = r.scheduledPay > 0 ? Math.min(r.scheduledPay, r.balance) : r.balance;
      if (amt <= 0) return;
      const pvNo = nextPvNo();
      const payments = getPayments();
      // FIX: fallback to current vendor master if snapshot missing (older bills)
      const vend = b.vendorSnapshot || vendors.find((x) => x.vendorCode === b.vendorCode) || {};
      payments.push({
        id: `pv_bulk_${b.id}_${Date.now()}`,
        pvNo, pvDate: new Date().toISOString().slice(0, 10),
        date: new Date().toISOString().slice(0, 10),
        billId: b.id, billRefNo: b.permanentBillNo || b.refNo, billNo: b.billNo,
        vendorCode: b.vendorCode, vendorName: vend.firmName || "",
        accountName: vend.accountHolder || vend.firmName || "",
        amount: amt, mode: "Bank Transfer",
        bankName: vend.bankName || "", ifscCode: vend.ifscCode || vend.ifsc || "", accountNumber: vend.accountNumber || vend.bankAccount || "",
        remarks: `Bulk-generated from Due List decision sheet · ${monthLabel}`,
        status: "Draft", createdAt: new Date().toISOString(), createdByName: currentUser(),
      });
      savePayments(payments);
      created += 1;
    });
    setRefresh((v) => v + 1);
    toast.success(`${created} Payment Voucher drafts generated · Review in Payment Vouchers tab`);
  };

  const processBulkBankAdvice = () => {
    const toPay = consolidatedDues.filter((r) => r.decision === "MarkedPay");
    if (!toPay.length) { toast.error("No vendor bills marked 'Pay' for this month"); return; }
    const items = toPay.map((r) => {
      const b = bills.find((x) => x.id === r.id) || {};
      // FIX: fallback to current vendor master if snapshot missing (older bills)
      const vend = b.vendorSnapshot || vendors.find((x) => x.vendorCode === b.vendorCode) || {};
      return {
        refNo: r.refNo, billNo: r.billNo,
        party: r.party, partyCode: r.partyCode,
        bank: vend.bankName || "—", branch: vend.bankBranch || "",
        account: vend.bankAccount || "—", ifsc: vend.ifsc || "—",
        amount: r.scheduledPay > 0 ? Math.min(r.scheduledPay, r.balance) : r.balance,
      };
    });
    printBulkBankAdvice(items, { monthLabel, period: monthKey });
  };

  const summary = {
    approvedBillsCount: approvedBills.length,
    totalBasic: dueRows.reduce((s, r) => s + r.basic, 0),
    totalGST: dueRows.reduce((s, r) => s + r.gst, 0),
    totalTDS: dueRows.reduce((s, r) => s + r.tds, 0),
    totalNet: dueRows.reduce((s, r) => s + r.net, 0),
    totalPaid: dueRows.reduce((s, r) => s + r.paid, 0),
    totalOutstanding: dueRows.reduce((s, r) => s + r.balance, 0),
    overdue: dueRows.filter((r) => r.status === "Overdue").length,
    vendors: vendors.filter((v) => v.step === 3).length,
  };

  const handleNew = () => { setSelectedBillId(""); setPv(null); toast.success("New voucher draft"); };

  // ---- Payment management (Edit / Delete / Reschedule after approval) ----
  const reopenPayment = (pvNo) => {
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === pvNo);
    if (idx < 0) return;
    const prev = list[idx];
    const history = Array.isArray(prev.history) ? prev.history : [];
    history.push({
      action: "Reopened",
      from: prev.status,
      by: currentUser(),
      at: new Date().toISOString(),
      prevAmount: prev.amount,
      prevDate: prev.date,
    });
    list[idx] = {
      ...prev,
      status: "Draft",
      approvedByName: "",
      approvalDate: "",
      revision: (prev.revision || 0) + 1,
      reopenedAt: new Date().toISOString(),
      reopenedBy: currentUser(),
      history,
    };
    savePayments(list);
    setPv(list[idx]);
    setRefresh((n) => n + 1);
    toast.success(`${pvNo} reopened (Rev ${list[idx].revision}) · Awaiting Re-Approval`);
  };
  const reApprovePayment = (pvNo) => {
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === pvNo);
    if (idx < 0) return;
    const prev = list[idx];
    if (prev.status === "Approved") { toast.info("Already approved"); return; }
    const history = Array.isArray(prev.history) ? prev.history : [];
    history.push({
      action: "Re-Approved",
      from: prev.status,
      by: currentUser(),
      at: new Date().toISOString(),
      amount: prev.amount,
      date: prev.date,
    });
    list[idx] = {
      ...prev,
      status: "Approved",
      approvedByName: currentUser(),
      approvalDate: new Date().toISOString().slice(0, 10),
      history,
    };
    savePayments(list);
    if (pv?.pvNo === pvNo) setPv(list[idx]);
    setRefresh((n) => n + 1);
    toast.success(`${pvNo} Re-Approved (Rev ${prev.revision || 0}) · Bill marked Paid`);
  };
  const deletePayment = (pvNo) => {
    if (!window.confirm(`Delete voucher ${pvNo}? Bill will re-appear in Due List.`)) return;
    // ZOMBIE FIX: use deletePaymentCloud → backend DELETE + local filter + cloud reconcile
    deletePaymentCloud(pvNo);
    if (pv?.pvNo === pvNo) setPv(null);
    setRefresh((n) => n + 1);
    toast.success(`${pvNo} deleted · Bill moved back to Due List`);
  };
  const reschedulePayment = (pvNo, newDate) => {
    if (!newDate) return;
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === pvNo);
    if (idx < 0) return;
    const prev = list[idx];
    const history = Array.isArray(prev.history) ? prev.history : [];
    history.push({
      action: "Rescheduled",
      from: prev.date,
      to: newDate,
      by: currentUser(),
      at: new Date().toISOString(),
    });
    list[idx] = { ...prev, date: newDate, history };
    savePayments(list);
    if (pv?.pvNo === pvNo) setPv(list[idx]);
    setRefresh((n) => n + 1);
    toast.success(`${pvNo} rescheduled to ${newDate}`);
  };
  const loadVoucher = (pvNo) => {
    const p = payments.find((x) => x.pvNo === pvNo);
    if (p) {
      // Self-heal: if existing PV has missing/stale bank details, pull latest from vendor master
      const vend = vendors.find((x) => x.vendorCode === p.vendorCode) || {};
      const healed = {
        ...p,
        bankName: p.bankName || vend.bankName || "",
        accountName: p.accountName || vend.accountHolder || vend.firmName || "",
        accountNumber: p.accountNumber || vend.accountNumber || vend.bankAccount || "",
        ifscCode: p.ifscCode || vend.ifscCode || vend.ifsc || "",
      };
      setPv(healed);
      setSelectedBillId(p.billId || "");
      toast.info(`Loaded ${pvNo}`);
    }
  };

  const handleSave = () => {
    if (!pv) { toast.error("Generate a voucher first"); return; }
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === pv.pvNo);
    if (idx >= 0) list[idx] = pv; else list.push(pv);
    savePayments(list); setRefresh((n) => n + 1);
    toast.success(`Saved ${pv.pvNo}`);
  };
  const handleEdit = () => pv && pv.status !== "Approved" ? toast.info("Editable") : toast.error("No editable voucher");
  const handleSubmit = () => {
    if (!pv) { toast.error("Generate a voucher first"); return; }
    if (pv.status !== "Draft") { toast.error("Already submitted"); return; }
    const next = { ...pv, status: "Submitted", preparedByName: pv.preparedByName || currentUser() };
    setPv(next);
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === next.pvNo);
    if (idx >= 0) list[idx] = next; else list.push(next);
    savePayments(list); setRefresh((n) => n + 1);
    toast.success("Voucher submitted");
  };
  const handleApprove = () => {
    if (!pv) { toast.error("Generate a voucher first"); return; }
    if (pv.status === "Approved") { toast.info("Already approved"); return; }
    if (pv.status !== "Submitted") { toast.error("Submit the voucher first"); return; }
    const oldNo = pv.pvNo;
    const newNo = toApprovedPvNo(oldNo); // GPV/... → PN/... (same serial)
    const next = {
      ...pv,
      pvNo: newNo,
      draftNo: oldNo !== newNo ? oldNo : (pv.draftNo || ""),
      status: "Approved",
      approvedByName: pv.approvedByName || currentUser(),
      approvalDate: new Date().toISOString().slice(0, 10),
    };
    setPv(next);
    // Remove the OLD GPV entry both locally and in cloud — otherwise it reappears
    // on next cross-device sync as a duplicate submission (GM dashboard duplicate bug).
    const list = getPayments().filter((x) => x.pvNo !== oldNo && x.pvNo !== newNo);
    list.push(next);
    savePayments(list); // savePayments now auto-reconciles the removed oldNo on backend
    setRefresh((n) => n + 1);
    toast.success(`Voucher approved · ${oldNo}${oldNo !== newNo ? " → " + newNo : ""}`);
  };

  const generateVoucher = () => {
    const b = approvedBills.find((x) => x.id === selectedBillId);
    if (!b) { toast.error("Select an approved bill"); return; }
    // Prevent duplicate voucher for same bill (billId primary + fallback vendorCode+billNo)
    const existing = payments.find(
      (p) => p.billId === b.id ||
        (p.vendorCode === b.vendorCode && String(p.billNo || "").trim() === String(b.billNo || "").trim() && b.billNo)
    );
    if (existing) {
      toast.error(`Duplicate · voucher ${existing.pvNo} already exists for this bill. Open existing voucher instead.`);
      setPv(existing);
      return;
    }
    const c = computeBill(b);
    const paid = payments.filter((p) => p.billId === b.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = +(c.netPayable - paid).toFixed(2);
    // FIX: use correct vendor master keys (bankAccount, ifsc, accountHolder) AND fallback
    // to current vendor master if the snapshot is missing (older bills).
    const vend = b.vendorSnapshot || vendors.find((x) => x.vendorCode === b.vendorCode) || {};
    // Vendor master uses accountNumber + ifscCode (per VendorRegistration schema).
    // Older snapshots may have bankAccount + ifsc — kept as fallbacks.
    const vAcct = vend.accountNumber || vend.bankAccount || "";
    const vIfsc = vend.ifscCode || vend.ifsc || "";
    const vHolder = vend.accountHolder || vend.firmName || "";
    const vBank = vend.bankName || "";
    const missing = !(vBank || vAcct || vIfsc);
    if (missing) {
      toast.warning(`Bank details missing for ${vend.firmName || b.vendorCode}. Please update the vendor master.`);
    }
    setPv({
      pvNo: nextPvNo(),
      date: new Date().toISOString().slice(0, 10),
      billId: b.id, billRefNo: b.permanentBillNo || b.refNo, billNo: b.billNo,
      vendorCode: b.vendorCode, vendorName: vend.firmName || "",
      accountName: vHolder,
      accountNumber: vAcct,
      ifscCode: vIfsc,
      bankName: vBank,
      basic: c.basic, gst: c.gst, tds: c.tds, net: c.netPayable,
      amount: balance, mode: "NEFT", remarks: "",
      utrNo: "",
      status: "Draft",
      createdByName: currentUser(),
      preparedByName: "", checkedByName: "", approvedByName: "", approvalDate: "",
    });
    toast.success(`Voucher generated · ${vend.firmName || b.vendorCode}${missing ? " (bank details pending)" : ""}`);
  };

  const exportDuesExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dueRows.map((r) => ({
      "Ref No": r.refNo, "Vendor Code": r.vendorCode, "Vendor Name": r.vendorName,
      "Bill No": r.billNo, "Bill Date": r.billDate, "Due Date": r.dueDate,
      Basic: r.basic, GST: r.gst, TDS: r.tds, Net: r.net, Paid: r.paid,
      Balance: r.balance, Status: r.status,
    }))), "Due List");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Metric", "Value"], [
      "Approved Bills", summary.approvedBillsCount], ["Total Basic", summary.totalBasic],
      ["Total GST", summary.totalGST], ["Total TDS", summary.totalTDS],
      ["Total Net Payable", summary.totalNet], ["Total Paid", summary.totalPaid],
      ["Total Outstanding", summary.totalOutstanding], ["Overdue Bills", summary.overdue],
    ]), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments.map((p) => ({
      "GPV / PN No": p.pvNo, Date: p.date, "Bill Ref": p.billRefNo, "Bill No": p.billNo,
      "Vendor Code": p.vendorCode, "Vendor Name": p.vendorName,
      Amount: p.amount, Mode: p.mode, "UTR / Ref No": p.utrNo || "",
      Bank: p.bankName, IFSC: p.ifscCode,
      "Account No": p.accountNumber, Status: p.status,
    }))), "Payment Vouchers");
    XLSX.writeFile(wb, `vendor_reports_${today}.xlsx`);
    toast.success("Excel exported");
  };

  const handleExportJSON = () => {
    exportJSON({ dueRows, summary, payments, generatedAt: new Date().toISOString() }, `vendor_reports_${today}.json`);
    toast.success("Reports exported as JSON");
  };

  // ---- Approved Voucher export (selected or all) — vendor PVs only ----
  const approvedPayments = useMemo(
    () => vendorPayments.filter((p) => p.status === "Approved"),
    [vendorPayments]
  );
  const toggleSelectPv = (pvNo) => {
    setSelectedPvs((prev) => {
      const n = new Set(prev);
      if (n.has(pvNo)) n.delete(pvNo); else n.add(pvNo);
      return n;
    });
  };
  const toggleSelectAll = () => {
    setSelectedPvs((prev) => {
      const allApproved = approvedPayments.map((p) => p.pvNo);
      const allSelected = allApproved.length > 0 && allApproved.every((n) => prev.has(n));
      return allSelected ? new Set() : new Set(allApproved);
    });
  };
  const exportApprovedVouchers = () => {
    if (approvedPayments.length === 0) {
      toast.error("No approved vouchers to export");
      return;
    }
    const toExport = selectedPvs.size === 0
      ? approvedPayments
      : approvedPayments.filter((p) => selectedPvs.has(p.pvNo));
    if (toExport.length === 0) {
      toast.error("Please select at least one voucher (or clear selection to export all)");
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(toExport.map((p) => ({
        "GPV / PN No": p.pvNo,
        "Date": p.date,
        "Bill Ref": p.billRefNo,
        "Bill No": p.billNo,
        "Vendor Code": p.vendorCode,
        "Vendor Name": p.vendorName,
        "Bill Basic": Number(p.basic || 0),
        "GST": Number(p.gst || 0),
        "TDS": Number(p.tds || 0),
        "Bill Net": Number(p.net || 0),
        "Voucher Amount": Number(p.amount || 0),
        "Mode": p.mode,
        "UTR / Ref No": p.utrNo || "",
        "Bank": p.bankName,
        "IFSC": p.ifscCode,
        "Account Holder": p.accountName,
        "Account Number": p.accountNumber,
        "Status": p.status,
        "Approval Date": p.approvalDate || "",
        "Approved By": p.approvedByName || "",
        "Prepared By": p.preparedByName || "",
        "Checked By": p.checkedByName || "",
        "Remarks": p.remarks || "",
      }))),
      "Approved Vouchers"
    );
    const scope = selectedPvs.size === 0 ? "all" : `${toExport.length}`;
    const filename = toExport.length === 1
      ? `voucher_${toExport[0].pvNo.replace(/[\/\\]/g, "_")}.xlsx`
      : `approved_vouchers_${today}_${scope}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${toExport.length} approved voucher${toExport.length > 1 ? "s" : ""}`);
  };
  const handlePrint = () => window.print();
  const handleSearch = (q) => setFilter(q);
  const openQuery = (q) => { setQueryCode(q || ""); setQueryOpen(true); };

  const workflowLabel = !pv ? "Generate first" :
                        pv.status === "Draft" ? "Submit for Checking" :
                        pv.status === "Submitted" ? "Final Approval" :
                        "Approved";

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <TopActionBar
          searchPlaceholder="Vendor Code / Firm / Bill Ref"
          searchLabel="Query"
          onQuery={openQuery}
          prevLabel="Bill Process"
          prevTo="/bill"
          onNew={handleNew}
          onSave={handleSave}
          onEdit={handleEdit}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onPrint={handlePrint}
          onExportJSON={handleExportJSON}
          onExportExcel={exportDuesExcel}
          disabled={{
            submit: !pv || pv?.status !== "Draft",
            approve: !pv || pv?.status !== "Submitted",
          }}
        />
        <VendorQueryModal open={queryOpen} onClose={() => setQueryOpen(false)} initialCode={queryCode} variant="final" />

        <div className="a4" data-testid="reports-page">
          <div className="module-doc-header"><Header formTitle="PAYABLES · DUE LIST &amp; SUMMARY (FINAL PROCESSING)" /></div>

          {/* Reports Tabs */}
          <div style={{ display: "flex", gap: 6, borderBottom: "2px solid #e2e8f0", marginTop: 8, flexWrap: "wrap" }} data-testid="reports-tabs">
            {[
              { id: "vouchers", label: "💳 Payment Vouchers & Due List Preparation", tone: "#7c3aed" },
              { id: "salary", label: "👥 Salary Bills (HR Payroll)", tone: "#be185d" },
              { id: "advance", label: "💰 Employee Advances", tone: "#b45309" },
              { id: "aging", label: "⏱️ Aging", tone: "#ea580c" },
              { id: "gsttds", label: "🧾 GST-TDS Register", tone: "#16a34a" },
            ].map((t) => (
              <button
                key={t.id}
                data-testid={`reports-tab-${t.id}`}
                onClick={() => setReportsTab(t.id)}
                style={{
                  padding: "8px 16px",
                  background: reportsTab === t.id ? t.tone : "transparent",
                  color: reportsTab === t.id ? "#fff" : "#334155",
                  border: "none",
                  borderRadius: "6px 6px 0 0",
                  cursor: "pointer",
                  fontWeight: 700, fontSize: 12,
                  letterSpacing: .3,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Aging & GST-TDS Register (conditional simple tables) */}
          {reportsTab === "salary" && (
            <div className="section" data-testid="reports-salary">
              <div className="sec-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Salary Bills — HR Payroll · Accounts Processing Queue</span>
                <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>Flow: HR Draft → GM Approval → Accounts Settlement → Auto Payment Voucher</span>
              </div>
              {/* ---- Approved HR Pay Bills Data Sheet with per-row selection checkbox ---- */}
              {(() => {
                const approvedPB = payBillsAll.filter((pb) => Number(pb.step) >= 3);
                const allSelected = approvedPB.length > 0 && approvedPB.every((pb) => selectedPayBills.has(pb.id));
                const toggleAll = () => {
                  if (allSelected) setSelectedPayBills(new Set());
                  else setSelectedPayBills(new Set(approvedPB.map((pb) => pb.id)));
                };
                const toggleOne = (id) => {
                  const n = new Set(selectedPayBills);
                  n.has(id) ? n.delete(id) : n.add(id);
                  setSelectedPayBills(n);
                };
                const selectedRows = approvedPB.filter((pb) => selectedPayBills.has(pb.id));
                const selSum = selectedRows.reduce((s, pb) => s + Number(pb.totalNet || 0), 0);
                const totalSum = approvedPB.reduce((s, pb) => s + Number(pb.totalNet || 0), 0);
                return (
                  <div style={{ margin: "10px 0 6px", border: "1.5px solid #be185d", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ padding: "7px 12px", background: "#fdf2f8", borderBottom: "1px solid #f9a8d4" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#9d174d", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        All Approved HR Pay Bills · {approvedPB.length} record{approvedPB.length !== 1 ? "s" : ""} · <span style={{ color: "#be185d" }}>Selected: {selectedRows.length}</span> · <span style={{ color: "#166534" }}>₹ {selSum.toLocaleString("en-IN")}</span> · <span style={{ color: "#334155" }}>Grand Total ₹ {totalSum.toLocaleString("en-IN")}</span>
                        <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "none", letterSpacing: 0 }}>↓ Niche same Accounts Settlement workflow apply hogi.</span>
                      </div>
                    </div>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      <table className="data-table" data-testid="approved-paybills-sheet" style={{ margin: 0 }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                          <tr>
                            <th style={{ width: 34, textAlign: "center" }}>
                              <input type="checkbox" data-testid="pb-select-all" checked={allSelected} onChange={toggleAll} title="Select all approved pay bills" />
                            </th>
                            <th>Ref No</th>
                            <th>Period</th>
                            <th style={{ textAlign: "right" }}>Employees</th>
                            <th style={{ textAlign: "right" }}>Net Payable</th>
                            <th>Linked PV</th>
                            <th>UTR</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvedPB.length === 0 && (
                            <tr><td colSpan={8} style={{ textAlign: "center", color: "#64748b", padding: 14 }}>No approved HR Pay Bills · GM approval wait kijiye</td></tr>
                          )}
                          {approvedPB.map((pb) => {
                            const monthName = new Date(pb.year, (pb.month || 1) - 1).toLocaleString("en-IN", { month: "short" });
                            const pv = pb.linkedPvNo ? payments.find((p) => p.pvNo === pb.linkedPvNo) : null;
                            const hasUtr = !!(pv && pv.utrNo);
                            const isSettled = Number(pb.step) === 4;
                            return (
                              <tr key={pb.id} data-testid={`pb-sum-${pb.id}`} style={{ background: selectedPayBills.has(pb.id) ? "#fdf2f8" : isSettled && hasUtr ? "#f0fdf4" : isSettled ? "#fef2f2" : "#fff" }}>
                                <td style={{ textAlign: "center" }}>
                                  <input type="checkbox" data-testid={`pb-chk-${pb.id}`} checked={selectedPayBills.has(pb.id)} onChange={() => toggleOne(pb.id)} />
                                </td>
                                <td className="mono"><b>{pb.refNo}</b></td>
                                <td><b>{monthName} {pb.year}</b></td>
                                <td className="num">{pb.lines?.length || 0}</td>
                                <td className="num"><b>{inr(pb.totalNet)}</b></td>
                                <td className="mono" style={{ fontSize: 10 }}>{pb.linkedPvNo || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                <td className="mono" style={{ fontSize: 10, color: hasUtr ? "#166534" : "#991b1b", fontWeight: 700 }}>{pv?.utrNo || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                <td>
                                  {pb.holdFlag ? (
                                    <span title={pb.holdReason || "On Hold via Decision XLSX"} style={{ padding: "2px 7px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⏸ On Hold</span>
                                  ) : pb.rejectFlag ? (
                                    <span title={pb.rejectReason || "Rejected via Decision XLSX"} style={{ padding: "2px 7px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>✗ Rejected</span>
                                  ) : isSettled && hasUtr ? (
                                    <span style={{ padding: "2px 7px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>✓ PAID</span>
                                  ) : isSettled ? (
                                    <span style={{ padding: "2px 7px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⚠ UTR Pending</span>
                                  ) : (
                                    <span style={{ padding: "2px 7px", background: "#fed7aa", color: "#9a3412", border: "1px solid #fdba74", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⏳ GM Approved · Awaiting Settlement</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {selectedRows.length > 0 && (
                      <div style={{ padding: "6px 10px", background: "#fdf2f8", borderTop: "1px solid #f9a8d4", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          data-testid="pb-decision-xlsx"
                          onClick={() => {
                            const rows = selectedRows.map((pb) => {
                              const period = `${new Date(pb.year, (pb.month || 1) - 1).toLocaleString("en-IN", { month: "long" })} ${pb.year}`;
                              const pv = pb.linkedPvNo ? payments.find((p) => p.pvNo === pb.linkedPvNo) : null;
                              return {
                                "Ref No": pb.refNo,
                                "Period": period,
                                "Employees": pb.lines?.length || 0,
                                "Gross (₹)": Number(pb.totalGross || 0),
                                "Deductions (₹)": Number(pb.totalDeductions || 0),
                                "Advance (₹)": Number(pb.totalAdvance || 0),
                                "Net Payable (₹)": Number(pb.totalNet || 0),
                                "Status": PAYBILL_STATUS[pb.step] || "—",
                                "Linked PV": pb.linkedPvNo || "",
                                "UTR / Ref": pv?.utrNo || "",
                                "Decision (Pay / Hold / Reject)": "",
                                "Remarks": "",
                              };
                            });
                            const wb = XLSX.utils.book_new();
                            const ws = XLSX.utils.json_to_sheet(rows);
                            ws["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 26 }, { wch: 24 }];
                            XLSX.utils.book_append_sheet(wb, ws, "HR Pay Bills Decision");
                            const stamp = new Date().toISOString().slice(0, 10);
                            XLSX.writeFile(wb, `HR_PayBill_Decision_${stamp}.xlsx`);
                            toast.success(`Decision XLSX downloaded · ${rows.length} rows`);
                          }}
                          style={{ padding: "4px 10px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                          title="Download XLSX with Decision + Remarks columns (fill offline, re-upload to apply)"
                        >⬇ Download Decision XLSX ({selectedRows.length})</button>
                        <input
                          ref={pbFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (!f) return;
                            if (!canApprove()) { toast.error("Only Admin / SuperAdmin / Accounts can apply decisions"); return; }
                            try {
                              const buf = await f.arrayBuffer();
                              const wb = XLSX.read(buf, { type: "array" });
                              const ws = wb.Sheets[wb.SheetNames[0]];
                              const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
                              let settled = 0, held = 0, rejected = 0, skipped = 0, missing = 0;
                              const pbs = getPayBills();
                              const updates = [];
                              rows.forEach((row) => {
                                const ref = String(row["Ref No"] || "").trim();
                                const decision = String(row["Decision (Pay / Hold / Reject)"] || "").trim().toLowerCase();
                                const remarks = String(row["Remarks"] || "").trim();
                                if (!ref || !decision) { skipped += 1; return; }
                                const pb = pbs.find((x) => x.refNo === ref);
                                if (!pb) { missing += 1; return; }
                                if (decision === "pay") {
                                  if (Number(pb.step) !== 3) { skipped += 1; return; }
                                  const n = advancePayBillStep(pb);
                                  updates.push(n);
                                  settled += 1;
                                } else if (decision === "hold") {
                                  const next = { ...pb, holdFlag: true, holdReason: remarks || "Marked Hold via Decision XLSX", holdAt: new Date().toISOString() };
                                  upsertPayBill(next);
                                  held += 1;
                                } else if (decision === "reject") {
                                  const next = { ...pb, rejectFlag: true, rejectReason: remarks || "Marked Reject via Decision XLSX", rejectedAt: new Date().toISOString() };
                                  upsertPayBill(next);
                                  rejected += 1;
                                } else { skipped += 1; }
                              });
                              setRefresh((v) => v + 1);
                              toast.success(`Decisions applied · ${settled} settled (PV auto-gen) · ${held} held · ${rejected} rejected${missing ? ` · ${missing} ref-not-found` : ""}${skipped ? ` · ${skipped} skipped` : ""}`, { duration: 8000 });
                            } catch (err) {
                              toast.error(`Upload failed: ${err.message || err}`);
                            }
                          }}
                        />
                        <button
                          data-testid="pb-decision-xlsx-upload"
                          onClick={() => pbFileInputRef.current?.click()}
                          disabled={!canApprove()}
                          title={canApprove() ? "Upload edited Decision XLSX — 'Pay' rows settle (auto-PV), 'Hold' / 'Reject' flag the pay bill" : "Only Admin / SuperAdmin / Accounts can apply decisions"}
                          style={{ padding: "4px 10px", background: canApprove() ? "#7c3aed" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 3, cursor: canApprove() ? "pointer" : "not-allowed", fontSize: 10, fontWeight: 700 }}
                        >⬆ Upload Decision XLSX</button>
                        <button
                          data-testid="pb-bulk-settle"
                          onClick={() => {
                            try {
                              if (!canApprove()) { toast.error("Only Admin / SuperAdmin / Accounts can settle"); return; }
                              // Use a fresh snapshot so stale/missing rows don't throw
                              const fresh = getPayBills();
                              const freshById = Object.fromEntries(fresh.map((pb) => [pb.id, pb]));
                              const eligible = selectedRows
                                .map((pb) => freshById[pb.id])
                                .filter((pb) => pb && Number(pb.step) === 3);
                              if (eligible.length === 0) { toast.error("No GM-Approved pay bills selected · select step 3 rows to settle"); return; }
                              const totalPayout = eligible.reduce((s, pb) => s + Number(pb.totalNet || 0), 0);
                              if (!window.confirm(`1-Click Process · Settle ${eligible.length} Pay Bill(s)?\n\nEach will be moved to Settled (step 4) and a Payment Voucher auto-generated for the net salary payout.\n\nTotal payout: ₹ ${totalPayout.toLocaleString("en-IN")}`)) return;
                              let okCount = 0;
                              const pvs = [];
                              const errors = [];
                              eligible.forEach((pb) => {
                                try {
                                  const n = advancePayBillStep(pb);
                                  if (n && Number(n.step) === 4) {
                                    okCount += 1;
                                    if (n.linkedPvNo) pvs.push(n.linkedPvNo);
                                  } else {
                                    errors.push(`${pb.refNo}: step didn't advance`);
                                  }
                                } catch (ex) {
                                  errors.push(`${pb.refNo}: ${ex.message || ex}`);
                                }
                              });
                              setSelectedPayBills(new Set());
                              setRefresh((v) => v + 1);
                              if (okCount > 0) {
                                toast.success(`✓ Settled ${okCount}/${eligible.length} Pay Bills · ${pvs.length} PV auto-generated`, {
                                  duration: 7000,
                                  description: pvs.length ? pvs.slice(0, 3).join(", ") + (pvs.length > 3 ? ` + ${pvs.length - 3} more` : "") : undefined,
                                });
                              }
                              if (errors.length) {
                                toast.error(`${errors.length} failed`, { duration: 9000, description: errors.slice(0, 3).join(" · ") });
                              }
                            } catch (ex) {
                              toast.error(`1-Click Process failed: ${ex.message || ex}`);
                              try { console.error("[1-click-settle]", ex); } catch {}
                            }
                          }}
                          disabled={!canApprove()}
                          title={canApprove() ? "Settle all selected GM-approved pay bills in one click (step 3 → 4) with auto-PV generation" : "Only Admin / SuperAdmin / Accounts can settle"}
                          style={{ padding: "4px 10px", background: canApprove() ? "#16a34a" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 3, cursor: canApprove() ? "pointer" : "not-allowed", fontSize: 10, fontWeight: 700 }}
                        >⚡ 1-Click Process ({selectedRows.filter((pb) => Number(pb.step) === 3).length})</button>
                        <button
                          data-testid="pb-bulk-excel"
                          onClick={() => selectedRows.forEach((pb) => exportBankTransferXLSX(pb))}
                          style={{ padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                        >⬇ Export Bulk Bank Excel ({selectedRows.length})</button>
                        <button
                          data-testid="pb-bulk-advice"
                          onClick={() => selectedRows.forEach((pb) => printBankTransferAdvice(pb))}
                          style={{ padding: "4px 10px", background: "#be185d", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                        >🖨 Bulk Bank Advice ({selectedRows.length})</button>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="sec-body" style={{ padding: 0 }}>
                <table className="data-table" data-testid="salary-bills-table">
                  <thead><tr>
                    <th>Ref No</th>
                    <th>Period</th>
                    <th style={{ textAlign: "right" }}>Employees</th>
                    <th style={{ textAlign: "right" }}>Gross</th>
                    <th style={{ textAlign: "right" }}>Deductions</th>
                    <th style={{ textAlign: "right" }}>Advance</th>
                    <th style={{ textAlign: "right" }}>Net Payable</th>
                    <th>Status</th>
                    <th style={{ width: 240 }}>Accounts Action</th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const paybills = getPayBills().slice().sort((a, b) => (b.monthKey || "").localeCompare(a.monthKey || ""));
                      if (paybills.length === 0) {
                        return <tr><td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: 20 }}>No Pay Bills yet · HR must create &amp; submit for GM approval first</td></tr>;
                      }
                      return paybills.map((pb) => {
                        const monthName = new Date(pb.year, (pb.month || 1) - 1).toLocaleString("en-IN", { month: "short" });
                        const tone = Number(pb.step) === 4 ? "#166534" : Number(pb.step) === 3 ? "#be185d" : Number(pb.step) === 2 ? "#b45309" : "#64748b";
                        const canSettle = canApprove() && Number(pb.step) === 3;
                        return (
                          <tr key={pb.id} data-testid={`salary-row-${pb.id}`}>
                            <td className="mono">{pb.refNo}</td>
                            <td><b>{monthName} {pb.year}</b></td>
                            <td className="num">{pb.lines?.length || 0}</td>
                            <td className="num">{inr(pb.totalGross)}</td>
                            <td className="num">{inr(pb.totalDeductions)}</td>
                            <td className="num">{inr(pb.totalAdvance)}</td>
                            <td className="num"><b>{inr(pb.totalNet)}</b></td>
                            <td style={{ color: tone, fontWeight: 700, fontSize: 11 }}>{PAYBILL_STATUS[pb.step]}</td>
                            <td>
                              {Number(pb.step) < 3 && <span style={{ padding: "3px 7px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⏳ Awaiting HR/GM</span>}
                              {Number(pb.step) === 3 && (
                                <button
                                  data-testid={`salary-settle-${pb.id}`}
                                  onClick={() => {
                                    if (!canApprove()) { toast.error("Only Admin / SuperAdmin / Accounts"); return; }
                                    if (!window.confirm(`Approve & Settle Pay Bill ${pb.refNo}? A Payment Voucher of ₹ ${Number(pb.totalNet || 0).toLocaleString("en-IN")} will be auto-generated.`)) return;
                                    const n = advancePayBillStep(pb);
                                    setRefresh((v) => v + 1);
                                    toast.success(`Pay Bill settled · PV ${n.linkedPvNo || ""} auto-generated`);
                                  }}
                                  disabled={!canSettle}
                                  style={{ padding: "4px 10px", background: canSettle ? "#16a34a" : "#94a3b8", color: "#fff", border: "none", borderRadius: 4, cursor: canSettle ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }}
                                >💰 Approve & Generate PV</button>
                              )}
                              {Number(pb.step) === 4 && (() => {
                                const pv = pb.linkedPvNo ? getPayments().find((p) => p.pvNo === pb.linkedPvNo) : null;
                                const hasUtr = !!(pv && pv.utrNo);
                                const saveUtr = (newUtr) => {
                                  if (!pv) { toast.error("Linked PV not found"); return; }
                                  const payments = getPayments().map((p) => p.pvNo === pv.pvNo ? { ...p, utrNo: (newUtr || "").toUpperCase().slice(0, 32), paidAt: newUtr ? new Date().toISOString() : p.paidAt } : p);
                                  savePayments(payments);
                                  setRefresh((v) => v + 1);
                                  toast.success(newUtr ? `UTR saved · ${pb.refNo}` : `UTR cleared`);
                                };
                                return (
                                  <div key={`sb-act-${pb.id}-${refresh}-${pv?.utrNo || ""}`} style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                    <span style={{ padding: "3px 7px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>✓ PV: {pb.linkedPvNo || "—"}</span>
                                    <button
                                      data-testid={`salary-xlsx-${pb.id}`}
                                      onClick={() => exportBankTransferXLSX(pb)}
                                      style={{ padding: "3px 7px", background: "#059669", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                      title="Export Bank Transfer Excel"
                                    >⬇ Excel</button>
                                    <button
                                      data-testid={`salary-advice-${pb.id}`}
                                      onClick={() => printBankTransferAdvice(pb)}
                                      style={{ padding: "3px 7px", background: "#be185d", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                      title="Print A4 Landscape Bank Advice for Branch Manager"
                                    >🖨 Bank Advice</button>
                                    <input
                                      key={`utr-${pb.id}-${pv?.utrNo || "empty"}`}
                                      type="text"
                                      defaultValue={pv?.utrNo || ""}
                                      placeholder="Enter UTR / Ref No"
                                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (pv?.utrNo || "")) saveUtr(v); }}
                                      onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }}
                                      disabled={!canApprove()}
                                      data-testid={`salary-utr-${pb.id}`}
                                      title={canApprove() ? "Enter UTR after bank transfer · auto-saves on blur / Enter" : "Only Admin / SuperAdmin / Accounts can set UTR"}
                                      style={{
                                        padding: "3px 7px",
                                        fontSize: 10,
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        border: `1.5px solid ${hasUtr ? "#86efac" : "#fca5a5"}`,
                                        background: hasUtr ? "#dcfce7" : "#fef2f2",
                                        color: hasUtr ? "#166534" : "#991b1b",
                                        borderRadius: 3,
                                        width: 150,
                                      }}
                                    />
                                    {!hasUtr && <span style={{ fontSize: 9, color: "#991b1b", fontWeight: 800 }}>⚠ UTR PENDING</span>}
                                  </div>
                                );
                              })()}
                              {canDelete() && Number(pb.step) >= 3 && (
                                <button
                                  data-testid={`salary-del-${pb.id}`}
                                  onClick={() => {
                                    const pv = pb.linkedPvNo ? getPayments().find((p) => p.pvNo === pb.linkedPvNo) : null;
                                    const pvInfo = pb.linkedPvNo ? ` + linked voucher ${pb.linkedPvNo}` : "";
                                    if (!window.confirm(`Delete Pay Bill ${pb.refNo}${pvInfo}?\n\nStatus: ${PAYBILL_STATUS[pb.step]}\nNet: ₹${Number(pb.totalNet || 0).toLocaleString("en-IN")}\nUTR: ${pv?.utrNo || "—"}\n\nYeh action undo nahi hoga.`)) return;
                                    try {
                                      const log = JSON.parse(localStorage.getItem("ae_vm_pb_delete_log") || "[]");
                                      log.push({ refNo: pb.refNo, step: pb.step, totalNet: pb.totalNet, linkedPvNo: pb.linkedPvNo || "", utr: pv?.utrNo || "", source: "Reports", deletedBy: currentUser() || "User", deletedAt: new Date().toISOString() });
                                      localStorage.setItem("ae_vm_pb_delete_log", JSON.stringify(log));
                                    } catch (err) {}
                                    if (pb.linkedPvNo) {
                                      const next = getPayments().filter((p) => p.pvNo !== pb.linkedPvNo);
                                      savePayments(next);
                                    }
                                    deletePayBill(pb.id);
                                    setRefresh((v) => v + 1);
                                    toast.success(`Pay Bill ${pb.refNo}${pvInfo} deleted`);
                                  }}
                                  style={{ marginLeft: 6, padding: "3px 10px", background: "#991b1b", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                  title={pb.linkedPvNo ? `Delete pay bill + voucher ${pb.linkedPvNo}` : "Delete pay bill"}
                                >🗑 Delete Pay Bills</button>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aging & GST-TDS Register (conditional simple tables) */}
          {/* Employee Advances — Accounts queue (aggregated from Pay Bills) */}
          {reportsTab === "advance" && (
            <div className="section" data-testid="reports-advance">
              <div className="sec-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Employee Advances — Live Register (aggregated from Pay Bills)</span>
                <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>Flow: On-Demand Request → Accounts Approved → Auto-adjusted in Target Month Pay Bill → Pay Bill Settled</span>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                {(() => {
                  const reg = getAdvanceRegister();
                  const totalAdv = reg.reduce((a, r) => a + r.totalAdvance, 0);
                  return (
                    <>
                      <div style={{ padding: "10px 14px", background: "#fef3c7", borderBottom: "1px solid #fcd34d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#78350f", letterSpacing: .5, textTransform: "uppercase" }}>Total Advance Granted · {reg.length} Employee{reg.length !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#78350f" }}>₹ {Number(totalAdv).toLocaleString("en-IN")}</div>
                      </div>
                      {reg.length === 0 ? (
                        <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No advance entries yet · Advance column in Pay Bill rows populates this register.</div>
                      ) : (
                        <table className="data-table" data-testid="advance-table">
                          <thead><tr>
                            <th>EMP Code</th>
                            <th>Employee</th>
                            <th>Department</th>
                            <th style={{ textAlign: "center" }}>Advance Entries</th>
                            <th style={{ textAlign: "right" }}>Total Advance (₹)</th>
                            <th>Linked PVs</th>
                            <th>Status Breakdown</th>
                          </tr></thead>
                          <tbody>
                            {reg.map((r) => {
                              const activeLines = r.lines || [];
                              // Breakdown by actual flow stage (source-aware)
                              const settledCnt = activeLines.filter((l) => l.source === "PayBill" && Number(l.step) === 4).length;
                              const inPayBillCnt = activeLines.filter((l) => l.source === "PayBill" && Number(l.step) < 4).length;
                              const autoAdjCnt = activeLines.filter((l) => l.source === "On-Demand" && Number(l.step) >= 3).length;
                              // Collect linked advance PVs for this employee from Payments store
                              const empAdvPvs = payments.filter((p) => String(p.pvNo || "").startsWith("PV/ADV") && (p.remarks || "").includes(r.empCode || "zzzz"));
                              return (
                                <tr key={r.empId} data-testid={`advance-row-${r.empId}`}>
                                  <td className="mono">{r.empCode}</td>
                                  <td><b>{r.name || "—"}</b></td>
                                  <td>{r.department || "—"}</td>
                                  <td style={{ textAlign: "center" }}>{activeLines.length}</td>
                                  <td className="num" style={{ fontWeight: 800, color: "#78350f" }}>₹ {Number(r.totalAdvance).toLocaleString("en-IN")}</td>
                                  <td style={{ fontSize: 10 }}>
                                    {empAdvPvs.length === 0 ? <span style={{ color: "#94a3b8" }}>—</span> : empAdvPvs.map((p) => <span key={p.pvNo} style={{ display: "inline-block", padding: "2px 6px", margin: 1, background: "#dbeafe", color: "#1e3a8a", borderRadius: 3, border: "1px solid #93c5fd", fontWeight: 700 }}>{p.pvNo}</span>)}
                                  </td>
                                  <td style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                    {settledCnt > 0 && <span data-testid={`adv-badge-settled-${r.empId}`} onClick={() => setAdvDetail({ r, filter: "settled" })} title="Click to see settled advance details" style={{ padding: "2px 7px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✓ Settled · {settledCnt}</span>}
                                    {autoAdjCnt > 0 && <span data-testid={`adv-badge-auto-${r.empId}`} onClick={() => setAdvDetail({ r, filter: "autoAdj" })} title="Click to see which advance requests were auto-adjusted in which Pay Bill month" style={{ padding: "2px 7px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>⚡ Auto-Adjusted · {autoAdjCnt}</span>}
                                    {inPayBillCnt > 0 && <span data-testid={`adv-badge-inpb-${r.empId}`} onClick={() => setAdvDetail({ r, filter: "inPB" })} title="Click to see pay bills where advance is still pending settlement" style={{ padding: "2px 7px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>⏳ In Pay Bill · {inPayBillCnt}</span>}
                                    {activeLines.length === 0 && <span style={{ color: "#94a3b8", fontSize: 10 }}>—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </>
                  );
                })()}

                {/* Advance Payment Vouchers (PV/ADV/*) — moved here from PV Vouchers tab, with simple delete */}
                {(() => {
                  const advPvs = payments.filter((p) => /^PV\/ADV/i.test(String(p.pvNo || "")));
                  if (advPvs.length === 0) return null;
                  const totalAdvPv = advPvs.reduce((s, p) => s + Number(p.amount || 0), 0);
                  return (
                    <div data-testid="advance-pv-section" style={{ borderTop: "2px solid #fcd34d" }}>
                      <div style={{ padding: "10px 14px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9a3412", letterSpacing: .5, textTransform: "uppercase" }}>Advance Payment Vouchers · {advPvs.length} record{advPvs.length !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#9a3412" }}>₹ {Number(totalAdvPv).toLocaleString("en-IN")}</div>
                      </div>
                      <table className="data-table" data-testid="advance-pv-table">
                        <thead><tr>
                          <th title="GPV = Draft · PN = Approved · PV = Legacy">GPV / PN No</th>
                          <th>Employee</th>
                          <th>Date</th>
                          <th style={{ textAlign: "right" }}>Amount (₹)</th>
                          <th style={{ textAlign: "center" }}>Mode</th>
                          <th>UTR / Ref</th>
                          <th style={{ textAlign: "center" }}>Status</th>
                          <th style={{ textAlign: "center" }}>Action</th>
                        </tr></thead>
                        <tbody>
                          {advPvs.map((p) => {
                            const isApp = p.status === "Approved";
                            return (
                              <tr key={p.pvNo} data-testid={`advance-pv-row-${p.pvNo}`}>
                                <td className="mono" style={{ fontWeight: 700, color: isApp ? "#166534" : "#92400e" }}>{isApp ? `✓ ${p.pvNo}` : `⏳ ${p.pvNo}`}</td>
                                <td>{p.vendorName || p.remarks || "—"}</td>
                                <td>{p.date || "—"}</td>
                                <td className="num">{Number(p.amount || 0).toFixed(2)}</td>
                                <td style={{ textAlign: "center" }}>{p.mode || "—"}</td>
                                <td className="mono" style={{ fontSize: 10 }}>{p.utrNo || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                <td style={{ textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: isApp ? "#dcfce7" : "#fef3c7", color: isApp ? "#166534" : "#92400e", border: `1px solid ${isApp ? "#86efac" : "#fcd34d"}` }}>
                                    {p.status || "Draft"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <button
                                    onClick={() => {
                                      if (!canDelete()) { toast.error("Only Admin / SuperAdmin can delete"); return; }
                                      if (!window.confirm(`Delete advance voucher ${p.pvNo}?\n\nAmount: ₹${Number(p.amount || 0).toLocaleString("en-IN")}\nEmployee: ${p.vendorName || p.remarks || "—"}\n\nYeh action undo nahi hoga.`)) return;
                                      deletePayment(p.pvNo);
                                    }}
                                    disabled={!canDelete()}
                                    data-testid={`advance-pv-del-${p.pvNo}`}
                                    style={{ padding: "3px 10px", fontSize: 10.5, background: canDelete() ? "#fee2e2" : "#f1f5f9", color: canDelete() ? "#991b1b" : "#94a3b8", border: `1px solid ${canDelete() ? "#fca5a5" : "#cbd5e1"}`, borderRadius: 4, cursor: canDelete() ? "pointer" : "not-allowed", fontWeight: 600 }}
                                    title={canDelete() ? "Delete this advance voucher (no UTR required)" : "Only Admin / SuperAdmin can delete"}
                                  >
                                    🗑 Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {reportsTab === "aging" && (
            <div className="section" data-testid="reports-aging">
              <div className="sec-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Aging Report — Outstanding Balances by Bucket</span>
                <button
                  data-testid="btn-export-aging"
                  onClick={() => {
                    const buckets = { "0–30 days": [], "31–60 days": [], "61–90 days": [], "90+ days": [] };
                    const now = new Date();
                    dueRows.forEach((r) => {
                      if (r.balance <= 0) return;
                      const due = r.dueDate ? new Date(r.dueDate) : now;
                      const days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
                      const key = days <= 30 ? "0–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "90+ days";
                      buckets[key].push(r);
                    });
                    const summary = Object.entries(buckets).map(([bucket, rows]) => ({
                      Bucket: bucket,
                      "Bill Count": rows.length,
                      "Outstanding (₹)": rows.reduce((s, r) => s + r.balance, 0).toFixed(2),
                    }));
                    const detail = Object.entries(buckets).flatMap(([bucket, rows]) => rows.map((r) => ({
                      Bucket: bucket,
                      "Ref No": r.refNo,
                      Vendor: r.vendorName,
                      "Bill No": r.billNo,
                      "Bill Date": r.billDate,
                      "Due Date": r.dueDate,
                      Net: r.net.toFixed(2),
                      Paid: r.paid.toFixed(2),
                      Balance: r.balance.toFixed(2),
                    })));
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Aging Summary");
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Aging Detail");
                    XLSX.writeFile(wb, `AE-Aging-${today}.xlsx`);
                    toast.success("Aging report exported");
                  }}
                  style={{ padding: "4px 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                >
                  ⬇ Excel
                </button>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr><th>Bucket</th><th style={{ textAlign: "right" }}>Bills</th><th style={{ textAlign: "right" }}>Outstanding</th></tr></thead>
                  <tbody>
                    {(() => {
                      const buckets = { "0–30 days": [], "31–60 days": [], "61–90 days": [], "90+ days": [] };
                      const now = new Date();
                      dueRows.forEach((r) => {
                        if (r.balance <= 0) return;
                        const due = r.dueDate ? new Date(r.dueDate) : now;
                        const days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
                        const key = days <= 30 ? "0–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "90+ days";
                        buckets[key].push(r);
                      });
                      return Object.entries(buckets).map(([k, arr]) => (
                        <tr key={k} data-testid={`aging-${k.replace(/[^a-z0-9]/gi, "")}`}>
                          <td><b>{k}</b></td>
                          <td className="num">{arr.length}</td>
                          <td className="num"><b>{inr(arr.reduce((s, r) => s + r.balance, 0))}</b></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportsTab === "gsttds" && (
            <div className="section" data-testid="reports-gsttds">
              <div className="sec-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>GST-TDS Register — Approved Bills</span>
                <button
                  data-testid="btn-export-gsttds"
                  onClick={() => {
                    const rows = approvedBills.map((b) => {
                      const c = computeBill(b);
                      const v = b.vendorSnapshot || vendors.find((x) => x.vendorCode === b.vendorCode) || {};
                      return {
                        "Ref No": b.permanentBillNo || b.refNo,
                        Vendor: v.firmName || b.vendorCode,
                        "GST No": v.gstNo || "",
                        PAN: v.panNo || "",
                        "Basic (₹)": c.basic.toFixed(2),
                        "GST (₹)": c.gst.toFixed(2),
                        "TDS (₹)": c.tds.toFixed(2),
                        "Net (₹)": c.netPayable.toFixed(2),
                        "GST Slab %": b.gstSlab,
                        "TDS Rate %": b.tdsRate,
                        "Bill Date": b.billDate,
                        "Approval Date": b.approvalDate || "",
                      };
                    });
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "GST-TDS Register");
                    XLSX.writeFile(wb, `AE-GST-TDS-Register-${today}.xlsx`);
                    toast.success("GST-TDS register exported");
                  }}
                  style={{ padding: "4px 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                >
                  ⬇ Excel
                </button>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr>
                    <th>Ref No</th><th>Vendor</th><th>GST No</th><th>PAN</th>
                    <th style={{ textAlign: "right" }}>Basic</th>
                    <th style={{ textAlign: "right" }}>GST</th>
                    <th style={{ textAlign: "right" }}>TDS</th>
                    <th style={{ textAlign: "right" }}>Net</th>
                  </tr></thead>
                  <tbody>
                    {approvedBills.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: "center", color: "#64748b", padding: 14 }}>No approved bills</td></tr>
                    )}
                    {approvedBills.map((b) => {
                      const c = computeBill(b);
                      const v = b.vendorSnapshot || vendors.find((x) => x.vendorCode === b.vendorCode) || {};
                      return (
                        <tr key={b.id} data-testid={`gsttds-row-${b.refNo}`}>
                          <td className="mono">{b.permanentBillNo || b.refNo}</td>
                          <td>{v.firmName || b.vendorCode}</td>
                          <td className="mono" style={{ fontSize: 11 }}>{v.gstNo || "-"}</td>
                          <td className="mono" style={{ fontSize: 11 }}>{v.panNo || "-"}</td>
                          <td className="num">{c.basic.toFixed(2)}</td>
                          <td className="num">{c.gst.toFixed(2)}</td>
                          <td className="num">{c.tds.toFixed(2)}</td>
                          <td className="num"><b>{c.netPayable.toFixed(2)}</b></td>
                        </tr>
                      );
                    })}
                    {approvedBills.length > 0 && (
                      <tr style={{ background: "#f1f5f9", fontWeight: 800 }}>
                        <td colSpan={4} style={{ textAlign: "right" }}>TOTAL</td>
                        <td className="num">{approvedBills.reduce((s, b) => s + computeBill(b).basic, 0).toFixed(2)}</td>
                        <td className="num">{approvedBills.reduce((s, b) => s + computeBill(b).gst, 0).toFixed(2)}</td>
                        <td className="num">{approvedBills.reduce((s, b) => s + computeBill(b).tds, 0).toFixed(2)}</td>
                        <td className="num">{approvedBills.reduce((s, b) => s + computeBill(b).netPayable, 0).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportsTab === "vouchers" && (
          <>
          <div className="section">
            <div className="sec-head">A. Summary Dashboard · Approved Bills Data Sheet</div>
            <div className="sec-body">
              <div className="row cols-4">
                <F label="Approved Bills"><input className="pill" value={summary.approvedBillsCount} readOnly data-testid="sum-count" /></F>
                <F label="Total Basic"><input className="pill" value={inr(summary.totalBasic)} readOnly data-testid="sum-basic" /></F>
                <F label="Total GST"><input className="pill" value={inr(summary.totalGST)} readOnly data-testid="sum-gst" /></F>
                <F label="Total TDS"><input className="pill" value={inr(summary.totalTDS)} readOnly data-testid="sum-tds" /></F>
              </div>
              <div className="row cols-4" style={{ marginTop: 10 }}>
                <F label="Net Payable"><input className="pill-generated" value={inr(summary.totalNet)} readOnly data-testid="sum-net" /></F>
                <F label="Paid"><input className="pill-generated" value={inr(summary.totalPaid)} readOnly data-testid="sum-paid" /></F>
                <F label="Outstanding"><input className="pill-status" value={inr(summary.totalOutstanding)} readOnly data-testid="sum-outstanding" /></F>
                <F label="Overdue Bills"><input className="pill-status" value={summary.overdue} readOnly data-testid="sum-overdue" /></F>
              </div>
              <div className="row cols-1" style={{ marginTop: 10 }}>
                <F label="Total Net Payable (In Words)">
                  <input
                    className="pill-generated"
                    value={amountToWords(summary.totalNet)}
                    readOnly
                    data-testid="sum-net-words"
                    style={{ fontStyle: "italic", letterSpacing: ".2px" }}
                  />
                </F>
              </div>

              {/* ---- Approved Bills Data Sheet with per-row selection checkbox (VENDOR BILLS ONLY) ---- */}
              {(() => {
                const unpaidApproved = dueRows.filter((r) => r.balance > 0);
                const allSelected = unpaidApproved.length > 0 && unpaidApproved.every((r) => selectedDueBills.has(r.id));
                const toggleAll = () => {
                  if (allSelected) setSelectedDueBills(new Set());
                  else setSelectedDueBills(new Set(unpaidApproved.map((r) => r.id)));
                };
                const toggleOne = (id) => {
                  const n = new Set(selectedDueBills);
                  n.has(id) ? n.delete(id) : n.add(id);
                  setSelectedDueBills(n);
                };
                const selectedRows = unpaidApproved.filter((r) => selectedDueBills.has(r.id));
                const selSum = selectedRows.reduce((s, r) => s + r.balance, 0);
                return (
                  <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ padding: "7px 12px", background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#334155", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        All Approved Vendor Bills · {unpaidApproved.length} unpaid · <span style={{ color: "#be185d" }}>Selected: {selectedRows.length}</span> · <span style={{ color: "#166534" }}>₹ {selSum.toLocaleString("en-IN")}</span>
                        <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "none", letterSpacing: 0 }}>↓ Vendor decisions niche "Due List · Monthly Decision Sheet" me lagein · HR Pay Bills Salary Bills tab me handle hoti hain.</span>
                      </div>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto" }}>
                      <table className="data-table" data-testid="approved-bills-sheet" style={{ margin: 0 }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                          <tr>
                            <th style={{ width: 34, textAlign: "center" }}>
                              <input type="checkbox" data-testid="sum-select-all" checked={allSelected} onChange={toggleAll} title="Select all unpaid approved bills" />
                            </th>
                            <th>Ref No</th>
                            <th>Vendor</th>
                            <th>Bill No</th>
                            <th>Bill Dt</th>
                            <th>Due Dt</th>
                            <th style={{ textAlign: "right" }}>Net</th>
                            <th style={{ textAlign: "right" }}>Paid</th>
                            <th style={{ textAlign: "right" }}>Balance</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unpaidApproved.length === 0 && (
                            <tr><td colSpan={10} style={{ textAlign: "center", color: "#64748b", padding: 14 }}>No unpaid approved bills</td></tr>
                          )}
                          {unpaidApproved.map((r) => {
                            const b = bills.find((x) => x.id === r.id);
                            const decision = b?.paymentStatus || "";
                            const isPaid = r.balance <= 0;
                            return (
                              <tr key={r.id} data-testid={`sum-row-${r.refNo}`} style={{ background: selectedDueBills.has(r.id) ? "#eff6ff" : isPaid ? "#f0fdf4" : decision === "MarkedPay" ? "#f0fdf4" : decision === "Hold" ? "#fffbeb" : decision === "Reject" ? "#fef2f2" : "#fff" }}>
                                <td style={{ textAlign: "center" }}>
                                  <input type="checkbox" data-testid={`sum-chk-${r.refNo}`} checked={selectedDueBills.has(r.id)} onChange={() => toggleOne(r.id)} />
                                </td>
                                <td className="mono" style={{ cursor: "pointer", color: "#0369a1", textDecoration: "underline dotted" }} onClick={() => setViewBill(b)} title="Click to view full bill">{r.refNo}</td>
                                <td style={{ cursor: "pointer" }} onClick={() => setViewBill(b)} title="Click to view full bill">{r.vendorName}<br /><span style={{ fontSize: 10, color: "#64748b" }} className="mono">{r.vendorCode}</span></td>
                                <td>{r.billNo}</td>
                                <td>{r.billDate}</td>
                                <td>{r.dueDate}</td>
                                <td className="num">{r.net.toFixed(2)}</td>
                                <td className="num">{r.paid.toFixed(2)}</td>
                                <td className="num"><b>{r.balance.toFixed(2)}</b></td>
                                <td>
                                  {isPaid ? (
                                    <span style={{ padding: "2px 7px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>✓ PAID</span>
                                  ) : decision === "MarkedPay" ? (
                                    <span style={{ padding: "2px 7px", background: "#bbf7d0", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>✓ Marked Pay</span>
                                  ) : decision === "Hold" ? (
                                    <span style={{ padding: "2px 7px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⏸ On Hold</span>
                                  ) : decision === "Reject" ? (
                                    <span style={{ padding: "2px 7px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>✗ Rejected</span>
                                  ) : (
                                    <span className={`pill-tag ${r.status === "Overdue" ? "overdue" : "due"}`}>{r.status}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="section">
            <div className="sec-head">B. Due List · Monthly Decision Sheet</div>
            <div className="sec-body">
              {/* Month filter + action bar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "8px 10px", background: "#f1f5f9", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 }}>Month</span>
                <select data-testid="due-month" value={dueMonth} onChange={(e) => setDueMonth(+e.target.value)} style={{ padding: "5px 8px", fontSize: 11.5, border: "1px solid #cbd5e1", borderRadius: 4 }}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}
                </select>
                <input data-testid="due-year" type="number" value={dueYear} onChange={(e) => setDueYear(+e.target.value)} style={{ padding: "5px 8px", width: 90, fontSize: 11.5, border: "1px solid #cbd5e1", borderRadius: 4 }} />
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>
                  {monthSummary.total} rows · Due ₹ {monthSummary.totalDue.toLocaleString("en-IN")} · <span style={{ color: "#16a34a" }}>✓Pay: {monthSummary.markedPayCount}</span> · <span style={{ color: "#b45309" }}>⏸Hold: {monthSummary.holdCount}</span> · <span style={{ color: "#991b1b" }}>✗Reject: {monthSummary.rejectCount}</span>
                </span>
                <button data-testid="due-download-xlsx" onClick={downloadDecisionExcel} style={{ padding: "5px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }} title="Download XLSX decision sheet — edit Decision + Pay Amount offline and re-upload">⬇ Download Decision XLSX</button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDecisionExcel(f); e.target.value = ""; }} />
                <button data-testid="due-upload-xlsx" onClick={() => fileInputRef.current?.click()} disabled={!canApprove()} style={{ padding: "5px 10px", background: canApprove() ? "#7c3aed" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 4, cursor: canApprove() ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }} title="Upload edited decision XLSX to apply decisions in bulk">⬆ Upload Decision XLSX</button>
                <button data-testid="due-bulk-single-pv" onClick={processSinglePVs} disabled={!canApprove() || monthSummary.markedPayCount === 0} style={{ padding: "5px 10px", background: canApprove() && monthSummary.markedPayCount > 0 ? "#0369a1" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 4, cursor: canApprove() && monthSummary.markedPayCount > 0 ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }} title="Generate individual Payment Voucher drafts per vendor from marked-Pay rows">💼 Process → Single PVs ({monthSummary.markedPayCount})</button>
                <button data-testid="due-single-bank-advice" onClick={() => {
                  const toPay = consolidatedDues.filter((r) => r.decision === "MarkedPay");
                  if (!toPay.length) { toast.error("No vendor bills marked 'Pay' for this month"); return; }
                  if (!window.confirm(`Print ${toPay.length} individual party-wise Bank Advice(s) for ${monthLabel}?\n\nEach vendor gets its own A4 landscape bank transfer advice.`)) return;
                  let printed = 0;
                  toPay.forEach((r, idx) => {
                    const b = bills.find((x) => x.id === r.id); if (!b) return;
                    const vend = b.vendorSnapshot || {};
                    const amt = r.scheduledPay > 0 ? Math.min(r.scheduledPay, r.balance) : r.balance;
                    setTimeout(() => {
                      printBulkBankAdvice([{ refNo: r.refNo, billNo: r.billNo, party: r.party, partyCode: r.partyCode, bank: vend.bankName || "—", branch: vend.bankBranch || "", account: vend.bankAccount || "—", ifsc: vend.ifsc || "—", amount: amt }], { monthLabel: `${r.party} · ${monthLabel}`, period: monthKey });
                    }, idx * 400);
                    printed += 1;
                  });
                  toast.success(`Opening ${printed} individual bank advice prints · check pop-ups`);
                }} disabled={monthSummary.markedPayCount === 0} style={{ padding: "5px 10px", background: monthSummary.markedPayCount > 0 ? "#ea580c" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 4, cursor: monthSummary.markedPayCount > 0 ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }} title="Print individual A4 landscape bank advice per vendor (one page per party)">🖨 Single Payment Bank Advice ({monthSummary.markedPayCount})</button>
                <button data-testid="due-bulk-advice" onClick={processBulkBankAdvice} disabled={monthSummary.markedPayCount === 0} style={{ padding: "5px 10px", background: monthSummary.markedPayCount > 0 ? "#be185d" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 4, cursor: monthSummary.markedPayCount > 0 ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }} title="Print A4 landscape consolidated bank advice listing all marked-Pay vendor transfers">🖨 Print → Bulk Bank Advice</button>
              </div>

              {/* Decision summary cards removed per user request — only workflow instruction remains below the action bar when there are no dues */}
              {monthSummary.total === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "#64748b", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 6, fontSize: 12 }}>
                  <b style={{ color: "#334155" }}>No vendor dues for {monthLabel}</b><br />
                  Jab is month ke bills Vendor Bills section se Approved honge, yahan dikhne lagenge.
                </div>
              )}
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 5, fontSize: 11, color: "#1e3a8a", lineHeight: 1.6 }}>
                <b>Workflow:</b> Upar <b>Summary Dashboard</b> me bills select karein → ⬇ Download XLSX → offline me Decision + Pay Amount fill karein → ⬆ Upload XLSX → 💼 Process → Single PVs <i>ya</i> 🖨 Single Payment Bank Advice <i>ya</i> 🖨 Bulk Bank Advice.
              </div>
            </div>
          </div>
          <div className="section">
            <div className="sec-head">C. Payments Register · Edit / Delete / Reschedule</div>
            <div className="sec-body">
              {payments.length === 0 ? (
                <div style={{ padding: 14, color: "#64748b", fontSize: 12, textAlign: "center" }}>
                  No payment vouchers generated yet.
                </div>
              ) : (
                <table className="data-table" data-testid="payments-register">
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ width: 34, textAlign: "center" }} title="Select approved voucher for export">
                        <input
                          type="checkbox"
                          data-testid="export-select-all"
                          disabled={approvedPayments.length === 0}
                          checked={approvedPayments.length > 0 && approvedPayments.every((p) => selectedPvs.has(p.pvNo))}
                          onChange={toggleSelectAll}
                          title="Select / Deselect all approved vouchers"
                        />
                      </th>
                      <th title="GPV = Generated draft · PN = Approved · PV = Legacy">GPV / PN No</th>
                      <th>Vendor</th>
                      <th>Bill No</th>
                      <th>Payment Date</th>
                      <th style={{ textAlign: "right" }}>Amount (₹)</th>
                      <th>Mode</th>
                      <th>UTR / Ref</th>
                      <th>Status</th>
                      <th style={{ minWidth: 260 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorPayments.map((p) => (
                      <tr key={p.pvNo} data-testid={`pay-row-${p.pvNo}`}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            data-testid={`export-select-${p.pvNo}`}
                            disabled={p.status !== "Approved"}
                            checked={selectedPvs.has(p.pvNo)}
                            onChange={() => toggleSelectPv(p.pvNo)}
                            title={p.status === "Approved" ? "Select for Excel export" : "Only approved vouchers can be exported"}
                          />
                        </td>
                        <td className="mono">
                          <button
                            onClick={() => loadVoucher(p.pvNo)}
                            data-testid={`pay-load-${p.pvNo}`}
                            style={{ background: "transparent", border: "none", color: "#1d4ed8", cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}
                            title="Load voucher below to view/edit"
                          >
                            {p.pvNo}
                          </button>
                          {p.revision > 0 && (
                            <span
                              data-testid={`pay-rev-${p.pvNo}`}
                              style={{ marginLeft: 6, padding: "1px 6px", fontSize: 9, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 999, fontWeight: 700 }}
                              title={`Reopened ${p.revision} time(s)`}
                            >
                              REV {p.revision}
                            </span>
                          )}
                        </td>
                        <td>{p.vendorName || p.vendorCode}</td>
                        <td>{p.billNo}</td>
                        <td>
                          <input
                            type="date"
                            value={p.date || ""}
                            onChange={(e) => reschedulePayment(p.pvNo, e.target.value)}
                            data-testid={`pay-date-${p.pvNo}`}
                            style={{ padding: "4px 6px", fontSize: 11, border: "1px solid #cfd8e3", borderRadius: 4 }}
                            title="Change payment date"
                          />
                        </td>
                        <td className="num">{Number(p.amount || 0).toFixed(2)}</td>
                        <td>{p.mode}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 10.5 }} data-testid={`pay-utr-${p.pvNo}`}>{p.utrNo || "—"}</td>
                        <td>
                          <span className={`pill-tag ${p.status === "Approved" ? "paid" : "due"}`}>{p.status}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {p.status === "Approved" && (
                              <button
                                onClick={() => reopenPayment(p.pvNo)}
                                data-testid={`pay-reopen-${p.pvNo}`}
                                style={{ padding: "3px 8px", fontSize: 10.5, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                                title="Reopen for edit (requires Re-Approval)"
                              >
                                Reopen
                              </button>
                            )}
                            {p.status !== "Approved" && (
                              <button
                                onClick={() => reApprovePayment(p.pvNo)}
                                data-testid={`pay-reapprove-${p.pvNo}`}
                                style={{ padding: "3px 8px", fontSize: 10.5, background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                                title={p.revision > 0 ? "Re-Approve after edit" : "Approve this voucher"}
                              >
                                {p.revision > 0 ? "Re-Approve" : "Approve"}
                              </button>
                            )}
                            <button
                              onClick={() => loadVoucher(p.pvNo)}
                              data-testid={`pay-edit-${p.pvNo}`}
                              style={{ padding: "3px 8px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                              title="Load voucher below to edit"
                            >
                              Edit
                            </button>
                            {p.status !== "Approved" ? (
                              <button
                                onClick={() => { if (!canDelete()) { toast.error("Only Admin / SuperAdmin can delete"); return; } deletePayment(p.pvNo); }}
                                disabled={!canDelete()}
                                data-testid={`pay-delete-${p.pvNo}`}
                                style={{ padding: "3px 8px", fontSize: 10.5, background: canDelete() ? "#fee2e2" : "#f1f5f9", color: canDelete() ? "#991b1b" : "#94a3b8", border: `1px solid ${canDelete() ? "#fca5a5" : "#cbd5e1"}`, borderRadius: 4, cursor: canDelete() ? "pointer" : "not-allowed", fontWeight: 600 }}
                                title={canDelete() ? "Delete voucher and free the bill" : "Only Admin / SuperAdmin can delete"}
                              >
                                Delete
                              </button>
                            ) : (
                              <SuperAdminDelete
                                label={`Payment Voucher ${p.pvNo}`}
                                meta={{ "Vendor": p.vendorName || p.vendorCode, "Amount": `₹${Number(p.amount || 0).toLocaleString("en-IN")}`, "Status": p.status, "Approved By": p.approvedByName || "—", "UTR": p.utrNo || "—" }}
                                auditKey="ae_vm_pv_delete_log"
                                testid={`pay-sa-del-${p.pvNo}`}
                                blockReason={!p.utrNo ? `Delete locked · Pehle UTR number enter karo (Edit voucher → UTR / Reference No field), uske baad hi delete allow hoga.` : ""}
                                onDelete={() => deletePayment(p.pvNo)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="section">
            <div className="sec-head">D. Generate Payment Voucher</div>
            <div className="sec-body">
              <div className="row cols-3">
                <F label="Approved Bill">
                  <select data-testid="pv-bill-select" value={selectedBillId} onChange={(e) => setSelectedBillId(e.target.value)}>
                    <option value="">Select approved bill</option>
                    {approvedBills.map((b) => {
                      const exists = vouchersByBill[b.id];
                      const label = `${b.permanentBillNo || b.refNo} · ${b.vendorSnapshot?.firmName || b.vendorCode} · ₹${computeBill(b).netPayable}${exists ? `  ✓ Voucher: ${exists.pvNo}` : ""}`;
                      return (
                        <option key={b.id} value={b.id} disabled={!!exists}>{label}</option>
                      );
                    })}
                  </select>
                </F>
                <F label="Voucher Status">
                  <input className="pill-status" value={pv?.status || "—"} readOnly data-testid="pv-status" />
                </F>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic" }}>
                    👇 Action bar page ke last me — Generate → Save → Edit → Delete → Approval → Bank Advice → UTR → Status.
                  </div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.4fr 1.4fr auto", gap: "8px 12px", alignItems: "end", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6 }}>
                <div style={{ fontSize: 11.5, color: "#166534", lineHeight: 1.4, gridColumn: "1 / -1" }} data-testid="export-info">
                  <b>Approved Voucher Excel Export</b> — {approvedPayments.length} approved voucher{approvedPayments.length !== 1 ? "s" : ""} available.
                  {selectedPvs.size > 0
                    ? <> · <b>{selectedPvs.size}</b> selected for export.</>
                    : <> · Pick "All Approved" ya niche se koi specific voucher choose karein.</>}
                </div>
                <F label="Export Selection">
                  <select
                    data-testid="export-pv-select"
                    value={selectedPvs.size === 0 ? "__ALL__" : (selectedPvs.size === 1 ? Array.from(selectedPvs)[0] : "__MULTI__")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__ALL__") setSelectedPvs(new Set());
                      else if (v === "__MULTI__") { /* preserve current multi-selection made via row checkboxes */ }
                      else setSelectedPvs(new Set([v]));
                    }}
                    disabled={approvedPayments.length === 0}
                  >
                    <option value="__ALL__">{`All Approved Vouchers (${approvedPayments.length})`}</option>
                    {selectedPvs.size > 1 && (
                      <option value="__MULTI__">{`Multiple Selected (${selectedPvs.size}) · via row checkboxes`}</option>
                    )}
                    {approvedPayments.map((p) => (
                      <option key={p.pvNo} value={p.pvNo}>
                        {`${p.pvNo} · ${p.vendorName || p.vendorCode} · ₹${Number(p.amount || 0).toFixed(2)}`}
                      </option>
                    ))}
                  </select>
                </F>
                <div className="field-b">
                  <label>&nbsp;</label>
                  <button
                    onClick={exportApprovedVouchers}
                    data-testid="export-approved-vouchers"
                    disabled={approvedPayments.length === 0}
                    style={{
                      padding: "8px 16px", fontSize: 12,
                      background: approvedPayments.length === 0 ? "#94a3b8" : "#166534",
                      color: "#fff", border: "none", borderRadius: 5,
                      cursor: approvedPayments.length === 0 ? "not-allowed" : "pointer",
                      fontWeight: 700, letterSpacing: 0.3,
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 30,
                    }}
                    title={selectedPvs.size === 0 ? "Export all approved vouchers to Excel" : `Export ${selectedPvs.size} selected voucher(s) to Excel`}
                  >
                    📥 Export to Excel
                  </button>
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 10.5, color: "#166534", opacity: 0.85, fontStyle: "italic" }}>
                  💡 Tip: multiple voucher select karne ke liye upar Payments Register table me har row ke checkbox tick karein.
                </div>
              </div>
            </div>
          </div>

          {pv && (
            <>
              <div className="section">
                <div className="sec-head">E. Voucher Details</div>
                <div className="sec-body">
                  <div className="row cols-3">
                    <F label={pv.status === "Approved" ? "PN Number (Approved)" : "GPV Number (Draft)"}><input className="pill-generated" value={pv.pvNo} readOnly data-testid="pv-no" title={pv.draftNo ? `Draft was ${pv.draftNo} · Approved as ${pv.pvNo}` : ""} /></F>
                    <F label="Date"><input type="date" value={pv.date} onChange={(e) => setPv({ ...pv, date: e.target.value })} /></F>
                    <F label="Payment Mode">
                      <select value={pv.mode} onChange={(e) => setPv({ ...pv, mode: e.target.value })} data-testid="pv-mode">
                        {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </F>
                  </div>
                  <div className="row cols-3" style={{ marginTop: 10 }}>
                    <F label="Bill Ref"><input value={pv.billRefNo} readOnly /></F>
                    <F label="Bill No"><input value={pv.billNo} readOnly /></F>
                    <F label="Vendor Code"><input value={pv.vendorCode} readOnly /></F>
                  </div>
                  <div className="row cols-2" style={{ marginTop: 10 }}>
                    <F label="Vendor Name"><input value={pv.vendorName} readOnly /></F>
                    <F label="Bank"><input value={pv.bankName} readOnly /></F>
                  </div>
                  <div className="row cols-3" style={{ marginTop: 10 }}>
                    <F label="IFSC">
                      <input
                        value={pv.ifscCode || ""}
                        readOnly
                        data-testid="pv-ifsc"
                        style={{ fontFamily: "monospace", letterSpacing: ".4px", textTransform: "uppercase", fontWeight: 700, width: "100%", minWidth: 150 }}
                      />
                    </F>
                    <F label="Account Holder"><input value={pv.accountName} readOnly /></F>
                    <F label="Account Number">
                      <input
                        value={pv.accountNumber || ""}
                        readOnly
                        data-testid="pv-acctno"
                        style={{ fontFamily: "monospace", letterSpacing: ".4px", fontWeight: 700, width: "100%", minWidth: 150 }}
                      />
                    </F>
                  </div>
                  <div className="row cols-2" style={{ marginTop: 10 }}>
                    <F label="Amount (₹)">
                      <input type="number" step="0.01" min="0" value={pv.amount}
                        onChange={(e) => setPv({ ...pv, amount: e.target.value })} data-testid="pv-amount" />
                    </F>
                    <F label="UTR / Reference No (Post-payment)">
                      <input
                        value={pv.utrNo || ""}
                        onChange={(e) => setPv({ ...pv, utrNo: e.target.value.toUpperCase().slice(0, 32) })}
                        placeholder={pv.status === "Approved" ? "Enter UTR after transfer — appears in vendor's Due List" : "Available after voucher is approved"}
                        data-testid="pv-utr"
                        style={{
                          fontFamily: "monospace",
                          letterSpacing: ".3px",
                          background: pv.status === "Approved" ? "#fef9c3" : "#fff",
                          borderColor: pv.status === "Approved" ? "#facc15" : undefined,
                          fontWeight: pv.utrNo ? 700 : 400,
                        }}
                      />
                    </F>
                  </div>
                  <div className="row cols-1" style={{ marginTop: 10 }}>
                    <F label="Amount (In Words)">
                      <input
                        className="pill-generated"
                        value={amountToWords(pv.amount)}
                        readOnly
                        data-testid="pv-amount-words"
                        style={{ fontStyle: "italic", letterSpacing: ".2px" }}
                      />
                    </F>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="sec-head">F. Breakup</div>
                <div className="sec-body">
                  <div className="compute">
                    <table>
                      <thead><tr><th>Particulars</th><th style={{ textAlign: "right" }}>Amount (₹)</th></tr></thead>
                      <tbody>
                        <tr><td>Bill Basic</td><td className="num">{Number(pv.basic || 0).toFixed(2)}</td></tr>
                        <tr><td>GST</td><td className="num">{Number(pv.gst || 0).toFixed(2)}</td></tr>
                        <tr><td>TDS Deducted</td><td className="num">{Number(pv.tds || 0).toFixed(2)}</td></tr>
                        <tr><td>Bill Net</td><td className="num">{Number(pv.net || pv.amount || 0).toFixed(2)}</td></tr>
                        <tr className="total"><td>Voucher Amount</td><td className="num" data-testid="pv-voucher-amount">{Number(pv.amount || 0).toFixed(2)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="row cols-1" style={{ marginTop: 10 }}>
                    <F label="Voucher Amount (In Words)">
                      <input
                        className="pill-generated"
                        value={amountToWords(pv.amount)}
                        readOnly
                        data-testid="pv-breakup-words"
                        style={{ fontStyle: "italic", letterSpacing: ".2px" }}
                      />
                    </F>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="sec-head">G. Workflow &amp; Approvals (Voucher)</div>
                <div className="sec-body">
                  <div className="row cols-3">
                    <F label="Created By"><input value={pv.createdByName} onChange={(e) => setPv({ ...pv, createdByName: e.target.value })} /></F>
                    <F label="Checked By"><input value={pv.checkedByName} onChange={(e) => setPv({ ...pv, checkedByName: e.target.value })} /></F>
                    <F label="Approved By"><input value={pv.approvedByName} onChange={(e) => setPv({ ...pv, approvedByName: e.target.value })} /></F>
                  </div>
                  <div className="row cols-2" style={{ marginTop: 10 }}>
                    <F label="Remarks"><textarea rows={2} value={pv.remarks} onChange={(e) => setPv({ ...pv, remarks: e.target.value })} /></F>
                    <F label="Approval Date">
                      <input className="date-highlight" value={pv.approvalDate || ""} readOnly />
                    </F>
                  </div>
                </div>
              </div>

            </>
          )}

          {/* Bottom Action Bar · Section D PV actions · left-to-right: Generate → Save → Edit → Delete → Approval → Bank Advice → Fill UTR → Status */}
          <div data-testid="pv-bottom-actions" style={{ marginTop: 16, padding: "14px 18px", background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff", borderRadius: 8, boxShadow: "0 4px 12px rgba(15,23,42,.25)" }}>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>
              <b style={{ color: "#fbbf24" }}>Single Bill Payment Voucher</b> ·
              {selectedBillId ? (
                <> Selected bill: <b>{(approvedBills.find((b) => b.id === selectedBillId)?.vendorSnapshot?.firmName) || "—"}</b></>
              ) : (
                <> Pehle upar section D me "Approved Bill" select karein</>
              )}
              {pv && <> · PV: <b style={{ color: "#fbbf24" }}>{pv.pvNo}</b></>}
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* 1. Generate Voucher · Amber */}
              <button
                data-testid="pv-generate"
                onClick={generateVoucher}
                disabled={!selectedBillId}
                style={{ padding: "9px 16px", background: selectedBillId ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#334155", color: "#fff", border: "none", borderRadius: 6, cursor: selectedBillId ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: selectedBillId ? "0 2px 6px rgba(245,158,11,.4)" : "none", textTransform: "uppercase" }}
                title={selectedBillId ? "Generate single-bill Payment Voucher draft" : "Select an approved bill first"}
              >🧾 Generate Voucher</button>

              {/* 2. Save · Blue */}
              <button
                data-testid="pv-save"
                onClick={handleSave}
                disabled={!pv || pv.status === "Approved"}
                style={{ padding: "9px 16px", background: pv && pv.status !== "Approved" ? "linear-gradient(135deg,#0ea5e9,#0369a1)" : "#334155", color: "#fff", border: "none", borderRadius: 6, cursor: pv && pv.status !== "Approved" ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: pv && pv.status !== "Approved" ? "0 2px 6px rgba(14,165,233,.4)" : "none", textTransform: "uppercase" }}
                title={pv ? (pv.status === "Approved" ? "Approved voucher — Save disabled" : "Save draft voucher") : "Generate voucher first"}
              >💾 Save</button>

              {/* 3. Edit · Indigo — reopens Approved vouchers, re-fetches bank, focuses Amount */}
              <button
                data-testid="pv-edit"
                onClick={() => {
                  if (!pv) {
                    if (selectedBillId) { toast.error("Pehle 'Generate Voucher' click karein"); return; }
                    toast.error("Pehle Approved Bill select karein, phir Generate / Edit"); return;
                  }
                  // Re-fetch latest vendor master bank details (in case vendor master was updated after voucher creation)
                  const vend = vendors.find((x) => x.vendorCode === pv.vendorCode) || {};
                  const refreshed = {
                    ...pv,
                    bankName: pv.bankName || vend.bankName || "",
                    accountName: pv.accountName || vend.accountHolder || vend.firmName || "",
                    accountNumber: pv.accountNumber || vend.accountNumber || vend.bankAccount || "",
                    ifscCode: pv.ifscCode || vend.ifscCode || vend.ifsc || "",
                  };
                  if (pv.status === "Approved") {
                    if (!canApprove()) { toast.error("Only SuperAdmin / Admin can reopen an approved voucher"); return; }
                    if (!window.confirm(`Reopen Approved voucher ${pv.pvNo} for editing?\n\nThis will reset status to Draft and require Re-Approval. Audit log entry banega.`)) return;
                    reopenPayment(pv.pvNo);
                    toast.info("Voucher reopened · PV fields now editable");
                  } else {
                    setPv(refreshed);
                    toast.success("Edit mode · Bank details refreshed, fields editable");
                  }
                  setTimeout(() => {
                    const el = document.querySelector('[data-testid="pv-amount"]');
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      try { el.focus(); el.select && el.select(); } catch (e) { /* noop */ }
                    }
                  }, 150);
                }}
                disabled={!pv && !selectedBillId}
                style={{ padding: "9px 16px", background: pv ? "linear-gradient(135deg,#6366f1,#4338ca)" : (selectedBillId ? "linear-gradient(135deg,#6366f1,#4338ca)" : "#334155"), color: "#fff", border: "none", borderRadius: 6, cursor: (pv || selectedBillId) ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: pv ? "0 2px 6px rgba(99,102,241,.4)" : "none", textTransform: "uppercase" }}
                title={pv ? (pv.status === "Approved" ? "Reopen for editing (Admin/SuperAdmin)" : "Refresh bank details & focus amount") : "Generate voucher first"}
              >✏️ Edit</button>

              {/* 4. Delete · Red · Unified style (Approved vouchers keep UTR-lock + audit log) */}
              {(() => {
                const isApproved = !!(pv && pv.status === "Approved");
                const utrLocked = isApproved && !pv.utrNo;
                const roleOk = isApproved ? currentRole() === "SuperAdmin" : canDelete();
                const enabled = !!pv && roleOk && !utrLocked;
                const tooltip = !pv
                  ? "Generate voucher first"
                  : utrLocked
                    ? "Delete locked · Pehle UTR number enter karo, uske baad hi delete allow hoga."
                    : !roleOk
                      ? (isApproved ? "Only SuperAdmin can delete an approved voucher" : "Only Admin / SuperAdmin can delete")
                      : (isApproved ? "SuperAdmin override · Delete approved voucher (audit logged)" : "Delete this voucher (frees bill)");
                return (
                  <button
                    data-testid="pv-delete"
                    onClick={() => {
                      if (!pv) { toast.error("Pehle voucher generate karein"); return; }
                      if (utrLocked) { toast.error("Delete locked · Pehle UTR number enter karo, uske baad hi delete allow hoga."); return; }
                      if (!roleOk) { toast.error(isApproved ? "Only SuperAdmin can delete an approved voucher" : "Only Admin / SuperAdmin can delete"); return; }
                      if (isApproved) {
                        const detail = `Vendor: ${pv.vendorName || pv.vendorCode}\nAmount: ₹${Number(pv.amount || 0).toLocaleString("en-IN")}\nStatus: ${pv.status}\nApproved By: ${pv.approvedByName || "—"}\nUTR: ${pv.utrNo || "—"}`;
                        if (!window.confirm(`⚠️ SuperAdmin Override\n\nDelete Payment Voucher ${pv.pvNo}?\n\n${detail}\n\nThis action is logged in audit trail. Linked bill will re-appear in Due List.`)) return;
                        try {
                          const log = JSON.parse(localStorage.getItem("ae_vm_pv_delete_log") || "[]");
                          log.push({ label: `Payment Voucher ${pv.pvNo}`, Vendor: pv.vendorName || pv.vendorCode, Amount: pv.amount, Status: pv.status, "Approved By": pv.approvedByName || "—", UTR: pv.utrNo || "—", deletedBy: currentUser() || "SuperAdmin", deletedAt: new Date().toISOString() });
                          localStorage.setItem("ae_vm_pv_delete_log", JSON.stringify(log));
                        } catch (_e) { /* noop */ }
                      } else {
                        if (!window.confirm(`Delete voucher ${pv.pvNo}?\n\nStatus: ${pv.status}\nAmount: ₹${Number(pv.amount || 0).toLocaleString("en-IN")}\n\nYeh action undo nahi hoga.`)) return;
                      }
                      deletePayment(pv.pvNo);
                      setPv(null);
                      setSelectedBillId("");
                    }}
                    disabled={!enabled}
                    style={{ padding: "9px 16px", background: enabled ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "#334155", color: "#fff", border: "none", borderRadius: 6, cursor: enabled ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: enabled ? "0 2px 6px rgba(239,68,68,.4)" : "none", textTransform: "uppercase" }}
                    title={tooltip}
                  >{utrLocked ? "🔒 Delete" : "🗑️ Delete"}</button>
                );
              })()}

              {/* 5. Submit to GM · Purple (all approvals route via GM Dashboard only, per user policy) */}
              <button
                data-testid="pv-approve"
                onClick={() => {
                  if (!pv) { toast.error("Pehle voucher generate karein"); return; }
                  if (pv.status === "Draft") { handleSubmit(); toast.info("Submitted · ab GM Dashboard me approve hoga"); return; }
                  if (pv.status === "Submitted") { toast.info("Pehle hi Submitted hai · GM Dashboard me approve karein"); return; }
                  toast.info(`Voucher already ${pv.status}`);
                }}
                disabled={!pv || pv.status === "Approved"}
                title={!pv ? "Generate voucher first" : pv.status === "Approved" ? "Already approved" : pv.status === "Submitted" ? "Submitted — approval ab sirf GM Dashboard me hoga" : "Submit to GM Dashboard for approval"}
                style={{ padding: "9px 16px", background: pv && pv.status !== "Approved" ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "#334155", color: "#fff", border: "none", borderRadius: 6, cursor: pv && pv.status !== "Approved" ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: pv && pv.status !== "Approved" ? "0 2px 6px rgba(139,92,246,.4)" : "none", textTransform: "uppercase" }}
              >📤 Submit to GM</button>

              {/* 6. Bank Advice · Pink */}
              <button
                data-testid="pv-bank-advice"
                onClick={() => {
                  if (!pv) { toast.error("Pehle voucher generate karein"); return; }
                  const bill = approvedBills.find((b) => b.id === pv.billId) || {};
                  const vend = (bill.vendorSnapshot) || vendors.find((v) => v.vendorCode === pv.vendorCode) || {};
                  const monthLabel = `PV ${pv.pvNo} · ${pv.date}`;
                  printBulkBankAdvice([{
                    refNo: pv.pvNo,
                    billNo: pv.billRefNo || pv.billNo,
                    party: pv.vendorName || vend.firmName || pv.vendorCode,
                    partyCode: pv.vendorCode,
                    bank: pv.bankName || vend.bankName || "—",
                    branch: vend.bankBranch || "",
                    account: pv.accountNumber || vend.bankAccount || "—",
                    ifsc: pv.ifscCode || vend.ifsc || "—",
                    amount: Number(pv.amount || 0),
                  }], { monthLabel, period: pv.date || "" });
                }}
                disabled={!pv}
                style={{ padding: "9px 16px", background: pv ? "linear-gradient(135deg,#ec4899,#be185d)" : "#334155", color: "#fff", border: "none", borderRadius: 6, cursor: pv ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: pv ? "0 2px 6px rgba(236,72,153,.4)" : "none", textTransform: "uppercase" }}
                title={pv ? "Print A4 landscape bank advice for this voucher" : "Generate voucher first"}
              >🖨 Bank Advice</button>

              {/* 7. Fill UTR · Yellow highlighted when Approved */}
              <div
                data-testid="pv-utr-wrap"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", background: pv && pv.status === "Approved" ? "linear-gradient(135deg,#fde68a,#fbbf24)" : "#334155", border: `1.5px solid ${pv && pv.status === "Approved" ? "#f59e0b" : "#475569"}`, borderRadius: 6, boxShadow: pv && pv.status === "Approved" ? "0 2px 6px rgba(251,191,36,.4)" : "none" }}
                title={pv ? (pv.status === "Approved" ? "UTR / Reference No — post-payment entry" : "UTR available after voucher is Approved") : "Generate voucher first"}
              >
                <label style={{ fontSize: 10.5, color: pv && pv.status === "Approved" ? "#78350f" : "#fbbf24", fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase" }}>UTR</label>
                <input
                  data-testid="pv-utr-bottom"
                  value={pv?.utrNo || ""}
                  onChange={(e) => pv && setPv({ ...pv, utrNo: e.target.value.toUpperCase().slice(0, 32) })}
                  onBlur={() => { if (pv && pv.status === "Approved" && pv.utrNo) { handleSave(); } }}
                  disabled={!pv || pv.status !== "Approved"}
                  placeholder={pv && pv.status === "Approved" ? "Enter UTR / Ref No" : "Approve first"}
                  style={{ width: 150, padding: "5px 8px", fontSize: 11.5, fontFamily: "monospace", letterSpacing: ".3px", background: pv && pv.status === "Approved" ? "#fffbeb" : "#1e293b", color: pv && pv.status === "Approved" ? "#0f172a" : "#94a3b8", border: `1px solid ${pv && pv.status === "Approved" ? "#f59e0b" : "#475569"}`, borderRadius: 4, fontWeight: pv?.utrNo ? 800 : 500 }}
                />
                <button
                  data-testid="pv-mark-paid"
                  onClick={() => {
                    if (!pv) { toast.error("Generate voucher first"); return; }
                    if (pv.status !== "Approved") { toast.error("Pehle voucher Approve karein, phir UTR fill karke Paid karein"); return; }
                    const utr = (pv.utrNo || "").trim();
                    if (!utr) { toast.error("UTR / Ref No enter karein"); return; }
                    const next = { ...pv, utrNo: utr.toUpperCase().slice(0, 32), paidAt: new Date().toISOString() };
                    setPv(next);
                    const list = getPayments().map((x) => x.pvNo === next.pvNo ? next : x);
                    savePayments(list);
                    setRefresh((v) => v + 1);
                    toast.success(`✓ Paid · UTR ${next.utrNo} saved for ${next.pvNo}`);
                  }}
                  disabled={!pv || pv.status !== "Approved" || !(pv?.utrNo || "").trim()}
                  title={!pv ? "Generate voucher first" : pv.status !== "Approved" ? "Approve voucher first" : !(pv?.utrNo || "").trim() ? "Enter UTR first" : "Save UTR and mark voucher as Paid"}
                  style={{ padding: "6px 12px", background: pv && pv.status === "Approved" && (pv?.utrNo || "").trim() ? "linear-gradient(135deg,#16a34a,#14532d)" : "#475569", color: "#fff", border: "none", borderRadius: 4, cursor: pv && pv.status === "Approved" && (pv?.utrNo || "").trim() ? "pointer" : "not-allowed", fontWeight: 900, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", boxShadow: pv && pv.status === "Approved" && (pv?.utrNo || "").trim() ? "0 2px 6px rgba(22,163,74,.5)" : "none" }}
                >✓ Paid</button>
              </div>

              {/* 8. Status · Dynamic pill */}
              <div
                data-testid="pv-status-badge"
                style={{
                  padding: "7px 16px",
                  background: !pv ? "#334155" : pv.utrNo && pv.status === "Approved" ? "linear-gradient(135deg,#10b981,#059669)" : pv.status === "Approved" ? "linear-gradient(135deg,#22c55e,#15803d)" : pv.status === "Submitted" ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "linear-gradient(135deg,#f59e0b,#d97706)",
                  color: "#fff",
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  border: "1.5px solid rgba(255,255,255,.25)",
                  marginLeft: "auto",
                  boxShadow: pv ? "0 2px 6px rgba(0,0,0,.3)" : "none",
                }}
                title="Current voucher status"
              >
                {pv ? (pv.utrNo && pv.status === "Approved" ? "✓ Paid" : pv.status) : "No Voucher"}
              </div>

              {/* New (reset) · Slate */}
              {pv && (
                <button data-testid="pv-new" onClick={handleNew} style={{ padding: "9px 16px", background: "linear-gradient(135deg,#64748b,#475569)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.4, boxShadow: "0 2px 6px rgba(100,116,139,.4)", textTransform: "uppercase" }} title="Clear and start a new voucher">🆕 New</button>
              )}
            </div>
          </div>
          </>
          )}

        </div>
      </div>
    {advDetail && (() => {
      const { r, filter } = advDetail;
      const lines = (r.lines || []).filter((l) => {
        if (filter === "settled") return l.source === "PayBill" && Number(l.step) === 4;
        if (filter === "autoAdj") return l.source === "On-Demand" && Number(l.step) >= 3;
        if (filter === "inPB") return l.source === "PayBill" && Number(l.step) < 4;
        return true;
      });
      const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
      const title = filter === "settled" ? "✓ Settled Advances" : filter === "autoAdj" ? "⚡ Auto-Adjusted Advance Requests" : filter === "inPB" ? "⏳ In Pay Bill (Pending Settlement)" : "All Advance Entries";
      const tone = filter === "settled" ? ["#dcfce7", "#166534", "#86efac"] : filter === "autoAdj" ? ["#dbeafe", "#1e3a8a", "#93c5fd"] : ["#fef3c7", "#78350f", "#fcd34d"];
      return (
        <div onClick={() => setAdvDetail(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ padding: "12px 18px", background: tone[0], color: tone[1], borderRadius: "10px 10px 0 0", borderBottom: `2px solid ${tone[2]}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.9 }}>Advance Detail · {r.empCode} · {r.name}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{title} · {lines.length} entry{lines.length !== 1 ? "ies" : ""} · ₹ {total.toLocaleString("en-IN")}</div>
              </div>
              <button data-testid="adv-detail-close" onClick={() => setAdvDetail(null)} style={{ background: "rgba(0,0,0,.08)", color: tone[1], border: "none", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Close</button>
            </div>
            <div style={{ padding: 18 }}>
              {lines.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No entries matching this filter.</div>
              ) : (
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead><tr>
                    <th>Source</th>
                    <th>Ref No</th>
                    <th>Month</th>
                    <th style={{ textAlign: "right" }}>Amount (₹)</th>
                    <th>Stage</th>
                  </tr></thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.source === "On-Demand" ? <span style={{ padding: "2px 6px", background: "#dbeafe", color: "#1e3a8a", borderRadius: 3, fontWeight: 700, fontSize: 10 }}>⚡ On-Demand</span> : <span style={{ padding: "2px 6px", background: "#fef3c7", color: "#78350f", borderRadius: 3, fontWeight: 700, fontSize: 10 }}>📋 Pay Bill</span>}</td>
                        <td className="mono"><b>{l.refNo}</b></td>
                        <td>{new Date(l.year, (l.month || 1) - 1).toLocaleString("en-IN", { month: "long" })} {l.year}</td>
                        <td className="num" style={{ fontWeight: 800, color: "#78350f" }}>{Number(l.amount || 0).toLocaleString("en-IN")}</td>
                        <td>
                          {l.source === "On-Demand"
                            ? <span style={{ padding: "2px 6px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>✓ Accounts Approved · Auto-adjusted</span>
                            : Number(l.step) === 4
                              ? <span style={{ padding: "2px 6px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>✓ Pay Bill Settled</span>
                              : Number(l.step) === 3
                                ? <span style={{ padding: "2px 6px", background: "#fde68a", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⏳ GM Approved · Awaiting Settlement</span>
                                : Number(l.step) === 2
                                  ? <span style={{ padding: "2px 6px", background: "#fed7aa", color: "#9a3412", border: "1px solid #fdba74", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>⏳ Submitted to GM</span>
                                  : <span style={{ padding: "2px 6px", background: "#e2e8f0", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>📝 Draft</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      );
    })()}
    {viewBill && (() => {
      const b = viewBill;
      const c = computeBill(b);
      const paid = payments.filter((p) => p.billId === b.id && p.status === "Approved").reduce((s, p) => s + Number(p.amount || 0), 0);
      const balance = +(c.netPayable - paid).toFixed(2);
      const v = b.vendorSnapshot || vendors.find((x) => x.vendorCode === b.vendorCode) || {};
      return (
        <div onClick={() => setViewBill(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "min(820px, 100%)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ padding: "12px 18px", background: "linear-gradient(135deg,#0369a1,#1e3a8a)", color: "#fff", borderRadius: "10px 10px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.9 }}>Bill Preview</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{b.permanentBillNo || b.refNo} · {v.firmName || b.vendorCode}</div>
              </div>
              <button data-testid="view-bill-close" onClick={() => setViewBill(null)} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Close</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>Bill No</div><div style={{ fontWeight: 700 }}>{b.billNo || "—"}</div></div>
                <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>Bill Date</div><div style={{ fontWeight: 700 }}>{b.billDate || "—"}</div></div>
                <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>Due Date</div><div style={{ fontWeight: 700 }}>{b.dueDate || "—"}</div></div>
                <div style={{ padding: 8, background: "#eef2ff", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#3730a3", letterSpacing: 1, textTransform: "uppercase" }}>Basic</div><div style={{ fontWeight: 800, color: "#3730a3" }}>₹ {inr(c.basic)}</div></div>
                <div style={{ padding: 8, background: "#fef3c7", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#78350f", letterSpacing: 1, textTransform: "uppercase" }}>GST</div><div style={{ fontWeight: 800, color: "#78350f" }}>₹ {inr(c.gst)}</div></div>
                <div style={{ padding: 8, background: "#fee2e2", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#991b1b", letterSpacing: 1, textTransform: "uppercase" }}>TDS</div><div style={{ fontWeight: 800, color: "#991b1b" }}>− ₹ {inr(c.tds)}</div></div>
                <div style={{ padding: 8, background: "#dcfce7", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#166534", letterSpacing: 1, textTransform: "uppercase" }}>Net Payable</div><div style={{ fontWeight: 900, color: "#166534", fontSize: 15 }}>₹ {inr(c.netPayable)}</div></div>
                <div style={{ padding: 8, background: "#f0fdf4", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: "#166534", letterSpacing: 1, textTransform: "uppercase" }}>Paid</div><div style={{ fontWeight: 800, color: "#166534" }}>₹ {inr(paid)}</div></div>
                <div style={{ padding: 8, background: balance > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: 4 }}><div style={{ fontSize: 9, fontWeight: 800, color: balance > 0 ? "#991b1b" : "#166534", letterSpacing: 1, textTransform: "uppercase" }}>Balance</div><div style={{ fontWeight: 900, color: balance > 0 ? "#991b1b" : "#166534", fontSize: 15 }}>₹ {inr(balance)}</div></div>
              </div>
              <div style={{ padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, lineHeight: 1.6 }}>
                <b style={{ color: "#334155" }}>Vendor:</b> {v.firmName || "—"} · <b>{b.vendorCode}</b><br />
                <b style={{ color: "#334155" }}>GSTIN:</b> {v.gstin || "—"} · <b style={{ color: "#334155" }}>PAN:</b> {v.pan || "—"}<br />
                <b style={{ color: "#334155" }}>Bank:</b> {v.bankName || "—"} · A/C <span style={{ fontFamily: "monospace" }}>{v.bankAccount || "—"}</span> · IFSC <span style={{ fontFamily: "monospace" }}>{v.ifsc || "—"}</span>
              </div>
              {b.workOrderFile && (
                <div style={{ marginTop: 10 }}>
                  <a href={b.workOrderFile.dataUrl} target="_blank" rel="noreferrer" data-testid="view-bill-wo" style={{ padding: "6px 14px", background: "#1e40af", color: "#fff", borderRadius: 5, fontSize: 11, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>📎 Open Work Order Copy</a>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
