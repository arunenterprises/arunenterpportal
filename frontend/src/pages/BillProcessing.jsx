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
  BILL_STEP_LABEL, currentUser, exportJSON, findVendorByAny,
} from "../lib/store";

const GST_SLABS = [0, 5, 12, 18, 28];
const UOMS = ["Nos", "Kg", "Mtr", "Sqm", "Cum", "Ton", "Ltr", "Lot", "Job"];
const CATEGORY_SCOPES = [
  "Civil Work", "Electrical Work", "Plumbing & Sanitary", "Steel & Fabrication",
  "Painting & Finishing", "Interior / Woodwork", "Material Supply",
  "Labour / Manpower", "Consulting / Design", "Other",
];
const ITEM_UNITS = ["Sft/MT", "Nos", "Kg", "Mtr", "Sqm", "Cum", "Ton", "Ltr", "Lot", "Job"];
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
      woQty: 0,
      unit: "Sft/MT",
      woRate: 0,
      billedQty: 0,
    }];
    setBill({ ...bill, items: list });
  };
  const updateItem = (id, patch) => {
    const list = items.map((r) => r.id === id ? { ...r, ...patch } : r);
    setBill({ ...bill, items: list });
  };
  const removeItem = (id) => {
    setBill({ ...bill, items: items.filter((r) => r.id !== id) });
  };
  const useItemsSumAsBasic = () => {
    setBill({ ...bill, basicAmount: +itemsTotal.toFixed(2) });
    toast.success(`Basic Amount set to ₹${itemsTotal.toFixed(2)}`);
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
    if (bill.step === 5) { toast.error("Approved bill cannot be edited"); return; }
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
    const next = advanceBillStep({ ...bill });
    setBill(next);
    setLocked(true);
    toast.success(`Final Approval · Added to Due List · Net ₹${comp.netPayable}`);
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
                <F label="Permanent Bill No (Primary Key)">
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
                  <label>Enter Vendor Code (Primary Key) <span className="req">*</span></label>
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
                <F label="Vendor / Firm Name">
                  <input value={vendor?.firmName || ""} readOnly data-testid="fetched-firmName" />
                </F>
                <F label="GST Number">
                  <input value={vendor?.gstNo || ""} readOnly data-testid="fetched-gst" />
                </F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="Mobile Number">
                  <input value={vendor?.mobileNo || ""} readOnly data-testid="fetched-mobile" />
                </F>
                <F label="Vendor Email ID">
                  <input value={vendor?.email || ""} readOnly />
                </F>
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
              <div className="row cols-3">
                <F label="Work Order No." req>
                  <input placeholder="WO Number" {...bind("workOrderNo")} />
                </F>
                <F label="Work Order Date">
                  <input type="date" {...bind("workOrderDate")} />
                </F>
                <F label="Project Code &amp; Location">
                  <input placeholder="Project Code / Site Name" {...bind("projectCodeLocation")} />
                </F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="Work Scope / Description">
                  <input placeholder="Description of executed work" {...bind("workScope")} />
                </F>
                <F label="Total Work Order Value (₹)">
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("totalWOValue")} />
                </F>
                <F label="Previous Advance / Paid Amount (₹)">
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("previousAdvance")} />
                </F>
              </div>
              <div className="row cols-3" style={{ marginTop: 10 }}>
                <F label="Item Description (Summary)">
                  <input placeholder="Item / Service" {...bind("itemDescription")} />
                </F>
                <F label="Quantity (Summary)">
                  <input type="number" step="0.01" min="0" placeholder="0" {...bind("quantity")} />
                </F>
                <F label="UOM (Unit of Measure)">
                  <select {...bind("uom")}>
                    {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
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
                    <th style={{ width: "18%" }}>Category Scope</th>
                    <th>Item Description</th>
                    <th style={{ width: "9%" }}>WO Qty</th>
                    <th style={{ width: "9%" }}>Unit</th>
                    <th style={{ width: "11%" }}>WO Rate (₹)</th>
                    <th style={{ width: "9%" }}>Billed Qty</th>
                    <th style={{ width: "11%" }}>Amount (₹)</th>
                    <th className="col-del">X</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => {
                    const amount = (Number(r.woRate) || 0) * (Number(r.billedQty) || 0);
                    return (
                      <tr key={r.id} data-testid={`item-row-${i}`}>
                        <td>
                          <select value={r.categoryScope}
                            onChange={(e) => updateItem(r.id, { categoryScope: e.target.value })}
                            disabled={locked} data-testid={`item-category-${i}`}>
                            {CATEGORY_SCOPES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <input placeholder="Work Item Name"
                            value={r.description}
                            onChange={(e) => updateItem(r.id, { description: e.target.value })}
                            readOnly={locked} data-testid={`item-desc-${i}`} />
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
                            readOnly={locked} data-testid={`item-billedQty-${i}`} className="num" />
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
                  <tr>
                    <td colSpan={6} style={{ textAlign: "right" }}>Items Subtotal (Basic Amount)</td>
                    <td className="num" data-testid="items-subtotal">{itemsTotal.toFixed(2)}</td>
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
                <F label={`GST Amount (${bill.gstSlab}% / Actual ₹)`}>
                  <input value={comp.gst.toFixed(2)} readOnly data-testid="calc-gst" />
                </F>
              </div>
              <div className="row cols-4" style={{ marginTop: 10 }}>
                <F label="GST Slab">
                  <select {...bind("gstSlab")}>
                    {GST_SLABS.map((s) => <option key={s} value={s}>{s}%</option>)}
                  </select>
                </F>
                <F label="Gross Bill Amount (₹)">
                  <input value={comp.gross.toFixed(2)} readOnly data-testid="calc-gross" />
                </F>
                <F label={`TDS / Retention Deduction (${bill.tdsRate}%)`}>
                  <input value={comp.tds.toFixed(2)} readOnly data-testid="calc-tds" />
                </F>
                <F label="Other Deductions / Penalties (₹)">
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("otherDeductions")} />
                </F>
              </div>
              <div className="row cols-4" style={{ marginTop: 10 }}>
                <F label="TDS Rate">
                  <select {...bind("tdsRate")}>
                    {[0, 1, 2, 5, 10].map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </F>
                <div className="field-b" style={{ gridColumn: "span 2" }}></div>
                <F label="Net Payable Amount (₹)">
                  <input className="pill-generated" value={comp.netPayable.toFixed(2)} readOnly data-testid="calc-net" />
                </F>
              </div>
            </div>
          </div>

          {/* 4. MULTI-STAGE APPROVAL */}
          <div className="section">
            <div className="sec-head">4. Multi-Stage Approval &amp; Verification</div>
            <div className="sec-body">
              <div className="row cols-2">
                <div className="substep">
                  <div className="substep-title">[STEP 1] MEASUREMENT &amp; SITE CHECK</div>
                  <div className="row cols-2">
                    <F label="Site Incharge Name">
                      <input placeholder="Enter Name" {...bind("siteInchargeName")} />
                    </F>
                    <F label="Measurement Status">
                      <select {...bind("measurementStatus")}>
                        {MEASUREMENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </F>
                  </div>
                </div>
                <div className="substep">
                  <div className="substep-title">[STEP 2] PURCHASE DEPT VERIFICATION</div>
                  <div className="row cols-2">
                    <F label="Purchase Incharge Name">
                      <input placeholder="Enter Name" {...bind("purchaseInchargeName")} />
                    </F>
                    <F label="WO Rate Status">
                      <select {...bind("woRateStatus")}>
                        {WO_RATE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </F>
                  </div>
                </div>
              </div>
              <div className="row cols-2" style={{ marginTop: 10 }}>
                <div className="substep">
                  <div className="substep-title">[STEP 3] ACCOUNTS &amp; TAX VERIFICATION</div>
                  <div className="row cols-2">
                    <F label="Account Incharge Name">
                      <input placeholder="Enter Name" {...bind("accountInchargeName")} />
                    </F>
                    <F label="GST/TDS Check">
                      <select {...bind("gstTdsCheck")}>
                        {GST_TDS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </F>
                  </div>
                </div>
                <div className="substep">
                  <div className="substep-title">[STEP 4] MANAGEMENT APPROVAL</div>
                  <div className="row cols-2">
                    <F label="Approver Name">
                      <input placeholder="Enter Approver Name" {...bind("approverName")} />
                    </F>
                    <F label="Approval Status">
                      <select {...bind("approvalStatus")}>
                        {APPROVAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </F>
                  </div>
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
        </div>
      </div>
    </>
  );
}
