import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import TopActionBar from "../components/TopActionBar";
import VendorQueryModal from "../components/VendorQueryModal";
import {
  getBills, getVendors, computeBill, getPayments, savePayments, nextPvNo,
  currentUser, exportJSON, amountToWords,
} from "../lib/store";

const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const F = ({ label, children }) => (
  <div className="field-b"><label>{label}</label>{children}</div>
);

export default function Reports() {
  const nav = useNavigate();
  const [selectedBillId, setSelectedBillId] = useState("");
  const [pv, setPv] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState("");
  const [queryOpen, setQueryOpen] = useState(false);
  const [queryCode, setQueryCode] = useState("");
  const [selectedPvs, setSelectedPvs] = useState(() => new Set());

  const bills = useMemo(() => getBills(), [refresh]);
  const vendors = useMemo(() => getVendors(), [refresh]);
  const payments = useMemo(() => getPayments(), [refresh]);

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
    const list = getPayments().filter((x) => x.pvNo !== pvNo);
    savePayments(list);
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
    if (p) { setPv(p); setSelectedBillId(p.billId || ""); toast.info(`Loaded ${pvNo}`); }
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
    const next = {
      ...pv, status: "Approved",
      approvedByName: pv.approvedByName || currentUser(),
      approvalDate: new Date().toISOString().slice(0, 10),
    };
    setPv(next);
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === next.pvNo);
    if (idx >= 0) list[idx] = next; else list.push(next);
    savePayments(list); setRefresh((n) => n + 1);
    toast.success("Voucher approved");
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
      toast.error(`Voucher already exists for this bill (${existing.pvNo}). Cannot create duplicate.`);
      // Load the existing voucher so user can view/edit it
      setPv(existing);
      return;
    }
    const c = computeBill(b);
    const paid = payments.filter((p) => p.billId === b.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = +(c.netPayable - paid).toFixed(2);
    setPv({
      pvNo: nextPvNo(),
      date: new Date().toISOString().slice(0, 10),
      billId: b.id, billRefNo: b.permanentBillNo || b.refNo, billNo: b.billNo,
      vendorCode: b.vendorCode, vendorName: b.vendorSnapshot?.firmName || "",
      accountName: b.vendorSnapshot?.accountHolder || "",
      accountNumber: b.vendorSnapshot?.accountNumber || "",
      ifscCode: b.vendorSnapshot?.ifscCode || "",
      bankName: b.vendorSnapshot?.bankName || "",
      basic: c.basic, gst: c.gst, tds: c.tds, net: c.netPayable,
      amount: balance, mode: "NEFT", remarks: "",
      utrNo: "",
      status: "Draft",
      createdByName: currentUser(),
      preparedByName: "", checkedByName: "", approvedByName: "", approvalDate: "",
    });
    toast.success("Voucher generated");
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
      "PV No": p.pvNo, Date: p.date, "Bill Ref": p.billRefNo, "Bill No": p.billNo,
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

  // ---- Approved Voucher export (selected or all) ----
  const approvedPayments = useMemo(
    () => payments.filter((p) => p.status === "Approved"),
    [payments]
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
        "PV No": p.pvNo,
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
          <Header formTitle="PAYABLES · DUE LIST &amp; SUMMARY (FINAL PROCESSING)" />

          <div className="section">
            <div className="sec-head">A. Summary Dashboard</div>
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
            </div>
          </div>

          <div className="section">
            <div className="sec-head">B. Due List (Approved Bills)</div>
            <div className="sec-body">
              <table className="data-table" data-testid="due-table">
                <thead><tr>
                  <th>Ref No</th><th>Vendor</th><th>Bill No</th><th>Bill Dt</th><th>Due Dt</th>
                  <th style={{ textAlign: "right" }}>Net</th>
                  <th style={{ textAlign: "right" }}>Paid</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th>UTR / Ref</th>
                  <th>WO Copy</th>
                  <th>Status</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} style={{ textAlign: "center", color: "#64748b", padding: 14 }}>No approved bills</td></tr>
                  )}
                  {filtered.map((r) => {
                    const billObj = bills.find((b) => b.id === r.id);
                    const pvForBill = payments.find((p) => p.billId === r.id);
                    return (
                    <tr key={r.id} data-testid={`due-row-${r.refNo}`}>
                      <td className="mono">{r.refNo}</td>
                      <td>{r.vendorName}<br /><span style={{ fontSize: 10, color: "#64748b" }} className="mono">{r.vendorCode}</span></td>
                      <td>{r.billNo}</td>
                      <td>{r.billDate}</td>
                      <td>{r.dueDate}</td>
                      <td className="num">{r.net.toFixed(2)}</td>
                      <td className="num">{r.paid.toFixed(2)}</td>
                      <td className="num"><b>{r.balance.toFixed(2)}</b></td>
                      <td style={{ fontFamily: "monospace", fontSize: 10.5 }} data-testid={`due-utr-${r.refNo}`}>
                        {pvForBill?.utrNo ? (
                          <span style={{ padding: "2px 6px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 4, fontWeight: 700 }}>{pvForBill.utrNo}</span>
                        ) : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {billObj?.workOrderFile ? (
                          <a href={billObj.workOrderFile.dataUrl} target="_blank" rel="noreferrer"
                            data-testid={`due-wo-file-${r.refNo}`}
                            title={billObj.workOrderFile.name}
                            style={{ padding: "2px 8px", background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, fontWeight: 600, fontSize: 10.5, textDecoration: "none" }}>
                            📎 View
                          </a>
                        ) : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td>
                        <span className={`pill-tag ${r.status === "Overdue" ? "overdue" : r.status === "Paid" ? "paid" : "due"}`}>{r.status}</span>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
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
                      <th>PV No</th>
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
                    {payments.map((p) => (
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
                            <button
                              onClick={() => deletePayment(p.pvNo)}
                              data-testid={`pay-delete-${p.pvNo}`}
                              style={{ padding: "3px 8px", fontSize: 10.5, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                              title="Delete voucher and free the bill"
                            >
                              Delete
                            </button>
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
                      return (
                        <option key={b.id} value={b.id} disabled={!!exists}>
                          {b.permanentBillNo || b.refNo} · {b.vendorSnapshot?.firmName || b.vendorCode} · ₹{computeBill(b).netPayable}
                          {exists ? `  ✓ Voucher: ${exists.pvNo}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </F>
                <div className="field-b" style={{ justifyContent: "end" }}>
                  <label>&nbsp;</label>
                  <button className="btn-color btn-nav" data-testid="pv-generate" onClick={generateVoucher}>Generate Voucher</button>
                </div>
                <F label="Voucher Status">
                  <input className="pill-status" value={pv?.status || "—"} readOnly data-testid="pv-status" />
                </F>
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
                    <option value="__ALL__">All Approved Vouchers ({approvedPayments.length})</option>
                    {selectedPvs.size > 1 && (
                      <option value="__MULTI__">Multiple Selected ({selectedPvs.size}) · via row checkboxes</option>
                    )}
                    {approvedPayments.map((p) => (
                      <option key={p.pvNo} value={p.pvNo}>
                        {p.pvNo} · {p.vendorName || p.vendorCode} · ₹{Number(p.amount || 0).toFixed(2)}
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
                    <F label="PV Number"><input className="pill-generated" value={pv.pvNo} readOnly data-testid="pv-no" /></F>
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
                    <F label="IFSC"><input value={pv.ifscCode} readOnly /></F>
                    <F label="Account Holder"><input value={pv.accountName} readOnly /></F>
                    <F label="Account Number"><input value={pv.accountNumber} readOnly /></F>
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
                        <tr><td>Bill Basic</td><td className="num">{pv.basic.toFixed(2)}</td></tr>
                        <tr><td>GST</td><td className="num">{pv.gst.toFixed(2)}</td></tr>
                        <tr><td>TDS Deducted</td><td className="num">{pv.tds.toFixed(2)}</td></tr>
                        <tr><td>Bill Net</td><td className="num">{pv.net.toFixed(2)}</td></tr>
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

              <div className="signs">
                <div className="sig"><div className="title">Prepared By</div><div className="role">(Purchase Dept.)</div></div>
                <div className="sig"><div className="title">Checked By</div><div className="role">(Audit &amp; Verification)</div></div>
                <div className="sig"><div className="title">Approved By</div><div className="role">(Account Manager / Partner)</div></div>
              </div>
            </>
          )}

          {/* Vouchers Data Sheet — bottom of page, all payment vouchers */}
          {payments.length > 0 && (
            <div className="section" data-testid="vouchers-data-sheet" style={{ marginTop: 14 }}>
              <div className="sec-head">Payment Vouchers Data Sheet · Click to Load</div>
              <div className="sec-body">
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>PV No</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Vendor</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Bill No</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Date</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #cbd5e1" }}>Amount (₹)</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Mode</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Status</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const isApp = p.status === "Approved";
                      return (
                        <tr key={p.pvNo} data-testid={`voucher-row-${p.pvNo}`}
                          style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, color: isApp ? "#166534" : "#92400e" }}>
                            {isApp ? `✓ ${p.pvNo}` : `⏳ ${p.pvNo}`}
                            {p.revision > 0 && <span style={{ marginLeft: 6, padding: "1px 6px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>R{p.revision}</span>}
                          </td>
                          <td style={{ padding: "5px 8px" }}>{p.vendorName || p.vendorCode}</td>
                          <td style={{ padding: "5px 8px" }}>{p.billNo || "—"}</td>
                          <td style={{ padding: "5px 8px" }}>{p.date || "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>{Number(p.amount || 0).toFixed(2)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>{p.mode || "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: isApp ? "#dcfce7" : "#fef3c7", color: isApp ? "#166534" : "#92400e", border: `1px solid ${isApp ? "#86efac" : "#fcd34d"}` }}>
                              {p.status || "Draft"}
                            </span>
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <button
                              onClick={() => loadVoucher(p.pvNo)}
                              data-testid={`voucher-load-${p.pvNo}`}
                              style={{ padding: "3px 10px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                            >
                              Load
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
