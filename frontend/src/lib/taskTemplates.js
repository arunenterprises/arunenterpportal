// Default task templates per department (seniors pick one; title/description auto-fill)
export const TASK_TEMPLATES = {
  "Core Committee": ["Core Working Form update karein", "Core Escalation resolve karein", "Core Project progress review", "Weekly core meeting report"],
  "HR Management": ["Attendance update karein", "Joining documents verify karein", "Pay Bill / Salary sheet tayyar karein", "Leave application review", "Recruitment interview schedule"],
  "Finance Management": ["Vendor bill verification", "Payment voucher tayyar karein", "GST reconciliation", "TDS entry / challan", "Bank reconciliation"],
  "Procurement Management": ["Vendor registration verify karein", "BOQ tayyar karein", "Work Order draft karein", "Quotation / rate comparison", "Material PO follow-up"],
  "Project Management": ["DPR submit karein", "Material indent raise karein", "Site inspection", "Drawing / design check", "Client / Railway meeting"],
  "QC & Safety Management": ["Lab test conduct karein", "Safety audit", "Toolbox talk", "NCR close karein"],
  "P & M Management": ["Machine log update", "Diesel log entry", "Preventive maintenance", "Breakdown repair"],
  "Client & Revenue Management": ["Measurement Book entry", "RA Bill tayyar karein", "Tax Invoice raise karein", "Client payment follow-up"],
  "HR & Admin": ["Office administration", "Vehicle / asset management", "Housekeeping & stationery"],
  "Legal": ["Agreement / contract review", "Legal notice reply", "Court hearing follow-up"],
  "Financial": ["Fund planning", "Budget review", "Cash-flow statement"],
  "Reports Management": ["Monthly MIS report", "Department report print / share"],
};
export const TASK_DEPTS = Object.keys(TASK_TEMPLATES);
export const SENIOR = (role) => ["SuperAdmin", "GM", "Admin"].includes(role) || /^Member /.test(role || "");
