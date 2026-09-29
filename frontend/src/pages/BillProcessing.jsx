import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import { CheckCircle2, Search, Plus, X } from "lucide-react";
import Header from "../components/Header";
import StepTabs from "../components/StepTabs";
import TopActionBar from "../components/TopActionBar";
import VendorQueryModal from "../components/VendorQueryModal";
import {
  createBillDraft, computeBill, upsertBill, findVendorByCode, advanceBillStep,
  BILL_STEP_LABEL, currentUser, exportJSON, findVendorByAny, amountToWords, getBills,
} from "../lib/store";
const GST_SLABS = [0, 5, 12, 18, 28];
const UOMS = ["Nos", "Kg", "Km", "Mtr", "Sqm", "Cum", "Ton", "Ltr", "Lot", "Job"];
const CATEGORY_SCOPES = [
  "Civil Work", "Electrical Work", "Plumbing & Sanitary", "Steel & Fabrication",
  "Painting & Finishing", "Interior / Woodwork", "Material Supply",
  "Labour / Manpower", "Consulting / Design",
  "Transportation", "Loading / Unloading",
  "Other",
];
const ITEM_UNITS = ["Sft/MT", "Nos", "Kg", "Km", "Mtr", "Sqm", "Cum", "Ton", "Ltr", "Lot", "Job"];
const MEASUREMENT_OPTIONS = ["Verified & OK", "Pending", "Rejected"];
const WO_RATE_OPTIONS = ["Matched with WO", "Rate Deviation", "Not Verified"];
const GST_TDS_OPTIONS = ["TDS & GST Verified", "Pending", "Discrepancy Found"];
const APPROVAL_OPTIONS = ["Approved For Payment", "Hold", "Rejected"];
const PRIORITY_OPTIONS = ["High Priority (Immediate)", "Normal", "Low"];
const PAY_MODES = ["RTGS / NEFT Bank Transfer", "IMPS", "UPI", "Cheque", "Cash"];
const RELEASE_OPTIONS = ["Added to Due List (Unpaid)", "Paid", "On Hold"];

const F = ({ label, req, children }) => (
  <div className="field-b">
    <label>{label}{req && <span className="req"> *</span>}</label>
    {children}
  </div>
);

export default function BillProcessing() {
  const nav = useNavigate();
  const [bill, setBill] = useState(() => createBillDraft());
  const [locked, setLocked] = useState(false);
  const [vendorInput, setVendorInput] = useState("");
  const [queryOpen, setQueryOpen] = useState(false);
  const [queryCode, setQueryCode] = useState("");
  const [refresh, setRefresh] = useState(0);

  const allBills = useMemo(() => getBills(), [refresh, bill.id]);
  const loadBill = (b) => {
    setBill(b);
    setLocked(b.step === 5);
    toast.success(`Loaded ${b.permanentBillNo || b.refNo}`);
  };

  useEffect(() => {
    setBill((b) => ({ ...b, createdByName: b.createdByName || currentUser() }));
  }, []);

  // ---- Items & Work Scope Breakdown handlers ----
  const items = bill.items || [];
  const itemsTotal = items.reduce((s, r) => s + (Number(r.woRate) || 0) * (Number(r.billedQty) || 0), 0);

  const addItem = () => {
    const list = [...items, {
      id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      categoryScope: "Civil Work",
      description: "",
      hsn: "",
      woQty: 0,
      unit: "Sft/MT",
      woRate: 0,
      billedQty: 0,
    }];
    setBill({ ...bill, items: list });
  };
  const updateItem = (id, patch) => {
    const list = items.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      // Auto-select unit for Transportation
      if (patch.categoryScope === "Transportation" && !next.unit) next.unit = "Km";
      if (patch.categoryScope === "Transportation" && next.unit === "Sft/MT") next.unit = "Km";
      // Clamp billedQty to woQty
      if (patch.billedQty !== undefined) {
        const bq = Number(patch.billedQty) || 0;
        const wq = Number(next.woQty) || 0;
        if (wq > 0 && bq > wq) {
          toast.error(`Billed Qty (${bq}) cannot exceed WO Qty (${wq})`);
          next.billedQty = wq;
        }
      }
      return next;
    });
    setBill({ ...bill, items: list });
  };
  const removeItem = (id) => {
    setBill({ ...bill, items: items.filter((r) => r.id !== id) });
  };
  // Cumulative totals across items in current bill
  const totals = items.reduce((acc, r) => {
    const woQty = Number(r.woQty) || 0;
    const billed = Number(r.billedQty) || 0;
    const woRate = Number(r.woRate) || 0;
    acc.woQty += woQty;
    acc.billed += billed;
    acc.balance += Math.max(0, woQty - billed);
    acc.woValue += woQty * woRate;
    acc.amount += billed * woRate;
    return acc;
  }, { woQty: 0, billed: 0, balance: 0, woValue: 0, amount: 0 });
  const useItemsSumAsBasic = () => {
    setBill({ ...bill, basicAmount: +itemsTotal.toFixed(2) });
    toast.success(`Basic Amount set to ₹${itemsTotal.toFixed(2)}`);
  };

  // ---- Work Order file upload (max 300 KB) ----
  const handleWoFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 300 * 1024) {
      toast.error(`File size ${Math.round(f.size / 1024)} KB exceeds 300 KB limit`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBill({ ...bill, workOrderFile: { name: f.name, size: f.size, type: f.type, dataUrl: reader.result } });
      toast.success(`Uploaded ${f.name} (${Math.round(f.size / 1024)} KB)`);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(f);
    e.target.value = "";
  };
  const removeWoFile = () => {
    setBill({ ...bill, workOrderFile: null });
    toast.success("Work Order file removed");
  };

  const bind = (k, extra = {}) => ({
    value: bill[k] ?? "",
    onChange: (e) => setBill({ ...bill, [k]: e.target.value }),
    readOnly: locked,
    "data-testid": `field-${k}`,
    ...extra,
  });

  const vendor = bill.vendorSnapshot;
  const comp = useMemo(() => computeBill(bill), [bill]);

  useEffect(() => {
    if (bill.billDate && !bill.dueDate) {
      const d = new Date(bill.billDate);
      d.setDate(d.getDate() + 30);
      setBill((b) => ({ ...b, dueDate: d.toISOString().slice(0, 10), scheduledDueDate: b.scheduledDueDate || d.toISOString().slice(0, 10) }));
    }
  }, [bill.billDate, bill.dueDate]);

  const fetchVendor = (codeArg) => {
    const code = (codeArg ?? vendorInput).trim();
    if (!code) { toast.error("Enter Vendor Code first"); return; }
    const v = findVendorByCode(code);
    if (!v) { toast.error("Vendor not found"); return; }
    if (v.step !== 3) { toast.error("Vendor is not approved yet"); return; }
    setBill({ ...bill, vendorCode: v.vendorCode, vendorSnapshot: v });
    toast.success(`Loaded ${v.firmName}`);
  };

  const handleSearch = (q) => {
    const v = findVendorByAny(q);
    if (!v) { toast.error("Vendor not found"); return; }
    if (v.step !== 3) { toast.error("Vendor is not approved yet"); return; }
    setVendorInput(v.vendorCode);
    setBill({ ...bill, vendorCode: v.vendorCode, vendorSnapshot: v });
    toast.success(`Loaded ${v.firmName}`);
  };
  const openQuery = (q) => { setQueryCode(q || bill.vendorCode || ""); setQueryOpen(true); };

  const handleNew = () => {
    setBill({ ...createBillDraft(), createdByName: currentUser() });
    setLocked(false); setVendorInput("");
    toast.success("New bill draft");
  };

  const validate = () => {
    if (!bill.vendorSnapshot) { toast.error("Fetch approved vendor first"); return false; }
    if (!bill.workOrderNo.trim()) { toast.error("Work Order No is required"); return false; }
    if (!bill.billNo.trim()) { toast.error("Vendor Invoice / Bill No is required"); return false; }
    if (!bill.billDate) { toast.error("Invoice Date is required"); return false; }
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
    if (bill.step === 5) {
      if (!window.confirm(`Reopen approved bill ${bill.permanentBillNo || bill.refNo} for editing? This requires Re-Approval.`)) return;
      const history = Array.isArray(bill.history) ? bill.history : [];
      history.push({
        action: "Reopened",
        from: "Approved",
        by: currentUser(),
        at: new Date().toISOString(),
      });
      const next = {
        ...bill,
        step: 4,
        revision: (bill.revision || 0) + 1,
        reopenedAt: new Date().toISOString(),
        reopenedBy: currentUser(),
        history,
      };
      const saved = upsertBill(next);
      setBill(saved);
      setLocked(false);
      toast.success(`${bill.permanentBillNo || bill.refNo} reopened (Rev ${next.revision}) · Awaiting Re-Approval`);
      return;
    }
    setLocked(false); toast.info("Editable");
  };

  const requiredForStep = (step) => {
    if (step === 1) return { field: "siteInchargeName", label: "Site Incharge Name" };
    if (step === 2) return { field: "purchaseInchargeName", label: "Purchase Incharge Name" };
    if (step === 3) return { field: "accountInchargeName", label: "Account Incharge Name" };
    if (step === 4) return { field: "approverName", label: "Approver Name" };
    return null;
  };

  const handleSubmit = () => {
    if (bill.step >= 4) { toast.error("Already at final approval stage"); return; }
    if (!validate()) return;
    const req = requiredForStep(bill.step);
    if (req && !String(bill[req.field] || "").trim()) {
      toast.error(`Enter '${req.label}' first`); return;
    }
    const next = advanceBillStep({ ...bill });
    setBill(next);
    toast.success(`Advanced to ${BILL_STEP_LABEL[next.step]}`);
  };

  const handleApprove = () => {
    if (bill.step === 5) { toast.info("Already in Payment Due List"); return; }
    if (bill.step !== 4) { toast.error("Complete all approval steps first (use Submit)"); return; }
    if (!validate()) return;
    if (!bill.approverName.trim()) { toast.error("Enter Approver Name first"); return; }
    const isReApproval = (bill.revision || 0) > 0;
    const history = Array.isArray(bill.history) ? bill.history : [];
    history.push({
      action: isReApproval ? "Re-Approved" : "Approved",
      by: currentUser(),
      at: new Date().toISOString(),
    });
    const next = { ...advanceBillStep({ ...bill }), history };
    const saved = upsertBill(next);
    setBill(saved);
    setLocked(true);
    toast.success(
      isReApproval
        ? `Re-Approved (Rev ${saved.revision}) · Bill No: ${saved.permanentBillNo} · Net ₹${comp.netPayable}`
        : `Final Approval · Added to Due List · Net ₹${comp.netPayable}`
    );
  };

  const handleExportJSON = () => {
    exportJSON({ ...bill, computed: comp }, `bill_${(bill.refNo || "draft").replace(/\//g, "_")}.json`);
    toast.success("Bill exported as JSON");
  };
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Ref No", bill.refNo], ["Permanent Bill No", bill.permanentBillNo],
      ["Process Date", bill.processDate],
      ["Vendor Code", bill.vendorCode], ["Vendor Name", vendor?.firmName || ""],
      ["Work Order No", bill.workOrderNo], ["Work Order Date", bill.workOrderDate],
      ["Project Code & Location", bill.projectCodeLocation],
      ["Work Scope", bill.workScope],
      ["Total WO Value", bill.totalWOValue], ["Previous Advance", bill.previousAdvance],
      ["Item Description", bill.itemDescription], ["Quantity", bill.quantity], ["UOM", bill.uom],
      ["Bill No", bill.billNo], ["Bill Date", bill.billDate],
      ["Basic Amount", comp.basic], [`GST @ ${bill.gstSlab}%`, comp.gst],
      ["Gross", comp.gross], [`TDS @ ${bill.tdsRate}%`, comp.tds],
      ["Other Deductions", comp.other], ["Net Payable", comp.netPayable],
      ["Site Incharge", bill.siteInchargeName], ["Measurement Status", bill.measurementStatus],
      ["Purchase Incharge", bill.purchaseInchargeName], ["WO Rate Status", bill.woRateStatus],
      ["Account Incharge", bill.accountInchargeName], ["GST/TDS Check", bill.gstTdsCheck],
      ["Approver", bill.approverName], ["Approval Status", bill.approvalStatus],
      ["Scheduled Due Date", bill.scheduledDueDate], ["Priority", bill.priorityLevel],
      ["Payment Mode", bill.paymentMode], ["To-Do Notes", bill.todoNotes],
      ["Final Release Status", bill.finalReleaseStatus],
      ["Step", BILL_STEP_LABEL[bill.step]],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Field", "Value"], ...rows]), "Bill");
    XLSX.writeFile(wb, `bill_${(bill.refNo || "draft").replace(/\//g, "_")}.xlsx`);
    toast.success("Bill exported as Excel");
  };
  const handlePrint = () => window.print();

  const workflowLabel = bill.step < 5 ? `Next Approval Step (→ ${BILL_STEP_LABEL[bill.step + 1] || ""})` : "Approved";
  const isApproved = bill.step === 5;  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopActionBar
          variant="dark"
          searchPlaceholder="Vendor Code / Firm / Temp ID"
          searchLabel="Query"
          onQuery={openQuery}
          prevLabel="Vendor Reg"
          prevTo="/vendor"
          nextLabel="Final Process"
          nextTo="/final"
          onNew={handleNew}
          onSave={handleSave}
          onEdit={handleEdit}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onPrint={handlePrint}
          onExportJSON={handleExportJSON}
          onExportExcel={handleExportExcel}
          labels={{ new: "New Bill", save: "Save Bill", print: "Print" }}
          disabled={{ submit: bill.step >= 4, approve: bill.step !== 4 }}
        />
        <VendorQueryModal open={queryOpen} onClose={() => setQueryOpen(false)} initialCode={queryCode} variant="bill" />

        <div className="a4" data-testid="bill-page">
          <Header formTitle="VENDOR BILL PROCESSING & PAYMENT APPROVAL VOUCHER" />
          <StepTabs
            step={bill.step}
            labels={[BILL_STEP_LABEL[1], BILL_STEP_LABEL[2], BILL_STEP_LABEL[3], BILL_STEP_LABEL[4], BILL_STEP_LABEL[5]]}
          />

          {/* Approval banner */}
          {isApproved && (
            <div className="approval-banner" data-testid="approval-banner">
              <CheckCircle2 size={18} />
              <span>BILL APPROVED · PERMANENT BILL NO (PRIMARY KEY):</span>
              <span className="code" data-testid="approved-bill-no">{bill.permanentBillNo}</span>
              <span>· NET PAYABLE:</span>
              <span className="code">₹ {comp.netPayable.toFixed(2)}</span>
              <span className="exp">SCHEDULED: {bill.scheduledDueDate || bill.dueDate}</span>
            </div>
          )}

          {/* Bill Process Reference */}
          <div className="section">
            <div className="sec-head">Bill Process Reference</div>
            <div className="sec-body">
              <div className="row cols-4">
                <F label="Bill Ref No (Active till Approval)">
                  <input className="pill" value={bill.refNo} readOnly data-testid="field-refNo" />
                </F>
                <F label="Permanent Bill No">
                  <input className="pill-generated" data-testid="field-permanentBillNo"
                    value={bill.permanentBillNo || "Generated on Final Approval"} readOnly />
                </F>
                <F label="Process Date">
                  <input type="date" {...bind("processDate")} />
                </F>
                <F label="Current Status">
                  <input className="pill-status" value={BILL_STEP_LABEL[bill.step]} readOnly data-testid="field-currentStatus" />
                </F>
              </div>
            </div>
          </div>

          {/* 1. VENDOR LOOKUP */}
          <div className="section">
            <div className="sec-head">1. Vendor Lookup &amp; Details (Auto-Fetch via Vendor Code)</div>
            <div className="sec-body">
              <div className="row cols-3">
                <div className="field-b">
                  <label>Enter Vendor Code <span className="req">*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="mono" placeholder="E.G. AE0001JV2526"
                      value={vendorInput} onChange={(e) => setVendorInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchVendor()}
                      data-testid="bill-vendor-input"
                      style={{ flex: 1 }} />
                    <button className="btn-color btn-save" data-testid="bill-fetch-vendor" onClick={() => fetchVendor()} style={{ minWidth: 76 }}>
                      <Search size={13} /><span className="lbl">Fetch</span>
                    </button>
                  </div>
                </div>
                <F label="Vendor Type">
                  <input value={vendor?.vendorType || ""} readOnly data-testid="fetched-vendorType" />
                </F>
                <F label="Vendor / Firm Name">
                  <input value={vendor?.firmName || ""} readOnly data-testid="fetched-firmName" />
                </F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="GST Number">
                  <input value={vendor?.gstNo || ""} readOnly data-testid="fetched-gst" />
                </F>
                <F label="Mobile Number">
                  <input value={vendor?.mobileNo || ""} readOnly data-testid="fetched-mobile" />
                </F>
                <F label="Vendor Email ID">
                  <input value={vendor?.email || ""} readOnly />
                </F>
              </div>
              <div className="row cols-1" style={{ marginTop: 10 }}>
                <F label="Bank Name &amp; Account No.">
                  <input
                    value={vendor ? `${vendor.bankName || ""} / ${vendor.accountNumber || ""}` : ""}
                    readOnly placeholder="Bank Name / Acc No"
                    data-testid="fetched-bank"
                  />
                </F>
              </div>
            </div>
          </div>

          {/* 2. WORK ORDER */}
          <div className="section">
            <div className="sec-head">2. Work Order &amp; Project Allocation</div>
            <div className="sec-body">
              <div className="row cols-4">
                <F label="Work Order No." req>
                  <input placeholder="WO Number" {...bind("workOrderNo")} />
                </F>
                <F label="Work Order Date">
                  <input type="date" {...bind("workOrderDate")} />
                </F>
                <F label="Work Order Expiry Date">
                  <input type="date"
                    {...bind("workOrderExpiryDate")}
                    min={bill.workOrderDate || undefined}
                    data-testid="field-workOrderExpiryDate"
                    style={
                      bill.workOrderExpiryDate &&
                      bill.workOrderExpiryDate < new Date().toISOString().slice(0, 10)
                        ? { background: "#fee2e2", color: "#991b1b", fontWeight: 700 }
                        : bill.workOrderExpiryDate
                          ? { background: "#f0fdf4" }
                          : {}
                    }
                    title={
                      bill.workOrderExpiryDate &&
                      bill.workOrderExpiryDate < new Date().toISOString().slice(0, 10)
                        ? "Work Order EXPIRED"
                        : "Validity end date"
                    }
                  />
                </F>
                <F label="Total Work Order Value (₹)">
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("totalWOValue")} />
                </F>
              </div>
              <div className="row cols-4" style={{ marginTop: 10 }}>
                <F label="Project Code &amp; Location">
                  <input placeholder="Project Code / Site Name" {...bind("projectCodeLocation")} />
                </F>
                <F label="Work Scope / Description">
                  <input placeholder="Description of executed work" {...bind("workScope")} />
                </F>
                <F label="Previous Bill & Amount (info only)">
                  <input type="text" placeholder="e.g. BILL0003/2526 - ₹50,000" {...bind("previousAdvance")} />
                </F>
                <F label="UOM (Unit of Measure)">
                  <select {...bind("uom")}>
                    {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </F>
              </div>
              <div className="row" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "3fr 1fr 2fr", gap: "8px 12px" }}>
                <F label="Item Summary">
                  <input placeholder="Item / Service description (multi-word ok)" {...bind("itemDescription")} />
                </F>
                <F label="Quantity (Summary)">
                  <input type="number" step="0.01" min="0" placeholder="0" {...bind("quantity")} />
                </F>
                <F label="Work Order Copy (PDF/Image · Max 300 KB)">
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleWoFile}
                      disabled={locked}
                      data-testid="wo-file-input"
                      style={{ maxWidth: 200, padding: "3px 4px", fontSize: 10.5, border: "1px solid #cfd8e3", borderRadius: 4, background: "#fff", flex: "0 0 auto" }}
                    />
                    {bill.workOrderFile && (
                      <a href={bill.workOrderFile.dataUrl} target="_blank" rel="noreferrer"
                        data-testid="wo-file-link"
                        style={{ padding: "3px 8px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 4, fontWeight: 600, fontSize: 10.5, textDecoration: "none", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
                        title={bill.workOrderFile.name}>
                        📎 {bill.workOrderFile.name} ({Math.round(bill.workOrderFile.size / 1024)}KB)
                      </a>
                    )}
                    {bill.workOrderFile && !locked && (
                      <button type="button" onClick={removeWoFile} data-testid="wo-file-remove"
                        style={{ padding: "3px 8px", fontSize: 10, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
                        Remove
                      </button>
                    )}
                  </div>
                </F>
              </div>
            </div>
          </div>

          {/* 2B. ITEM & WORK SCOPE BREAKDOWN */}
          <div className="section">
            <div className="section-title-inline">
              <span>Item &amp; Work Scope Breakdown Details</span>
              <button className="btn-add-row" data-testid="btn-add-item-row"
                onClick={addItem} disabled={locked}>
                <Plus size={12} /> Add Row
              </button>
            </div>
            {items.length === 0 ? (
              <div className="items-empty" data-testid="items-empty">
                No items added yet. Click "Add Row" to break down the work scope.
              </div>
            ) : (
              <table className="items-table" data-testid="items-table">
                <thead>
                  <tr>
                    <th style={{ width: "11%" }}>Category Scope</th>
                    <th style={{ minWidth: 220 }}>Item Description</th>
                    <th style={{ width: "8%" }}>HSN / SAC</th>
                    <th style={{ width: "6%" }}>WO Qty</th>
                    <th style={{ width: "6%" }}>Unit</th>
                    <th style={{ width: "8%" }}>WO Rate (₹)</th>
                    <th style={{ width: "6%" }}>Billed Qty</th>
                    <th style={{ width: "6%", background: "#f0f9ff" }} title="WO Qty - Billed Qty">Balance</th>
                    <th style={{ width: "9%" }}>Amount (₹)</th>
                    <th className="col-del">X</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => {
                    const woQty = Number(r.woQty) || 0;
                    const billed = Number(r.billedQty) || 0;
                    const balance = Math.max(0, woQty - billed);
                    const amount = (Number(r.woRate) || 0) * billed;
                    const overbill = billed > woQty && woQty > 0;
                    return (
                      <tr key={r.id} data-testid={`item-row-${i}`}>
                        <td>
                          <select value={r.categoryScope}
                            onChange={(e) => updateItem(r.id, { categoryScope: e.target.value })}
                            disabled={locked} data-testid={`item-category-${i}`}>
                            {CATEGORY_SCOPES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ minWidth: 220 }}>
                          <input placeholder="Detailed work item name / description"
                            value={r.description}
                            onChange={(e) => updateItem(r.id, { description: e.target.value })}
                            readOnly={locked} data-testid={`item-desc-${i}`} />
                        </td>
                        <td>
                          <input placeholder="HSN/SAC"
                            value={r.hsn || ""}
                            onChange={(e) => updateItem(r.id, { hsn: e.target.value.replace(/[^0-9]/g, "").slice(0, 8) })}
                            readOnly={locked} data-testid={`item-hsn-${i}`}
                            className="num" />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" placeholder="0"
                            value={r.woQty}
                            onChange={(e) => updateItem(r.id, { woQty: e.target.value })}
                            readOnly={locked} data-testid={`item-woQty-${i}`} className="num" />
                        </td>
                        <td>
                          <select value={r.unit}
                            onChange={(e) => updateItem(r.id, { unit: e.target.value })}
                            disabled={locked} data-testid={`item-unit-${i}`}>
                            {ITEM_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" placeholder="0.00"
                            value={r.woRate}
                            onChange={(e) => updateItem(r.id, { woRate: e.target.value })}
                            readOnly={locked} data-testid={`item-woRate-${i}`} className="num" />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" placeholder="0"
                            value={r.billedQty}
                            onChange={(e) => updateItem(r.id, { billedQty: e.target.value })}
                            readOnly={locked} data-testid={`item-billedQty-${i}`}
                            className="num"
                            style={overbill ? { background: "#fee2e2", color: "#991b1b" } : {}} />
                        </td>
                        <td>
                          <input value={balance.toFixed(2)} readOnly
                            data-testid={`item-balance-${i}`}
                            className="num"
                            style={{ background: balance === 0 && woQty > 0 ? "#dcfce7" : "#f0f9ff", fontWeight: 700 }} />
                        </td>
                        <td>
                          <input value={amount.toFixed(2)} readOnly
                            data-testid={`item-amount-${i}`} className="num" />
                        </td>
                        <td className="col-del">
                          <button className="btn-del-row" data-testid={`item-del-${i}`}
                            onClick={() => removeItem(r.id)} disabled={locked} title="Delete row">
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>Cumulative Totals →</td>
                    <td className="num" data-testid="total-wo-qty" style={{ fontWeight: 700 }}>{totals.woQty.toFixed(2)}</td>
                    <td></td>
                    <td className="num" data-testid="total-wo-value" style={{ fontWeight: 700 }} title="Total WO Value (WO Qty × WO Rate)">₹{totals.woValue.toFixed(2)}</td>
                    <td className="num" data-testid="total-billed-qty" style={{ fontWeight: 700 }}>{totals.billed.toFixed(2)}</td>
                    <td className="num" data-testid="total-balance-qty" style={{ fontWeight: 700, background: "#f0f9ff", color: "#0369a1" }}>{totals.balance.toFixed(2)}</td>
                    <td className="num" data-testid="items-subtotal" style={{ fontWeight: 700 }}>{itemsTotal.toFixed(2)}</td>
                    <td className="col-del">
                      <button className="btn-color btn-save" data-testid="btn-use-items-total"
                        onClick={useItemsSumAsBasic} disabled={locked}
                        style={{ padding: "5px 8px", fontSize: 10 }}
                        title="Use subtotal as Basic Amount below">
                        Use →
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* 3. BILL ENTRY */}
          <div className="section">
            <div className="sec-head">3. Bill Entry &amp; Payment Calculation</div>
            <div className="sec-body">
              <div className="row cols-4">
                <F label="Vendor Invoice / Bill No." req>
                  <input placeholder="Bill Number" {...bind("billNo")} />
                </F>
                <F label="Invoice Date">
                  <input type="date" {...bind("billDate")} />
                </F>
                <F label="Basic Amount (₹)" req>
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("basicAmount")} />
                </F>
                <F label="GST Slab">
                  <select {...bind("gstSlab")}>
                    {GST_SLABS.map((s) => <option key={s} value={s}>{s}%</option>)}
                  </select>
                </F>
              </div>
              <div className="row cols-4" style={{ marginTop: 10 }}>
                <F label={`GST Amount (${bill.gstSlab}% / Actual ₹)`}>
                  <input value={comp.gst.toFixed(2)} readOnly data-testid="calc-gst" />
                </F>
                <F label="Gross Bill Amount (₹)">
                  <input value={comp.gross.toFixed(2)} readOnly data-testid="calc-gross" />
                </F>
                <F label="TDS Rate">
                  <select {...bind("tdsRate")}>
                    {[0, 1, 2, 5, 10].map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </F>
                <F label={`TDS / Retention Deduction (${bill.tdsRate}%)`}>
                  <input value={comp.tds.toFixed(2)} readOnly data-testid="calc-tds" />
                </F>
              </div>
              <div className="row cols-2" style={{ marginTop: 10 }}>
                <F label="Other Deductions / Penalties (₹)">
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("otherDeductions")} />
                </F>
                <F label="Net Payable Amount (₹)">
                  <input className="pill-generated" value={comp.netPayable.toFixed(2)} readOnly data-testid="calc-net" />
                </F>
              </div>
              <div className="row cols-1" style={{ marginTop: 10 }}>
                <F label="Net Payable Amount (In Words)">
                  <input
                    className="pill-generated"
                    value={amountToWords(comp.netPayable)}
                    readOnly
                    data-testid="calc-net-words"
                    style={{ fontStyle: "italic", letterSpacing: ".2px" }}
                  />
                </F>
              </div>
            </div>
          </div>

          {/* 4. MULTI-STAGE APPROVAL */}
          <div className="section">
            <div className="sec-head">4. Multi-Stage Approval &amp; Verification</div>
            <div className="sec-body">
              <div className="row cols-4">
                <div className="substep">
                  <div className="substep-title">[STEP 1] MEASUREMENT &amp; SITE CHECK</div>
                  <F label="Site Incharge Name">
                    <input placeholder="Enter Name" {...bind("siteInchargeName")} />
                  </F>
                  <F label="Measurement Status" style={{ marginTop: 8 }}>
                    <select {...bind("measurementStatus")}>
                      {MEASUREMENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </F>
                </div>
                <div className="substep">
                  <div className="substep-title">[STEP 2] PURCHASE DEPT VERIFICATION</div>
                  <F label="Purchase Incharge Name">
                    <input placeholder="Enter Name" {...bind("purchaseInchargeName")} />
                  </F>
                  <F label="WO Rate Status" style={{ marginTop: 8 }}>
                    <select {...bind("woRateStatus")}>
                      {WO_RATE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </F>
                </div>
                <div className="substep">
                  <div className="substep-title">[STEP 3] ACCOUNTS &amp; TAX VERIFICATION</div>
                  <F label="Account Incharge Name">
                    <input placeholder="Enter Name" {...bind("accountInchargeName")} />
                  </F>
                  <F label="GST/TDS Check" style={{ marginTop: 8 }}>
                    <select {...bind("gstTdsCheck")}>
                      {GST_TDS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </F>
                </div>
                <div className="substep">
                  <div className="substep-title">[STEP 4] MANAGEMENT APPROVAL</div>
                  <F label="Approver Name">
                    <input placeholder="Enter Approver Name" {...bind("approverName")} />
                  </F>
                  <F label="Approval Status" style={{ marginTop: 8 }}>
                    <select {...bind("approvalStatus")}>
                      {APPROVAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </F>
                </div>
              </div>
            </div>
          </div>

          {/* 5. PAYMENT SCHEDULE */}
          <div className="section">
            <div className="sec-head">5. Step 5: Payment Schedule &amp; To-Do List Setup</div>
            <div className="sec-body">
              <div className="row cols-3">
                <F label="Scheduled Payment Due Date" req>
                  <input type="date" {...bind("scheduledDueDate")} />
                </F>
                <F label="Payment Priority Level">
                  <select {...bind("priorityLevel")}>
                    {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </F>
                <F label="Payment Mode / Account">
                  <select {...bind("paymentMode")}>
                    {PAY_MODES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </F>
              </div>
              <div className="row cols-2" style={{ marginTop: 10 }}>
                <F label="To-Do / Action Notes for Cashier/Accounts">
                  <input placeholder="e.g. Release 50% first, check original invoice attached" {...bind("todoNotes")} />
                </F>
                <F label="Final Payment Release Status">
                  <select {...bind("finalReleaseStatus")}>
                    {RELEASE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </F>
              </div>
            </div>
          </div>

          {/* Signatures - 4 columns */}
          <div className="signs cols-4">
            <div className="sig"><div className="title">Site Engineer</div></div>
            <div className="sig"><div className="title">Purchase Manager</div></div>
            <div className="sig"><div className="title">Account Manager</div></div>
            <div className="sig"><div className="title">Authorized Signatory</div></div>
          </div>

          {/* Bills Data Sheet — bottom of page, all bills listed */}
          {allBills.length > 0 && (
            <div className="section" data-testid="bills-data-sheet" style={{ marginTop: 14 }}>
              <div className="sec-head">Bills Data Sheet · Click to Load (⏳ Temp ID till Approval · ✓ Vendor Code + Bill No after)</div>
              <div className="sec-body">
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Bill Ref / Permanent No</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Vendor Code</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Vendor Name</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Bill No</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>Bill Date</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #cbd5e1" }}>Net Payable (₹)</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Status</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBills.map((b) => {
                      const isApp = b.step === 5;
                      const isActive = bill.id === b.id;
                      const c = computeBill(b);
                      return (
                        <tr key={b.id} data-testid={`bill-row-${b.id}`}
                          style={{ background: isActive ? "#eef4ff" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, color: isApp ? "#166534" : "#92400e" }}>
                            {isApp ? `✓ ${b.permanentBillNo}` : `⏳ ${b.refNo}`}
                          </td>
                          <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{b.vendorCode || "—"}</td>
                          <td style={{ padding: "5px 8px" }}>{b.vendorSnapshot?.firmName || "—"}</td>
                          <td style={{ padding: "5px 8px" }}>{b.billNo || "—"}</td>
                          <td style={{ padding: "5px 8px" }}>{b.billDate || "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>{c.netPayable.toFixed(2)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: isApp ? "#dcfce7" : "#fef3c7", color: isApp ? "#166534" : "#92400e", border: `1px solid ${isApp ? "#86efac" : "#fcd34d"}` }}>
                              {isApp ? "Approved" : BILL_STEP_LABEL[b.step] || `Step ${b.step}`}
                            </span>
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <button
                                onClick={() => loadBill(b)}
                                data-testid={`bill-load-${b.id}`}
                                style={{ padding: "3px 10px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                              >
                                Load
                              </button>
                              {isApp && (
                                <button
                                  onClick={() => {
                                    if (!window.confirm(`Reopen approved bill ${b.permanentBillNo}? This requires Re-Approval.`)) return;
                                    const history = Array.isArray(b.history) ? b.history : [];
                                    history.push({ action: "Reopened", from: "Approved", by: currentUser(), at: new Date().toISOString() });
                                    const next = { ...b, step: 4, revision: (b.revision || 0) + 1, reopenedAt: new Date().toISOString(), reopenedBy: currentUser(), history };
                                    const saved = upsertBill(next);
                                    setBill(saved); setLocked(false); setRefresh((n) => n + 1);
                                    toast.success(`${b.permanentBillNo} reopened (Rev ${next.revision}) · Awaiting Re-Approval`);
                                  }}
                                  data-testid={`bill-reopen-${b.id}`}
                                  style={{ padding: "3px 10px", fontSize: 10.5, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                                  title="Reopen for edit (requires Re-Approval)"
                                >
                                  Reopen
                                </button>
                              )}
                              {b.revision > 0 && (
                                <span
                                  data-testid={`bill-rev-${b.id}`}
                                  style={{ padding: "1px 6px", fontSize: 9, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 999, fontWeight: 700, alignSelf: "center" }}
                                  title={`Reopened ${b.revision} time(s)`}
                                >
                                  REV {b.revision}
                                </span>
                              )}
                            </div>
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
