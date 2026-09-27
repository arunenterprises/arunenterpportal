import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import Workflow from "../components/Workflow";
import ActionBar from "../components/ActionBar";
import TopNav from "../components/TopNav";
import {
  createVendorDraft, upsertVendor, getVendors, findVendorByCode, approveVendor,
  currentUser, exportJSON,
} from "../lib/store";

const VENDOR_TYPES = ["Material Supplier", "Service Provider", "Contractor", "Consultant", "Transporter", "Other"];
const PROJECTS = ["Project Alpha", "Project Bravo", "Project Charlie", "Project Delta", "Head Office"];
const LOCATIONS = ["Prayagraj", "Lucknow", "Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore", "Other"];
const BUSINESS_TYPES = ["Registered", "Non-Registered"];

const Field = ({ label, children, test }) => (
  <div className="field">
    <label>{label}</label>
    <div className="ctl" data-testid={test}>{children}</div>
  </div>
);

export default function VendorRegistration() {
  const [vendor, setVendor] = useState(() => createVendorDraft());
  const [locked, setLocked] = useState(false); // approved -> locked
  const [searchCode, setSearchCode] = useState("");

  useEffect(() => {
    setVendor((v) => ({ ...v, createdBy: v.createdBy || currentUser() }));
  }, []);

  const bind = (k) => ({
    value: vendor[k] ?? "",
    onChange: (e) => setVendor({ ...vendor, [k]: e.target.value }),
    readOnly: locked,
    "data-testid": `field-${k}`,
  });

  const displayCode = vendor.vendorCode || vendor.tempCode;

  const validate = () => {
    const required = [
      ["vendorType", "Vendor Type"],
      ["vendorName", "Vendor / Supplier Name"],
      ["panNo", "PAN No"],
      ["email", "Email ID"],
      ["phoneNo", "Phone No"],
      ["bankName", "Bank Name"],
      ["ifscCode", "IFSC Code"],
      ["accountNumber", "Account Number"],
    ];
    for (const [k, l] of required) {
      if (!String(vendor[k] || "").trim()) {
        toast.error(`${l} is required`);
        return false;
      }
    }
    return true;
  };

  const handleNew = () => {
    setVendor({ ...createVendorDraft(), createdBy: currentUser() });
    setLocked(false);
    toast.success("New vendor draft created");
  };

  const handleSave = () => {
    if (!validate()) return;
    const saved = upsertVendor({ ...vendor });
    setVendor(saved);
    toast.success(`Saved (${saved.tempCode})`);
  };

  const handleEdit = () => {
    if (vendor.status === "Approved") {
      toast.error("Approved vendor cannot be edited");
      return;
    }
    setLocked(false);
    toast.info("You can edit the form now");
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const s = { ...vendor, status: "Submitted", preparedBy: vendor.preparedBy || currentUser() };
    upsertVendor(s);
    setVendor(s);
    toast.success("Submitted for approval");
  };

  const handleApprove = () => {
    if (vendor.status === "Approved") {
      toast.info("Already approved");
      return;
    }
    if (!validate()) return;
    const approved = approveVendor({
      ...vendor,
      status: "Submitted",
      checkedBy: vendor.checkedBy || currentUser(),
      approvedBy: vendor.approvedBy || currentUser(),
    });
    setVendor(approved);
    setLocked(true);
    toast.success(`Approved · Vendor Code: ${approved.vendorCode}`);
  };

  const handleExportJSON = () => {
    exportJSON(vendor, `vendor_${displayCode || "draft"}.json`);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = Object.entries(vendor).map(([k, v]) => ({ Field: k, Value: v }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Vendor");
    XLSX.writeFile(wb, `vendor_${displayCode || "draft"}.xlsx`);
  };

  const handlePrint = () => window.print();

  const handleSearch = () => {
    const v = findVendorByCode(searchCode.trim());
    if (v) {
      setVendor(v);
      setLocked(v.status === "Approved");
      toast.success(`Loaded ${v.vendorCode || v.tempCode}`);
    } else {
      toast.error("Vendor not found");
    }
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopNav />
        <div className="a4" data-testid="vendor-page">
          <Header
            docTitle="Vendor Registration Form"
            docNo={displayCode}
            pageLabel="PAGE 1 / 3"
            status={vendor.status}
          />
          {vendor.status === "Approved" && <div className="stamp approved">APPROVED</div>}
          {vendor.status === "Submitted" && <div className="stamp submitted">SUBMITTED</div>}
          {vendor.status === "Draft" && <div className="stamp draft">DRAFT</div>}

          <Workflow data={vendor} />

          {/* Search bar */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", fontSize: 11 }}>
            <label style={{ color: "#55617a", letterSpacing: 1 }}>SEARCH BY CODE</label>
            <input
              className="mono"
              data-testid="vendor-search-input"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Enter Temp or Vendor Code"
              style={{ flex: 1, border: "1px solid #d7dbe3", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
            />
            <button className="btn ghost" data-testid="vendor-search-btn" onClick={handleSearch}>Load</button>
          </div>

          {/* Section 1 */}
          <div className="section-title">1. Classification</div>
          <div className="field-grid cols-3">
            <Field label="1.1 Vendor Type" test="cell-vendorType">
              <select {...bind("vendorType")}>
                <option value="">Select</option>
                {VENDOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="1.2 Project" test="cell-project">
              <select {...bind("project")}>
                <option value="">Select</option>
                {PROJECTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="1.3 Location" test="cell-location">
              <select {...bind("location")}>
                <option value="">Select</option>
                {LOCATIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {/* Section 2 */}
          <div className="section-title">2. Entity Details</div>
          <div className="field-grid">
            <Field label="2.1 Vendor / Supplier Name" test="cell-vendorName">
              <input {...bind("vendorName")} />
            </Field>
            <Field label="2.2 Concern Person Name" test="cell-concernPerson">
              <input {...bind("concernPerson")} />
            </Field>
            <Field label="2.3 PAN No" test="cell-panNo">
              <input {...bind("panNo")} maxLength={10} style={{ textTransform: "uppercase" }} />
            </Field>
            <Field label="2.4 Business Type" test="cell-businessType">
              <select {...bind("businessType")}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="2.5 GST No" test="cell-gstNo">
              <input {...bind("gstNo")} maxLength={15} style={{ textTransform: "uppercase" }} />
            </Field>
            <Field label=""><span style={{ fontSize: 10, color: "#55617a" }}>GST required if Registered</span></Field>
          </div>

          {/* Section 3 */}
          <div className="section-title">3. Contact & Address</div>
          <div className="field-grid cols-1">
            <Field label="3.1 Permanent / Communication Address" test="cell-address">
              <textarea rows={2} {...bind("address")} />
            </Field>
          </div>
          <div className="field-grid cols-3">
            <Field label="Pin Code" test="cell-pinNo"><input {...bind("pinNo")} maxLength={6} /></Field>
            <Field label="3.2 Email ID" test="cell-email"><input type="email" {...bind("email")} /></Field>
            <Field label="3.3 Phone No" test="cell-phoneNo"><input {...bind("phoneNo")} maxLength={12} /></Field>
          </div>
          <div className="field-grid cols-1">
            <Field label="3.4 Aadhaar Card No" test="cell-aadhaarNo"><input {...bind("aadhaarNo")} maxLength={12} /></Field>
          </div>

          {/* Section 4 */}
          <div className="section-title">4. Bank Details</div>
          <div className="field-grid">
            <Field label="4.1 Bank Name" test="cell-bankName"><input {...bind("bankName")} /></Field>
            <Field label="4.2 Bank Address" test="cell-bankAddress"><input {...bind("bankAddress")} /></Field>
            <Field label="4.3 IFSC Code" test="cell-ifscCode"><input {...bind("ifscCode")} maxLength={11} style={{ textTransform: "uppercase" }} /></Field>
            <Field label="4.4 Account Name" test="cell-accountName"><input {...bind("accountName")} /></Field>
            <Field label="4.5 Account Number" test="cell-accountNumber"><input {...bind("accountNumber")} /></Field>
            <Field label=""><span style={{ fontSize: 10, color: "#55617a" }}>Confirm details before final approval</span></Field>
          </div>

          {/* Workflow signers */}
          <div className="section-title">5. Approval Workflow</div>
          <div className="field-grid cols-3">
            <Field label="Created By" test="cell-createdBy"><input {...bind("createdBy")} /></Field>
            <Field label="Checked By" test="cell-checkedBy"><input {...bind("checkedBy")} /></Field>
            <Field label="Prepared By" test="cell-preparedBy"><input {...bind("preparedBy")} /></Field>
            <Field label="Approved By" test="cell-approvedBy"><input {...bind("approvedBy")} /></Field>
            <Field label="Approval Date" test="cell-approvalDate"><input value={vendor.approvalDate || ""} readOnly /></Field>
            <Field label="Expiry Date (Auto +2Y)" test="cell-expiryDate"><input value={vendor.expiryDate || ""} readOnly /></Field>
          </div>

          <div className="sign-row">
            <div className="sig">Created By</div>
            <div className="sig">Checked By</div>
            <div className="sig">Prepared By</div>
            <div className="sig">Approved By</div>
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
          disabled={{ approve: vendor.status === "Approved" }}
        />
      </div>
    </>
  );
}
