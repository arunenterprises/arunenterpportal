import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import { CheckCircle2, Search, Plus, X, FilePlus2, Save, Pencil, Send, Printer, Download, FileSearch, Wallet, Receipt, LogOut, IndianRupee, FileText } from "lucide-react";
import Header from "../components/Header";
import StepTabs from "../components/StepTabs";
import TopActionBar from "../components/TopActionBar";
import HomeNavBar from "../components/HomeNavBar";
import VendorQueryModal from "../components/VendorQueryModal";
import {
  createBillDraft, computeBill, upsertBill, findVendorByCode, advanceBillStep,
  BILL_STEP_LABEL, currentUser, exportJSON, findVendorByAny, amountToWords, getBills,
  canFinalApprove, currentUserEmail, APPROVER_EMAIL, APPROVER_NAME,
  getWOs, canCreate, canApprove,
  getPayBills, advancePayBillStep, PAYBILL_STATUS,
  getAdvanceRegister,
  getAdvanceRequests, advanceAdvanceRequestStep, rejectAdvanceRequest, ADVANCE_REQ_STATUS,
  getExits, advanceExitStep, EXIT_STATUS,
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
  const [activeView, setActiveView] = useState("vendor"); // vendor | advance | paybill | exit
  const [rev, setRev] = useState(0);
  const bumpRev = () => setRev((r) => r + 1);

  const allBills = useMemo(() => getBills(), [refresh, bill.id]);
  const loadBill = (b) => {
    // Normalize step in case it was serialised as string
    const normalized = { ...b, step: Number(b.step) || 1 };
    setBill(normalized);
    setLocked(normalized.step === 5);
    toast.success(`Loaded ${normalized.permanentBillNo || normalized.refNo}`);
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

  // ---- Vendor Invoice file upload (max 500 KB) ----
  const handleInvoiceFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500 * 1024) {
      toast.error(`File size ${Math.round(f.size / 1024)} KB exceeds 500 KB limit`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBill({ ...bill, invoiceFile: { name: f.name, size: f.size, type: f.type, dataUrl: reader.result } });
      toast.success(`Uploaded ${f.name} (${Math.round(f.size / 1024)} KB)`);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(f);
    e.target.value = "";
  };
  const removeInvoiceFile = () => {
    setBill({ ...bill, invoiceFile: null });
    toast.success("Invoice file removed");
  };

  // ---- Force-download any file stored as data URL ----
  const downloadDataUrl = (dataUrl, name) => {
    if (!dataUrl) { toast.error("No file to download"); return; }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${name}`);
  };

  const bind = (k, extra = {}) => ({
    value: bill[k] ?? "",
    onChange: (e) => setBill({ ...bill, [k]: e.target.value }),
    readOnly: locked,
    "data-testid": `field-${k}`,
    ...extra,
  });

  // Approved WOs list (memoised) — used both for datalist and lookup on WO No entry
  const approvedWOs = useMemo(
    () => getWOs().filter((w) => Number(w.step) >= 4 && (w.woNo || "").trim()),
    [refresh]
  );

  // When user types / picks a Work Order No, auto-fetch its full data set
  const fillFromWorkOrder = (woNoRaw) => {
    const norm = (woNoRaw || "").trim();
    if (!norm) return;
    const w = approvedWOs.find((x) => (x.woNo || "").trim() === norm);
    if (!w) return; // free-text ignored — let user type manually
    const v = w.vendorCode ? findVendorByCode(w.vendorCode) : null;
    setBill((prev) => ({
      ...prev,
      workOrderNo: w.woNo,
      workOrderDate: w.woDate || prev.workOrderDate,
      workOrderExpiryDate: w.expiryDate || prev.workOrderExpiryDate,
      totalWOValue: Number(w.total) || prev.totalWOValue,
      projectCodeLocation: w.projectSite || prev.projectCodeLocation,
      workScope: w.scopeOfWork || prev.workScope,
      vendorCode: v?.vendorCode || prev.vendorCode,
      vendorSnapshot: v || prev.vendorSnapshot,
      items: (w.items && w.items.length > 0)
        ? w.items.map((it) => ({
            id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            categoryScope: "Civil Work",
            description: it.description || "",
            hsn: "",
            woQty: Number(it.qty) || 0,
            unit: it.unit || "Nos",
            woRate: Number(it.rate) || 0,
            billedQty: 0,
          }))
        : prev.items,
    }));
    if (v?.vendorCode) setVendorInput(v.vendorCode);
    toast.success(`Auto-filled from ${w.woNo}${v ? ` · vendor ${v.vendorCode}` : ""}`);
  };

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
    // Coerce step (handles legacy bills where step got serialised as string)
    const step = Number(bill.step) || 1;
    // Treat as approved if step===5 OR permanent bill no was already issued
    const isApproved = step === 5 || !!bill.permanentBillNo;
    if (isApproved) {
      const label = bill.permanentBillNo || bill.refNo || "this bill";
      if (!window.confirm(`Reopen approved bill ${label} for editing? This requires Re-Approval.`)) return;
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
      setRefresh((n) => n + 1);
      toast.success(`${label} reopened (Rev ${next.revision}) · Awaiting Re-Approval`);
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
    if (bill.step >= 5) { toast.error("Already in Payment Due List"); return; }
    if (!validate()) return;
    // Re-Submit after reopen (record is at step 4 with revision > 0) — just save & log, awaiting Re-Approval
    if (bill.step === 4 && (bill.revision || 0) > 0) {
      const history = Array.isArray(bill.history) ? bill.history : [];
      history.push({ action: "Re-Submitted", by: currentUser(), at: new Date().toISOString() });
      const saved = upsertBill({ ...bill, history, submittedAt: new Date().toISOString() });
      setBill(saved);
      toast.success(`Re-Submitted (Rev ${bill.revision}) · Awaiting Re-Approval`);
      return;
    }
    if (bill.step === 4) { toast.info("Awaiting Final Approval — click Approve"); return; }
    const req = requiredForStep(bill.step);
    if (req && !String(bill[req.field] || "").trim()) {
      toast.error(`Enter '${req.label}' first`); return;
    }
    const next = advanceBillStep({ ...bill });
    setBill(next);
    toast.success(`Advanced to ${BILL_STEP_LABEL[next.step]}`);
  };

  const handleApprove = () => {
    const step = Number(bill.step) || 1;
    if (step === 5) { toast.info("Already in Payment Due List"); return; }
    if (step !== 4) { toast.error("Complete all approval steps first (use Submit)"); return; }
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
      <HomeNavBar />
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
          disabled={{ submit: bill.step >= 5, approve: bill.step !== 4 }}
        />
        <VendorQueryModal open={queryOpen} onClose={() => setQueryOpen(false)} initialCode={queryCode} variant="bill" />

        <div className="a4" data-testid="bill-page">
          <Header formTitle="ACCOUNTS DEPARTMENT" />

          {/* Accounts Department Top Switcher — Vendor Bills · Advance Reg · Pay Bills · Exit F&F */}
          <div style={{ display: "flex", gap: 6, borderBottom: "2px solid #e2e8f0", marginTop: 8, flexWrap: "wrap" }} data-testid="accounts-view-tabs">
            {[
              { id: "vendor", label: "Vendor Bills", tone: "#0369a1", icon: Receipt },
              { id: "advance", label: "Advance Reg.", tone: "#f59e0b", icon: Wallet },
              { id: "paybill", label: "Pay Bills Process", tone: "#be185d", icon: IndianRupee },
              { id: "exit", label: "Exit & F&F", tone: "#991b1b", icon: LogOut },
            ].map((t) => {
              const Icon = t.icon; const active = activeView === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`accounts-tab-${t.id}`}
                  onClick={() => { setActiveView(t.id); bumpRev(); }}
                  style={{
                    padding: "8px 16px", background: active ? t.tone : "transparent",
                    color: active ? "#fff" : "#334155", border: "none",
                    borderRadius: "6px 6px 0 0", cursor: "pointer",
                    fontWeight: 700, fontSize: 12, letterSpacing: .3,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          {activeView === "vendor" && (<>
          {/* View Switcher — Vendor Bills · HR Payroll · Employee Advance */}
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
                  <input
                    placeholder="Type or pick WO No…"
                    value={bill.workOrderNo ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBill({ ...bill, workOrderNo: val });
                      // If value matches an approved WO exactly (from datalist pick), auto-fetch
                      if (approvedWOs.some((w) => (w.woNo || "").trim() === val.trim())) {
                        fillFromWorkOrder(val);
                      }
                    }}
                    onBlur={(e) => fillFromWorkOrder(e.target.value)}
                    readOnly={locked}
                    list="wo-approved-list"
                    data-testid="field-workOrderNo"
                  />
                  <datalist id="wo-approved-list">
                    {approvedWOs.map((w) => (
                      <option key={w.id} value={w.woNo}>
                        {`${w.vendorName || w.vendorCode || ""} · ${w.projectSite || ""} · ₹${Number(w.total || 0).toLocaleString("en-IN")}`}
                      </option>
                    ))}
                  </datalist>
                </F>
                <F label="Work Order Date">
                  <input type="date" {...bind("workOrderDate")} />
                </F>
                <F label="Work Order Expiry Date">
                  <input type="date"
                    {...bind("workOrderExpiryDate")}
                    min={bill.workOrderDate || undefined}
                    data-testid="field-workOrderExpiryDate"
                  />
                </F>
                <F label="Work Order Status (auto)">
                  {(() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const exp = bill.workOrderExpiryDate;
                    let label = "— (No Expiry Set)";
                    let bg = "#f1f5f9", fg = "#475569", border = "#cbd5e1";
                    if (exp) {
                      const daysLeft = Math.floor((new Date(exp) - new Date(today)) / 86400000);
                      if (daysLeft < 0) { label = `EXPIRED (${Math.abs(daysLeft)}d ago)`; bg = "#fee2e2"; fg = "#991b1b"; border = "#fca5a5"; }
                      else if (daysLeft === 0) { label = "EXPIRES TODAY"; bg = "#fef3c7"; fg = "#92400e"; border = "#fcd34d"; }
                      else if (daysLeft <= 30) { label = `Expiring in ${daysLeft}d`; bg = "#fef3c7"; fg = "#92400e"; border = "#fcd34d"; }
                      else { label = `All OK ✓ (${daysLeft}d left)`; bg = "#dcfce7"; fg = "#166534"; border = "#86efac"; }
                    }
                    return (
                      <input
                        readOnly
                        value={label}
                        data-testid="wo-status"
                        title={exp ? `Work Order valid till ${exp}` : "Set Work Order Expiry Date to compute status"}
                        style={{ background: bg, color: fg, borderColor: border, fontWeight: 700, letterSpacing: ".3px", textAlign: "center" }}
                      />
                    );
                  })()}
                </F>
              </div>
              <div className="row cols-4" style={{ marginTop: 10 }}>
                <F label="Total Work Order Value (₹)">
                  <input type="number" step="0.01" min="0" placeholder="0.00" {...bind("totalWOValue")} />
                </F>
                <F label="Project Code &amp; Location">
                  <input placeholder="Project Code / Site Name" {...bind("projectCodeLocation")} />
                </F>
                <F label="Work Scope / Description">
                  <input placeholder="Description of executed work" {...bind("workScope")} />
                </F>
                <F label="Previous Bill & Amount (info only)">
                  <input type="text" placeholder="e.g. BILL0003/2526 - ₹50,000" {...bind("previousAdvance")} />
                </F>
              </div>
              <div className="row" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr", gap: "8px 12px" }}>
                <F label="Item Summary">
                  <input placeholder="Item / Service description (multi-word ok)" {...bind("itemDescription")} />
                </F>
                <F label="Quantity (Summary)">
                  <input type="number" step="0.01" min="0" placeholder="0" {...bind("quantity")} />
                </F>
                <F label="UOM (Unit of Measure)">
                  <select {...bind("uom")}>
                    {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </F>
                <F label="Work Order Copy (PDF / Image · Max 300 KB)">
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {!bill.workOrderFile ? (
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={handleWoFile}
                        disabled={locked}
                        data-testid="wo-file-input"
                        style={{ flex: 1, padding: "4px 6px", fontSize: 10.5, border: "1px solid #cfd8e3", borderRadius: 4, background: "#fff", minWidth: 0 }}
                      />
                    ) : (
                      <>
                        <a href={bill.workOrderFile.dataUrl} target="_blank" rel="noreferrer"
                          data-testid="wo-file-link"
                          style={{ flex: 1, padding: "6px 10px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 4, fontWeight: 600, fontSize: 11, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
                          title={`${bill.workOrderFile.name} · ${Math.round(bill.workOrderFile.size / 1024)}KB`}>
                          📎 {bill.workOrderFile.name}
                        </a>
                        <button
                          type="button"
                          onClick={() => downloadDataUrl(bill.workOrderFile.dataUrl, bill.workOrderFile.name)}
                          data-testid="wo-file-download"
                          title="Download Work Order"
                          style={{ padding: "5px 10px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 700, flex: "0 0 auto" }}
                        >
                          ⬇ Download
                        </button>
                        {!locked && (
                          <button type="button" onClick={removeWoFile} data-testid="wo-file-remove"
                            style={{ padding: "5px 10px", fontSize: 10.5, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600, flex: "0 0 auto" }}>
                            Remove
                          </button>
                        )}
                      </>
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
                    <th style={{ minWidth: 220, textAlign: "center" }}>Item Description</th>
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
                            style={{ textAlign: "center" }} />
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
                    {GST_SLABS.map((s) => <option key={s} value={s}>{`${s}%`}</option>)}
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
                    {[0, 1, 2, 5, 10].map((r) => <option key={r} value={r}>{`${r}%`}</option>)}
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
              <div className="row cols-1" style={{ marginTop: 10 }}>
                <F label="Vendor Bill / Invoice Copy (PDF / Image · Max 500 KB)">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {!bill.invoiceFile ? (
                      <label
                        data-testid="invoice-file-label"
                        style={{
                          flex: 1,
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 14px",
                          background: "#fffbeb",
                          border: "1.5px dashed #fbbf24",
                          borderRadius: 6,
                          cursor: locked ? "not-allowed" : "pointer",
                          opacity: locked ? 0.55 : 1,
                          fontWeight: 600, fontSize: 12, color: "#78350f",
                          letterSpacing: .3,
                          minWidth: 0,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>🧾</span>
                        <span style={{ flex: 1 }}>Click to attach Vendor Invoice (PDF / Image · Max 500 KB)</span>
                        <span style={{ padding: "4px 10px", background: "#f59e0b", color: "#fff", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Choose file</span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleInvoiceFile}
                          disabled={locked}
                          data-testid="invoice-file-input"
                          style={{ display: "none" }}
                        />
                      </label>
                    ) : (
                      <>
                        <a
                          href={bill.invoiceFile.dataUrl} target="_blank" rel="noreferrer"
                          data-testid="invoice-file-link"
                          style={{ flex: 1, padding: "10px 14px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 6, fontWeight: 700, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}
                          title={`${bill.invoiceFile.name} · ${Math.round(bill.invoiceFile.size / 1024)}KB`}
                        >
                          <span style={{ fontSize: 16 }}>🧾</span>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{bill.invoiceFile.name}</span>
                          <span style={{ fontSize: 10, color: "#a16207", fontWeight: 500 }}>{Math.round(bill.invoiceFile.size / 1024)} KB</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => downloadDataUrl(bill.invoiceFile.dataUrl, bill.invoiceFile.name)}
                          data-testid="invoice-file-download"
                          title="Download Invoice"
                          style={{ padding: "8px 14px", fontSize: 11, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 5, cursor: "pointer", fontWeight: 700, flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          ⬇ Download
                        </button>
                        {!locked && (
                          <button
                            type="button"
                            onClick={removeInvoiceFile}
                            data-testid="invoice-file-remove"
                            style={{ padding: "8px 12px", fontSize: 11, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 5, cursor: "pointer", fontWeight: 700, flex: "0 0 auto" }}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
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
                      const bStep = Number(b.step) || 1;
                      const isApp = bStep === 5 || !!b.permanentBillNo;
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
                                    const label = b.permanentBillNo || b.refNo;
                                    if (!window.confirm(`Reopen approved bill ${label}? This requires Re-Approval.`)) return;
                                    const history = Array.isArray(b.history) ? b.history : [];
                                    history.push({ action: "Reopened", from: "Approved", by: currentUser(), at: new Date().toISOString() });
                                    const next = { ...b, step: 4, revision: (b.revision || 0) + 1, reopenedAt: new Date().toISOString(), reopenedBy: currentUser(), history };
                                    const saved = upsertBill(next);
                                    setBill({ ...saved, step: Number(saved.step) || 4 });
                                    setLocked(false); setRefresh((n) => n + 1);
                                    toast.success(`${label} reopened (Rev ${next.revision}) · Awaiting Re-Approval`);
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

          {/* Inline Action Buttons — uniform left-to-right alignment */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-start", alignItems: "stretch", gap: 6, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }} data-testid="bill-action-row">
            <button data-testid="bill-btn-query" onClick={() => openQuery()} style={{ padding: "7px 12px", height: 32, background: "#0891b2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><FileSearch size={13} /> Vendor Query</button>
            <button data-testid="bill-btn-new" onClick={handleNew} disabled={!canCreate()} style={{ padding: "7px 12px", height: 32, background: canCreate() ? "#0369a1" : "#94a3b8", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><FilePlus2 size={13} /> New Bill</button>
            <button data-testid="bill-btn-edit" onClick={handleEdit} disabled={!canCreate() || bill.step >= 5} style={{ padding: "7px 12px", height: 32, background: bill.step >= 5 ? "#94a3b8" : "#eab308", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() && bill.step < 5 ? "pointer" : "not-allowed", opacity: canCreate() && bill.step < 5 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><Pencil size={13} /> Edit</button>
            <button data-testid="bill-btn-save" onClick={handleSave} disabled={!canCreate() || bill.step >= 5} style={{ padding: "7px 12px", height: 32, background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() && bill.step < 5 ? "pointer" : "not-allowed", opacity: canCreate() && bill.step < 5 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><Save size={13} /> Save Bill</button>
            <button data-testid="bill-btn-submit" onClick={handleSubmit} disabled={!canCreate() || bill.step >= 5} style={{ padding: "7px 12px", height: 32, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: canCreate() && bill.step < 5 ? "pointer" : "not-allowed", opacity: canCreate() && bill.step < 5 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><Send size={13} /> Submit</button>
            <button data-testid="bill-btn-approve" onClick={handleApprove} disabled={!canApprove() || bill.step !== 4} style={{ padding: "7px 12px", height: 32, background: canApprove() && bill.step === 4 ? "#dc2626" : "#94a3b8", color: "#fff", border: "none", borderRadius: 5, cursor: canApprove() && bill.step === 4 ? "pointer" : "not-allowed", opacity: canApprove() && bill.step === 4 ? 1 : .5, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1 }}><CheckCircle2 size={13} /> Final Approval</button>
            <span style={{ width: 1, height: 24, background: "#cbd5e1", margin: "4px 6px", alignSelf: "center" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 1, textTransform: "uppercase", padding: "7px 12px", height: 32, background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", borderRadius: 5, boxShadow: "0 1px 3px rgba(79,70,229,.35)", display: "inline-flex", alignItems: "center", lineHeight: 1, boxSizing: "border-box" }}>Export</span>
            <button data-testid="bill-btn-export-json" onClick={handleExportJSON} style={{ padding: "7px 12px", height: 32, background: "#2563eb", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(37,99,235,.3)", lineHeight: 1 }}><Download size={13} /> JSON</button>
            <button data-testid="bill-btn-export-excel" onClick={handleExportExcel} style={{ padding: "7px 12px", height: 32, background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(5,150,105,.3)", lineHeight: 1 }}>⬇ Excel</button>
            <button data-testid="bill-btn-print" onClick={handlePrint} style={{ padding: "7px 12px", height: 32, background: "#ea580c", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(234,88,12,.3)", lineHeight: 1 }}><Printer size={13} /> Print</button>
          </div>
          </>)}

          {activeView === "advance" && <AccountsAdvanceView rev={rev} bumpRev={bumpRev} />}
          {activeView === "paybill" && <AccountsPayBillView rev={rev} bumpRev={bumpRev} />}
          {activeView === "exit" && <AccountsExitView rev={rev} bumpRev={bumpRev} />}
        </div>
      </div>
    </>
  );
}

// ===================== Accounts · Advance Register Approval Queue =====================
const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
const statusTone = { 1: "#64748b", 2: "#f59e0b", 3: "#0369a1", 4: "#16a34a", 5: "#dc2626" };

const AccountsAdvanceView = ({ rev, bumpRev }) => {
  const reqs = useMemo(() => getAdvanceRequests(), [rev]);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const pending = reqs.filter((r) => Number(r.status) === 2);
  const approved = reqs.filter((r) => Number(r.status) === 3);
  const paid = reqs.filter((r) => Number(r.status) === 4);
  const totalPending = pending.reduce((a, r) => a + Number(r.amount || 0), 0);

  const approveNow = (r) => {
    if (!canApprove()) return toast.error("Only Admin / SuperAdmin can approve");
    const n = advanceAdvanceRequestStep(r); bumpRev();
    toast.success(`Accounts approved · ${n.refNo} · Ready to disburse`);
  };
  const payNow = (r) => {
    if (!canApprove()) return toast.error("Only Admin / SuperAdmin can disburse");
    const n = advanceAdvanceRequestStep(r); bumpRev();
    toast.success(`Paid · Payment Voucher ${n.linkedPvNo} generated`);
  };
  const doReject = (r) => {
    if (!canApprove()) return toast.error("Only Admin / SuperAdmin can reject");
    if (!rejectReason.trim()) return toast.error("Enter rejection reason");
    rejectAdvanceRequest(r, rejectReason);
    setRejectingId(null); setRejectReason(""); bumpRev();
    toast.success("Request rejected");
  };

  return (
    <div data-testid="accounts-advance-view">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
        <KpiBox label="Pending Approval" value={pending.length} tone="#f59e0b" sub={`₹ ${inrN(totalPending)}`} />
        <KpiBox label="Approved · To Pay" value={approved.length} tone="#0369a1" />
        <KpiBox label="Paid · PV Generated" value={paid.length} tone="#16a34a" />
        <KpiBox label="Total Requests" value={reqs.length} tone="#334155" />
      </div>

      <AdvanceSection title={`Pending Accounts Approval (${pending.length})`} rows={pending} tone="#f59e0b"
        testid="adv-pending" renderActions={(r, i) => (
          <>
            {canApprove() && <button data-testid={`adv-approve-${i}`} onClick={() => approveNow(r)} style={btnSm("#0369a1")}>Approve</button>}
            {canApprove() && <button data-testid={`adv-reject-${i}`} onClick={() => setRejectingId(r.id)} style={btnSm("#dc2626")}>Reject</button>}
            {rejectingId === r.id && (
              <div style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
                <input autoFocus placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ padding: "3px 6px", fontSize: 10, border: "1px solid #cbd5e1", borderRadius: 3, width: 120 }} data-testid={`adv-reject-reason-${i}`} />
                <button onClick={() => doReject(r)} style={btnSm("#dc2626")}>OK</button>
                <button onClick={() => { setRejectingId(null); setRejectReason(""); }} style={btnSm("#64748b")}>X</button>
              </div>
            )}
          </>
        )}
      />

      <AdvanceSection title={`Approved · Ready to Pay (${approved.length})`} rows={approved} tone="#0369a1"
        testid="adv-approved" renderActions={(r, i) => (
          canApprove() ? <button data-testid={`adv-pay-${i}`} onClick={() => payNow(r)} style={btnSm("#16a34a")}>Generate PV & Pay</button> : null
        )}
      />

      <AdvanceSection title={`Paid · Payment Vouchers Generated (${paid.length})`} rows={paid} tone="#16a34a"
        testid="adv-paid" renderActions={(r) => <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>{r.linkedPvNo}</span>}
      />
    </div>
  );
};

const AdvanceSection = ({ title, rows, tone, testid, renderActions }) => (
  <div className="section" data-testid={testid} style={{ marginTop: 12 }}>
    <div className="sec-head" style={{ background: tone, color: "#fff" }}>{title}</div>
    <div className="sec-body" style={{ padding: 0 }}>
      {rows.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No records</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Ref No", "Date", "Employee", "Amount", "Repayment", "Reason", "Status", "Action"].map((h) => <th key={h} style={{ padding: 7, border: "1px solid #e2e8f0", fontSize: 10, textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} data-testid={`${testid}-row-${i}`} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 10 }}>{r.refNo}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10 }}>{r.requestDate}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><b>{r.empCode}</b> · {r.empName}<div style={{ fontSize: 9, color: "#64748b" }}>{r.department || "—"}</div></td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800, color: "#78350f" }}>₹ {inrN(r.amount)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10 }}>{r.repaymentMode}{r.repaymentMode === "EMI" ? ` · ${r.emiMonths}m` : ""}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10, color: "#475569" }}>{r.reason || "—"}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><span style={{ background: statusTone[r.status] || "#64748b", color: "#fff", padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{ADVANCE_REQ_STATUS[r.status]}</span></td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{renderActions(r, i)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

// ===================== Accounts · Pay Bills Approval Queue =====================
const AccountsPayBillView = ({ rev, bumpRev }) => {
  const bills = useMemo(() => getPayBills(), [rev]);
  const submitted = bills.filter((b) => Number(b.step) === 2);
  const gmApproved = bills.filter((b) => Number(b.step) === 3);
  const settled = bills.filter((b) => Number(b.step) === 4);

  const gmApprove = (b) => {
    if (!canApprove()) return toast.error("Only Admin / SuperAdmin / Accounts");
    const n = advancePayBillStep(b); bumpRev();
    toast.success(`GM approved · ${n.refNo}`);
  };
  const settle = (b) => {
    if (!canApprove()) return toast.error("Only Admin / SuperAdmin / Accounts");
    if (!window.confirm(`Settle Pay Bill ${b.refNo}? A Payment Voucher of ₹ ${inrN(b.totalNet)} will be auto-generated.`)) return;
    const n = advancePayBillStep(b); bumpRev();
    toast.success(`Pay Bill settled · PV ${n.linkedPvNo}`);
  };

  return (
    <div data-testid="accounts-paybill-view">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
        <KpiBox label="Submitted to GM" value={submitted.length} tone="#f59e0b" />
        <KpiBox label="GM Approved · To Settle" value={gmApproved.length} tone="#0369a1" />
        <KpiBox label="Settled · PV Done" value={settled.length} tone="#16a34a" />
        <KpiBox label="Total Pay Bills" value={bills.length} tone="#334155" />
      </div>

      <PayBillSection title={`Submitted · Awaiting GM Approval (${submitted.length})`} rows={submitted} tone="#f59e0b" testid="pb-submitted"
        renderActions={(b, i) => canApprove() ? <button data-testid={`pb-gm-${i}`} onClick={() => gmApprove(b)} style={btnSm("#0369a1")}>GM Approve</button> : null} />
      <PayBillSection title={`GM Approved · Ready for Accounts Settlement (${gmApproved.length})`} rows={gmApproved} tone="#0369a1" testid="pb-approved"
        renderActions={(b, i) => canApprove() ? <button data-testid={`pb-settle-${i}`} onClick={() => settle(b)} style={btnSm("#16a34a")}>Settle & Generate PV</button> : null} />
      <PayBillSection title={`Settled · Payment Vouchers Generated (${settled.length})`} rows={settled} tone="#16a34a" testid="pb-settled"
        renderActions={(b) => <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>{b.linkedPvNo}</span>} />
    </div>
  );
};

const PayBillSection = ({ title, rows, tone, testid, renderActions }) => (
  <div className="section" data-testid={testid} style={{ marginTop: 12 }}>
    <div className="sec-head" style={{ background: tone, color: "#fff" }}>{title}</div>
    <div className="sec-body" style={{ padding: 0 }}>
      {rows.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No records</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Ref No", "Period", "Employees", "Gross", "Deductions", "Advance", "Net Payable", "Status", "Action"].map((h) => <th key={h} style={{ padding: 7, border: "1px solid #e2e8f0", fontSize: 10, textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b.id} data-testid={`${testid}-row-${i}`} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 10 }}>{b.refNo}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10 }}>{new Date(b.year, (b.month || 1) - 1).toLocaleString("en", { month: "short" })} {b.year}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>{b.lines?.length || 0}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>₹ {inrN(b.totalGross)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", color: "#dc2626" }}>₹ {inrN(b.totalDeductions)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", color: "#78350f" }}>₹ {inrN(b.totalAdvance)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800, color: "#065f46", background: "#ecfdf5" }}>₹ {inrN(b.totalNet)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><span style={{ background: tone, color: "#fff", padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{PAYBILL_STATUS[b.step]}</span></td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{renderActions(b, i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

// ===================== Accounts · Exit & F&F Approval Queue =====================
const AccountsExitView = ({ rev, bumpRev }) => {
  const exits = useMemo(() => getExits(), [rev]);
  const pending = exits.filter((x) => Number(x.status) === 3); // GM Approved · Pending Accounts
  const settled = exits.filter((x) => Number(x.status) === 4);
  const drafts = exits.filter((x) => Number(x.status) < 3);
  const totalPending = pending.reduce((a, x) => a + Number(x.fnfNet || 0), 0);

  const settle = (x) => {
    if (!canApprove()) return toast.error("Only Admin / SuperAdmin / Accounts");
    if (!window.confirm(`Settle F&F for ${x.empName || x.empCode}? Payout ₹ ${inrN(x.fnfNet)} · A Payment Voucher will be auto-generated.`)) return;
    const n = advanceExitStep(x); bumpRev();
    toast.success(`F&F settled · PV ${n.linkedPvNo}`);
  };

  return (
    <div data-testid="accounts-exit-view">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
        <KpiBox label="Pending Accounts" value={pending.length} tone="#f59e0b" sub={`₹ ${inrN(totalPending)}`} />
        <KpiBox label="Settled · PV Done" value={settled.length} tone="#16a34a" />
        <KpiBox label="In HR (Draft/GM)" value={drafts.length} tone="#64748b" />
        <KpiBox label="Total Exits" value={exits.length} tone="#334155" />
      </div>

      <ExitSection title={`GM Approved · Pending Accounts Settlement (${pending.length})`} rows={pending} tone="#f59e0b" testid="exit-pending"
        renderActions={(x, i) => canApprove() ? <button data-testid={`exit-settle-${i}`} onClick={() => settle(x)} style={btnSm("#16a34a")}>Settle & Generate PV</button> : null} />
      <ExitSection title={`Settled · F&F Paid (${settled.length})`} rows={settled} tone="#16a34a" testid="exit-settled"
        renderActions={(x) => <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>{x.linkedPvNo}</span>} />
    </div>
  );
};

const ExitSection = ({ title, rows, tone, testid, renderActions }) => (
  <div className="section" data-testid={testid} style={{ marginTop: 12 }}>
    <div className="sec-head" style={{ background: tone, color: "#fff" }}>{title}</div>
    <div className="sec-body" style={{ padding: 0 }}>
      {rows.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No records</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Employee", "Resign Date", "LWD", "Dues", "Bonus", "Leave Enc.", "Gratuity", "Loan Ded.", "Notice Rec.", "F&F Net", "Status", "Action"].map((h) => <th key={h} style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10, textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.id} data-testid={`${testid}-row-${i}`} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><b>{x.empCode}</b> · {x.empName}<div style={{ fontSize: 9, color: "#64748b" }}>{x.department || "—"}</div></td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10 }}>{x.resignDate || "—"}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10 }}>{x.lastWorkingDay || "—"}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontSize: 10 }}>₹ {inrN(x.pendingDues)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontSize: 10 }}>₹ {inrN(x.bonusDue)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontSize: 10 }}>₹ {inrN(x.leaveEncash)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontSize: 10 }}>₹ {inrN(x.gratuity)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontSize: 10, color: "#dc2626" }}>₹ {inrN(x.loanDeduction)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontSize: 10, color: "#dc2626" }}>₹ {inrN(x.noticeRecovery)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800, color: "#065f46", background: "#ecfdf5" }}>₹ {inrN(x.fnfNet)}</td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><span style={{ background: tone, color: "#fff", padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{EXIT_STATUS[x.status]}</span></td>
                <td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{renderActions(x, i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

const KpiBox = ({ label, value, tone, sub }) => (
  <div style={{ padding: 12, background: "#fff", border: `1.5px solid ${tone}30`, borderLeft: `4px solid ${tone}`, borderRadius: 6 }}>
    <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: tone, marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, fontWeight: 700, color: "#78350f", marginTop: 2 }}>{sub}</div>}
  </div>
);

const btnSm = (bg) => ({ padding: "3px 8px", background: bg, color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 });
