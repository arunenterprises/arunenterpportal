import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import TopActionBar from "../components/TopActionBar";
import VendorQueryModal from "../components/VendorQueryModal";
import {
  getBills, getVendors, computeBill, getPayments, savePayments, nextPvNo,
  currentUser, exportJSON,
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

  const bills = useMemo(() => getBills(), [refresh]);
  const vendors = useMemo(() => getVendors(), [refresh]);
  const payments = useMemo(() => getPayments(), [refresh]);

  const approvedBills = bills.filter((b) => b.step === 5);
  const today = new Date().toISOString().slice(0, 10);

  const dueRows = approvedBills.map((b) => {
    const c = computeBill(b);
    const paid = payments.filter((p) => p.billId === b.id).reduce((s, p) => s + Number(p.amount || 0), 0);
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
      Amount: p.amount, Mode: p.mode, Bank: p.bankName, IFSC: p.ifscCode,
      "Account No": p.accountNumber, Status: p.status,
    }))), "Payment Vouchers");
    XLSX.writeFile(wb, `vendor_reports_${today}.xlsx`);
    toast.success("Excel exported");
  };

  const handleExportJSON = () => exportJSON({ dueRows, summary, payments, generatedAt: new Date().toISOString() }, `vendor_reports_${today}.json`);
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
        <VendorQueryModal open={queryOpen} onClose={() => setQueryOpen(false)} initialCode={queryCode} />

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
                  <th>Status</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: 14 }}>No approved bills</td></tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id} data-testid={`due-row-${r.refNo}`}>
                      <td className="mono">{r.refNo}</td>
                      <td>{r.vendorName}<br /><span style={{ fontSize: 10, color: "#64748b" }} className="mono">{r.vendorCode}</span></td>
                      <td>{r.billNo}</td>
                      <td>{r.billDate}</td>
                      <td>{r.dueDate}</td>
                      <td className="num">{r.net.toFixed(2)}</td>
                      <td className="num">{r.paid.toFixed(2)}</td>
                      <td className="num"><b>{r.balance.toFixed(2)}</b></td>
                      <td>
                        <span className={`pill-tag ${r.status === "Overdue" ? "overdue" : r.status === "Paid" ? "paid" : "due"}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="section">
            <div className="sec-head">D. Generate Payment Voucher</div>
            <div className="sec-body">
              <div className="row cols-3">
                <F label="Approved Bill">
                  <select data-testid="pv-bill-select" value={selectedBillId} onChange={(e) => setSelectedBillId(e.target.value)}>
                    <option value="">Select approved bill</option>
                    {approvedBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.permanentBillNo || b.refNo} · {b.vendorSnapshot?.firmName || b.vendorCode} · ₹{computeBill(b).netPayable}
                      </option>
                    ))}
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
                    <F label="Bill Ref"><input value={pv.billRefNo} readOnly /></F>
                    <F label="Bill No"><input value={pv.billNo} readOnly /></F>
                    <F label="Vendor Code"><input value={pv.vendorCode} readOnly /></F>
                    <F label="Vendor Name"><input value={pv.vendorName} readOnly /></F>
                    <F label="Bank"><input value={pv.bankName} readOnly /></F>
                    <F label="IFSC"><input value={pv.ifscCode} readOnly /></F>
                    <F label="Account Holder"><input value={pv.accountName} readOnly /></F>
                    <F label="Account Number"><input value={pv.accountNumber} readOnly /></F>
                    <F label="Amount (₹)">
                      <input type="number" step="0.01" min="0" value={pv.amount}
                        onChange={(e) => setPv({ ...pv, amount: e.target.value })} data-testid="pv-amount" />
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
        </div>
      </div>
    </>
  );
}
