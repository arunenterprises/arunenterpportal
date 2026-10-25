import { HardHat, FlaskConical, Tractor } from "lucide-react";
import { QC_TESTS, qcCalc } from "./qcNorms";

const n = (v) => Number(v) || 0;
const P = { k: "project", l: "Project / Site", type: "project", req: true };
const D = (k = "date", l = "Date") => ({ k, l, type: "date", req: true });
const YN = ["Yes", "Partial", "No"];

export const OPS = {
  dpr: {
    kind: "dpr", title: "Daily Progress Report (DPR)", color: "#b45309",
    fields: [P, D(), { k: "weather", l: "Weather", type: "select", options: ["Clear", "Cloudy", "Rain", "Extreme Heat", "Fog"] },
      { k: "activity", l: "Activity / Work Item", req: true, span: 2 }, { k: "qtyDone", l: "Qty Done Today", type: "number" }, { k: "unit", l: "Unit", type: "select", options: ["Cum", "Sqm", "Mtr", "Rmt", "Nos", "Kg", "MT", "Lot"] },
      { k: "labourSkilled", l: "Skilled Labour", type: "number" }, { k: "labourUnskilled", l: "Unskilled Labour", type: "number" }, { k: "labourTotal", l: "Total Labour (auto)", type: "number", ro: true },
      { k: "progressPct", l: "Project Progress %", type: "number" }, { k: "machinery", l: "Machinery Used", span: 2 },
      { k: "hindrance", l: "Issues / Hindrance", type: "textarea", span: 2 }, { k: "nextPlan", l: "Kal ka Plan", type: "textarea", span: 2 }],
    calc: (r) => ({ labourTotal: n(r.labourSkilled) + n(r.labourUnskilled) }),
    columns: ["docNo", "date", "project", "activity", "labourTotal", "progressPct"],
  },
  indent: {
    kind: "indent", title: "Material Indent & Issue", color: "#0f766e",
    fields: [P, D("date", "Indent Date"), D("requiredBy", "Required By"), { k: "priority", l: "Priority", type: "select", options: ["Normal", "Urgent", "Critical"] },
      { k: "material", l: "Material", req: true, span: 2 }, { k: "qty", l: "Required Qty", type: "number", req: true }, { k: "unit", l: "Unit", type: "select", options: ["Bags", "MT", "Kg", "Cum", "Nos", "Ltr", "Mtr", "Sqm"] },
      { k: "issuedQty", l: "Issued Qty", type: "number" }, { k: "balanceQty", l: "Balance (auto)", type: "number", ro: true }, { k: "storeKeeper", l: "Store Keeper" }, { k: "purpose", l: "Purpose / Location", span: 2 }],
    calc: (r) => ({ balanceQty: Math.max(0, n(r.qty) - n(r.issuedQty)) }),
    columns: ["docNo", "date", "project", "material", "qty", "issuedQty", "balanceQty", "priority"],
  },
  qc_test: {
    kind: "qc_test", title: "Material Lab Test Report", color: "#7c3aed",
    fields: [P, D("date", "Test Date"), { k: "material", l: "Material", type: "select", req: true, options: ["Cement", "Steel / TMT", "Aggregate", "Sand", "Concrete Cube", "Brick", "Soil", "Bitumen", "Other"] },
      { k: "sampleId", l: "Sample ID" }, { k: "lab", l: "Lab Name" }, { k: "testName", l: "Test Name (list se chunein)", req: true, listOf: (r) => (QC_TESTS[r.material] || []).map((t) => t.test) }, { k: "specified", l: "Specified Value (auto as per IS)" }, { k: "observed", l: "Observed Value" },
      { k: "result", l: "Result", type: "select", req: true, options: ["Pass", "Fail", "Retest"] }, { k: "remarks", l: "Remarks", type: "textarea", span: 3 }],
    calc: qcCalc,
    alert: (r) => (r.result === "Fail" ? "TEST FAILED" : ""),
    columns: ["docNo", "date", "project", "material", "testName", "result"],
  },
  safety_audit: {
    kind: "safety_audit", title: "Daily Site Safety Audit", color: "#dc2626",
    fields: [P, D("date", "Audit Date"), { k: "auditor", l: "Auditor", req: true }, { k: "ppe", l: "PPE (Helmet/Shoes/Vest)", type: "select", options: YN },
      { k: "scaffolding", l: "Scaffolding / Height Safety", type: "select", options: YN }, { k: "electrical", l: "Electrical Safety", type: "select", options: YN }, { k: "firstAid", l: "First Aid Box", type: "select", options: YN },
      { k: "toolbox", l: "Toolbox Talk Done", type: "select", options: ["Yes", "No"] }, { k: "incidents", l: "Incidents", type: "number" }, { k: "nearMiss", l: "Near Miss", type: "number" },
      { k: "score", l: "Safety Score (0-100)", type: "number", req: true }, { k: "observations", l: "Observations", type: "textarea", span: 2 }, { k: "action", l: "Action Required", type: "textarea", span: 2 }],
    alert: (r) => (n(r.incidents) > 0 ? "INCIDENT" : r.score !== "" && n(r.score) < 60 ? "LOW SCORE" : ""),
    columns: ["docNo", "date", "project", "auditor", "score", "incidents"],
  },
  machine: {
    kind: "machine", title: "Machinery Register & Allocation", color: "#a16207",
    fields: [{ k: "machineCode", l: "Machine Code", req: true }, { k: "name", l: "Machine Name", req: true }, { k: "type", l: "Type", type: "select", options: ["Excavator", "JCB / Backhoe", "Crane", "Roller", "Dumper / Tipper", "Transit Mixer", "Batching Plant", "DG Set", "Other"] },
      { k: "regNo", l: "Reg. / Serial No" }, { k: "ownership", l: "Ownership", type: "select", options: ["Owned", "Hired"] }, { k: "hireRate", l: "Hire Rate (₹/hr)", type: "number" },
      { ...P, l: "Allocated Project / Site" }, { k: "operator", l: "Operator" }, { k: "mstatus", l: "Machine Status", type: "select", options: ["Working", "Idle", "Breakdown", "Maintenance"] },
      { k: "dieselNorm", l: "Diesel Norm (Ltr / hr)", type: "number" }],
    columns: ["docNo", "machineCode", "name", "type", "project", "mstatus"],
  },
  machine_log: {
    kind: "machine_log", title: "Running Hours Log", color: "#ca8a04",
    fields: [D(), { k: "machineCode", l: "Machine Code", type: "machine", req: true }, P, { k: "operator", l: "Operator" },
      { k: "startHr", l: "Start Meter (hr)", type: "number" }, { k: "endHr", l: "End Meter (hr)", type: "number" }, { k: "runHours", l: "Running Hours (auto)", type: "number", ro: true }, { k: "work", l: "Work Done", span: 2 }],
    calc: (r) => ({ runHours: Math.max(0, +(n(r.endHr) - n(r.startHr)).toFixed(2)) }),
    columns: ["docNo", "date", "machineCode", "project", "runHours"],
  },
  diesel_log: {
    kind: "diesel_log", title: "Diesel Issue & Chori Tracking", color: "#9a3412",
    fields: [D(), { k: "machineCode", l: "Machine Code", type: "machine", req: true }, P, { k: "runHours", l: "Running Hours", type: "number", req: true },
      { k: "norm", l: "Norm (Ltr / hr)", type: "number", req: true }, { k: "issued", l: "Diesel Issued (Ltr)", type: "number", req: true }, { k: "expected", l: "Expected (auto)", type: "number", ro: true },
      { k: "excess", l: "Excess Ltr (auto)", type: "number", ro: true }, { k: "issuedBy", l: "Issued By" }, { k: "remarks", l: "Remarks", span: 2 }],
    calc: (r) => { const e = +(n(r.runHours) * n(r.norm)).toFixed(2); return { expected: e, excess: +(n(r.issued) - e).toFixed(2) }; },
    alert: (r) => (n(r.expected) > 0 && n(r.excess) > n(r.expected) * 0.1 ? "DIESEL CHORI SHAK" : ""),
    columns: ["docNo", "date", "machineCode", "runHours", "issued", "expected", "excess"],
  },
  booking: {
    kind: "booking", title: "Customer Booking", color: "#0891b2",
    fields: [{ k: "clientName", l: "Customer Name", req: true }, { k: "mobile", l: "Mobile" }, P, { k: "unitNo", l: "Unit / Plot No", req: true }, { k: "area", l: "Area (Sqft)", type: "number" },
      { k: "rate", l: "Rate (₹/Sqft)", type: "number" }, { k: "totalValue", l: "Total Value (auto)", type: "number", ro: true }, { k: "bookingAmount", l: "Booking Amount", type: "number" },
      D("bookingDate", "Booking Date"), { k: "plan", l: "Payment Plan", type: "select", options: ["Construction Linked", "Down Payment", "Time Linked", "Flexi"] }, { k: "broker", l: "Broker / Channel" }],
    calc: (r) => ({ totalValue: +(n(r.area) * n(r.rate)).toFixed(2) }),
    columns: ["docNo", "bookingDate", "clientName", "project", "unitNo", "totalValue"],
  },
  demand_letter: {
    kind: "demand_letter", title: "Demand Letter", color: "#2563eb",
    fields: [{ k: "clientName", l: "Customer / Client", req: true }, P, { k: "unitNo", l: "Unit / Work Ref" }, { k: "milestone", l: "Milestone / Stage", req: true, span: 2 },
      D("dueDate", "Due Date"), { k: "amount", l: "Amount (₹)", type: "number", req: true }, { k: "gstPct", l: "GST %", type: "select", options: ["0", "5", "12", "18"] },
      { k: "gst", l: "GST (auto)", type: "number", ro: true }, { k: "total", l: "Total (auto)", type: "number", ro: true }, { k: "sentOn", l: "Sent On", type: "date" }],
    calc: (r) => { const g = +(n(r.amount) * n(r.gstPct) / 100).toFixed(2); return { gst: g, total: +(n(r.amount) + g).toFixed(2) }; },
    columns: ["docNo", "dueDate", "clientName", "milestone", "total"],
  },
  tender: {
    kind: "tender", title: "Tenders (Govt / Private)", color: "#4f46e5",
    fields: [{ k: "tenderNo", l: "Tender / NIT No", req: true }, { k: "ttype", l: "Type", type: "select", options: ["Government", "Private"] }, { k: "authority", l: "Department / Authority", req: true },
      { k: "title", l: "Work Name", req: true, span: 3 }, { k: "estValue", l: "Estimated Value (₹)", type: "number" }, { k: "emd", l: "EMD (₹)", type: "number" },
      { k: "emdMode", l: "EMD Mode", type: "select", options: ["Online", "FDR", "BG", "DD", "Exempted"] }, D("submissionDate", "Submission Date"), { k: "openingDate", l: "Opening Date", type: "date" },
      { k: "ourQuote", l: "Our Quote (₹)", type: "number" }, { k: "result", l: "Result", type: "select", options: ["Pending", "Won", "Lost", "Cancelled"] }],
    columns: ["docNo", "tenderNo", "ttype", "authority", "estValue", "result"],
  },
  agreement: {
    kind: "agreement", title: "Legal Agreements", color: "#be185d",
    fields: [{ k: "atype", l: "Agreement Type", type: "select", req: true, options: ["Client Contract", "Sub-contract", "Lease / Rent", "NDA", "MOU", "Sale Agreement", "Other"] },
      { k: "party", l: "Party Name", req: true }, P, D("startDate", "Start Date"), { k: "endDate", l: "End Date", type: "date" }, { k: "value", l: "Value (₹)", type: "number" },
      { k: "stampDuty", l: "Stamp Duty (₹)", type: "number" }, { k: "registered", l: "Registered", type: "select", options: ["Yes", "No"] }, { k: "terms", l: "Key Terms", type: "textarea", span: 3 }],
    columns: ["docNo", "atype", "party", "project", "startDate", "endDate", "value"],
  },
  labour: {
    kind: "labour", title: "Labour Master", color: "#be185d",
    fields: [{ k: "name", l: "Labour Name", req: true }, { k: "trade", l: "Trade", type: "select", options: ["Mason", "Helper / Beldar", "Carpenter", "Bar Bender", "Electrician", "Plumber", "Painter", "Welder", "Operator", "Other"] },
      P, { k: "contractor", l: "Contractor / Thekedar" }, { k: "dailyWage", l: "Daily Wage (₹)", type: "number", req: true }, { k: "otRate", l: "OT Rate (₹/hr)", type: "number" },
      { k: "mobile", l: "Mobile" }, { k: "aadhaar", l: "Aadhaar No" }, { k: "lstatus", l: "Status", type: "select", options: ["Active", "Left"] }],
    columns: ["docNo", "name", "trade", "project", "dailyWage", "lstatus"],
  },
  labour_bill: {
    kind: "labour_bill", title: "Labour Wage Bill (Monthly)", color: "#9d174d",
    fields: [{ k: "month", l: "Month" }, P, { k: "labourCount", l: "Labour", type: "number" }, { k: "totalDays", l: "Man-days", type: "number" }, { k: "totalAmount", l: "Total Wages (₹)", type: "number" }],
    columns: ["docNo", "month", "project", "labourCount", "totalDays", "totalAmount"],
  },
};

export const DEPTS = {
  site: { title: "Project Management", sub: "Daily Progress Report (DPR) · Material Indent / Issue", icon: HardHat, gradient: "linear-gradient(135deg,#78350f 0%,#b45309 55%,#f59e0b 100%)", shadow: "180,83,9,.28", tabs: ["dpr", "indent"], projectsLink: true },
  qc: { title: "QC & Safety Management", sub: "Material Lab Test Reports · Daily Site Safety Audits", icon: FlaskConical, gradient: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 55%,#dc2626 100%)", shadow: "124,58,237,.28", tabs: ["qc_test", "safety_audit"] },
  plant: { title: "P & M Management", sub: "Machinery Allocation · Running Hours · Diesel Chori Tracking", icon: Tractor, gradient: "linear-gradient(135deg,#422006 0%,#a16207 55%,#9a3412 100%)", shadow: "161,98,7,.28", tabs: ["machine", "machine_log", "diesel_log"] },
};
