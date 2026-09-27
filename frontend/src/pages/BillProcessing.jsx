import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import Workflow from "../components/Workflow";
import ActionBar from "../components/ActionBar";
import TopNav from "../components/TopNav";
import {
  createBillDraft, computeBill, upsertBill, findVendorByCode, approveBill,
  currentUser, exportJSON,
} from "../lib/store";

const GST_SLABS = [0, 5, 12, 18, 28];
const TDS_RATES = [
  { r: 0, l: "0% (None)" },
  { r: 1, l: "1% (Sec 194C - Ind/HUF)" },
  { r: 2, l: "2% (Sec 194C - Others)" },
  { r: 5, l: "5% (Sec 194J - Prof)" },
  { r: 10, l: "10% (Sec 194J - Tech)" },
];

const Field = ({ label, children, test }) => (
  <div className="field">
    <label>{label}</label>
    <div className="ctl" data-testid={test}>{children}</div>
  </div>
);

export default function BillProcessing() {
  const [bill, setBill] = useState(() => createBillDraft());
  const [locked, setLocked] = useState(false);
  const [vendorInput, setVendorInput] = useState("");

  useEffect(() => {
    setBill((b) => ({ ...b, createdBy: b.createdBy || currentUser() }));
  }, []);

  const bind = (k) => ({
    value: bill[k] ?? "",
    onChange: (e) => setBill({ ...bill, [k]: e.target.value }),
    readOnly: locked,
    "data-testid": `field-${k}`,
  });

  const vendor = bill.vendorSnapshot;
  const comp = useMemo(() => computeBill(bill), [bill]);

  // Auto due date if empty when bill date changes
  useEffect(() => {
    if (bill.billDate && !bill.dueDate) {
      const d = new Date(bill.billDate);
      d.setDate(d.getDate() + 30);
      setBill((b) => ({ ...b, dueDate: d.toISOString().slice(0, 10) }));
    }
  }, [bill.billDate, bill.dueDate]);

  const loadVendor = () => {
    const v = findVendorByCode(vendorInput.trim());
    if (!v) { toast.error("Vendor not found"); return; }
    if (v.status !== "Approved") { toast.error("Vendor is not approved yet"); return; }
    setBill({ ...bill, vendorCode: v.vendorCode, vendorSnapshot: v });
    toast.success(`Loaded ${v.vendorName}`);
  };

  const handleNew = () => {
    setBill({ ...createBillDraft(), createdBy: currentUser() });
    setLocked(false);
    setVendorInput("");
    toast.success("New bill draft created");
  };

  const validate = () => {
    if (!bill.vendorSnapshot) { toast.error("Load an approved vendor first"); return false; }
    if (!bill.billNo.trim()) { toast.error("Bill No is required"); return false; }
    if (!bill.billDate) { toast.error("Bill Date is required"); return false; }
    if (!(Number(bill.basicAmount) > 0)) { toast.error("Basic amount must be > 0"); return false; }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const s = upsertBill({ ...bill });
    setBill(s);
    toast.success(`Saved (${s.refNo})`);
  };

  const handleEdit = () => {
    if (bill.status === "Approved") { toast.error("Approved bill cannot be edited"); return; }
    setLocked(false);
    toast.info("You can edit the form now");
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const s = upsertBill({ ...bill, status: "Submitted", preparedBy: bill.preparedBy || currentUser() });
    setBill(s);
    toast.success("Submitted for approval");
  };

  const handleApprove = () => {
    if (bill.status === "Approved") { toast.info("Already approved"); return; }
    if (!validate()) return;
    const s = approveBill({
      ...bill,
      status: "Submitted",
      checkedBy: bill.checkedBy || currentUser(),
      approvedBy: bill.approvedBy || currentUser(),
    });
    setBill(s);
    setLocked(true);
    toast.success(`Approved · Net Payable ₹${comp.netPayable}`);
  };

  const handleExportJSON = () => exportJSON({ ...bill, computed: comp }, `bill_${bill.refNo.replace(/\//g, "_")}.json`);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Ref No", bill.refNo],
      ["Bill No", bill.billNo],
      ["Bill Date", bill.billDate],
      ["Vendor Code", bill.vendorCode],
      ["Vendor Name", vendor?.vendorName || ""],
      ["Description", bill.description],
      ["Basic Amount", comp.basic],
      [`GST @ ${bill.gstSlab}%`, comp.gst],
      ["Gross", comp.gross],
      [`TDS @ ${bill.tdsRate}%`, comp.tds],
      ["Net Payable", comp.netPayable],
      ["Due Date", bill.dueDate],
      ["Status", bill.status],
    ];
    const ws = XLSX.utils.aoa_to_sheet([["Field", "Value"], ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Bill");
    XLSX.writeFile(wb, `bill_${bill.refNo.replace(/\//g, "_")}.xlsx`);
  };

  const handlePrint = () => window.print();

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopNav />
        <div className="a4" data-testid="bill-page">
          <Header
            docTitle="Vendor Bill Processing"
            docNo={bill.refNo}
            pageLabel="PAGE 2 / 3"
            status={bill.status}
          />
          {bill.status === "Approved" && <div className="stamp approved">APPROVED</div>}
          {bill.status === "Submitted" && <div className="stamp submitted">SUBMITTED</div>}
          {bill.status === "Draft" && <div className="stamp draft">DRAFT</div>}

          <Workflow data={bill} />

          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", fontSize: 11 }}>
            <label style={{ color: "#55617a", letterSpacing: 1 }}>VENDOR CODE</label>
            <input
              className="mono"
              data-testid="bill-vendor-input"
              value={vendorInput}
              onChange={(e) => setVendorInput(e.target.value)}
              placeholder="e.g. AE0001JV2526"
              style={{ flex: 1, border: "1px solid #d7dbe3", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
            />
            <button className="btn ghost" data-testid="bill-load-vendor" onClick={loadVendor}>Autofill</button>
          </div>

          <div className="section-title">A. Vendor Snapshot</div>
          <div className="field-grid cols-3">
            <Field label="Vendor Code" test="v-code">
              <input value={bill.vendorCode || ""} readOnly />
            </Field>
            <Field label="Vendor Name" test="v-name">
              <input value={vendor?.vendorName || ""} readOnly />
            </Field>
            <Field label="PAN" test="v-pan">
              <input value={vendor?.panNo || ""} readOnly />
            </Field>
            <Field label="GST No" test="v-gst">
              <input value={vendor?.gstNo || ""} readOnly />
            </Field>
            <Field label="Business Type" test="v-btype">
              <input value={vendor?.businessType || ""} readOnly />
            </Field>
            <Field label="Phone" test="v-phone">
              <input value={vendor?.phoneNo || ""} readOnly />
            </Field>
            <Field label="Bank" test="v-bank">
              <input value={vendor?.bankName || ""} readOnly />
            </Field>
            <Field label="IFSC" test="v-ifsc">
              <input value={vendor?.ifscCode || ""} readOnly />
            </Field>
            <Field label="Account No" test="v-acct">
              <input value={vendor?.accountNumber || ""} readOnly />
            </Field>
          </div>

          <div className="section-title">B. Bill Details</div>
          <div className="field-grid cols-3">
            <Field label="Bill No" test="cell-billNo"><input {...bind("billNo")} /></Field>
            <Field label="Bill Date" test="cell-billDate"><input type="date" {...bind("billDate")} /></Field>
            <Field label="Due Date" test="cell-dueDate"><input type="date" {...bind("dueDate")} /></Field>
          </div>
          <div className="field-grid cols-1">
            <Field label="Description of Goods / Services" test="cell-description">
              <textarea rows={2} {...bind("description")} />
            </Field>
          </div>

          <div className="section-title">C. Amounts, GST & TDS</div>
          <div className="field-grid cols-3">
            <Field label="Basic Amount (₹)" test="cell-basicAmount">
              <input type="number" step="0.01" min="0" {...bind("basicAmount")} />
            </Field>
            <Field label="GST Slab" test="cell-gstSlab">
              <select {...bind("gstSlab")}>
                {GST_SLABS.map((s) => <option key={s} value={s}>{s}%</option>)}
              </select>
            </Field>
            <Field label="TDS Rate" test="cell-tdsRate">
              <select {...bind("tdsRate")}>
                {TDS_RATES.map((t) => <option key={t.r} value={t.r}>{t.l}</option>)}
              </select>
            </Field>
          </div>

          <div className="compute" data-testid="bill-compute">
            <table>
              <thead>
                <tr><th>Particulars</th><th style={{ textAlign: "right" }}>Amount (₹)</th></tr>
              </thead>
              <tbody>
                <tr><td>Basic Amount</td><td className="num" data-testid="calc-basic">{comp.basic.toFixed(2)}</td></tr>
                <tr><td>GST @ {bill.gstSlab}%</td><td className="num" data-testid="calc-gst">{comp.gst.toFixed(2)}</td></tr>
                <tr><td><b>Gross (Basic + GST)</b></td><td className="num" data-testid="calc-gross"><b>{comp.gross.toFixed(2)}</b></td></tr>
                <tr><td>Less: TDS @ {bill.tdsRate}% on Basic</td><td className="num" data-testid="calc-tds">{comp.tds.toFixed(2)}</td></tr>
                <tr className="total"><td>Net Payable</td><td className="num" data-testid="calc-net">{comp.netPayable.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="section-title">D. Approval Workflow</div>
          <div className="field-grid cols-3">
            <Field label="Created By" test="cell-createdBy"><input {...bind("createdBy")} /></Field>
            <Field label="Checked By" test="cell-checkedBy"><input {...bind("checkedBy")} /></Field>
            <Field label="Prepared By" test="cell-preparedBy"><input {...bind("preparedBy")} /></Field>
            <Field label="Approved By" test="cell-approvedBy"><input {...bind("approvedBy")} /></Field>
            <Field label="Approval Date" test="cell-approvalDate"><input value={bill.approvalDate || ""} readOnly /></Field>
            <Field label="Status" test="cell-status"><input value={bill.status} readOnly /></Field>
          </div>

          <div className="sign-row">
            <div className="sig">Prepared By</div>
            <div className="sig">Checked By</div>
            <div className="sig">Approved By</div>
            <div className="sig">Received By</div>
          </div>
        </div>

        <ActionBar
          onNew={handleNew}
          onSave={handleSave}
          onEdit={handleEdit}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onExportJSON={handleExportJSON}
          onExportExcel={handleExportExcel}
          onPrint={handlePrint}
          disabled={{ approve: bill.status === "Approved" }}
        />
      </div>
    </>
  );
}
