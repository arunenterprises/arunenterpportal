import { HardHat, FlaskConical, Tractor } from "lucide-react";
import { apiCoreConfig } from "../../lib/api";
import { QC_TESTS, qcCalc } from "./qcNorms";

const n = (v) => Number(v) || 0;
const P = { k: "project", l: "Project / Site", type: "project", req: true };
const D = (k = "date", l = "Date") => ({ k, l, type: "date", req: true });
const YN = ["Yes", "Partial", "No"];

// ---- Core Projects (CIVIL / OHE / PSI / P&M / E&M) ----
export const CORE_DISC = ["CIVIL", "OHE", "PSI", "P&M", "E&M", "HR & ADMIN", "LEGAL", "FINANCE"];
export const CORE_MODULES = {
  CIVIL: [["Earthwork", "Cum"], ["PCC", "Cum"], ["RCC", "Cum"], ["Brick / Block Work", "Cum"], ["Plaster", "Sqm"], ["Flooring / Tiling", "Sqm"], ["Platform / Road Work", "Sqm"], ["Drainage", "Rmt"], ["Building Finishing", "Sqm"]],
  OHE: [["Survey & Pegging", "Km"], ["Mast Foundation", "Nos"], ["Mast / Portal Erection", "Nos"], ["Bracket Assembly", "Nos"], ["Catenary Wiring", "Km"], ["Contact Wire", "Km"], ["Dropper Fixing", "Nos"], ["Earthing & Bonding", "Nos"], ["Testing & Commissioning", "Km"]],
  PSI: [["TSS / SP / SSP Civil Work", "%"], ["Power Transformer Erection", "Nos"], ["Circuit Breaker / Interrupter", "Nos"], ["Isolator & CT / PT", "Nos"], ["Control & Power Cabling", "Mtr"], ["Earth Mat", "Nos"], ["SCADA / RTU", "%"], ["Testing & Commissioning", "%"]],
  "P&M": [["Machinery Deployment", "Nos"], ["Running Hours", "Hrs"], ["Diesel Consumption", "Ltr"], ["Breakdown Repair", "Nos"], ["Preventive Maintenance", "Nos"], ["Hiring / Mobilisation", "Nos"]],
  "E&M": [["Internal Wiring", "Points"], ["Light Fittings", "Nos"], ["Fans & Fixtures", "Nos"], ["DB / Panel Installation", "Nos"], ["DG Set", "Nos"], ["Pump Sets", "Nos"], ["Fire Fighting System", "%"], ["HVAC", "TR"], ["Lift / Escalator", "Nos"]],
  "HR & ADMIN": [["Manpower Deployment", "Nos"], ["Recruitment / Joining", "Nos"], ["Labour Licence / Compliance", "%"], ["Site Camp / Accommodation", "%"], ["Vehicle / Office Admin", "Nos"], ["Training", "Nos"]],
  LEGAL: [["Agreement / Contract Vetting", "Nos"], ["Bank Guarantee / Security", "Nos"], ["Arbitration / Dispute", "Nos"], ["Legal Notice", "Nos"], ["Statutory Licences", "Nos"], ["Court Cases", "Nos"]],
  FINANCE: [["Fund Requirement / Planning", "₹"], ["Bill Realisation", "₹"], ["Vendor Payments", "₹"], ["GST / TDS Compliance", "%"], ["Bank Limits / BG", "₹"], ["Budget vs Actual", "%"]],
};
export const MEMBER_DISC = { "Member Civil": ["CIVIL"], "Member OHE": ["OHE"], "Member Electrical": ["PSI", "E&M"], "Member Procurement": ["P&M"], "Member HR & Admin": ["HR & ADMIN"], "Member Legal": ["LEGAL"], "Member Financial": ["FINANCE"] };
export const CORE_MEMBERS = Object.keys(MEMBER_DISC);
export const CORE_CUSTOM = {};
// Process forms a project can switch on in Projects Register
export const PROJECT_FORMS = ["dpr", "indent", "labour", "labour_bill", "machine_log", "diesel_log", "qc_test", "safety_audit", "demand_letter", "agreement"];
// Pull SuperAdmin-configured members / extra disciplines from server (mutates the shared lists in place)
export const loadCoreConfig = async () => {
  const cfg = await apiCoreConfig();
  Object.keys(MEMBER_DISC).forEach((k) => delete MEMBER_DISC[k]);
  Object.assign(MEMBER_DISC, cfg.members || {});
  CORE_MEMBERS.splice(0, CORE_MEMBERS.length, ...Object.keys(MEMBER_DISC));
  Object.assign(CORE_MODULES, cfg.modules || {});
  Object.keys(CORE_CUSTOM).forEach((k) => delete CORE_CUSTOM[k]);
  Object.assign(CORE_CUSTOM, cfg.modules || {});
  [...Object.values(MEMBER_DISC).flat(), ...Object.keys(CORE_MODULES)].forEach((d) => { if (!CORE_DISC.includes(d)) CORE_DISC.push(d); });
  return cfg;
};
const memberOf = (disc) => CORE_MEMBERS.find((m) => MEMBER_DISC[m].includes(disc)) || "";
const modList = (r) => (CORE_MODULES[r.discipline] || []).map((m) => m[0]);
const DISC = { k: "discipline", l: "Discipline", type: "select", req: true, options: CORE_DISC };
const CP = { k: "project", l: "Core Project", type: "coreproject", req: true, span: 2 };
const LVL = ["L1 · Site Engineer", "L2 · Core Member", "L3 · GM", "L4 · SuperAdmin"];
const daysSince = (d) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0);

export const OPS = {
  core_project: {
    kind: "core_project", title: "Core Projects Register", color: "#1d4ed8",
    fields: [DISC, { k: "name", l: "Core Project Name", req: true, span: 2 }, { k: "code", l: "Project Code" },
      { k: "client", l: "Client / Railway Zone" }, { k: "location", l: "Location / Section" }, { k: "kmFrom", l: "Km From" }, { k: "kmTo", l: "Km To" },
      { k: "loaNo", l: "LOA / Agreement No" }, { k: "value", l: "Contract Value (₹)", type: "number" }, D("startDate", "Start Date"), { k: "endDate", l: "Completion Date", type: "date" },
      { k: "member", l: "Core Member (auto)", ro: true }, { k: "engineer", l: "Site Engineer" }, { k: "pstatus", l: "Project Status", type: "select", options: ["Planned", "Running", "On Hold", "Completed"] },
      { k: "scope", l: "Scope of Work", type: "textarea", span: 3 }],
    calc: (r) => ({ member: memberOf(r.discipline) }),
    columns: ["docNo", "discipline", "name", "location", "value", "member", "pstatus"],
  },
  core_progress: {
    kind: "core_progress", title: "Core Working Form (Daily Progress)", color: "#0369a1",
    fields: [DISC, CP, D(), { k: "module", l: "Module / Activity", req: true, span: 2, listOf: modList }, { k: "unit", l: "Unit (auto)", ro: true },
      { k: "scopeQty", l: "Total Scope Qty", type: "number" }, { k: "prevQty", l: "Previous Cumulative Qty", type: "number" }, { k: "todayQty", l: "Aaj ka Qty", type: "number", req: true },
      { k: "cumQty", l: "Cumulative Qty (auto)", type: "number", ro: true }, { k: "progressPct", l: "Module Progress % (auto)", type: "number", ro: true },
      { k: "labour", l: "Labour / Staff", type: "number" }, { k: "blockHrs", l: "Block / Shutdown Hrs", type: "number" }, { k: "machinery", l: "Machinery / T&P Used", span: 2 },
      { k: "weather", l: "Weather", type: "select", options: ["Clear", "Cloudy", "Rain", "Extreme Heat", "Fog"] }, { k: "engineer", l: "Site Engineer" }, { k: "assignedTo", l: "Assign To (Employee email)", type: "user", span: 2 },
      { k: "hindrance", l: "Hindrance / Issue", type: "textarea", span: 2 }, { k: "remarks", l: "Remarks / Kal ka Plan", type: "textarea", span: 2 }],
    calc: (r) => {
      const cum = n(r.prevQty) + n(r.todayQty);
      return { unit: ((CORE_MODULES[r.discipline] || []).find((m) => m[0] === r.module) || [])[1] || r.unit || "", cumQty: cum, progressPct: n(r.scopeQty) > 0 ? Math.min(100, +((cum / n(r.scopeQty)) * 100).toFixed(1)) : "" };
    },
    alert: (r) => (String(r.hindrance || "").trim() ? "HINDRANCE" : ""),
    columns: ["docNo", "date", "discipline", "project", "module", "todayQty", "cumQty", "progressPct"],
  },
  core_escalation: {
    kind: "core_escalation", title: "Core Escalation Register", color: "#b91c1c",
    fields: [DISC, CP, { k: "module", l: "Module / Activity", listOf: modList }, D("date", "Raised On"), { k: "issue", l: "Issue / Problem", req: true, span: 2 },
      { k: "category", l: "Category", type: "select", options: ["Design / Drawing", "Material", "Manpower", "Machinery", "Block / Shutdown", "Payment", "Safety", "Client / Railway", "Other"] },
      { k: "priority", l: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"] }, { k: "level", l: "Current Level", type: "select", options: LVL },
      { k: "assignedTo", l: "Assign To (Employee email)", type: "user", span: 2 }, { k: "targetDate", l: "Target Date", type: "date" }, { k: "estatus", l: "Issue Status", type: "select", options: ["Open", "In Progress", "Resolved"] },
      { k: "daysOpen", l: "Days Open (auto)", type: "number", ro: true }, { k: "suggested", l: "Auto Escalate To", ro: true }, { k: "resolution", l: "Action / Resolution", type: "textarea", span: 2 }],
    calc: (r) => {
      const d = r.estatus === "Resolved" ? 0 : daysSince(r.date);
      return { daysOpen: d, suggested: d > 5 || r.priority === "Critical" ? LVL[2] : d > 2 || r.priority === "High" ? LVL[1] : LVL[0] };
    },
    alert: (r) => (r.estatus === "Resolved" ? "" : r.targetDate && r.targetDate < new Date().toISOString().slice(0, 10) ? "OVERDUE" : LVL.indexOf(r.suggested) > LVL.indexOf(r.level) ? "ESCALATE" : ""),
    columns: ["docNo", "date", "discipline", "project", "issue", "priority", "level", "estatus"],
  },
  dpr: {
    kind: "dpr", title: "Daily Progress Report (DPR)", color: "#b45309",
    fields: [P, D(), { k: "weather", l: "Weather", type: "select", options: ["Clear", "Cloudy", "Rain", "Extreme Heat", "Fog"] },
      { k: "activity", l: "Activity / Work Item", req: true, span: 2 }, { k: "qtyDone", l: "Qty Done Today", type: "number" }, { k: "unit", l: "Unit", type: "select", options: ["Cum", "Sqm", "Mtr", "Rmt", "Nos", "Kg", "MT", "Lot"] },
      { k: "labourSkilled", l: "Skilled Labour", type: "number" }, { k: "labourUnskilled", l: "Unskilled Labour", type: "number" }, { k: "labourTotal", l: "Total Labour (auto)", type: "number", ro: true },
      { k: "progressPct", l: "Project Progress %", type: "number" }, { k: "machinery", l: "Machinery Used", span: 2 },
      { k: "consumedMaterial", l: "Material Consumed (Stock)" }, { k: "consumedQty", l: "Consumed Qty", type: "number" },
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

const today = () => new Date().toISOString().slice(0, 10);
const dleft = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : "");
const DSC = (opts) => ({ k: "discipline", l: "Discipline", type: "select", req: true, options: opts });
const CPo = { ...CP, req: false };
const S = (k, l, options, req) => ({ k, l, type: "select", options, req });
const N = (k, l, req) => ({ k, l, type: "number", req });
const RO = (k, l, num = true) => ({ k, l, ro: true, ...(num ? { type: "number" } : {}) });
const GST = S("gstPct", "GST %", ["5", "12", "18", "28", "0"], true);
const OPS2 = {
  core_target: { title: "Project Target / Issue to GM or Site Manager", color: "#b45309",
    fields: [DSC(["CIVIL"]), CP, { k: "module", l: "Module / Activity", listOf: modList }, S("ttype", "Type", ["Target", "Pending Issue"], true), N("targetQty", "Target Qty"), { k: "targetDate", l: "Target Date", type: "date" },
      S("sendTo", "Send To", ["GM", "Site Manager"], true), { k: "assignedTo", l: "Assign To (email)", type: "user", span: 2 }, { k: "remarks", l: "Details", type: "textarea", span: 3 }],
    columns: ["docNo", "project", "ttype", "module", "targetQty", "targetDate", "sendTo"] },
  core_block: { title: "Railway Block Request (Power / Traffic)", color: "#1d4ed8",
    fields: [DSC(["OHE"]), CP, S("blockType", "Block Type", ["Power Block", "Traffic Block", "Power + Traffic"], true), D("date", "Block Date"), { k: "section", l: "Section / Yard", req: true }, { k: "kmFrom", l: "Km From" }, { k: "kmTo", l: "Km To" },
      { k: "fromTime", l: "From (HH:MM)" }, { k: "toTime", l: "To (HH:MM)" }, N("durationHrs", "Duration (hrs)"), { k: "railwayRef", l: "Railway Ref / Message No" }, S("bstatus", "Block Status", ["Requested", "Sanctioned", "Availed", "Cancelled"]), { k: "purpose", l: "Purpose / Work", type: "textarea", span: 3 }],
    alert: (r) => (r.bstatus === "Requested" && r.date && r.date < today() ? "OVERDUE" : ""), columns: ["docNo", "date", "project", "blockType", "section", "durationHrs", "bstatus"] },
  core_drum: { title: "Copper Wire Drum Utilisation (Store vs Site)", color: "#b45309",
    fields: [DSC(["OHE"]), CP, { k: "drumNo", l: "Drum No", req: true }, S("wireType", "Wire Type", ["Catenary Wire", "Contact Wire", "Dropper Wire", "Jumper Wire", "Earth Wire"], true), D("date", "Issue Date"),
      N("storeQty", "Issued from Store (Mtr)", true), N("siteConsumed", "Site Consumed (Mtr)"), N("wastage", "Wastage / Scrap (Mtr)"), RO("balance", "Balance (auto)"), RO("utilPct", "Utilisation % (auto)")],
    calc: (r) => ({ balance: +(n(r.storeQty) - n(r.siteConsumed) - n(r.wastage)).toFixed(2), utilPct: n(r.storeQty) ? +((n(r.siteConsumed) / n(r.storeQty)) * 100).toFixed(1) : 0 }),
    alert: (r) => (n(r.storeQty) && n(r.wastage) > n(r.storeQty) * 0.02 ? "WASTAGE > 2%" : n(r.balance) < 0 ? "OVER-CONSUMED" : ""), columns: ["docNo", "project", "drumNo", "wireType", "storeQty", "siteConsumed", "balance", "utilPct"] },
  core_substation: { title: "Sub-station Register (TSS / SP / SSP)", color: "#7c3aed",
    fields: [DSC(["PSI", "E&M"]), CPo, S("ssType", "Type", ["TSS", "SP", "SSP"], true), { k: "name", l: "Sub-station Name", req: true }, { k: "location", l: "Location" }, N("assetValue", "Asset Value (₹)"),
      S("sstatus", "Status", ["Active", "Under Construction", "Shutdown"]), { k: "lastInspection", l: "Last Safety Inspection", type: "date" }, { k: "nextInspection", l: "Next Inspection Due", type: "date" }, S("inspStatus", "Inspection", ["Pending", "Done"])],
    alert: (r) => (r.inspStatus !== "Done" && r.nextInspection && r.nextInspection < today() ? "INSPECTION OVERDUE" : ""), columns: ["docNo", "ssType", "name", "location", "assetValue", "sstatus", "inspStatus"] },
  core_equip_test: { title: "Equipment Testing Log", color: "#6d28d9",
    fields: [DSC(["PSI", "E&M"]), CPo, D("date", "Test Date"), S("equipment", "Equipment", ["Power Transformer", "Circuit Breaker", "Interrupter", "Isolator", "CT / PT", "Earth Pit", "Cable"], true), { k: "serialNo", l: "Serial / Tag No" },
      S("testType", "Test", ["Insulation Resistance (IR)", "Earth Resistance", "Tan Delta", "Contact Resistance", "Oil BDV"], true), { k: "measured", l: "Measured Value" }, { k: "limit", l: "Permissible Limit" }, S("result", "Result", ["Pass", "Fail"], true), { k: "testedBy", l: "Tested By" }],
    alert: (r) => (r.result === "Fail" ? "TEST FAILED" : ""), columns: ["docNo", "date", "equipment", "serialNo", "testType", "measured", "result"] },
  core_amc: { title: "Preventive Maintenance (AMC) Schedule", color: "#9333ea",
    fields: [DSC(["PSI", "E&M"]), { k: "asset", l: "Asset / Equipment", req: true }, { k: "location", l: "Sub-station / Location" }, S("frequency", "Frequency", ["Monthly", "Quarterly", "Half-Yearly", "Yearly"], true),
      { k: "lastDone", l: "Last Done", type: "date" }, D("nextDue", "Next Due"), { k: "vendor", l: "AMC Vendor" }, S("astatus", "Status", ["Scheduled", "Done"])],
    alert: (r) => (r.astatus !== "Done" && r.nextDue && r.nextDue < today() ? "OVERDUE" : ""), columns: ["docNo", "asset", "location", "frequency", "nextDue", "astatus"] },
  core_hr_ticket: { title: "HR Tickets", color: "#db2777",
    fields: [DSC(["HR & ADMIN"]), D("date", "Raised On"), { k: "site", l: "Site / Project" }, { k: "employee", l: "Employee" }, S("category", "Category", ["Attendance", "Salary", "Leave", "Accommodation", "Grievance", "Safety Kit", "Other"], true),
      { k: "issue", l: "Issue", req: true, span: 2 }, { k: "assignedTo", l: "Assign To (email)", type: "user" }, S("tstatus", "Ticket Status", ["Open", "In Progress", "Closed"])],
    columns: ["docNo", "date", "employee", "category", "issue", "tstatus"] },
  core_payroll_freeze: { title: "Monthly Payroll Freeze & Salary Release (→ Accounts Manager)", color: "#be185d",
    fields: [DSC(["HR & ADMIN"]), { k: "month", l: "Month (YYYY-MM)", req: true }, N("employees", "Employees", true), N("grossTotal", "Gross Total (₹)", true), N("deductions", "Deductions (₹)"), RO("netPayable", "Net Payable (auto)"), { k: "remarks", l: "Remarks", type: "textarea", span: 3 }],
    calc: (r) => ({ netPayable: +(n(r.grossTotal) - n(r.deductions)).toFixed(2) }), columns: ["docNo", "month", "employees", "grossTotal", "netPayable"] },
  core_bg: { title: "Bank Guarantee / PG Register", color: "#475569",
    fields: [DSC(["LEGAL"]), S("bgType", "Type", ["Performance BG", "Advance BG", "PG", "EMD BG", "Security Deposit"], true), { k: "bgNo", l: "BG / PG No", req: true }, { k: "bank", l: "Bank" }, N("amount", "Amount (₹)", true),
      { k: "projectName", l: "Project / Contract" }, { k: "beneficiary", l: "Beneficiary (Railway)" }, { k: "issueDate", l: "Issue Date", type: "date" }, D("expiryDate", "Expiry Date"), RO("daysLeft", "Days Left (auto)"), S("bgstatus", "Status", ["Active", "Released", "Invoked", "Expired"])],
    calc: (r) => ({ daysLeft: dleft(r.expiryDate) }), alert: (r) => (r.bgstatus === "Active" && dleft(r.expiryDate) !== "" && dleft(r.expiryDate) < 30 ? "EXPIRING < 30 DAYS" : ""),
    columns: ["docNo", "bgType", "bgNo", "bank", "amount", "expiryDate", "bgstatus"] },
  core_eot: { title: "Railway EOT (Time Extension) Tracker", color: "#334155",
    fields: [DSC(["LEGAL"]), { k: "projectName", l: "Project / Agreement", req: true }, { k: "eotNo", l: "EOT No" }, D("appliedOn", "Applied On"), { k: "originalDate", l: "Original Completion", type: "date" }, { k: "requestedDate", l: "Requested Date", type: "date" },
      RO("days", "Extension Days (auto)"), S("estatus2", "Status", ["Applied", "Under Review", "Granted", "Rejected"]), { k: "grantedDate", l: "Granted Upto", type: "date" }, { k: "reason", l: "Reason / Hindrance", type: "textarea", span: 3 }],
    calc: (r) => ({ days: r.originalDate && r.requestedDate ? Math.round((new Date(r.requestedDate) - new Date(r.originalDate)) / 86400000) : "" }), columns: ["docNo", "projectName", "appliedOn", "originalDate", "requestedDate", "days", "estatus2"] },
  core_claim: { title: "Legal / Arbitration Claims", color: "#64748b",
    fields: [DSC(["LEGAL"]), S("ctype", "Type", ["Arbitration", "Court Case", "Legal Notice", "Contract Claim"], true), { k: "claimNo", l: "Case / Claim No", req: true }, { k: "party", l: "Against / Party" }, N("claimAmount", "Claim Amount (₹)"),
      { k: "filedOn", l: "Filed On", type: "date" }, { k: "nextHearing", l: "Next Hearing", type: "date" }, S("cstatus", "Status", ["Open", "Hearing", "Award", "Closed"])],
    columns: ["docNo", "ctype", "claimNo", "party", "claimAmount", "nextHearing", "cstatus"] },
  core_ra_bill: { title: "Railway RA Bill & MB Reconciliation", color: "#0f766e",
    fields: [DSC(["FINANCE"]), { k: "projectName", l: "Project", req: true }, { k: "raNo", l: "RA Bill No", req: true }, { k: "mbNo", l: "MB No" }, D("billDate", "Bill Date"), N("claimed", "Claimed (₹)", true), N("passed", "Passed (₹)"),
      N("tds", "TDS (₹)"), N("sd", "SD / Retention (₹)"), N("otherDed", "Other Deductions (₹)"), RO("net", "Net Receivable (auto)"), N("received", "Received (₹)"), RO("outstanding", "Outstanding (auto)"), RO("diff", "Claimed − Passed (auto)")],
    calc: (r) => { const net = +(n(r.passed) - n(r.tds) - n(r.sd) - n(r.otherDed)).toFixed(2); return { net, outstanding: +(net - n(r.received)).toFixed(2), diff: +(n(r.claimed) - n(r.passed)).toFixed(2) }; },
    columns: ["docNo", "projectName", "raNo", "claimed", "passed", "net", "outstanding"] },
  proc_rfq: { title: "RFQ (Request for Quotation)", color: "#15803d",
    fields: [P, { k: "indentNo", l: "Indent No" }, D("date", "RFQ Date"), { k: "material", l: "Material", req: true, span: 2 }, N("qty", "Qty", true), { k: "unit", l: "Unit" }, { k: "dueDate", l: "Quote Due", type: "date" },
      { k: "vendors", l: "Vendors Invited", span: 2 }, S("rstatus", "RFQ Status", ["Floating", "Closed", "Cancelled"])],
    columns: ["docNo", "date", "project", "indentNo", "material", "qty", "rstatus"] },
  proc_po: { title: "Purchase Order (PO)", color: "#166534",
    fields: [P, D("date", "PO Date"), { k: "indentNo", l: "Indent No" }, { k: "csNo", l: "CS No" }, { k: "vendorCode", l: "Vendor Code", req: true }, { k: "vendorName", l: "Vendor Name" },
      { k: "material", l: "Material", req: true, span: 2 }, N("qty", "PO Qty", true), { k: "unit", l: "Unit" }, N("rate", "Rate (₹)", true), GST, RO("amount", "Basic (auto)"), RO("total", "PO Value incl. GST (auto)"), { k: "deliveryDate", l: "Delivery By", type: "date" }],
    calc: (r) => { const a = +(n(r.qty) * n(r.rate)).toFixed(2); return { amount: a, total: +(a * (1 + n(r.gstPct) / 100)).toFixed(2) }; },
    columns: ["docNo", "date", "project", "vendorCode", "material", "qty", "rate", "total"] },
  proc_grn: { title: "Store GRN (Goods Receipt Note)", color: "#0f766e",
    fields: [P, D("date", "Receipt Date"), { k: "poNo", l: "PO No", req: true }, RO("vendorCode", "Vendor (from PO)", false), RO("material", "Material (from PO)", false), RO("unit", "Unit", false),
      { k: "challanNo", l: "Vendor Challan No", req: true }, { k: "vehicleNo", l: "Vehicle / Dumper No", req: true }, N("receivedQty", "Received Qty", true), S("qcStatus", "Quality Status", ["Pass", "Fail", "Under Lab Test"], true),
      RO("acceptedQty", "Accepted Qty (auto)"), { k: "storeKeeper", l: "Store Keeper" }],
    calc: (r) => ({ acceptedQty: r.qcStatus === "Pass" ? n(r.receivedQty) : 0 }), alert: (r) => (r.qcStatus === "Fail" ? "QC FAIL" : r.qcStatus === "Under Lab Test" ? "UNDER TEST" : ""),
    columns: ["docNo", "date", "project", "poNo", "material", "challanNo", "receivedQty", "qcStatus"] },
  proc_invoice: { title: "3-Way Match Register (PO + GRN + Vendor Bill)", color: "#b91c1c",
    fields: [{ k: "poNo", l: "PO No", req: true }, { k: "grnNo", l: "GRN No", req: true }, { k: "vendorCode", l: "Vendor Code", req: true }, { k: "billNo", l: "Vendor Bill / Invoice No", req: true }, { k: "billDate", l: "Bill Date", type: "date" },
      N("invoiceQty", "Invoiced Qty", true), N("invoiceAmount", "Invoice Amount incl. GST (₹)", true), RO("expectedAmount", "PO × GRN Amount (server)"), RO("matchStatus", "Match Status (server)", false)],
    alert: (r) => (r.matchStatus && r.matchStatus !== "MATCHED" ? "LOCKED" : ""), columns: ["docNo", "poNo", "grnNo", "vendorCode", "billNo", "invoiceAmount", "matchStatus"] },
  stock_count: { title: "Daily Stock Register (Opening + GRN − DPR vs Physical)", color: "#9a3412",
    fields: [P, D("date", "Stock Date"), { k: "material", l: "Material", req: true }, { k: "unit", l: "Unit" }, N("openingStock", "Opening (blank = auto)"), N("physicalClosing", "Physical Closing", true),
      RO("grnQty", "GRN Qty (server)"), RO("consumedQty", "DPR Consumption (server)"), RO("bookClosing", "Book Closing (server)"), RO("variancePct", "Variance % (server)"), RO("fraudFlag", "Flag", false)],
    alert: (r) => (r.fraudFlag === "RED ALERT" ? "VARIANCE > 5%" : ""), columns: ["docNo", "date", "project", "material", "openingStock", "grnQty", "consumedQty", "physicalClosing", "variancePct"] },
};
Object.entries(OPS2).forEach(([k, v]) => { OPS[k] = { kind: k, ...v }; });

export const DEPTS = {
  site: { title: "Project Management", sub: "Projects Register · Project-wise Forms · DPR · Material Indent", icon: HardHat, gradient: "linear-gradient(135deg,#78350f 0%,#b45309 55%,#f59e0b 100%)", shadow: "180,83,9,.28", tabs: ["dpr", "indent"], projectsLink: true },
  qc: { title: "QC & Safety Management", sub: "Material Lab Test Reports · Daily Site Safety Audits", icon: FlaskConical, gradient: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 55%,#dc2626 100%)", shadow: "124,58,237,.28", tabs: ["qc_test", "safety_audit"] },
  plant: { title: "P & M Management", sub: "Machinery Allocation · Running Hours · Diesel Chori Tracking", icon: Tractor, gradient: "linear-gradient(135deg,#422006 0%,#a16207 55%,#9a3412 100%)", shadow: "161,98,7,.28", tabs: ["machine", "machine_log", "diesel_log"] },
};
