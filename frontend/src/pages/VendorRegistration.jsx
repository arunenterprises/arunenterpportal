import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Header from "../components/Header";
import StepTabs from "../components/StepTabs";
import TopActionBar from "../components/TopActionBar";
import VendorQueryModal from "../components/VendorQueryModal";
import {
  createVendorDraft, upsertVendor, findVendorByAny, advanceVendorStep,
  STEP_LABEL, currentUser, exportJSON, generateTempRefId, getVendors,
} from "../lib/store";

const ACCOUNT_TYPES = ["Current Account", "Savings Account", "Overdraft (OD)", "Cash Credit (CC)"];

const F = ({ label, req, children, test }) => (
  <div className="field-b" data-testid={test ? `wrap-${test}` : undefined}>
    <label>{label}{req && <span className="req"> *</span>}</label>
    {children}
  </div>
);

export default function VendorRegistration() {
  const nav = useNavigate();
  const [vendor, setVendor] = useState(() => createVendorDraft());
  const [locked, setLocked] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [queryCode, setQueryCode] = useState("");
  const [refresh, setRefresh] = useState(0);

  const allVendors = useMemo(() => getVendors(), [refresh, vendor.id, vendor.step]);
  const loadVendorById = (v) => {
    setVendor(v);
    setLocked(v.step === 3);
    toast.success(`Loaded ${v.firmName || v.tempRefId} · ${v.vendorCode || v.tempRefId}`);
  };

  useEffect(() => {
    setVendor((v) => ({ ...v, createdByName: v.createdByName || currentUser() }));
  }, []);

  const bind = (k, extra = {}) => ({
    value: vendor[k] ?? "",
    onChange: (e) => setVendor({ ...vendor, [k]: e.target.value }),
    readOnly: locked,
    "data-testid": `field-${k}`,
    ...extra,
  });

  const validateStep1 = () => {
    if (!String(vendor.firmName || "").trim()) { toast.error("Vendor / Firm Name is required"); return false; }
    if (!String(vendor.mobileNo || "").trim()) { toast.error("Mobile Number is required"); return false; }
    return true;
  };

  const handleNew = () => {
    setVendor({ ...createVendorDraft(), createdByName: currentUser() });
    setLocked(false);
    toast.success("New vendor draft created");
  };
  const handleSave = () => {
    if (!validateStep1()) return;
    // Temp Ref ID is issued at first Save of Step 1 (Creation start)
    const withTemp = vendor.tempRefId
      ? { ...vendor }
      : { ...vendor, tempRefId: generateTempRefId() };
    const saved = upsertVendor(withTemp);
    setVendor(saved);
    toast.success(`Saved (${saved.tempRefId})`);
  };
  const handleEdit = () => {
    if (vendor.step === 3) {
      if (!window.confirm(`Reopen approved vendor ${vendor.vendorCode} for editing? This requires Re-Approval.`)) return;
      const history = Array.isArray(vendor.history) ? vendor.history : [];
      history.push({
        action: "Reopened",
        from: "Approved",
        by: currentUser(),
        at: new Date().toISOString(),
      });
      const next = {
        ...vendor,
        step: 2,
        revision: (vendor.revision || 0) + 1,
        reopenedAt: new Date().toISOString(),
        reopenedBy: currentUser(),
        history,
      };
      setVendor(upsertVendor(next));
      setLocked(false);
      toast.success(`${vendor.vendorCode} reopened (Rev ${next.revision}) · Awaiting Re-Approval`);
      return;
    }
    setLocked(false);
    toast.info("You can edit the form");
  };
  const handleSubmit = () => {
    if (vendor.step !== 1) {
      toast.error(vendor.step === 3 ? "Already approved" : "Already submitted for checking");
      return;
    }
    if (!validateStep1()) return;
    if (!vendor.tempRefId) { toast.error("Please Save the record first — Temp Ref ID is required"); return; }
    if (!vendor.checkedByName.trim()) { toast.error("Enter 'Checked By (Name)' in Step 2 section"); return; }
    const next = advanceVendorStep({ ...vendor });
    setVendor(next);
    toast.success("Submitted for Checking & Verification");
  };
  const handleApprove = () => {
    if (vendor.step === 3) { toast.info("Already approved"); return; }
    if (vendor.step === 1) { toast.error("Please Submit for Checking first"); return; }
    if (!vendor.approvedByName.trim()) { toast.error("Enter 'Approved By' name in Step 3 section"); return; }
    const isReApproval = (vendor.revision || 0) > 0;
    const history = Array.isArray(vendor.history) ? vendor.history : [];
    history.push({
      action: isReApproval ? "Re-Approved" : "Approved",
      by: currentUser(),
      at: new Date().toISOString(),
    });
    const next = { ...advanceVendorStep({ ...vendor }), history };
    setVendor(upsertVendor(next));
    setLocked(true);
    toast.success(
      isReApproval
        ? `Re-Approved (Rev ${next.revision}) · Vendor Code: ${next.vendorCode}`
        : `Final Approval done · Vendor Code: ${next.vendorCode}`
    );
  };
  const handleSearch = (q) => {
    const v = findVendorByAny(q);
    if (v) {
      setVendor(v);
      setLocked(v.step === 3);
      toast.success(`Loaded ${v.firmName || v.tempRefId} · ${v.vendorCode || v.tempRefId}`);
      return true;
    }
    toast.error("Vendor not found · Opening Query lookup");
    return false;
  };
  const openQuery = (q) => { setQueryCode(q || ""); setQueryOpen(true); };
  const handleExportJSON = () => {
    exportJSON(vendor, `vendor_${vendor.vendorCode || vendor.tempRefId || "draft"}.json`);
    toast.success("Vendor exported as JSON");
  };
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = Object.entries(vendor).map(([k, v]) => ({ Field: k, Value: v }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Vendor");
    XLSX.writeFile(wb, `vendor_${vendor.vendorCode || vendor.tempRefId || "draft"}.xlsx`);
    toast.success("Vendor exported as Excel");
  };
  const handlePrint = () => window.print();

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopActionBar
          searchPlaceholder="Vendor Code / Temp ID / Firm Name / Mobile"
          searchLabel="Search"
          onSearch={handleSearch}
          onQuery={openQuery}
          nextLabel="Bill Process"
          nextTo="/bill"
          onNew={handleNew}
          onSave={handleSave}
          onEdit={handleEdit}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onPrint={handlePrint}
          onExportJSON={handleExportJSON}
          onExportExcel={handleExportExcel}
          disabled={{ submit: vendor.step !== 1, approve: vendor.step !== 2 && vendor.step !== 3 }}
        />
        <VendorQueryModal
          open={queryOpen}
          onClose={() => setQueryOpen(false)}
          initialCode={queryCode}
          variant="vendor"
          onLoad={(v) => { setVendor(v); setLocked(v.step === 3); toast.success(`Loaded ${v.firmName || v.tempRefId}`); }}
        />

        <div className="a4" data-testid="vendor-page">
          <Header formTitle="VENDOR / SUPPLIER REGISTRATION FORM" />
          <StepTabs step={vendor.step} />

          {/* Vendors Register Tabs — Temp ID till Final Approval · Vendor Code after */}
          {allVendors.length > 0 && (
            <div className="section" data-testid="vendors-register">
              <div className="sec-head">Vendors Register · Click to Load (Temp ID till Approval · Vendor Code after)</div>
              <div className="sec-body">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allVendors.map((v) => {
                    const isApp = v.step === 3;
                    const isActive = vendor.id === v.id;
                    const label = isApp
                      ? `${v.vendorCode} · ${v.firmName || "—"}`
                      : `${v.tempRefId || "TEMP–"} · ${v.firmName || "Draft"}`;
                    return (
                      <button
                        key={v.id}
                        onClick={() => loadVendorById(v)}
                        data-testid={`vendor-tab-${v.id}`}
                        title={isApp ? `Approved · ${v.vendorType || "Vendor"}` : `Draft · Step ${v.step}`}
                        style={{
                          padding: "5px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          border: `1px solid ${isApp ? "#86efac" : "#fcd34d"}`,
                          background: isActive ? (isApp ? "#166534" : "#92400e") : (isApp ? "#dcfce7" : "#fef3c7"),
                          color: isActive ? "#fff" : (isApp ? "#166534" : "#92400e"),
                          borderRadius: 999,
                          cursor: "pointer",
                          fontFamily: "monospace",
                          letterSpacing: ".3px",
                        }}
                      >
                        {isApp ? "✓ " : "⏳ "}{label}
                        {v.revision > 0 && (
                          <span style={{ marginLeft: 4, padding: "0 4px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 999, fontSize: 8, fontWeight: 700 }}>
                            R{v.revision}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {vendor.step === 3 && vendor.vendorCode && (
            <div className="approval-banner" data-testid="approval-banner">
              <CheckCircle2 size={18} />
              <span>VENDOR APPROVED · PERMANENT VENDOR CODE:</span>
              <span className="code" data-testid="approved-vendor-code">{vendor.vendorCode}</span>
              {vendor.revision > 0 && (
                <span
                  data-testid="vendor-rev-badge"
                  style={{ padding: "2px 8px", fontSize: 10, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 999, fontWeight: 700, marginLeft: 8 }}
                  title={`Reopened & Re-Approved ${vendor.revision} time(s)`}
                >
                  REV {vendor.revision}
                </span>
              )}
              <span className="exp">VALID TILL: {vendor.expiryDate}</span>
            </div>
          )}

          <div className="section">
            <div className="sec-head">System Reference &amp; Primary Key</div>
            <div className="sec-body">
              <div className="row cols-3">
                <F label="Temporary Ref ID (Active till Approval)">
                  <input className="pill" data-testid="field-tempRefId"
                    value={vendor.tempRefId || "Generated on First Save"} readOnly />
                </F>
                <F label="Permanent Vendor Code (Primary Key)">
                  <input className="pill-generated" data-testid="field-vendorCode"
                    value={vendor.vendorCode || "Generated on Step 3 Approval"} readOnly />
                </F>
                <F label="Current Status">
                  <input className="pill-status" data-testid="field-currentStatus" value={STEP_LABEL[vendor.step]} readOnly />
                </F>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="sec-head">Project &amp; Site Details</div>
            <div className="sec-body">
              <div className="row cols-2">
                <F label="Project Code"><input placeholder="e.g. PRJ-2026-NNA" {...bind("projectCode")} /></F>
                <F label="Project Location / Site Name"><input placeholder="e.g. Naini Site / Prayagraj" {...bind("siteName")} /></F>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="sec-head">1. Vendor Basic, Contact &amp; Address Details</div>
            <div className="sec-body">
              <div className="row cols-3">
                <F label="Vendor Type" req>
                  <select {...bind("vendorType")} data-testid="field-vendorType">
                    <option value="Vendor">Vendor</option>
                    <option value="Supplier">Supplier</option>
                  </select>
                </F>
                <F label="Vendor / Firm Name" req><input placeholder="Full Firm Name" {...bind("firmName")} /></F>
                <F label="Contact Person Name"><input placeholder="Contact Person Name" {...bind("contactPerson")} /></F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="Mobile Number" req><input placeholder="Phone Number" maxLength={12} {...bind("mobileNo")} /></F>
                <F label="Vendor Email ID (For Work Orders)"><input type="email" placeholder="vendor@domain.com" {...bind("email")} /></F>
                <F label="GST Number">
                  <input placeholder="GSTIN Number" maxLength={15}
                    {...bind("gstNo", { style: { textTransform: "uppercase" } })} />
                </F>
              </div>
              <div className="row cols-2" style={{ marginTop: 10 }}>
                <F label="PAN Number">
                  <input placeholder="PAN Number" maxLength={10}
                    {...bind("panNo", { style: { textTransform: "uppercase" } })} />
                </F>
                <F label="Registered Street Address"><input placeholder="Premises No, Street, Area" {...bind("streetAddress")} /></F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="City"><input placeholder="City" {...bind("city")} /></F>
                <F label="State"><input placeholder="State" {...bind("state")} /></F>
                <F label="Pincode / PIN Number"><input placeholder="PIN Code" maxLength={6} {...bind("pincode")} /></F>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="sec-head">2. Vendor Bank Details</div>
            <div className="sec-body">
              <div className="row cols-3">
                <F label="Bank Name"><input placeholder="Bank Name" {...bind("bankName")} /></F>
                <F label="Branch Name"><input placeholder="Branch Name / City" {...bind("branchName")} /></F>
                <F label="IFSC Code">
                  <input placeholder="IFSC CODE (E.G. SBIN0001234)" maxLength={11}
                    {...bind("ifscCode", { style: { textTransform: "uppercase" } })} />
                </F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="Account Holder Name"><input placeholder="Name as per Bank" {...bind("accountHolder")} /></F>
                <F label="Account Number"><input placeholder="Bank Account Number" {...bind("accountNumber")} /></F>
                <F label="Account Type">
                  <select {...bind("accountType")}>
                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </F>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="sec-head">3. Workflow &amp; Approvals</div>
            <div className="sec-body">
              <div className="substep">
                <div className="substep-title">[STEP 1] CREATED BY</div>
                <div className="row cols-2">
                  <F label="Created By (Fill Name)"><input placeholder="Name of Creator" {...bind("createdByName")} /></F>
                  <F label="Creation Date"><input type="date" {...bind("creationDate")} /></F>
                </div>
              </div>
              <div className="substep">
                <div className="substep-title">[STEP 2] CHECKED &amp; PREPARED BY</div>
                <div className="row cols-2">
                  <F label="Checked By (Name)"><input placeholder="Checker Name" {...bind("checkedByName")} /></F>
                  <F label="Prepared By (Name with Purchase Manager)"><input placeholder="e.g. Divya Srivastava (Purchase Manager)" {...bind("preparedByName")} /></F>
                </div>
              </div>
              <div className="substep">
                <div className="substep-title">[STEP 3] FINAL APPROVAL &amp; EXPIRY</div>
                <div className="row cols-3">
                  <F label="Approved By (Name with Account Manager)"><input placeholder="e.g. Komal Srivastava (Account Manager)" {...bind("approvedByName")} /></F>
                  <F label="Date of Approval"><input className="date-highlight" value={vendor.approvalDate || ""} readOnly placeholder="dd / mm / yyyy" /></F>
                  <F label="Expiry Date (2 Years Valid)"><input className="date-highlight" value={vendor.expiryDate || ""} readOnly placeholder="dd / mm / yyyy" /></F>
                </div>
              </div>
            </div>
          </div>

          <div className="signs">
            <div className="sig"><div className="title">Prepared By</div><div className="role">(Purchase Dept.)</div></div>
            <div className="sig"><div className="title">Checked By</div><div className="role">(Audit &amp; Verification)</div></div>
            <div className="sig"><div className="title">Approved By</div><div className="role">(Account Manager / Partner)</div></div>
          </div>
        </div>
      </div>
    </>
  );
}
