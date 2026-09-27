import React, { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  findVendorByAny, getBillsForVendor, getPaymentsForVendor,
  vendorAccountSummary, computeBill,
} from "../lib/store";

const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VendorQueryModal({ open, onClose, initialCode = "" }) {
  const [q, setQ] = useState(initialCode);
  const [vendor, setVendor] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const runQuery = () => {
    const v = findVendorByAny(q);
    if (!v) { setVendor(null); setNotFound(true); return; }
    setVendor(v); setNotFound(false);
  };

  const summary = useMemo(() =>
    vendor?.vendorCode ? vendorAccountSummary(vendor.vendorCode) : null,
    [vendor]);

  const bills = useMemo(() =>
    vendor?.vendorCode ? getBillsForVendor(vendor.vendorCode) : [],
    [vendor]);
  const payments = useMemo(() =>
    vendor?.vendorCode ? getPaymentsForVendor(vendor.vendorCode) : [],
    [vendor]);

  const exportHistory = () => {
    if (!vendor) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Vendor Code", vendor.vendorCode || "—"],
      ["Firm Name", vendor.firmName || ""],
      ["PAN", vendor.panNo || ""],
      ["GST", vendor.gstNo || ""],
      ["Contact", vendor.contactPerson || ""],
      ["Mobile", vendor.mobileNo || ""],
      ["Email", vendor.email || ""],
      ["Bank", vendor.bankName || ""],
      ["IFSC", vendor.ifscCode || ""],
      ["Account No.", vendor.accountNumber || ""],
      [],
      ["Total Bills Raised", summary?.totalBillsRaised || 0],
      ["Approved Bills", summary?.approvedBillsCount || 0],
      ["Total Billed (₹)", summary?.totalBilled || 0],
      ["Total Paid (₹)", summary?.totalPaid || 0],
      ["Outstanding (₹)", summary?.totalOutstanding || 0],
    ]), "Vendor");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bills.map((b) => {
      const c = computeBill(b);
      return {
        "Bill Ref": b.permanentBillNo || b.refNo,
        "Bill No": b.billNo,
        "Bill Date": b.billDate,
        "Due Date": b.dueDate,
        "Basic": c.basic, "GST": c.gst, "Gross": c.gross,
        "TDS": c.tds, "Other Deductions": c.other,
        "Net Payable": c.netPayable,
        "Step": b.step,
      };
    })), "Bill History");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments.map((p) => ({
      "PV No": p.pvNo, Date: p.date, "Bill Ref": p.billRefNo, "Bill No": p.billNo,
      Amount: p.amount, Mode: p.mode, Status: p.status,
    }))), "Payment Vouchers");
    XLSX.writeFile(wb, `vendor_history_${vendor.vendorCode || vendor.tempRefId}.xlsx`);
    toast.success("Vendor history exported");
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" data-testid="query-modal" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Vendor Code Query</div>
            <div className="modal-title">Vendor Details, Bill History &amp; Payment Summary</div>
          </div>
          <button className="modal-close" onClick={onClose} data-testid="query-close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="mono"
              data-testid="query-input"
              placeholder="Enter Vendor Code (e.g. AE0001JV2627) or Temp ID or Firm Name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runQuery()}
              style={{ flex: 1, padding: "8px 12px", border: "1px solid #cfd8e3", borderRadius: 6, fontSize: 13 }}
            />
            <button className="btn-color btn-nav" data-testid="query-run" onClick={runQuery}>
              <Search size={13} /><span className="lbl">Query</span>
            </button>
          </div>

          {notFound && (
            <p style={{ color: "#dc2626", fontSize: 12, marginTop: 10 }} data-testid="query-notfound">
              No vendor found with that code / temp ID / name.
            </p>
          )}

          {vendor && (
            <>
              <div className="section" style={{ marginTop: 12 }}>
                <div className="sec-head">Vendor Details</div>
                <div className="sec-body">
                  <div className="row cols-3">
                    <div className="field-b">
                      <label>Vendor Code</label>
                      <input className="pill-generated" readOnly value={vendor.vendorCode || vendor.tempRefId} data-testid="query-vendor-code" />
                    </div>
                    <div className="field-b"><label>Firm Name</label><input readOnly value={vendor.firmName || ""} /></div>
                    <div className="field-b"><label>Status</label><input readOnly value={vendor.step === 3 ? "Approved" : `Step ${vendor.step}`} /></div>
                    <div className="field-b"><label>PAN</label><input readOnly value={vendor.panNo || ""} /></div>
                    <div className="field-b"><label>GST</label><input readOnly value={vendor.gstNo || ""} /></div>
                    <div className="field-b"><label>Mobile</label><input readOnly value={vendor.mobileNo || ""} /></div>
                    <div className="field-b"><label>Bank</label><input readOnly value={vendor.bankName || ""} /></div>
                    <div className="field-b"><label>IFSC</label><input readOnly value={vendor.ifscCode || ""} /></div>
                    <div className="field-b"><label>Account No.</label><input readOnly value={vendor.accountNumber || ""} /></div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="sec-head">Account Summary</div>
                <div className="sec-body">
                  <div className="row cols-4">
                    <div className="field-b"><label>Bills Raised</label><input className="pill" readOnly value={summary?.totalBillsRaised || 0} data-testid="query-bills-raised" /></div>
                    <div className="field-b"><label>Total Billed</label><input className="pill" readOnly value={inr(summary?.totalBilled)} data-testid="query-total-billed" /></div>
                    <div className="field-b"><label>Total Paid</label><input className="pill-generated" readOnly value={inr(summary?.totalPaid)} data-testid="query-total-paid" /></div>
                    <div className="field-b"><label>Outstanding</label><input className="pill-status" readOnly value={inr(summary?.totalOutstanding)} data-testid="query-outstanding" /></div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="sec-head">Bill History</div>
                <div className="sec-body">
                  <table className="data-table" data-testid="query-bill-history">
                    <thead>
                      <tr>
                        <th>Bill Ref</th><th>Bill No</th><th>Date</th><th>Due</th>
                        <th style={{ textAlign: "right" }}>Net (₹)</th>
                        <th>Step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>No bills for this vendor yet</td></tr>
                      )}
                      {bills.map((b) => {
                        const c = computeBill(b);
                        return (
                          <tr key={b.id}>
                            <td className="mono">{b.permanentBillNo || b.refNo}</td>
                            <td>{b.billNo}</td>
                            <td>{b.billDate}</td>
                            <td>{b.dueDate}</td>
                            <td className="num">{c.netPayable.toFixed(2)}</td>
                            <td><span className={`pill-tag ${b.step === 5 ? "paid" : "due"}`}>{b.step === 5 ? "Approved" : `Step ${b.step}`}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="section">
                <div className="sec-head">Payment Vouchers</div>
                <div className="sec-body">
                  <table className="data-table" data-testid="query-payment-history">
                    <thead>
                      <tr>
                        <th>PV No</th><th>Date</th><th>Bill Ref</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Mode</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>No vouchers yet</td></tr>
                      )}
                      {payments.map((p) => (
                        <tr key={p.pvNo}>
                          <td className="mono">{p.pvNo}</td>
                          <td>{p.date}</td>
                          <td className="mono">{p.billRefNo}</td>
                          <td className="num">{Number(p.amount || 0).toFixed(2)}</td>
                          <td>{p.mode}</td>
                          <td><span className={`pill-tag ${p.status === "Approved" ? "paid" : "due"}`}>{p.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 10, textAlign: "right" }}>
                <button className="btn-color btn-export" data-testid="query-export" onClick={exportHistory}>
                  <span className="lbl">Export Bill History (Excel)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
