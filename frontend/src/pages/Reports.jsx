import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import ActionBar from "../components/ActionBar";
import TopNav from "../components/TopNav";
import {
  getBills, getVendors, computeBill, getPayments, savePayments, nextPvNo,
  currentUser, exportJSON,
} from "../lib/store";

const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const daysDiff = (from, to) => Math.floor((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24));

export default function Reports() {
  const [selectedBillId, setSelectedBillId] = useState("");
  const [pv, setPv] = useState(null); // in-memory voucher preview
  const [refresh, setRefresh] = useState(0);

  const bills = useMemo(() => getBills(), [refresh]);
  const vendors = useMemo(() => getVendors(), [refresh]);
  const payments = useMemo(() => getPayments(), [refresh]);

  const approvedBills = bills.filter((b) => b.status === "Approved");
  const today = new Date().toISOString().slice(0, 10);

  const dueRows = approvedBills.map((b) => {
    const c = computeBill(b);
    const paid = payments
      .filter((p) => p.billId === b.id)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = +(c.netPayable - paid).toFixed(2);
    const isOverdue = b.dueDate && b.dueDate < today && balance > 0;
    const daysToDue = b.dueDate ? daysDiff(today, b.dueDate) : "";
    return {
      id: b.id,
      refNo: b.refNo,
      vendorCode: b.vendorCode,
      vendorName: b.vendorSnapshot?.vendorName || "",
      billNo: b.billNo,
      billDate: b.billDate,
      dueDate: b.dueDate,
      basic: c.basic,
      gst: c.gst,
      tds: c.tds,
      net: c.netPayable,
      paid,
      balance,
      daysToDue,
      status: balance <= 0 ? "Paid" : (isOverdue ? "Overdue" : "Due"),
    };
  });

  const summary = {
    approvedBillsCount: approvedBills.length,
    totalBasic: dueRows.reduce((s, r) => s + r.basic, 0),
    totalGST: dueRows.reduce((s, r) => s + r.gst, 0),
    totalTDS: dueRows.reduce((s, r) => s + r.tds, 0),
    totalNet: dueRows.reduce((s, r) => s + r.net, 0),
    totalPaid: dueRows.reduce((s, r) => s + r.paid, 0),
    totalOutstanding: dueRows.reduce((s, r) => s + r.balance, 0),
    overdue: dueRows.filter((r) => r.status === "Overdue").length,
  };

  // ---------- Actions ----------
  const handleNew = () => {
    setSelectedBillId("");
    setPv(null);
    toast.success("New voucher draft");
  };

  const handleSave = () => {
    if (!pv) { toast.error("Generate a voucher first"); return; }
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === pv.pvNo);
    if (idx >= 0) list[idx] = pv; else list.push(pv);
    savePayments(list);
    setRefresh((n) => n + 1);
    toast.success(`Saved ${pv.pvNo}`);
  };

  const handleEdit = () => {
    if (!pv) { toast.error("No voucher to edit"); return; }
    if (pv.status === "Approved") { toast.error("Approved voucher cannot be edited"); return; }
    toast.info("Editable");
  };

  const handleSubmit = () => {
    if (!pv) { toast.error("Generate a voucher first"); return; }
    const next = { ...pv, status: "Submitted", preparedBy: pv.preparedBy || currentUser() };
    setPv(next);
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === next.pvNo);
    if (idx >= 0) list[idx] = next; else list.push(next);
    savePayments(list);
    setRefresh((n) => n + 1);
    toast.success("Voucher submitted");
  };

  const handleApprove = () => {
    if (!pv) { toast.error("Generate a voucher first"); return; }
    const next = {
      ...pv,
      status: "Approved",
      checkedBy: pv.checkedBy || currentUser(),
      approvedBy: pv.approvedBy || currentUser(),
      approvalDate: new Date().toISOString().slice(0, 10),
    };
    setPv(next);
    const list = getPayments();
    const idx = list.findIndex((x) => x.pvNo === next.pvNo);
    if (idx >= 0) list[idx] = next; else list.push(next);
    savePayments(list);
    setRefresh((n) => n + 1);
    toast.success("Voucher approved");
  };

  const generateVoucher = () => {
    const b = approvedBills.find((x) => x.id === selectedBillId);
    if (!b) { toast.error("Select an approved bill"); return; }
    const c = computeBill(b);
    const paid = payments.filter((p) => p.billId === b.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = +(c.netPayable - paid).toFixed(2);
    setPv({
      pvNo: nextPvNo(),
      date: new Date().toISOString().slice(0, 10),
      billId: b.id,
      billRefNo: b.refNo,
      billNo: b.billNo,
      vendorCode: b.vendorCode,
      vendorName: b.vendorSnapshot?.vendorName || "",
      accountName: b.vendorSnapshot?.accountName || "",
      accountNumber: b.vendorSnapshot?.accountNumber || "",
      ifscCode: b.vendorSnapshot?.ifscCode || "",
      bankName: b.vendorSnapshot?.bankName || "",
      basic: c.basic, gst: c.gst, tds: c.tds, net: c.netPayable,
      amount: balance,
      mode: "NEFT",
      remarks: "",
      status: "Draft",
      createdBy: currentUser(),
      checkedBy: "", preparedBy: "", approvedBy: "", approvalDate: "",
    });
    toast.success("Voucher generated");
  };

  const exportDuesExcel = () => {
    const wb = XLSX.utils.book_new();
    // Dues sheet
    const dueSheet = XLSX.utils.json_to_sheet(dueRows.map((r) => ({
      "Ref No": r.refNo, "Vendor Code": r.vendorCode, "Vendor Name": r.vendorName,
      "Bill No": r.billNo, "Bill Date": r.billDate, "Due Date": r.dueDate,
      Basic: r.basic, GST: r.gst, TDS: r.tds, Net: r.net, Paid: r.paid,
      Balance: r.balance, "Days To Due": r.daysToDue, Status: r.status,
    })));
    XLSX.utils.book_append_sheet(wb, dueSheet, "Due List");

    // Summary sheet
    const summaryRows = [
      ["Approved Bills", summary.approvedBillsCount],
      ["Total Basic", summary.totalBasic],
      ["Total GST", summary.totalGST],
      ["Total TDS", summary.totalTDS],
      ["Total Net Payable", summary.totalNet],
      ["Total Paid", summary.totalPaid],
      ["Total Outstanding", summary.totalOutstanding],
      ["Overdue Bills", summary.overdue],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Metric", "Value"], ...summaryRows]), "Summary");

    // Payment vouchers sheet
    const pvSheet = XLSX.utils.json_to_sheet(payments.map((p) => ({
      "PV No": p.pvNo, Date: p.date, "Bill Ref": p.billRefNo, "Bill No": p.billNo,
      "Vendor Code": p.vendorCode, "Vendor Name": p.vendorName,
      Amount: p.amount, Mode: p.mode, Bank: p.bankName, IFSC: p.ifscCode,
      "Account No": p.accountNumber, Status: p.status,
    })));
    XLSX.utils.book_append_sheet(wb, pvSheet, "Payment Vouchers");

    XLSX.writeFile(wb, `vendor_reports_${today}.xlsx`);
    toast.success("Excel exported");
  };

  const handleExportJSON = () => {
    exportJSON({ dueRows, summary, payments, generatedAt: new Date().toISOString() },
      `vendor_reports_${today}.json`);
  };

  const handlePrint = () => window.print();

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopNav />

        {/* ---- Reports Page ---- */}
        <div className="a4" data-testid="reports-page">
          <Header
            docTitle="Payables · Due List, Summary & Payment Voucher"
            docNo={`RPT/${today}`}
            pageLabel="PAGE 3 / 3"
            status="Live"
          />

          <div className="section-title">A. Summary Dashboard</div>
          <div className="field-grid cols-3">
            <div className="field"><label>Approved Bills</label><div className="ctl"><b data-testid="sum-count">{summary.approvedBillsCount}</b></div></div>
            <div className="field"><label>Total Basic</label><div className="ctl"><b data-testid="sum-basic">{inr(summary.totalBasic)}</b></div></div>
            <div className="field"><label>Total GST</label><div className="ctl"><b data-testid="sum-gst">{inr(summary.totalGST)}</b></div></div>
            <div className="field"><label>Total TDS</label><div className="ctl"><b data-testid="sum-tds">{inr(summary.totalTDS)}</b></div></div>
            <div className="field"><label>Net Payable</label><div className="ctl"><b data-testid="sum-net">{inr(summary.totalNet)}</b></div></div>
            <div className="field"><label>Paid</label><div className="ctl"><b data-testid="sum-paid">{inr(summary.totalPaid)}</b></div></div>
            <div className="field"><label>Outstanding</label><div className="ctl" style={{ color: "#b3261e" }}><b data-testid="sum-outstanding">{inr(summary.totalOutstanding)}</b></div></div>
            <div className="field"><label>Overdue Bills</label><div className="ctl"><b data-testid="sum-overdue">{summary.overdue}</b></div></div>
            <div className="field"><label>Vendors</label><div className="ctl"><b data-testid="sum-vendors">{vendors.filter((v) => v.status === "Approved").length}</b></div></div>
          </div>

          <div className="section-title">B. Due List (Approved Bills)</div>
          <table className="data-table" data-testid="due-table">
            <thead>
              <tr>
                <th>Ref No</th><th>Vendor</th><th>Bill No</th><th>Bill Dt</th><th>Due Dt</th>
                <th style={{ textAlign: "right" }}>Net</th>
                <th style={{ textAlign: "right" }}>Paid</th>
                <th style={{ textAlign: "right" }}>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dueRows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "#55617a", padding: 14 }}>No approved bills yet</td></tr>
              )}
              {dueRows.map((r) => (
                <tr key={r.id} data-testid={`due-row-${r.refNo}`}>
                  <td className="mono">{r.refNo}</td>
                  <td>{r.vendorName}<br /><span style={{ fontSize: 10, color: "#55617a" }} className="mono">{r.vendorCode}</span></td>
                  <td>{r.billNo}</td>
                  <td>{r.billDate}</td>
                  <td>{r.dueDate}</td>
                  <td className="num">{r.net.toFixed(2)}</td>
                  <td className="num">{r.paid.toFixed(2)}</td>
                  <td className="num"><b>{r.balance.toFixed(2)}</b></td>
                  <td>
                    <span className={`pill ${r.status === "Overdue" ? "overdue" : r.status === "Paid" ? "approved" : "submitted"}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Payment Voucher Page ---- */}
        <div className="a4" data-testid="voucher-page">
          <Header
            docTitle="Payment Voucher"
            docNo={pv?.pvNo || "—"}
            pageLabel="PAGE 3B"
            status={pv?.status || "—"}
          />
          {pv?.status === "Approved" && <div className="stamp approved">APPROVED</div>}
          {pv?.status === "Submitted" && <div className="stamp submitted">SUBMITTED</div>}
          {pv?.status === "Draft" && <div className="stamp draft">DRAFT</div>}

          <div className="section-title">Generate Payment Voucher</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
            <label style={{ color: "#55617a", letterSpacing: 1 }}>APPROVED BILL</label>
            <select
              data-testid="pv-bill-select"
              value={selectedBillId}
              onChange={(e) => setSelectedBillId(e.target.value)}
              style={{ flex: 1, border: "1px solid #d7dbe3", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
            >
              <option value="">Select approved bill</option>
              {approvedBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.refNo} · {b.vendorSnapshot?.vendorName || b.vendorCode} · ₹{computeBill(b).netPayable}
                </option>
              ))}
            </select>
            <button className="btn" data-testid="pv-generate" onClick={generateVoucher}>Generate</button>
          </div>

          {pv && (
            <>
              <div className="section-title">Voucher Details</div>
              <div className="field-grid cols-3">
                <div className="field"><label>PV No.</label><div className="ctl"><input readOnly value={pv.pvNo} data-testid="pv-no" /></div></div>
                <div className="field"><label>Date</label><div className="ctl"><input type="date" value={pv.date} onChange={(e) => setPv({ ...pv, date: e.target.value })} /></div></div>
                <div className="field"><label>Mode</label><div className="ctl">
                  <select value={pv.mode} onChange={(e) => setPv({ ...pv, mode: e.target.value })} data-testid="pv-mode">
                    {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div></div>
                <div className="field"><label>Bill Ref</label><div className="ctl"><input readOnly value={pv.billRefNo} /></div></div>
                <div className="field"><label>Bill No</label><div className="ctl"><input readOnly value={pv.billNo} /></div></div>
                <div className="field"><label>Vendor Code</label><div className="ctl"><input readOnly value={pv.vendorCode} /></div></div>
                <div className="field"><label>Vendor Name</label><div className="ctl"><input readOnly value={pv.vendorName} /></div></div>
                <div className="field"><label>Bank</label><div className="ctl"><input readOnly value={pv.bankName} /></div></div>
                <div className="field"><label>IFSC</label><div className="ctl"><input readOnly value={pv.ifscCode} /></div></div>
                <div className="field"><label>Account Name</label><div className="ctl"><input readOnly value={pv.accountName} /></div></div>
                <div className="field"><label>Account No</label><div className="ctl"><input readOnly value={pv.accountNumber} /></div></div>
                <div className="field"><label>Amount (₹)</label><div className="ctl">
                  <input type="number" step="0.01" min="0" value={pv.amount} onChange={(e) => setPv({ ...pv, amount: e.target.value })} data-testid="pv-amount" />
                </div></div>
              </div>

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

              <div className="field-grid cols-1" style={{ marginTop: 10 }}>
                <div className="field">
                  <label>Remarks</label>
                  <div className="ctl">
                    <textarea rows={2} value={pv.remarks} onChange={(e) => setPv({ ...pv, remarks: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="field-grid cols-3" style={{ marginTop: 10 }}>
                <div className="field"><label>Created By</label><div className="ctl"><input value={pv.createdBy} onChange={(e) => setPv({ ...pv, createdBy: e.target.value })} /></div></div>
                <div className="field"><label>Checked By</label><div className="ctl"><input value={pv.checkedBy} onChange={(e) => setPv({ ...pv, checkedBy: e.target.value })} /></div></div>
                <div className="field"><label>Approved By</label><div className="ctl"><input value={pv.approvedBy} onChange={(e) => setPv({ ...pv, approvedBy: e.target.value })} /></div></div>
              </div>

              <div className="sign-row">
                <div className="sig">Prepared By</div>
                <div className="sig">Checked By</div>
                <div className="sig">Approved By</div>
                <div className="sig">Receiver Signature</div>
              </div>
            </>
          )}
        </div>

        <ActionBar
          onNew={handleNew}
          onSave={handleSave}
          onEdit={handleEdit}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onExportJSON={handleExportJSON}
          onExportExcel={exportDuesExcel}
          onPrint={handlePrint}
        />
      </div>
    </>
  );
}
