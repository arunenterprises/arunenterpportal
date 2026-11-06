// Default task library: ERP Module → Vertical / Work → [task, form path]
export const TASK_LIB = {
  "Core Committee": {
    "Member Civil": [["Core Project target set karein", "/core-dashboard"], ["Civil Working Form (DPR sync) update", "/core-dashboard"], ["Pending issue GM / Site Manager ko bhejein", "/core-dashboard"], ["Civil escalation resolve karein", "/core-dashboard"]],
    "Member OHE": [["Power / Traffic Block request bhejein", "/core-dashboard"], ["Copper wire drum utilisation entry", "/core-dashboard"], ["Km-wise foundation & wiring progress update", "/core-dashboard"], ["Critical delay escalation", "/core-dashboard"]],
    "Member Electrical": [["Equipment test (IR / Earth) log entry", "/core-dashboard"], ["AMC / preventive maintenance schedule", "/core-dashboard"], ["Sub-station safety inspection", "/core-dashboard"]],
    "Member Procurement": [["Pending indents ka RFQ float karein", "/purchase?tab=rfq"], ["Comparative Statement approve karein", "/purchase?tab=rfq"], ["PO authorize karein", "/purchase?tab=rfq"], ["Stock variance alert review", "/core-dashboard"]],
    "Member HR & Admin": [["Monthly payroll freeze & release", "/core-dashboard"], ["HR ticket close karein", "/core-dashboard"], ["Site manpower geo-attendance check", "/hr"]],
    "Member Legal": [["Bank Guarantee expiry follow-up", "/core-dashboard"], ["EOT application file karein", "/core-dashboard"], ["Legal / arbitration claim hearing", "/core-dashboard"]],
    "Member Financial": [["RA Bill / MB reconciliation", "/core-dashboard"], ["3-Way match (PO + GRN + Bill) verify", "/purchase?tab=billing"], ["Vendor payables review", "/final"]],
  },
  "1. GM Dashboard": {
    "Approvals": [["Pending approvals clear karein", "/gm"], ["₹30 lakh+ Discussion Window conclude", "/requisitions"]],
    "Review": [["Weekly project review meeting", "/gm"], ["Monthly MIS review", "/reports-hub"]],
  },
  "2. Client & Revenue Management": {
    "Client & Contracts": [["Client master update", "/client-revenue"], ["Work Order / contract entry", "/client-revenue"]],
    "Billing": [["Measurement Book entry", "/client-revenue"], ["RA Bill tayyar karein", "/client-revenue"], ["Abstract of item schedules", "/client-revenue"], ["Tax Invoice raise karein", "/client-revenue"]],
    "Collection": [["Client payment follow-up", "/client-revenue"], ["Receipt / UTR entry", "/client-revenue"]],
    "Tenders & Legal": [["Tender submission", "/client-revenue"], ["Agreement registration", "/client-revenue"]],
  },
  "3. HR Management": {
    "Employee Registration": [["Naya employee registration (photo + KYC)", "/hr"], ["Joining documents verify karein", "/hr"]],
    "Attendance": [["Monthly attendance update", "/hr"], ["Geo-attendance site check", "/hr"], ["Labour attendance entry", "/hr"]],
    "Payroll": [["Pay Bill tayyar karein", "/hr"], ["Payslip generate karein", "/hr"], ["Advance / loan deduction check", "/hr"]],
    "Recruitment & Exit": [["Recruitment interview schedule", "/hr"], ["Exit & F&F documentation", "/hr"]],
    "HR Letters": [["Offer / appointment letter issue", "/hr"]],
  },
  "4. Procurement Management": {
    "Vendor Registration": [["Vendor KYC (GST / PAN / Cheque) verify", "/purchase?tab=vendor"], ["Vendor approval follow-up", "/purchase?tab=vendor"]],
    "BOQ": [["Client Master BOQ tayyar karein", "/purchase"], ["Sub-contractor BOQ budget check", "/purchase"]],
    "Work Order": [["Work Order draft karein", "/purchase?tab=wo"], ["WO approval follow-up", "/purchase?tab=wo"]],
    "Vendor Bill": [["Vendor bill entry (3-way match)", "/purchase?tab=billing"], ["3-Way register update", "/purchase?tab=billing"]],
    "RFQ & CS": [["RFQ float karein", "/purchase?tab=rfq"], ["Comparative Statement banayein", "/purchase?tab=rfq"], ["L1 vendor ka PO generate", "/purchase?tab=rfq"]],
    "Store & GRN": [["GRN entry (challan + vehicle + QC)", "/purchase?tab=grn"], ["Daily stock register entry", "/purchase?tab=grn"]],
  },
  "5. Finance Management": {
    "Vendor Bill Process": [["Vendor bill verification", "/bill"], ["Accounts & tax verification (Step 3)", "/bill"]],
    "Expenses": [["Site / office expense entry", "/bill?view=expense"], ["Petty cash reconciliation", "/bill?view=expense"]],
    "Advance Reg.": [["Staff advance approve / pay", "/bill?view=advance"]],
    "Pay Bills Process": [["Salary settlement & bank advice", "/bill?view=paybill"], ["Salary UTR entry", "/bill?view=paybill"]],
    "Weekly Fooding": [["Weekly fooding entry", "/bill?view=fooding"]],
    "Exit & F&F": [["F&F settlement payment", "/bill?view=exit"]],
    "Payment Vouchers": [["Payment voucher tayyar karein", "/final"], ["UTR entry / FINAL PAID", "/final"], ["Monthly due list decision", "/final"]],
    "Tax & Bank": [["GST reconciliation", "/bill"], ["TDS challan", "/bill"], ["Bank reconciliation", "/final"]],
  },
  "6. Project Management": {
    "Projects Register": [["Project register / forms assign", "/project"]],
    "DPR": [["DPR submit karein (material consumption ke saath)", "/site"]],
    "Material Indent": [["Material indent raise karein", "/site"]],
    "Site Work": [["Site inspection", "/site"], ["Drawing / design check", "/site"], ["Client / Railway meeting", "/site"]],
  },
  "7. QC & Safety Management": {
    "QC Lab": [["Material lab test conduct karein", "/qc-safety"], ["Failed test ka retest", "/qc-safety"]],
    "Safety": [["Daily site safety audit", "/qc-safety"], ["Toolbox talk", "/qc-safety"], ["Incident / near-miss report", "/qc-safety"]],
  },
  "8. P & M Management": {
    "Machinery": [["Machine allocation update", "/plant"], ["Breakdown repair", "/plant"], ["Preventive maintenance", "/plant"]],
    "Logs": [["Running hours log", "/plant"], ["Diesel issue log", "/plant"]],
  },
  "9. Reports Management": {
    "Reports": [["Monthly MIS report", "/reports-hub"], ["Department report print / share", "/reports-hub"], ["Core Committee report", "/reports-hub"]],
  },
  "10. System Management": {
    "Users & Access": [["Naya user / role create", "/users"], ["Permissions review", "/users"]],
    "Backup": [["Nightly backup verify", "/users"]],
  },
};
export const TASK_DEPTS = Object.keys(TASK_LIB);
export const SENIOR = (role) => ["SuperAdmin", "GM", "Admin"].includes(role) || /^Member /.test(role || "");
