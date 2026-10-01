import * as XLSX from "xlsx";
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  UserPlus, Users2, Calendar, IndianRupee, FileText, LogOut,
  UserCheck, Sparkles, Construction, Trash2, Save, Send, CheckCircle2, RefreshCw, Printer, Download,
  ArrowRight, Cake, Trophy, PartyPopper, Briefcase, Landmark, X, Receipt, Plus, Edit3, Wallet, ShieldCheck,
} from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import { Header } from "../components/Header";
import {
  getEmployees, createEmployeeDraft, upsertEmployee, advanceEmployeeStep, deleteEmployee,
  reapproveEmployee, EMPLOYEE_STEP_LABEL, computeSalary,
  getMonthAttendance, upsertAttendance, sendPayrollToAccounts,
  getPayBills, createPayBillDraft, upsertPayBill, advancePayBillStep, deletePayBill, PAYBILL_STATUS,
  getAdvanceRegister,
  getLoans, createLoanDraft, upsertLoan, advanceLoanStep, deleteLoan, computeLoanEMI, LOAN_STATUS,
  getLeaves, createLeaveDraft, upsertLeave, deleteLeave, approveLeave, LEAVE_TYPES, LEAVE_STATUS,
  getRecruitments, createRecruitDraft, upsertRecruit, deleteRecruit, convertRecruitToEmployee, RECRUIT_STATUS,
  getExits, createExitDraft, upsertExit, deleteExit, finalizeExit, advanceExitStep, EXIT_STATUS,
  getComplianceSnapshot,
  currentRole, canCreate, canApprove, currentUser, fmtDMY, amountToWords,
} from "../lib/store";
import { printOfferLetter, printExperienceLetter, printRelievingLetter, printFnFStatement, printEmployeeApplication, printAttendanceSheet, printLeaveApplication, printPayrollSlipLetter, printPayBillSheet, sendPayslipWhatsApp } from "../lib/hrLetters";

const DEPARTMENTS = ["Operations", "Site", "Purchase", "Accounts", "HR", "Admin", "Sales", "Store"];
const DESIGNATIONS = ["Engineer", "Supervisor", "Sr. Operation Manager", "Manager", "Accountant", "HR Officer", "Store Keeper", "Executive", "Assistant", "Director"];
const APPLIED_POSTS = ["Sr. Operation Manager", "Manager", "Site Incharge", "Engineer", "Supervisor", "Accountant", "Cashier", "HR Officer", "Store Keeper", "Executive", "Assistant", "Sr. Mason", "Mason", "Sr. Helper", "Helper", "Peon", "Driver", "Security", "Other"];
const ACCOUNT_TYPES = ["Savings", "Current", "Salary", "NRE", "NRO"];
const IN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
const DOC_TYPES = ["Aadhaar Card", "PAN Card", "Passport Size Photo", "Signature", "Educational Certificate", "Experience Letter", "Previous Payslip", "Resume / CV", "Address Proof", "Cancelled Cheque", "Other"];
const MAX_UPLOAD_KB = 500;
const ATT_CODES = { P: { label: "Present", tone: "#16a34a" }, A: { label: "Absent", tone: "#dc2626" }, L: { label: "Leave", tone: "#f59e0b" }, H: { label: "Half-day", tone: "#0369a1" }, W: { label: "Week-off", tone: "#94a3b8" }, HL: { label: "Holiday", tone: "#7c3aed" } };
const nextCode = { "": "P", "P": "A", "A": "L", "L": "H", "H": "W", "W": "HL", "HL": "" };

// Module-scope reusable field wrapper + input style. These MUST live at module
// scope — defining them inside the tab components caused React to create a
// new component class on every state update, which unmounted + remounted the
// input nodes and ate the user's focus/keystrokes.
const inputStyle = { padding: "6px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, width: "100%" };
const F = ({ label, req, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{label}{req && <span style={{ color: "#dc2626" }}> *</span>}</label>
    {children}
  </div>
);

// -------------- Dynamic rows helper (Family / Education / Experience / References) --------------
const DynamicRows = ({ title, rows, onChange, columns, disabled, testPrefix }) => {
  const addRow = () => {
    const blank = columns.reduce((acc, c) => ({ ...acc, [c.key]: c.type === "number" ? 0 : "" }), { _id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
    onChange([...(rows || []), blank]);
  };
  const updateRow = (idx, key, val) => {
    const next = [...rows]; next[idx] = { ...next[idx], [key]: val }; onChange(next);
  };
  const removeRow = (idx) => { const next = [...rows]; next.splice(idx, 1); onChange(next); };

  const gridCols = columns.map((c) => c.width || "1fr").join(" ") + " 36px";

  return (
    <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
      <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        <button type="button" onClick={addRow} disabled={disabled} data-testid={`${testPrefix}-add`} style={{ padding: "3px 10px", background: disabled ? "#e2e8f0" : "#0369a1", color: disabled ? "#64748b" : "#fff", border: "none", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer", fontSize: 10.5, fontWeight: 700 }}>+ Add Row</button>
      </div>
      <div style={{ padding: 10 }}>
        {(!rows || rows.length === 0) ? (
          <div style={{ padding: 14, textAlign: "center", color: "#94a3b8", fontSize: 11, border: "1px dashed #e2e8f0", borderRadius: 6 }}>No entries — click "+ Add Row" above</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, padding: "4px 0", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: .4, borderBottom: "1px solid #e2e8f0", marginBottom: 6 }}>
              {columns.map((c) => <div key={c.key}>{c.label}</div>)}
              <div></div>
            </div>
            {rows.map((row, idx) => (
              <div key={row._id || idx} data-testid={`${testPrefix}-row-${idx}`} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, padding: "3px 0" }}>
                {columns.map((c) => {
                  const base = { padding: "5px 8px", fontSize: 11.5, border: "1px solid #cbd5e1", borderRadius: 4, width: "100%" };
                  if (c.type === "select") return (
                    <select key={c.key} value={row[c.key] || ""} onChange={(e) => updateRow(idx, c.key, e.target.value)} disabled={disabled} style={base}>
                      <option value="">—</option>
                      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  );
                  return (
                    <input key={c.key} type={c.type || "text"} value={row[c.key] ?? ""} onChange={(e) => updateRow(idx, c.key, c.type === "number" ? (+e.target.value || 0) : e.target.value)} disabled={disabled} style={base} />
                  );
                })}
                <button type="button" onClick={() => removeRow(idx)} disabled={disabled} data-testid={`${testPrefix}-del-${idx}`} style={{ padding: 2, background: disabled ? "#f1f5f9" : "#fee2e2", color: disabled ? "#94a3b8" : "#991b1b", border: `1px solid ${disabled ? "#cbd5e1" : "#fca5a5"}`, borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}>🗑</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// -------------- Employee editor --------------
const EmployeeEditor = ({ writeAllowed, approveAllowed, onSaved }) => {
  const [emp, setEmp] = useState(null);
  const [list, setList] = useState([]);
  const [locked, setLocked] = useState(false);
  const [ifscBusy, setIfscBusy] = useState(false);
  const [ifscOk, setIfscOk] = useState(false);

  useEffect(() => { setList(getEmployees()); if (!emp) setEmp(createEmployeeDraft()); }, []);
  const refresh = () => setList(getEmployees());
  const set = (k, v) => setEmp((p) => ({ ...p, [k]: v }));

  // IFSC → auto-fill bank details via Razorpay public API
  useEffect(() => {
    const code = (emp?.ifsc || "").toUpperCase().trim();
    if (code.length !== 11) { setIfscOk(false); return; }
    setIfscBusy(true);
    fetch(`https://ifsc.razorpay.com/${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) { setIfscOk(false); toast.error(`IFSC "${code}" not found`); return; }
        setEmp((p) => ({ ...p,
          bankName: d.BANK || p.bankName,
          bankBranch: d.BRANCH || p.bankBranch,
          bankCity: d.CITY || p.bankCity,
          bankAddress: d.ADDRESS || p.bankAddress,
        }));
        setIfscOk(true);
        toast.success(`${d.BANK} · ${d.BRANCH}`);
      })
      .catch(() => setIfscOk(false))
      .finally(() => setIfscBusy(false));
  }, [emp?.ifsc]);

  // Copy present → permanent when checkbox toggled
  useEffect(() => {
    if (emp?.sameAsPresent) {
      setEmp((p) => ({ ...p,
        permanentLine: p.presentLine, permanentCity: p.presentCity,
        permanentState: p.presentState, permanentPincode: p.presentPincode,
      }));
    }
  }, [emp?.sameAsPresent, emp?.presentLine, emp?.presentCity, emp?.presentState, emp?.presentPincode]);

  const startNew = () => { const d = createEmployeeDraft(); setEmp(d); setLocked(false); toast.info(`Draft ${d.tempCode}`); };
  const load = (e) => { setEmp({ ...e }); setLocked(Number(e.step) >= 5); };

  const validate = () => {
    if (!emp.fullName.trim()) { toast.error("Full name required"); return false; }
    if (!emp.contactMobile.trim()) { toast.error("Mobile required"); return false; }
    if (!emp.designation.trim()) { toast.error("Designation required"); return false; }
    return true;
  };
  const save = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    if (!validate()) return;
    const saved = upsertEmployee({ ...emp });
    setEmp(saved); refresh(); onSaved?.();
    toast.success(`Saved ${saved.tempCode || saved.empCode}`);
  };
  const submit = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    if (!validate()) return;
    save();
    if (Number(emp.step) >= 5) { toast.info("Already finalized"); return; }
    const next = advanceEmployeeStep({ ...emp });
    setEmp(next); refresh();
    toast.success(EMPLOYEE_STEP_LABEL[next.step]);
  };
  const approve = () => {
    if (!approveAllowed) { toast.error("Only Admin / SuperAdmin can finalize"); return; }
    if (Number(emp.step) >= 5) { toast.info("Already finalized"); return; }
    // Auto-fill Date of Joining on Final Approval
    let cur = { ...emp, doj: emp.doj || new Date().toISOString().slice(0, 10) };
    if (!cur.doj) cur.doj = new Date().toISOString().slice(0, 10);
    cur.doj = new Date().toISOString().slice(0, 10);
    while (Number(cur.step) < 5) cur = advanceEmployeeStep(cur);
    setEmp(cur); setLocked(true); refresh();
    toast.success(`Finalized · EMP Code: ${cur.empCode} · DOJ: ${cur.doj}`);
  };
  const reapprove = () => {
    if (!approveAllowed) { toast.error("Only Admin / SuperAdmin can re-approve"); return; }
    const n = reapproveEmployee(emp); setEmp(n); refresh();
    toast.success(`Re-Approved (Rev ${n.revision})`);
  };
  const remove = (id, code) => {
    if (!writeAllowed) return toast.error("Not permitted");
    if (!window.confirm(`Delete employee ${code}?`)) return;
    deleteEmployee(id); refresh(); if (emp && emp.id === id) startNew();
    toast.success("Employee deleted");
  };

  if (!emp) return null;

  return (
    <div style={{ padding: 14 }}>
      {/* Header codes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <F label="Temp Code (Alpha-Num)"><input value={emp.tempCode} readOnly style={{ ...inputStyle, background: "#fef9c3", fontWeight: 700, color: "#78716c" }} data-testid="emp-temp-code" /></F>
        <F label="Permanent EMP Code"><input value={emp.empCode} readOnly placeholder="AE/EMP/XXXXXX/FY — on Final Approval" style={{ ...inputStyle, background: emp.empCode ? "#dcfce7" : "#f1f5f9", fontWeight: 800, color: emp.empCode ? "#166534" : "#94a3b8", border: emp.empCode ? "1.5px solid #16a34a" : "1px solid #cbd5e1" }} data-testid="emp-perm-code" /></F>
        <F label="Status / Step"><input value={EMPLOYEE_STEP_LABEL[emp.step] || "-"} readOnly style={{ ...inputStyle, background: "#eef2ff", fontWeight: 700, color: "#1e3a8a" }} /></F>
        <F label="Revision"><input value={emp.revision || 0} readOnly style={{ ...inputStyle, background: "#f8fafc", textAlign: "center" }} /></F>
      </div>

      {/* Application Reference */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#dbeafe", borderBottom: "1px solid #93c5fd", color: "#1e3a8a", textTransform: "uppercase", letterSpacing: .4 }}>Application Reference &amp; Position</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          <F label="Advertisement No."><input value={emp.advertisementNo || ""} onChange={(e) => set("advertisementNo", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-advt" placeholder="AE/HR/ADVT/2026/001" /></F>
          <F label="Date of Filing"><input type="date" value={emp.dateOfFiling || ""} onChange={(e) => set("dateOfFiling", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-filingdate" /></F>
          <F label="Project / Site"><input value={emp.projectSite || ""} onChange={(e) => set("projectSite", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-project" /></F>
          <F label="Location"><input value={emp.location || ""} onChange={(e) => set("location", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-location" /></F>
          <F label="Applied Post" req>
            <select value={emp.appliedPost || ""} onChange={(e) => set("appliedPost", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-appliedpost">
              <option value="">— Select —</option>
              {APPLIED_POSTS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </F>
          <F label="Allotted Designation" req><input list="hr-designations" value={emp.designation} onChange={(e) => set("designation", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-designation" /></F>
          <F label="Department"><select value={emp.department} onChange={(e) => set("department", e.target.value)} disabled={locked} style={inputStyle}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></F>
          <F label="Reporting Manager"><input value={emp.reportingManager || ""} onChange={(e) => set("reportingManager", e.target.value)} disabled={locked} style={inputStyle} /></F>
          <F label="Date of Joining">
            <input type="date" value={emp.doj || ""} onChange={(e) => set("doj", e.target.value)} disabled={locked} style={{ ...inputStyle, background: emp.doj ? "#dcfce7" : "#fff", fontWeight: 700, color: emp.doj ? "#166534" : "#0f172a" }} data-testid="emp-doj" />
          </F>
          <F label="Employment Status"><select value={emp.status || "Active"} onChange={(e) => set("status", e.target.value)} disabled={locked} style={inputStyle}><option>Active</option><option>Probation</option><option>On Leave</option><option>Exit Pending</option><option>Exited</option></select></F>
        </div>
        <datalist id="hr-designations">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>
      </div>

      {/* Bio-Data Application Form — Photo + Personal + Job */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>A. Personal Details</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 150px", gap: 16 }}>
          {/* Personal fields grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <F label="Full Name" req><input value={emp.fullName} onChange={(e) => set("fullName", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-name" /></F>
            <F label="Father's Name"><input value={emp.fatherName} onChange={(e) => set("fatherName", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Mother's Name"><input value={emp.motherName || ""} onChange={(e) => set("motherName", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Spouse Name"><input value={emp.spouseName || ""} onChange={(e) => set("spouseName", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Date of Birth"><input type="date" value={emp.dob} onChange={(e) => set("dob", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Gender"><select value={emp.gender} onChange={(e) => set("gender", e.target.value)} disabled={locked} style={inputStyle}><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></F>
            <F label="Marital Status"><select value={emp.maritalStatus || "Single"} onChange={(e) => set("maritalStatus", e.target.value)} disabled={locked} style={inputStyle}><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option></select></F>
            <F label="Blood Group"><select value={emp.bloodGroup || ""} onChange={(e) => set("bloodGroup", e.target.value)} disabled={locked} style={inputStyle}><option value="">—</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></F>
            <F label="Nationality"><input value={emp.nationality || "Indian"} onChange={(e) => set("nationality", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Religion"><input value={emp.religion || ""} onChange={(e) => set("religion", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Category"><select value={emp.category || "General"} onChange={(e) => set("category", e.target.value)} disabled={locked} style={inputStyle}><option>General</option><option>OBC</option><option>SC</option><option>ST</option><option>EWS</option></select></F>
            <F label="Aadhaar No."><input value={emp.aadhaar} onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))} disabled={locked} style={inputStyle} placeholder="12 digits" /></F>
            <F label="PAN No."><input value={emp.pan} onChange={(e) => set("pan", e.target.value.toUpperCase().slice(0, 10))} disabled={locked} style={inputStyle} placeholder="ABCDE1234F" /></F>
          </div>
          {/* Photo (right-top) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 130, height: 160, border: "2px solid #0f172a", borderRadius: 4, background: emp.photoUrl ? `url(${emp.photoUrl}) center/cover` : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10, textAlign: "center", lineHeight: 1.3 }}>
              {!emp.photoUrl && (<span>Passport<br/>Photo<br/>(120×150)<br/>≤ 500KB</span>)}
            </div>
            <label style={{ padding: "5px 14px", background: "#0369a1", color: "#fff", borderRadius: 4, cursor: locked ? "not-allowed" : "pointer", fontSize: 10.5, fontWeight: 700, opacity: locked ? .5 : 1 }}>
              Upload Photo
              <input type="file" accept="image/*" disabled={locked} onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                if (f.size > MAX_UPLOAD_KB * 1024) { toast.error(`Photo must be ≤ ${MAX_UPLOAD_KB}KB (uploaded ${Math.round(f.size / 1024)}KB)`); e.target.value = ""; return; }
                const r = new FileReader(); r.onload = () => set("photoUrl", r.result); r.readAsDataURL(f);
              }} style={{ display: "none" }} data-testid="emp-photo" />
            </label>
            <div style={{ fontSize: 9, color: "#64748b", textAlign: "center" }}>JPG / PNG · ≤ 500KB</div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>B. Contact Details</div>
        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            <F label="Mobile" req><input value={emp.contactMobile} onChange={(e) => set("contactMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={locked} style={inputStyle} data-testid="emp-mobile" /></F>
            <F label="Alternate Mobile"><input value={emp.contactAltMobile || ""} onChange={(e) => set("contactAltMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={locked} style={inputStyle} /></F>
            <F label="Email"><input value={emp.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
          </div>

          {/* Present Address */}
          <div style={{ padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>Present / Communication Address</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr", gap: 10 }}>
              <F label="Address Line (House / Street / Area)"><input value={emp.presentLine || ""} onChange={(e) => set("presentLine", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-present-line" /></F>
              <F label="City / District"><input value={emp.presentCity || ""} onChange={(e) => set("presentCity", e.target.value)} disabled={locked} style={inputStyle} /></F>
              <F label="State"><select value={emp.presentState || ""} onChange={(e) => set("presentState", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-present-state"><option value="">— Select —</option>{IN_STATES.map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="PIN Code"><input value={emp.presentPincode || ""} onChange={(e) => set("presentPincode", e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={locked} style={inputStyle} data-testid="emp-present-pin" /></F>
            </div>
          </div>

          {/* Permanent Address */}
          <div style={{ padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: .4 }}>Permanent Address</div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "#0369a1", display: "flex", alignItems: "center", gap: 5 }}>
                <input type="checkbox" checked={!!emp.sameAsPresent} onChange={(e) => set("sameAsPresent", e.target.checked)} disabled={locked} data-testid="emp-same-addr" />
                Same as Present Address
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr", gap: 10 }}>
              <F label="Address Line"><input value={emp.permanentLine || ""} onChange={(e) => set("permanentLine", e.target.value)} disabled={locked || emp.sameAsPresent} style={inputStyle} /></F>
              <F label="City / District"><input value={emp.permanentCity || ""} onChange={(e) => set("permanentCity", e.target.value)} disabled={locked || emp.sameAsPresent} style={inputStyle} /></F>
              <F label="State"><select value={emp.permanentState || ""} onChange={(e) => set("permanentState", e.target.value)} disabled={locked || emp.sameAsPresent} style={inputStyle}><option value="">— Select —</option>{IN_STATES.map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="PIN Code"><input value={emp.permanentPincode || ""} onChange={(e) => set("permanentPincode", e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={locked || emp.sameAsPresent} style={inputStyle} /></F>
            </div>
          </div>
        </div>
      </div>

      {/* C. Family Members (dynamic) */}
      <DynamicRows title="C. Family Members"
        rows={emp.familyMembers || []} onChange={(rows) => set("familyMembers", rows)} disabled={locked}
        columns={[
          { key: "name", label: "Name", width: "2fr" },
          { key: "relation", label: "Relation", width: "1fr", type: "select", options: ["Father", "Mother", "Spouse", "Son", "Daughter", "Brother", "Sister", "Other"] },
          { key: "dob", label: "DOB", width: "1fr", type: "date" },
          { key: "occupation", label: "Occupation", width: "1.5fr" },
          { key: "contact", label: "Contact", width: "1fr" },
        ]} testPrefix="emp-fam"
      />

      {/* D. References (compact — min 2) */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>D. References (minimum 2 — Non-Relatives)</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[0, 1].map((idx) => {
            const r = (emp.references || [])[idx] || { name: "", mobile: "", relation: "" };
            const updateRef = (key, val) => {
              const next = [...(emp.references || [])];
              while (next.length <= idx) next.push({ name: "", mobile: "", relation: "" });
              next[idx] = { ...next[idx], [key]: val };
              set("references", next);
            };
            return (
              <div key={idx} style={{ padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#334155", marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>Reference {idx + 1}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8 }}>
                  <F label="Name"><input value={r.name || ""} onChange={(e) => updateRef("name", e.target.value)} disabled={locked} style={inputStyle} data-testid={`emp-ref${idx}-name`} /></F>
                  <F label="Mobile No."><input value={r.mobile || ""} onChange={(e) => updateRef("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={locked} style={inputStyle} data-testid={`emp-ref${idx}-mobile`} /></F>
                  <F label="Relationship"><input value={r.relation || ""} onChange={(e) => updateRef("relation", e.target.value)} disabled={locked} style={inputStyle} placeholder="Friend / Colleague / Teacher" data-testid={`emp-ref${idx}-rel`} /></F>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* E. Educational Qualifications */}
      <DynamicRows title="E. Educational Qualifications"
        rows={emp.educations || []} onChange={(rows) => set("educations", rows)} disabled={locked}
        columns={[
          { key: "qualification", label: "Qualification", width: "1.5fr" },
          { key: "board", label: "Board / University", width: "2fr" },
          { key: "institute", label: "Institute", width: "2fr" },
          { key: "year", label: "Year", width: "0.6fr" },
          { key: "percentage", label: "% / CGPA", width: "0.8fr" },
        ]} testPrefix="emp-edu"
      />

      {/* Previous Experience */}
      <DynamicRows title="F. Previous Work Experience"
        rows={emp.experiences || []} onChange={(rows) => set("experiences", rows)} disabled={locked}
        columns={[
          { key: "company", label: "Company", width: "2fr" },
          { key: "designation", label: "Designation", width: "1.3fr" },
          { key: "from", label: "From", width: "1fr", type: "date" },
          { key: "to", label: "To", width: "1fr", type: "date" },
          { key: "lastSalary", label: "Last Salary (₹)", width: "1fr", type: "number" },
          { key: "reason", label: "Reason for Leaving", width: "1.5fr" },
        ]} testPrefix="emp-exp"
      />

      {/* Bank & Statutory */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>G. Bank &amp; Statutory</div>
        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 10 }}>
            <F label="IFSC Code (auto-fills bank)" req>
              <div style={{ position: "relative" }}>
                <input value={emp.ifsc || ""} onChange={(e) => set("ifsc", e.target.value.toUpperCase().slice(0, 11))} disabled={locked} style={{ ...inputStyle, textTransform: "uppercase", paddingRight: 42 }} data-testid="emp-ifsc" placeholder="SBIN0001234" />
                {(emp.ifsc || "").length === 11 && (
                  <span style={{ position: "absolute", right: 4, top: 4, padding: "2px 6px", fontSize: 10, fontWeight: 800, borderRadius: 3, background: ifscBusy ? "#fef3c7" : ifscOk ? "#dcfce7" : "#fee2e2", color: ifscBusy ? "#92400e" : ifscOk ? "#166534" : "#991b1b", border: `1px solid ${ifscBusy ? "#fcd34d" : ifscOk ? "#86efac" : "#fca5a5"}` }} data-testid="emp-ifsc-status">
                    {ifscBusy ? "…" : ifscOk ? "✓" : "✗"}
                  </span>
                )}
              </div>
            </F>
            <F label="Account Type"><select value={emp.bankAccountType || "Savings"} onChange={(e) => set("bankAccountType", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-acctype">{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
            <F label="Account No." req><input value={emp.bankAccount || ""} onChange={(e) => set("bankAccount", e.target.value.replace(/\D/g, ""))} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} data-testid="emp-bankac" /></F>
            <F label="Bank Name"><input value={emp.bankName || ""} readOnly={ifscOk || locked} onChange={(e) => set("bankName", e.target.value)} style={{ ...inputStyle, gridColumn: "span 2", background: ifscOk ? "#f0fdf4" : "#fff" }} /></F>
            <F label="Branch Name"><input value={emp.bankBranch || ""} readOnly={ifscOk || locked} onChange={(e) => set("bankBranch", e.target.value)} style={{ ...inputStyle, gridColumn: "span 2", background: ifscOk ? "#f0fdf4" : "#fff" }} /></F>
            <F label="Branch City"><input value={emp.bankCity || ""} readOnly={ifscOk || locked} onChange={(e) => set("bankCity", e.target.value)} style={{ ...inputStyle, gridColumn: "span 2", background: ifscOk ? "#f0fdf4" : "#fff" }} /></F>
            <F label="Branch Address"><input value={emp.bankAddress || ""} readOnly={ifscOk || locked} onChange={(e) => set("bankAddress", e.target.value)} style={{ ...inputStyle, gridColumn: "span 2", background: ifscOk ? "#f0fdf4" : "#fff" }} /></F>
          </div>
          <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <F label="PF Number"><input value={emp.pfNo || ""} onChange={(e) => set("pfNo", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="UAN"><input value={emp.uan || ""} onChange={(e) => set("uan", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="ESIC"><input value={emp.esicNo || ""} onChange={(e) => set("esicNo", e.target.value)} disabled={locked} style={inputStyle} /></F>
          </div>
        </div>
      </div>

      {/* Salary Structure */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>H. Salary Structure (₹ / month)</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <F label="Basic"><input type="number" value={emp.basic} onChange={(e) => set("basic", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="HRA"><input type="number" value={emp.hra} onChange={(e) => set("hra", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="DA"><input type="number" value={emp.da} onChange={(e) => set("da", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="Special"><input type="number" value={emp.special} onChange={(e) => set("special", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="Bonus"><input type="number" value={emp.bonus} onChange={(e) => set("bonus", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="Gross (auto)"><input value={(+emp.basic || 0) + (+emp.hra || 0) + (+emp.da || 0) + (+emp.special || 0) + (+emp.bonus || 0)} readOnly style={{ ...inputStyle, background: "#eef2ff", fontWeight: 700, textAlign: "right" }} /></F>
        </div>
      </div>

      {/* I. Documents Upload */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>I. Documents Upload (Aadhaar, PAN, Education, Experience etc. · each ≤ 500KB)</span>
          <label style={{ padding: "4px 10px", background: locked ? "#e2e8f0" : "#16a34a", color: locked ? "#64748b" : "#fff", borderRadius: 4, cursor: locked ? "not-allowed" : "pointer", fontSize: 10.5, fontWeight: 700 }}>
            + Add Document
            <input type="file" accept="image/*,.pdf" multiple disabled={locked} onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const existing = Array.isArray(emp.documents) ? [...emp.documents] : [];
              let anyRejected = false;
              files.forEach((f) => {
                if (f.size > MAX_UPLOAD_KB * 1024) { toast.error(`"${f.name}" exceeds 500KB (${Math.round(f.size / 1024)}KB) — skipped`); anyRejected = true; return; }
                const r = new FileReader();
                r.onload = () => {
                  existing.push({ _id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: "Other", name: f.name, dataUrl: r.result, sizeKB: Math.round(f.size / 1024) });
                  set("documents", [...existing]);
                };
                r.readAsDataURL(f);
              });
              if (!anyRejected && files.length > 0) toast.success(`${files.length} document(s) uploaded`);
              e.target.value = "";
            }} style={{ display: "none" }} data-testid="emp-doc-add" />
          </label>
        </div>
        <div style={{ padding: 12 }}>
          {(emp.documents || []).length === 0 ? (
            <div style={{ padding: 14, textAlign: "center", color: "#94a3b8", fontSize: 11, border: "1px dashed #e2e8f0", borderRadius: 6 }}>No documents uploaded yet — click "+ Add Document" above</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
              {(emp.documents || []).map((d, idx) => (
                <div key={d._id || idx} data-testid={`emp-doc-${idx}`} style={{ display: "grid", gridTemplateColumns: "2fr 2.5fr 90px 70px 40px", gap: 8, alignItems: "center", padding: "5px 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11.5 }}>
                  <select value={d.type || "Other"} onChange={(e) => {
                    const next = [...emp.documents]; next[idx] = { ...next[idx], type: e.target.value }; set("documents", next);
                  }} disabled={locked} style={{ padding: 4, fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 3 }}>
                    {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.name}>{d.name}</span>
                  <span style={{ fontSize: 10, color: "#64748b", textAlign: "right" }}>{d.sizeKB || "—"} KB</span>
                  <a href={d.dataUrl} download={d.name} style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, textAlign: "center", textDecoration: "none", border: "1px solid #93c5fd", borderRadius: 3, padding: "2px 4px" }}>View</a>
                  <button type="button" disabled={locked} onClick={() => { const next = [...emp.documents]; next.splice(idx, 1); set("documents", next); }} data-testid={`emp-doc-del-${idx}`} style={{ padding: 2, background: locked ? "#f1f5f9" : "#fee2e2", color: locked ? "#94a3b8" : "#991b1b", border: `1px solid ${locked ? "#cbd5e1" : "#fca5a5"}`, borderRadius: 3, cursor: locked ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* J. Declaration (moved below Documents) */}
      <div className="section" style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#fef3c7", borderBottom: "1px solid #fde68a", color: "#78350f" }}>J. Declaration</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 180px", gap: 14, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11.5, color: "#78350f", lineHeight: 1.6, marginBottom: 10 }}>
              I hereby declare that the information furnished above is true, correct and complete to the best of my knowledge and belief. I understand that in case any particular is found to be false or incorrect at any stage, my candidature / services are liable to be terminated without notice.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <F label="Place"><input value={emp.declarationPlace || ""} onChange={(e) => set("declarationPlace", e.target.value)} disabled={locked} style={inputStyle} /></F>
              <F label="Date"><input type="date" value={emp.declarationDate || ""} onChange={(e) => set("declarationDate", e.target.value)} disabled={locked} style={inputStyle} /></F>
            </div>
          </div>
          {/* Signature (right-bottom) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 160, height: 70, border: "1.5px dashed #94a3b8", borderRadius: 6, background: emp.signatureUrl ? `url(${emp.signatureUrl}) center/contain no-repeat #fff` : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10, textAlign: "center" }}>
              {!emp.signatureUrl && "Candidate\nSignature\n(≤ 500KB)"}
            </div>
            <label style={{ padding: "4px 10px", background: "#7c3aed", color: "#fff", borderRadius: 4, cursor: locked ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, opacity: locked ? .5 : 1 }}>
              Upload Signature
              <input type="file" accept="image/*" disabled={locked} onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                if (f.size > MAX_UPLOAD_KB * 1024) { toast.error(`Signature must be ≤ ${MAX_UPLOAD_KB}KB (uploaded ${Math.round(f.size / 1024)}KB)`); e.target.value = ""; return; }
                const r = new FileReader(); r.onload = () => set("signatureUrl", r.result); r.readAsDataURL(f);
              }} style={{ display: "none" }} data-testid="emp-signature" />
            </label>
            <div style={{ fontSize: 9, color: "#64748b", textAlign: "center" }}>Signature of Candidate<br/>JPG / PNG · ≤ 500KB</div>
          </div>
        </div>
      </div>

      {/* All employees list */}
      {list.length > 0 && (
        <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>K. All Employees ({list.length})</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead><tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Code</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Name</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Designation</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Dept</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Mobile</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Status</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Approval Date</th>
              <th style={{ padding: 6, textAlign: "center", borderBottom: "1px solid #e2e8f0", width: 160 }}>Actions</th>
            </tr></thead>
            <tbody>{list.map((e, i) => (
              <tr key={e.id} data-testid={`hr-emp-row-${e.id}`} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td onClick={() => load(e)} data-testid={`hr-emp-code-${e.id}`} title="Click to load this employee into the form" style={{ padding: 6, fontWeight: 700, color: e.empCode ? "#166534" : "#78716c", cursor: "pointer", textDecoration: "underline" }}>{e.empCode || e.tempCode}</td>
                <td style={{ padding: 6 }}>{e.fullName}</td>
                <td style={{ padding: 6 }}>{e.designation}</td>
                <td style={{ padding: 6 }}>{e.department}</td>
                <td style={{ padding: 6 }}>{e.contactMobile}</td>
                <td style={{ padding: 6, fontSize: 10.5 }}>{EMPLOYEE_STEP_LABEL[e.step] || "-"}</td>
                <td style={{ padding: 6, fontSize: 10.5, color: e.approvalDate ? "#166534" : "#94a3b8", fontWeight: 700 }} data-testid={`hr-emp-approval-${e.id}`}>{e.approvalDate ? fmtDMY(e.approvalDate) : "—"}</td>
                <td style={{ padding: 4, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => load(e)} data-testid={`hr-emp-edit-${e.id}`} style={{ padding: "3px 8px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✏ Edit</button>
                  <button onClick={() => remove(e.id, e.empCode || e.tempCode)} disabled={!writeAllowed || Number(e.step) >= 5} data-testid={`hr-emp-del-${e.id}`} style={{ padding: "3px 8px", background: (!writeAllowed || Number(e.step) >= 5) ? "#f1f5f9" : "#fee2e2", color: (!writeAllowed || Number(e.step) >= 5) ? "#94a3b8" : "#991b1b", border: `1px solid ${(!writeAllowed || Number(e.step) >= 5) ? "#cbd5e1" : "#fca5a5"}`, borderRadius: 3, cursor: (!writeAllowed || Number(e.step) >= 5) ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700 }}>🗑 Delete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Workflow Action Bar — matches BOQ / WO / Bill style (compact, 3-group) */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }} data-testid="hr-emp-action-row">
        {/* Left — Workflow */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button data-testid="wf-new" onClick={startNew} style={{ padding: "7px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><UserPlus size={13} /> New</button>
          <button data-testid="wf-edited" onClick={() => {
            if (!emp.id) { toast.error("No employee loaded. Pehle list se employee ko click karen ya New draft bana len."); return; }
            const approved = Number(emp.step) >= 5;
            if (approved) {
              if (!approveAllowed) { toast.error("Only Admin / SuperAdmin can re-open an Approved Employee"); return; }
              const label = emp.empCode || emp.fullName || "this employee";
              if (!window.confirm(`⚠ Re-open APPROVED Employee "${label}" for editing?\n\n• EMP Code intact rahega\n• Changes ke baad Re-Approval zaruri hogi\n\nContinue?`)) return;
              setLocked(false);
              toast.success("Employee re-opened. Make changes → Save → Re-Approve.");
              return;
            }
            if (!writeAllowed) { toast.error("Not permitted"); return; }
            if (!locked) { toast.info("Already in edit mode"); return; }
            setLocked(false);
            toast.success("Edit mode enabled");
          }} disabled={!emp.id || (Number(emp.step) >= 5 ? !approveAllowed : !writeAllowed)} title={Number(emp.step) >= 5 ? "Admin override — re-open Approved Employee" : "Unlock form to edit"} style={{ padding: "7px 12px", background: !emp.id || (Number(emp.step) >= 5 ? !approveAllowed : !writeAllowed) ? "#94a3b8" : (Number(emp.step) >= 5 ? "#b45309" : "#eab308"), color: "#fff", border: "none", borderRadius: 5, cursor: !emp.id || (Number(emp.step) >= 5 ? !approveAllowed : !writeAllowed) ? "not-allowed" : "pointer", opacity: !emp.id || (Number(emp.step) >= 5 ? !approveAllowed : !writeAllowed) ? .5 : 1, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Edit3 size={13} /> {Number(emp.step) >= 5 ? "Re-open & Edit (Admin)" : "Edit"}
          </button>
          <button data-testid="wf-save" onClick={save} disabled={!writeAllowed || locked} style={{ padding: "7px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: !writeAllowed || locked ? "not-allowed" : "pointer", opacity: !writeAllowed || locked ? .5 : 1, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Save size={13} /> Save</button>
          <button data-testid="wf-submitted" onClick={submit} disabled={!writeAllowed || locked || Number(emp.step) >= 5} style={{ padding: "7px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: !writeAllowed || locked || Number(emp.step) >= 5 ? "not-allowed" : "pointer", opacity: !writeAllowed || locked || Number(emp.step) >= 5 ? .5 : 1, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Send size={13} /> Submit</button>
        </div>
        {/* Center — Approval */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button data-testid="wf-approval" onClick={approve} disabled={!approveAllowed || Number(emp.step) >= 5} style={{ padding: "7px 14px", background: !approveAllowed || Number(emp.step) >= 5 ? "#94a3b8" : "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: !approveAllowed || Number(emp.step) >= 5 ? "not-allowed" : "pointer", opacity: !approveAllowed || Number(emp.step) >= 5 ? .5 : 1, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={13} /> Final Approval</button>
          {Number(emp.step) >= 5 && (
            <button data-testid="wf-reapprove" onClick={reapprove} disabled={!approveAllowed} style={{ padding: "7px 12px", background: !approveAllowed ? "#94a3b8" : "#f59e0b", color: "#fff", border: "none", borderRadius: 5, cursor: !approveAllowed ? "not-allowed" : "pointer", opacity: !approveAllowed ? .5 : 1, fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={13} /> Re-Approve</button>
          )}
        </div>
        {/* Right — Export */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button data-testid="wf-print" onClick={() => printEmployeeApplication(emp)} style={{ padding: "7px 12px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}><Printer size={13} /> Print A4</button>
        </div>
      </div>
    </div>
  );
};

// -------------- Attendance grid --------------
const AttendanceGrid = () => {
  const [emps] = useState(() => getEmployees().filter((e) => Number(e.step) === 5));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tick, setTick] = useState(0);
  const daysInMonth = new Date(year, month, 0).getDate();

  const cycleCell = (empId, day) => {
    const rec = getMonthAttendance(empId, year, month);
    const cur = rec.days[day] || "";
    const nxt = nextCode[cur] ?? "";
    const next = { ...rec, days: { ...rec.days, [day]: nxt } };
    upsertAttendance(next);
    setTick((t) => t + 1);
  };

  const exportExcel = () => {
    const rows = emps.map((e) => {
      const rec = getMonthAttendance(e.id, year, month);
      const days = {};
      for (let d = 1; d <= daysInMonth; d++) days[String(d).padStart(2, "0")] = rec.days[String(d).padStart(2, "0")] || "";
      return { Code: e.empCode || e.tempCode, Name: e.fullName, Designation: e.designation, ...days };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `${year}-${month}`);
    XLSX.writeFile(wb, `attendance_${year}_${String(month).padStart(2, "0")}.xlsx`);
    toast.success("Attendance exported");
  };

  if (emps.length === 0) return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No finalized employees yet — approve at least one in Employees tab.</div>;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Month:</label>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: 5 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("en-IN", { month: "long" })}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: 5, width: 80 }} />
        <button data-testid="att-export" onClick={exportExcel} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Download size={13} style={{ verticalAlign: -2 }} /> Export Excel</button>
        <button data-testid="att-print" onClick={() => printAttendanceSheet(emps, year, month, getMonthAttendance)} style={{ padding: "6px 12px", background: "#334155", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Printer size={13} style={{ verticalAlign: -2 }} /> Print A4 Sheet</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, fontSize: 10, alignItems: "center" }}>
          Legend: {Object.entries(ATT_CODES).map(([c, v]) => <span key={c} style={{ padding: "2px 6px", background: v.tone, color: "#fff", borderRadius: 3, fontWeight: 700 }}>{c} = {v.label}</span>)}
        </div>
      </div>

      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0", position: "sticky", left: 0, background: "#f8fafc" }}>Employee</th>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => <th key={d} style={{ padding: 4, borderBottom: "1px solid #e2e8f0", minWidth: 30, textAlign: "center" }}>{d}</th>)}
            <th style={{ padding: 6, borderBottom: "1px solid #e2e8f0", textAlign: "center", background: "#eef2ff" }}>P</th>
          </tr></thead>
          <tbody>{emps.map((e, ri) => {
            const rec = getMonthAttendance(e.id, year, month);
            const presentCount = Object.values(rec.days || {}).filter((s) => s === "P" || s === "H").length;
            return (
              <tr key={e.id + tick} data-testid={`att-row-${e.id}`} style={{ background: ri % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={{ padding: 6, fontWeight: 700, position: "sticky", left: 0, background: ri % 2 === 0 ? "#fff" : "#fafbfc" }}>{e.empCode} · {e.fullName}</td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const key = String(d).padStart(2, "0");
                  const val = rec.days[key] || "";
                  const info = ATT_CODES[val];
                  return (
                    <td key={d} onClick={() => cycleCell(e.id, key)} style={{ padding: 4, textAlign: "center", cursor: "pointer", borderRight: "1px solid #f1f5f9", background: info ? info.tone : "#fff", color: info ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 10 }} title={info ? info.label : "Click to mark"}>{val || "—"}</td>
                  );
                })}
                <td style={{ padding: 6, textAlign: "center", fontWeight: 800, background: "#eef2ff", color: "#1e3a8a" }}>{presentCount}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
};

// -------------- Payroll slip + Push-to-Accounts --------------
const PayrollTab = () => {
  const [emps] = useState(() => getEmployees().filter((e) => Number(e.step) === 5));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedId, setSelectedId] = useState(emps[0]?.id || "");
  const daysInMonth = new Date(year, month, 0).getDate();
  const emp = emps.find((e) => e.id === selectedId);
  const att = emp ? getMonthAttendance(emp.id, year, month) : null;
  const daysPresent = att ? Object.values(att.days || {}).filter((s) => s === "P" || s === "H").length : 0;
  const salary = emp ? computeSalary(emp, { daysInMonth, daysPresent }) : null;

  const pushToAccounts = () => {
    const bill = sendPayrollToAccounts(year, month);
    toast.success(`Monthly payroll pushed to Accounts as ${bill.refNo} · Total ₹${bill.basicAmount.toLocaleString("en-IN")}`);
  };

  if (emps.length === 0) return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Payroll dikhane ke liye pehle Employees tab me kam se kam ek employee finalize karo.</div>;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Employee:</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ padding: 5 }}>
          {emps.map((e) => <option key={e.id} value={e.id}>{`${e.empCode} — ${e.fullName}`}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: 5 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("en-IN", { month: "long" })}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: 5, width: 80 }} />
        <button data-testid="hr-payroll-print" onClick={() => printPayrollSlipLetter(emp, salary, year, month, daysInMonth, daysPresent)} style={{ padding: "6px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Printer size={13} style={{ verticalAlign: -2 }} /> Print A4 Slip</button>
        <button data-testid="hr-payroll-whatsapp" onClick={() => sendPayslipWhatsApp(emp, salary, year, month)} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>💬 Send on WhatsApp</button>
        <button data-testid="hr-payroll-push" onClick={pushToAccounts} style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Push Monthly Payroll → Accounts</button>
      </div>

      {emp && salary && (
        <div className="a4" style={{ background: "#fff", border: "1px solid #cbd5e1", padding: 24, borderRadius: 8, maxWidth: 800, margin: "0 auto" }} data-testid="hr-payroll-slip">
          <Header formTitle={`SALARY SLIP · ${new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" }).toUpperCase()}`} />

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12, marginTop: 12 }}>
            <tbody>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9", width: "25%" }}>Emp Code</td><td style={{ padding: 5 }}>{emp.empCode}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9", width: "25%" }}>Name</td><td style={{ padding: 5 }}>{emp.fullName}</td></tr>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Designation</td><td style={{ padding: 5 }}>{emp.designation}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Department</td><td style={{ padding: 5 }}>{emp.department}</td></tr>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Project</td><td style={{ padding: 5 }}>{emp.projectSite || "—"}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Location</td><td style={{ padding: 5 }}>{emp.location || "—"}</td></tr>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>PAN No.</td><td style={{ padding: 5 }}>{emp.pan || "—"}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Aadhaar</td><td style={{ padding: 5 }}>{emp.aadhaar || "—"}</td></tr>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>PF No.</td><td style={{ padding: 5 }}>{emp.pfNo || "—"}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>UAN</td><td style={{ padding: 5 }}>{emp.uan || "—"}</td></tr>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Days in Month</td><td style={{ padding: 5 }}>{daysInMonth}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Days Present</td><td style={{ padding: 5 }}>{daysPresent}</td></tr>
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><th colSpan={2} style={{ padding: 6, background: "#dcfce7", color: "#166534", textAlign: "left" }}>Earnings</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>Basic</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{emp.basic.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>HRA</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{emp.hra.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>DA</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{emp.da.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>Special</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{emp.special.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5 }}>Bonus</td><td style={{ padding: 5, textAlign: "right" }}>{emp.bonus.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, fontWeight: 800, background: "#dcfce7" }}>Gross Earned</td><td style={{ padding: 5, textAlign: "right", fontWeight: 800, background: "#dcfce7" }}>₹ {salary.earned.toLocaleString("en-IN")}</td></tr>
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><th colSpan={2} style={{ padding: 6, background: "#fee2e2", color: "#991b1b", textAlign: "left" }}>Deductions</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>PF (12% Basic)</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{salary.pf.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>ESIC (0.75%)</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{salary.esic.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, borderBottom: "1px dashed #e2e8f0" }}>Prof. Tax</td><td style={{ padding: 5, textAlign: "right", borderBottom: "1px dashed #e2e8f0" }}>{salary.proftax.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5 }}>TDS</td><td style={{ padding: 5, textAlign: "right" }}>{salary.tds.toLocaleString("en-IN")}</td></tr>
                <tr><td style={{ padding: 5, fontWeight: 800, background: "#fee2e2" }}>Total Deductions</td><td style={{ padding: 5, textAlign: "right", fontWeight: 800, background: "#fee2e2" }}>₹ {salary.deductions.toLocaleString("en-IN")}</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, padding: 12, background: "#0f172a", color: "#fff", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
            <b>NET SALARY PAYABLE</b>
            <b style={{ fontSize: 20 }}>₹ {salary.net.toLocaleString("en-IN")}</b>
          </div>

          <div data-testid="hr-payroll-amount-words" style={{ marginTop: 8, padding: "8px 12px", background: "#f1f5f9", border: "1px dashed #94a3b8", borderRadius: 6, fontSize: 12, color: "#0f172a" }}>
            <b>Amount in Words:</b> <i>{amountToWords(salary.net)}</i>
          </div>

          <div style={{ marginTop: 20, fontSize: 10, color: "#64748b", textAlign: "center" }}>
            System-generated slip. Payroll pushed to Accounts as monthly aggregate for GM final approval.
          </div>
        </div>
      )}
    </div>
  );
};

// Celebrations: find employees whose birthday or work-anniversary falls in
// the next `windowDays` (default 7). Returns { birthdays, anniversaries }.
const getCelebrations = (emps, windowDays = 7) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parse = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  const nextOccurrence = (date) => {
    const t = new Date(today.getFullYear(), date.getMonth(), date.getDate());
    if (t < today) t.setFullYear(today.getFullYear() + 1);
    return t;
  };
  const diffDays = (d) => Math.round((d - today) / 86400000);

  const birthdays = [], anniversaries = [];
  emps.filter((e) => Number(e.step) === 5 && (e.status || "Active") !== "Exited").forEach((e) => {
    const dob = parse(e.dob);
    if (dob) {
      const nxt = nextOccurrence(dob);
      const inDays = diffDays(nxt);
      if (inDays >= 0 && inDays <= windowDays) birthdays.push({ emp: e, when: nxt, inDays });
    }
    const doj = parse(e.doj);
    if (doj && doj < today) {
      const nxt = nextOccurrence(doj);
      const inDays = diffDays(nxt);
      if (inDays >= 0 && inDays <= windowDays) {
        const yearsCompleted = nxt.getFullYear() - doj.getFullYear();
        if (yearsCompleted >= 1) anniversaries.push({ emp: e, when: nxt, inDays, yearsCompleted });
      }
    }
  });
  birthdays.sort((a, b) => a.inDays - b.inDays);
  anniversaries.sort((a, b) => a.inDays - b.inDays);
  return { birthdays, anniversaries };
};

const CelebrationBanner = ({ emps }) => {
  const { birthdays, anniversaries } = useMemo(() => getCelebrations(emps, 7), [emps]);
  if (birthdays.length === 0 && anniversaries.length === 0) {
    return (
      <div data-testid="hr-celebration-banner" style={{
        marginTop: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
        background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 10,
        fontSize: 12, color: "#64748b",
      }}>
        <PartyPopper size={16} style={{ color: "#be185d" }} />
        Aane wale 7 din me koi birthday ya work anniversary nahi hai.
      </div>
    );
  }
  const whenLabel = (inDays, when) => {
    if (inDays === 0) return "Today!";
    if (inDays === 1) return "Tomorrow";
    return `${when.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · in ${inDays} d`;
  };

  const Pane = ({ title, items, tone, icon: Icon, renderExtra, emptyText }) => (
    <div style={{ flex: 1, minWidth: 280, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.24)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, letterSpacing: .4, textTransform: "uppercase", marginBottom: 8 }}>
        <Icon size={14} /> {title}
        <span style={{ marginLeft: "auto", padding: "1px 8px", background: "rgba(255,255,255,.22)", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)" }}>{emptyText}</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          {items.slice(0, 5).map((it) => (
            <li key={it.emp.id} data-testid={`celebration-${it.emp.id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "rgba(255,255,255,.1)", borderRadius: 6, fontSize: 11.5 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10, flexShrink: 0 }}>
                {(it.emp.fullName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.emp.fullName}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.78)" }}>{it.emp.designation || "—"} · {it.emp.empCode}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#fff" }}>{whenLabel(it.inDays, it.when)}</div>
                {renderExtra && <div style={{ fontSize: 9.5, color: "#fde68a", fontWeight: 700 }}>{renderExtra(it)}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div data-testid="hr-celebration-banner" style={{
      marginTop: 14, padding: 14,
      background: "linear-gradient(135deg, #be185d 0%, #c2410c 55%, #a16207 100%)",
      color: "#fff", borderRadius: 12,
      boxShadow: "0 8px 24px rgba(190,24,93,.28)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", right: -20, top: -20, opacity: .08, pointerEvents: "none" }}>
        <PartyPopper size={160} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <PartyPopper size={20} />
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase" }}>Celebrations This Week</div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Pane title="Birthdays" items={birthdays} tone="#be185d" icon={Cake} emptyText="No birthdays in the next 7 days" />
        <Pane title="Work Anniversaries" items={anniversaries} tone="#c2410c" icon={Trophy} emptyText="No anniversaries in the next 7 days" renderExtra={(it) => `${it.yearsCompleted} yr${it.yearsCompleted > 1 ? "s" : ""} completed`} />
      </div>
    </div>
  );
};

// ================== LEAVE APPLICATIONS ==================
const LeavesTab = ({ writeAllowed, approveAllowed }) => {
  const [emps] = useState(() => getEmployees().filter((e) => Number(e.step) === 5));
  const [list, setList] = useState(getLeaves());
  const [cur, setCur] = useState(createLeaveDraft(emps[0]?.id || ""));
  const refresh = () => setList(getLeaves());
  const set = (k, v) => setCur((p) => ({ ...p, [k]: v }));

  const daysBetween = (f, t) => {
    const d1 = new Date(f), d2 = new Date(t);
    if (!d1 || !d2 || d2 < d1) return 0;
    return Math.round((d2 - d1) / 86400000) + 1;
  };

  const save = () => {
    if (!cur.empId) return toast.error("Select employee");
    if (!cur.reason.trim()) return toast.error("Reason required");
    const next = { ...cur, days: daysBetween(cur.from, cur.to) };
    upsertLeave(next); refresh(); setCur(next);
    toast.success("Leave saved as draft");
  };
  const submit = () => {
    save();
    const list = getLeaves();
    const idx = list.findIndex((x) => x.id === cur.id);
    if (idx >= 0) { list[idx].status = 2; saveLeaves(list); refresh(); setCur(list[idx]); toast.success("Submitted to HR"); }
  };
  const decide = (id, ok) => {
    if (!approveAllowed) return toast.error("Only Admin / SuperAdmin");
    approveLeave(id, ok); refresh();
    toast.success(ok ? "Approved — attendance auto-marked as Leave" : "Rejected");
  };
  const remove = (id) => { if (!window.confirm("Delete leave?")) return; deleteLeave(id); refresh(); };

  if (emps.length === 0) return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Pehle Employees tab me kam se kam ek employee finalize karo.</div>;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: "#f8fafc", padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <F label="Employee"><select value={cur.empId} onChange={(e) => set("empId", e.target.value)} style={inputStyle} data-testid="lv-emp">{emps.map((e) => <option key={e.id} value={e.id}>{`${e.empCode} — ${e.fullName}`}</option>)}</select></F>
        <F label="Type"><select value={cur.type} onChange={(e) => set("type", e.target.value)} style={inputStyle}>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
        <F label="From"><input type="date" value={cur.from} onChange={(e) => set("from", e.target.value)} style={inputStyle} /></F>
        <F label="To"><input type="date" value={cur.to} onChange={(e) => set("to", e.target.value)} style={inputStyle} /></F>
        <F label="Days (auto)"><input value={daysBetween(cur.from, cur.to)} readOnly style={{ ...inputStyle, background: "#eef2ff", fontWeight: 700, textAlign: "center" }} /></F>
        <F label="Reason"><input value={cur.reason} onChange={(e) => set("reason", e.target.value)} style={inputStyle} placeholder="Short reason" data-testid="lv-reason" /></F>
        <div style={{ gridColumn: "span 6", display: "flex", gap: 6 }}>
          <button data-testid="lv-save" onClick={save} disabled={!writeAllowed} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Save size={13} style={{ verticalAlign: -2 }} /> Save</button>
          <button data-testid="lv-submit" onClick={submit} disabled={!writeAllowed} style={{ padding: "6px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Submit to HR</button>
          <button onClick={() => setCur(createLeaveDraft(emps[0]?.id || ""))} style={{ padding: "6px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>New</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <thead><tr style={{ background: "#f8fafc" }}>
          {["Employee", "Type", "From", "To", "Days", "Reason", "Status", "Actions"].map((h) => <th key={h} style={{ padding: 7, textAlign: "left", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
        </tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No leave applications</td></tr> : list.map((l, i) => {
          const emp = emps.find((e) => e.id === l.empId);
          const toneByStatus = { 1: "#64748b", 2: "#f59e0b", 3: "#16a34a", 4: "#dc2626" };
          return (
            <tr key={l.id} data-testid={`lv-row-${l.id}`} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
              <td style={{ padding: 7 }}>{emp ? `${emp.empCode} · ${emp.fullName}` : "—"}</td>
              <td style={{ padding: 7, fontWeight: 700 }}>{l.type}</td>
              <td style={{ padding: 7 }}>{fmtDMY(l.from)}</td>
              <td style={{ padding: 7 }}>{fmtDMY(l.to)}</td>
              <td style={{ padding: 7, textAlign: "center" }}>{l.days}</td>
              <td style={{ padding: 7 }}>{l.reason}</td>
              <td style={{ padding: 7, color: toneByStatus[l.status], fontWeight: 700 }}>{LEAVE_STATUS[l.status]}</td>
              <td style={{ padding: 4, whiteSpace: "nowrap" }}>
                {l.status === 2 && approveAllowed && <>
                  <button data-testid={`lv-approve-${l.id}`} onClick={() => decide(l.id, true)} style={{ padding: "3px 8px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✓ Approve</button>
                  <button data-testid={`lv-reject-${l.id}`} onClick={() => decide(l.id, false)} style={{ padding: "3px 8px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✕ Reject</button>
                </>}
                <button data-testid={`lv-print-${l.id}`} onClick={() => printLeaveApplication(l, emp)} style={{ padding: "3px 8px", background: "#eef2ff", color: "#3730a3", border: "1px solid #a5b4fc", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>📄 Print</button>
                <button onClick={() => remove(l.id)} style={{ padding: "3px 8px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>🗑</button>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
};

// ================== RECRUITMENT ==================
const RecruitTab = ({ writeAllowed }) => {
  const [list, setList] = useState(getRecruitments());
  const [cur, setCur] = useState(createRecruitDraft());
  const refresh = () => setList(getRecruitments());
  const set = (k, v) => setCur((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!cur.candidateName.trim()) return toast.error("Candidate name required");
    if (!cur.position.trim()) return toast.error("Position required");
    upsertRecruit(cur); refresh();
    toast.success("Candidate saved");
  };
  const changeStatus = (r, newStatus) => { upsertRecruit({ ...r, status: newStatus }); refresh(); };
  const convertToEmp = (r) => {
    if (!window.confirm(`Convert ${r.candidateName} into an Employee draft?`)) return;
    const emp = convertRecruitToEmployee(r); refresh();
    toast.success(`Employee draft ${emp.tempCode} auto-created. Switch to Employees tab to complete.`);
  };
  const remove = (id) => { if (!window.confirm("Delete?")) return; deleteRecruit(id); refresh(); };

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: "#f8fafc", padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <F label="Candidate Name"><input value={cur.candidateName} onChange={(e) => set("candidateName", e.target.value)} style={inputStyle} data-testid="rec-name" /></F>
        <F label="Mobile"><input value={cur.candidateMobile} onChange={(e) => set("candidateMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} style={inputStyle} /></F>
        <F label="Email"><input value={cur.candidateEmail} onChange={(e) => set("candidateEmail", e.target.value)} style={inputStyle} /></F>
        <F label="Position Applied"><input value={cur.position} onChange={(e) => set("position", e.target.value)} style={inputStyle} data-testid="rec-pos" /></F>
        <F label="Department"><select value={cur.department} onChange={(e) => set("department", e.target.value)} style={inputStyle}>{["Operations", "Site", "Purchase", "Accounts", "HR", "Admin", "Sales", "Store"].map((d) => <option key={d}>{d}</option>)}</select></F>
        <F label="Experience (yrs)"><input type="number" value={cur.experienceYears} onChange={(e) => set("experienceYears", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Qualification"><input value={cur.qualification} onChange={(e) => set("qualification", e.target.value)} style={inputStyle} /></F>
        <F label="Offered CTC (annual ₹)"><input type="number" value={cur.offerCTC} onChange={(e) => set("offerCTC", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Offer Date"><input type="date" value={cur.offerDate} onChange={(e) => set("offerDate", e.target.value)} style={inputStyle} /></F>
        <F label="Remarks"><input value={cur.remarks} onChange={(e) => set("remarks", e.target.value)} style={inputStyle} /></F>
        <div style={{ gridColumn: "span 4", display: "flex", gap: 6 }}>
          <button data-testid="rec-save" onClick={save} disabled={!writeAllowed} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Save size={13} style={{ verticalAlign: -2 }} /> Save Candidate</button>
          <button onClick={() => setCur(createRecruitDraft())} style={{ padding: "6px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>New</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <thead><tr style={{ background: "#f8fafc" }}>{["Candidate", "Position", "Dept", "Exp", "CTC", "Status", "Actions"].map((h) => <th key={h} style={{ padding: 7, textAlign: "left", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No candidates yet</td></tr> : list.map((r, i) => (
          <tr key={r.id} data-testid={`rec-row-${r.id}`} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
            <td style={{ padding: 7 }}>{r.candidateName}<div style={{ fontSize: 9.5, color: "#64748b" }}>{r.candidateMobile} · {r.candidateEmail}</div></td>
            <td style={{ padding: 7 }}>{r.position}</td>
            <td style={{ padding: 7 }}>{r.department}</td>
            <td style={{ padding: 7, textAlign: "center" }}>{r.experienceYears}</td>
            <td style={{ padding: 7, textAlign: "right" }}>₹ {Number(r.offerCTC || 0).toLocaleString("en-IN")}</td>
            <td style={{ padding: 7 }}>
              <select value={r.status} onChange={(e) => changeStatus(r, +e.target.value)} disabled={r.status === 5} style={{ padding: 3, fontSize: 10, fontWeight: 700, borderRadius: 4 }}>
                {Object.entries(RECRUIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </td>
            <td style={{ padding: 4, whiteSpace: "nowrap" }}>
              {(r.status >= 4) && <button data-testid={`rec-offer-${r.id}`} onClick={() => printOfferLetter(r)} style={{ padding: "3px 8px", background: "#eef2ff", color: "#3730a3", border: "1px solid #a5b4fc", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>📄 Offer Letter</button>}
              {r.status === 4 && !r.joinedEmpId && <button data-testid={`rec-convert-${r.id}`} onClick={() => convertToEmp(r)} style={{ padding: "3px 8px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>→ Emp Draft</button>}
              {r.joinedEmpId && <span style={{ fontSize: 10, color: "#166534", fontWeight: 700, marginRight: 4 }}>✓ Joined</span>}
              <button onClick={() => remove(r.id)} style={{ padding: "3px 8px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>🗑</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
};

// ================== EXIT & F&F ==================
const ExitTab = ({ writeAllowed, approveAllowed }) => {
  const [emps] = useState(() => getEmployees().filter((e) => Number(e.step) === 5 && (e.status || "Active") !== "Exited"));
  const [list, setList] = useState(getExits());
  const [cur, setCur] = useState(createExitDraft(emps[0]?.id || ""));
  const refresh = () => setList(getExits());
  const set = (k, v) => setCur((p) => ({ ...p, [k]: v }));
  const setClear = (dept, v) => setCur((p) => ({ ...p, clearance: { ...p.clearance, [dept]: v } }));

  const save = () => {
    if (!cur.empId) return toast.error("Select employee");
    const saved = upsertExit(cur); setCur(saved); refresh();
    toast.success("Exit saved as Draft");
  };
  const submit = () => {
    if (!writeAllowed) return toast.error("Not permitted");
    if (!cur.empId) return toast.error("Select employee");
    if (!cur.lastWorkingDay) return toast.error("Set Last Working Day before submission");
    const allCleared = cur.clearance && Object.values(cur.clearance).every((v) => v === true);
    if (!allCleared) {
      if (!window.confirm("All departmental clearances are not ticked. Submit to GM anyway?")) return;
    }
    const saved = upsertExit(cur);
    const next = advanceExitStep(saved);
    setCur(next); refresh();
    toast.success(`Exit of ${next.empName || "employee"} submitted to GM for approval`);
  };
  const settleByAccounts = (x) => {
    if (!approveAllowed) return toast.error("Only Admin / SuperAdmin / Accounts");
    if (!window.confirm("Settle F&F and auto-generate Payment Voucher?")) return;
    const n = advanceExitStep(x); refresh();
    toast.success(`F&F settled · Payment Voucher ${n.linkedPvNo || ""} generated`);
  };
  const finalize = (id) => {
    if (!approveAllowed) return toast.error("Only Admin / SuperAdmin");
    if (!window.confirm("Fast-forward: finalize F&F and mark employee Exited?")) return;
    finalizeExit(id); refresh();
    toast.success("Employee exited · F&F settled");
  };
  const remove = (id) => { if (!window.confirm("Delete?")) return; deleteExit(id); refresh(); };

  const fnf = (Number(cur.pendingDues) || 0) + (Number(cur.bonusDue) || 0) + (Number(cur.leaveEncash) || 0) + (Number(cur.gratuity) || 0) - (Number(cur.loanDeduction) || 0) - (Number(cur.noticeRecovery) || 0);

  if (emps.length === 0 && getExits().length === 0) return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No active employees to exit, and no exit history yet.</div>;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: "#f8fafc", padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <F label="Employee"><select value={cur.empId} onChange={(e) => set("empId", e.target.value)} style={inputStyle} data-testid="exit-emp">{emps.map((e) => <option key={e.id} value={e.id}>{`${e.empCode} — ${e.fullName}`}</option>)}</select></F>
        <F label="Resignation Date"><input type="date" value={cur.resignDate} onChange={(e) => set("resignDate", e.target.value)} style={inputStyle} /></F>
        <F label="Last Working Day"><input type="date" value={cur.lastWorkingDay} onChange={(e) => set("lastWorkingDay", e.target.value)} style={inputStyle} /></F>
        <F label="Reason"><input value={cur.reason} onChange={(e) => set("reason", e.target.value)} style={inputStyle} placeholder="e.g. Better opportunity" /></F>
        <div style={{ gridColumn: "span 4", padding: 10, background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#4c1d95", marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>Multi-Dept Clearance</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["hr", "accounts", "admin", "it", "store", "project"].map((d) => (
              <label key={d} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: cur.clearance?.[d] ? "#16a34a" : "#64748b", textTransform: "uppercase" }}>
                <input type="checkbox" checked={!!cur.clearance?.[d]} onChange={(e) => setClear(d, e.target.checked)} data-testid={`exit-clear-${d}`} />
                {d === "project" ? "Project Site" : d}
              </label>
            ))}
          </div>
        </div>
        <F label="Pending Dues (₹)"><input type="number" value={cur.pendingDues} onChange={(e) => set("pendingDues", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Bonus Due (₹)"><input type="number" value={cur.bonusDue} onChange={(e) => set("bonusDue", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Leave Encashment (₹)"><input type="number" value={cur.leaveEncash} onChange={(e) => set("leaveEncash", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Gratuity (₹)"><input type="number" value={cur.gratuity} onChange={(e) => set("gratuity", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Loan Deduction (₹)"><input type="number" value={cur.loanDeduction} onChange={(e) => set("loanDeduction", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="Notice Recovery (₹)"><input type="number" value={cur.noticeRecovery} onChange={(e) => set("noticeRecovery", +e.target.value || 0)} style={inputStyle} /></F>
        <F label="F&F Net (auto)"><input value={fnf.toLocaleString("en-IN")} readOnly style={{ ...inputStyle, background: fnf >= 0 ? "#dcfce7" : "#fee2e2", fontWeight: 800, color: fnf >= 0 ? "#166534" : "#991b1b", textAlign: "right" }} /></F>
        <div style={{ gridColumn: "span 4", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button data-testid="exit-new" onClick={() => setCur(createExitDraft(emps[0]?.id || ""))} style={{ padding: "6px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Plus size={13} style={{ verticalAlign: -2 }} /> New</button>
          <button data-testid="exit-save" onClick={save} disabled={!writeAllowed} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Save size={13} style={{ verticalAlign: -2 }} /> Save</button>
          <button data-testid="exit-edit" onClick={save} disabled={!writeAllowed || Number(cur.status) >= 2} style={{ padding: "6px 12px", background: Number(cur.status) >= 2 ? "#94a3b8" : "#eab308", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && Number(cur.status) < 2 ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Edit3 size={13} style={{ verticalAlign: -2 }} /> Edit</button>
          <button data-testid="exit-submit" onClick={submit} disabled={!writeAllowed || Number(cur.status) >= 2} style={{ padding: "6px 12px", background: Number(cur.status) >= 2 ? "#94a3b8" : "#be185d", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && Number(cur.status) < 2 ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Submit to GM</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <thead><tr style={{ background: "#f8fafc" }}>{["Employee", "Resign Date", "LWD", "Clearance", "F&F Net", "Status", "Actions"].map((h) => <th key={h} style={{ padding: 7, textAlign: "left", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>No exits</td></tr> : list.map((x, i) => {
          const emp = getEmployees().find((e) => e.id === x.empId);
          const clearedCount = Object.values(x.clearance || {}).filter(Boolean).length;
          const totalClear = Object.keys(x.clearance || {}).length || 6;
          const statusTone = Number(x.status) === 4 ? "#166534" : Number(x.status) === 3 ? "#1d4ed8" : Number(x.status) === 2 ? "#b45309" : "#64748b";
          return (
            <tr key={x.id} data-testid={`exit-row-${x.id}`} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
              <td style={{ padding: 7 }}>{emp ? `${emp.empCode} · ${emp.fullName}` : (x.empName || x.empCode || "—")}</td>
              <td style={{ padding: 7 }}>{fmtDMY(x.resignDate)}</td>
              <td style={{ padding: 7 }}>{fmtDMY(x.lastWorkingDay) || "—"}</td>
              <td style={{ padding: 7, fontWeight: 700, color: clearedCount === totalClear ? "#166534" : "#f59e0b" }}>{clearedCount} / {totalClear}</td>
              <td style={{ padding: 7, textAlign: "right", fontWeight: 700 }}>₹ {Number(x.fnfNet || 0).toLocaleString("en-IN")}</td>
              <td style={{ padding: 7, fontWeight: 700, color: statusTone }}>{EXIT_STATUS[x.status]}</td>
              <td style={{ padding: 4, whiteSpace: "nowrap" }}>
                {Number(x.status) === 1 && <button data-testid={`exit-edit-${x.id}`} onClick={() => setCur(x)} style={{ padding: "3px 8px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}><Edit3 size={10} style={{ verticalAlign: -1 }} /> Edit</button>}
                {Number(x.status) === 1 && writeAllowed && <button data-testid={`exit-submit-${x.id}`} onClick={() => { setCur(x); submit(); }} style={{ padding: "3px 8px", background: "#fce7f3", color: "#be185d", border: "1px solid #f9a8d4", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}><Send size={10} style={{ verticalAlign: -1 }} /> Submit to GM</button>}
                {Number(x.status) === 2 && <span style={{ padding: "3px 8px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, fontSize: 10, fontWeight: 700, marginRight: 4 }}>⏳ Awaiting GM</span>}
                {Number(x.status) === 3 && approveAllowed && <button data-testid={`exit-settle-${x.id}`} onClick={() => settleByAccounts(x)} style={{ padding: "3px 8px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>💰 Settle · Accounts Pay</button>}
                <button data-testid={`exit-fnf-${x.id}`} onClick={() => printFnFStatement(emp, x)} style={{ padding: "3px 8px", background: "#f0fdf4", color: "#14532d", border: "1px solid #86efac", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}><Printer size={10} style={{ verticalAlign: -1 }} /> F&F PDF</button>
                {Number(x.status) === 4 && emp && <>
                  <button data-testid={`exit-exp-${x.id}`} onClick={() => printExperienceLetter(emp, x)} style={{ padding: "3px 8px", background: "#eef2ff", color: "#3730a3", border: "1px solid #a5b4fc", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>📄 Experience</button>
                  <button data-testid={`exit-rel-${x.id}`} onClick={() => printRelievingLetter(emp, x)} style={{ padding: "3px 8px", background: "#fef3c7", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>📄 Relieving</button>
                  {x.linkedPvNo && <span style={{ padding: "3px 8px", background: "#e0e7ff", color: "#3730a3", border: "1px solid #a5b4fc", borderRadius: 3, fontSize: 10, fontWeight: 700, marginRight: 4 }}>PV: {x.linkedPvNo}</span>}
                </>}
                <button onClick={() => remove(x.id)} style={{ padding: "3px 8px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>🗑</button>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
};

// ================== COMPLIANCE SNAPSHOT ==================
const ComplianceTab = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const snap = useMemo(() => getComplianceSnapshot(year, month), [year, month]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(snap.rows), `PF-ESIC-${year}${month}`);
    XLSX.writeFile(wb, `compliance_${year}_${String(month).padStart(2, "0")}.xlsx`);
    toast.success("Compliance sheet exported");
  };

  const Stat = ({ label, value, tone }) => (
    <div style={{ padding: 10, background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${tone}`, borderRadius: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>₹ {Number(value || 0).toLocaleString("en-IN")}</div>
    </div>
  );

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: 5 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("en-IN", { month: "long" })}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: 5, width: 80 }} />
        <button data-testid="comp-export" onClick={exportExcel} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Download size={13} style={{ verticalAlign: -2 }} /> Export Compliance Excel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }} data-testid="comp-stats">
        <Stat label="Active Employees" value={snap.employeeCount} tone="#0369a1" />
        <Stat label="Gross Payroll" value={snap.totalGross} tone="#16a34a" />
        <Stat label="PF Challan" value={snap.totalPF} tone="#7c3aed" />
        <Stat label="ESIC Challan" value={snap.totalESIC} tone="#f59e0b" />
        <Stat label="Prof. Tax" value={snap.totalPT} tone="#0d9488" />
        <Stat label="TDS" value={snap.totalTDS} tone="#dc2626" />
        <Stat label="Net Paid" value={snap.totalNet} tone="#0f172a" />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <thead><tr style={{ background: "#f8fafc" }}>{["Code", "Name", "PAN", "UAN", "ESIC", "Gross", "PF", "ESIC", "PT", "TDS", "Net"].map((h) => <th key={h} style={{ padding: 7, textAlign: "left", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700 }}>{h}</th>)}</tr></thead>
        <tbody>{snap.rows.map((r, i) => (
          <tr key={r.empCode} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
            <td style={{ padding: 7, fontWeight: 700 }}>{r.empCode}</td>
            <td style={{ padding: 7 }}>{r.name}</td>
            <td style={{ padding: 7 }}>{r.pan || "—"}</td>
            <td style={{ padding: 7 }}>{r.uan || "—"}</td>
            <td style={{ padding: 7 }}>{r.esicNo || "—"}</td>
            <td style={{ padding: 7, textAlign: "right" }}>{r.gross.toLocaleString("en-IN")}</td>
            <td style={{ padding: 7, textAlign: "right" }}>{r.pf.toLocaleString("en-IN")}</td>
            <td style={{ padding: 7, textAlign: "right" }}>{r.esic.toLocaleString("en-IN")}</td>
            <td style={{ padding: 7, textAlign: "right" }}>{r.proftax.toLocaleString("en-IN")}</td>
            <td style={{ padding: 7, textAlign: "right" }}>{r.tds.toLocaleString("en-IN")}</td>
            <td style={{ padding: 7, textAlign: "right", fontWeight: 700, color: "#166534" }}>{r.net.toLocaleString("en-IN")}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
};

// -------------- Pay Bill (Monthly Salary Bill with Advance Adjustment) --------------
const PayBillTab = ({ writeAllowed, approveAllowed }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [list, setList] = useState([]);
  const [cur, setCur] = useState(null);

  useEffect(() => { setList(getPayBills()); }, []);
  const refresh = () => setList(getPayBills());

  const createDraft = () => {
    const d = createPayBillDraft(Number(year), Number(month));
    if (!d.lines.length) { toast.error("No active finalized employees found. Create & approve employees first."); return; }
    const saved = upsertPayBill(d);
    setCur(saved); refresh();
    toast.success(`Draft Pay Bill created · ${saved.lines.length} employees · Net ₹ ${saved.totalNet.toLocaleString("en-IN")}`);
  };

  const setLine = (idx, key, val) => {
    const num = Number(val) || 0;
    const next = { ...cur, lines: cur.lines.map((l, i) => i === idx ? { ...l, [key]: num } : l) };
    setCur(next);
  };

  const saveDraft = () => { const s = upsertPayBill(cur); setCur(s); refresh(); toast.success("Pay Bill saved"); };

  const submit = () => {
    if (!writeAllowed) return toast.error("Not permitted");
    const saved = upsertPayBill(cur);
    const next = advancePayBillStep(saved);
    setCur(next); refresh();
    toast.success(`Pay Bill submitted to GM for approval`);
  };

  const approveNow = () => {
    if (!approveAllowed) return toast.error("Only Admin / SuperAdmin can approve");
    const next = advancePayBillStep(cur);
    setCur(next); refresh();
    toast.success(`Pay Bill approved · Status: ${PAYBILL_STATUS[next.step]}`);
  };

  const settle = () => {
    if (!approveAllowed) return toast.error("Only Admin / SuperAdmin can settle");
    const next = advancePayBillStep(cur);
    setCur(next); refresh();
    toast.success(`Pay Bill settled & marked paid`);
  };

  const remove = (id) => { if (!window.confirm("Delete this pay bill?")) return; deletePayBill(id); setCur(null); refresh(); };

  const locked = cur && Number(cur.step) >= 2;
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");

  return (
    <div style={{ padding: 14 }}>
      {/* Create section */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div><label style={{ fontSize: 10.5, fontWeight: 700, color: "#334155" }}>Month</label><select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: 6, fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, minWidth: 120, display: "block", marginTop: 4 }} data-testid="pb-month">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}</select></div>
        <div><label style={{ fontSize: 10.5, fontWeight: 700, color: "#334155" }}>Year</label><input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: 6, fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, width: 100, display: "block", marginTop: 4 }} data-testid="pb-year" /></div>
        <button onClick={createDraft} disabled={!writeAllowed} data-testid="pb-create" style={{ padding: "7px 14px", background: writeAllowed ? "#0369a1" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Plus size={13} style={{ verticalAlign: -2 }} /> Create / Refresh Draft</button>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>Pay Bill compute from Attendance · All finalized active employees</div>
      </div>

      {/* Editor */}
      {cur && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{cur.refNo} · {new Date(cur.year, cur.month - 1).toLocaleString("en", { month: "long" })} {cur.year} · <span style={{ background: "#fbbf24", color: "#78350f", padding: "1px 8px", borderRadius: 3, marginLeft: 6, fontSize: 10 }}>{PAYBILL_STATUS[cur.step]}</span></div>
            <div style={{ fontSize: 11 }}>Gross <b>₹{inrN(cur.totalGross)}</b> · Ded <b>₹{inrN(cur.totalDeductions)}</b> · Adv <b>₹{inrN(cur.totalAdvance)}</b> · <span style={{ color: "#86efac" }}>NET <b style={{ fontSize: 13 }}>₹{inrN(cur.totalNet)}</b></span></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["#", "EMP Code", "Name", "Designation", "Days P/T", "Gross", "PF", "ESIC", "P.Tax", "TDS", "Advance", "Other Ded.", "NET"].map((h) => <th key={h} style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontSize: 10, textAlign: "center" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {cur.lines.map((l, i) => (
                  <tr key={l._id} data-testid={`pb-row-${i}`} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 10 }}>{l.empCode}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", fontWeight: 700 }}>{l.name}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", fontSize: 10, color: "#64748b" }}>{l.designation}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "center", fontSize: 10 }}>{l.daysPresent}/{l.daysInMonth}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, background: "#ecfdf5" }}>₹{inrN(l.gross)}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "right", background: "#fef2f2" }}>₹{inrN(l.pf)}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "right", background: "#fef2f2" }}>₹{inrN(l.esic)}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "right", background: "#fef2f2" }}>₹{inrN(l.proftax)}</td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "right", background: "#fef2f2" }}>₹{inrN(l.tds)}</td>
                    <td style={{ padding: 2, border: "1px solid #e2e8f0", background: "#fef3c7" }}>
                      <input type="number" value={l.advance || 0} onChange={(e) => setLine(i, "advance", e.target.value)} disabled={locked} data-testid={`pb-advance-${i}`} style={{ width: "100%", padding: 3, fontSize: 11, border: "1px solid #fbbf24", borderRadius: 3, textAlign: "right", background: locked ? "#fef9c3" : "#fffbeb" }} />
                    </td>
                    <td style={{ padding: 2, border: "1px solid #e2e8f0" }}>
                      <input type="number" value={l.otherDeductions || 0} onChange={(e) => setLine(i, "otherDeductions", e.target.value)} disabled={locked} style={{ width: "100%", padding: 3, fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: 4, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800, background: "#0f172a", color: "#fff" }}>₹{inrN(Math.max(0, l.gross - l.pf - l.esic - l.proftax - l.tds - (Number(l.advance) || 0) - (Number(l.otherDeductions) || 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
            <button data-testid="pb-save" onClick={saveDraft} disabled={locked || !writeAllowed} style={{ padding: "7px 14px", background: locked || !writeAllowed ? "#cbd5e1" : "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: locked || !writeAllowed ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}><Save size={13} style={{ verticalAlign: -2 }} /> Save</button>
            <button data-testid="pb-submit" onClick={submit} disabled={locked || !writeAllowed} style={{ padding: "7px 14px", background: locked || !writeAllowed ? "#cbd5e1" : "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: locked || !writeAllowed ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Submit to GM</button>
            {Number(cur.step) === 2 && <button data-testid="pb-approve" onClick={approveNow} disabled={!approveAllowed} style={{ padding: "7px 14px", background: approveAllowed ? "#dc2626" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> GM Approve</button>}
            {Number(cur.step) === 3 && <button data-testid="pb-settle" onClick={settle} disabled={!approveAllowed} style={{ padding: "7px 14px", background: approveAllowed ? "#0f766e" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><IndianRupee size={13} style={{ verticalAlign: -2 }} /> Mark Settled</button>}
            <button data-testid="pb-print" onClick={() => printPayBillSheet(cur)} style={{ padding: "7px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, marginLeft: "auto" }}><Printer size={13} style={{ verticalAlign: -2 }} /> Print A4 Landscape</button>
          </div>
        </div>
      )}

      {/* History */}
      {list.length > 0 && (
        <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>Pay Bill History ({list.length})</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ background: "#f8fafc" }}>{["Ref No.", "Period", "Employees", "Gross", "Advance", "Net Payable", "Status", "Action"].map((h) => <th key={h} style={{ padding: 7, border: "1px solid #e2e8f0", fontSize: 10, textAlign: "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {list.sort((a, b) => (b.monthKey || "").localeCompare(a.monthKey || "")).map((p) => (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setCur(p)}>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 10 }}>{p.refNo}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{new Date(p.year, p.month - 1).toLocaleString("en", { month: "long" })} {p.year}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>{p.lines?.length || 0}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>₹{inrN(p.totalGross)}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", color: "#78350f" }}>₹{inrN(p.totalAdvance)}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800, color: "#166534" }}>₹{inrN(p.totalNet)}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10, fontWeight: 700 }}>{PAYBILL_STATUS[p.step] || "Draft"}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <button onClick={(e) => { e.stopPropagation(); printPayBillSheet(p); }} style={{ padding: "3px 8px", background: "#eef2ff", color: "#3730a3", border: "1px solid #a5b4fc", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>📄 Print</button>
                    {approveAllowed && Number(p.step) === 1 && <button onClick={(e) => { e.stopPropagation(); remove(p.id); }} style={{ padding: "3px 8px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>🗑</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// -------------- Advance Register --------------
const AdvanceRegisterTab = () => {
  const [reg, setReg] = useState([]);
  useEffect(() => { setReg(getAdvanceRegister()); }, []);
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
  const totalAdvance = reg.reduce((a, r) => a + r.totalAdvance, 0);
  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1.5px solid #f59e0b", borderRadius: 8, padding: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#78350f", letterSpacing: 1, textTransform: "uppercase" }}>Advance Register · Live from Pay Bills</div>
          <div style={{ fontSize: 11, color: "#78350f", marginTop: 2 }}>Per-employee advance ledger aggregated across all monthly pay bills — tracks outstanding recoveries.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#78350f", letterSpacing: .5, textTransform: "uppercase" }}>Total Advance Granted</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#78350f" }}>₹ {inrN(totalAdvance)}</div>
        </div>
      </div>
      {reg.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 8 }}>No advance entries yet. Add Advance column in a Pay Bill row to populate this register.</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead><tr style={{ background: "#0f172a", color: "#fff" }}>{["#", "EMP Code", "Employee", "Department", "Advance Entries", "Total Advance (₹)"].map((h) => <th key={h} style={{ padding: 8, fontSize: 10, textAlign: "left", border: "1px solid #334155" }}>{h}</th>)}</tr></thead>
            <tbody>
              {reg.map((r, i) => (
                <tr key={r.empId} data-testid={`adv-row-${i}`} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{i + 1}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 10 }}>{r.empCode}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", color: "#64748b", fontSize: 10 }}>{r.department || "—"}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10 }}>
                    {r.lines.map((ln, j) => (
                      <span key={j} style={{ display: "inline-block", padding: "2px 7px", margin: 2, background: "#fef3c7", color: "#78350f", borderRadius: 3, border: "1px solid #fcd34d", fontWeight: 700 }}>
                        {new Date(ln.year, ln.month - 1).toLocaleString("en", { month: "short" })} {String(ln.year).slice(-2)}: ₹{inrN(ln.amount)}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800, fontSize: 13, color: "#78350f", background: "#fef3c7" }}>₹ {inrN(r.totalAdvance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// -------------- Loan Management --------------
const LoansTab = ({ writeAllowed, approveAllowed }) => {
  const emps = getEmployees().filter((e) => Number(e.step) === 5);
  const [list, setList] = useState([]);
  const [cur, setCur] = useState(null);
  useEffect(() => { setList(getLoans()); }, []);
  const refresh = () => setList(getLoans());
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");

  const startNew = () => setCur(createLoanDraft(emps[0]?.id || ""));
  const set = (k, v) => setCur((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!writeAllowed) return toast.error("Not permitted");
    if (!cur.empId) return toast.error("Select an employee");
    if (!cur.principal || cur.principal <= 0) return toast.error("Enter loan amount");
    const emp = emps.find((e) => e.id === cur.empId);
    const n = upsertLoan({ ...cur, empCode: emp?.empCode, empName: emp?.fullName, department: emp?.department, designation: emp?.designation });
    setCur(n); refresh();
    toast.success(`Loan saved · EMI ₹${inrN(n.emiAmount)}/month`);
  };
  const submit = () => { const n = advanceLoanStep(cur); setCur(n); refresh(); toast.success(`Loan submitted · ${LOAN_STATUS[n.status]}`); };
  const approve = () => {
    if (!approveAllowed) return toast.error("Only Admin/SuperAdmin can approve");
    const n = advanceLoanStep(cur); setCur(n); refresh(); toast.success(`Loan ${LOAN_STATUS[n.status]}`);
  };
  const disburse = () => { const n = advanceLoanStep(cur); setCur(n); refresh(); toast.success(`Loan disbursed · ₹${inrN(n.principal)}`); };
  const remove = (id) => { if (!window.confirm("Delete loan?")) return; deleteLoan(id); setCur(null); refresh(); };

  const locked = cur && Number(cur.status) >= 2;
  const emi = cur ? computeLoanEMI(cur.principal, cur.interestRate, cur.tenureMonths) : 0;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button data-testid="loan-new" onClick={startNew} style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Plus size={13} style={{ verticalAlign: -2 }} /> New Loan</button>
      </div>

      {cur && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 14 }}>
          <div style={{ padding: "10px 14px", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>Loan Application · <span style={{ background: "#fbbf24", color: "#78350f", padding: "1px 8px", borderRadius: 3, marginLeft: 6, fontSize: 10 }}>{LOAN_STATUS[cur.status]}</span></div>
            <div style={{ fontSize: 11 }}>Outstanding: <b style={{ color: "#fbbf24" }}>₹{inrN(cur.outstanding)}</b> · Paid EMIs: <b>{cur.paidEMIs || 0}</b>/{cur.tenureMonths}</div>
          </div>
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <F label="Employee" req>
              <select value={cur.empId} onChange={(e) => set("empId", e.target.value)} disabled={locked} style={inputStyle} data-testid="loan-emp">
                <option value="">— Select —</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.empCode} · {e.fullName}</option>)}
              </select>
            </F>
            <F label="Loan Type">
              <select value={cur.loanType} onChange={(e) => set("loanType", e.target.value)} disabled={locked} style={inputStyle}>
                <option>Personal</option><option>Medical</option><option>Festival</option><option>Housing</option><option>Education</option><option>Vehicle</option>
              </select>
            </F>
            <F label="Principal Amount (₹)" req><input type="number" value={cur.principal} onChange={(e) => set("principal", +e.target.value)} disabled={locked} style={inputStyle} data-testid="loan-amt" /></F>
            <F label="Interest Rate (% p.a.)"><input type="number" step="0.1" value={cur.interestRate} onChange={(e) => set("interestRate", +e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Tenure (months)" req><input type="number" value={cur.tenureMonths} onChange={(e) => set("tenureMonths", +e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="Start Month"><input type="month" value={cur.startMonth} onChange={(e) => set("startMonth", e.target.value)} disabled={locked} style={inputStyle} /></F>
            <F label="EMI (auto, ₹/month)"><input value={inrN(emi)} readOnly style={{ ...inputStyle, background: "#dcfce7", fontWeight: 800, color: "#166534", textAlign: "right" }} data-testid="loan-emi" /></F>
            <F label="Total Payable"><input value={`₹${inrN(emi * cur.tenureMonths)}`} readOnly style={{ ...inputStyle, background: "#fef3c7", fontWeight: 700, textAlign: "right" }} /></F>
            <F label="Purpose"><input value={cur.purpose} onChange={(e) => set("purpose", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 4" }} /></F>
          </div>
          <div style={{ padding: 12, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button data-testid="loan-save" onClick={save} disabled={locked || !writeAllowed} style={{ padding: "7px 14px", background: locked || !writeAllowed ? "#cbd5e1" : "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: locked || !writeAllowed ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}><Save size={13} style={{ verticalAlign: -2 }} /> Save</button>
            {Number(cur.status) === 1 && <button data-testid="loan-submit" onClick={submit} disabled={!writeAllowed} style={{ padding: "7px 14px", background: writeAllowed ? "#7c3aed" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Submit</button>}
            {Number(cur.status) === 2 && <button data-testid="loan-approve" onClick={approve} disabled={!approveAllowed} style={{ padding: "7px 14px", background: approveAllowed ? "#dc2626" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> GM Approve</button>}
            {Number(cur.status) === 3 && <button data-testid="loan-disburse" onClick={disburse} disabled={!approveAllowed} style={{ padding: "7px 14px", background: approveAllowed ? "#0f766e" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}><IndianRupee size={13} style={{ verticalAlign: -2 }} /> Mark Disbursed</button>}
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>All Loans ({list.length})</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ background: "#f8fafc" }}>{["EMP", "Employee", "Type", "Principal", "EMI/month", "Tenure", "Outstanding", "Paid EMI", "Status", "Action"].map((h) => <th key={h} style={{ padding: 7, border: "1px solid #e2e8f0", fontSize: 10, textAlign: "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setCur(l)}>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700, fontSize: 10 }}>{l.empCode}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontWeight: 700 }}>{l.empName}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{l.loanType}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>₹{inrN(l.principal)}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", background: "#dcfce7", fontWeight: 700 }}>₹{inrN(l.emiAmount)}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>{l.tenureMonths} m</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", color: "#991b1b", fontWeight: 700 }}>₹{inrN(l.outstanding)}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>{l.paidEMIs || 0}/{l.tenureMonths}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10, fontWeight: 700 }}>{LOAN_STATUS[l.status]}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0" }}><button onClick={(e) => { e.stopPropagation(); remove(l.id); }} style={{ padding: "2px 6px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 3, cursor: "pointer", fontSize: 10 }}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// -------------- ID Card Generator (Front + Back printable) --------------
// Design modelled after the user's reference artwork — portrait "lanyard" cards
// with navy + red decorative curves, round photo, signature line, and a note +
// emergency contact block on the back. Data mapping is unchanged.
const IDCardTab = () => {
  const emps = useMemo(() => getEmployees().filter((e) => Number(e.step) === 5), []);
  const [selectedId, setSelectedId] = useState(emps[0]?.id || "");
  const emp = emps.find((e) => e.id === selectedId);

  const COMPANY = {
    short: "ARUN ENTERPRISES",
    tagline: "OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY",
    addrLines: ["Arun Enterprises", "209H/1F/1 Ops Nagar", "Kalindipuram", "Prayagraj - 211011"],
    phone: "7080320222",
  };

  // Managers / Directors / Incharge → hide personal mobile on the FRONT only.
  // (The back always shows company email & phone — safe to display.)
  const isManagerRole = (desig = "") => {
    const d = String(desig).toLowerCase();
    return d.includes("manager") || d.includes("director") || d.includes("incharge");
  };

  // Returns the SVG markup for the top navy+red curved banner used on BOTH
  // front and back. Rendered via dangerouslySetInnerHTML + string template in
  // the print window.
  const TOP_SVG = `<svg viewBox="0 0 300 110" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:110px;">
    <path d="M0,0 L300,0 L300,70 Q220,110 150,80 Q70,55 0,95 Z" fill="#1e3a8a"/>
    <path d="M200,0 L300,0 L300,65 Q260,70 230,45 Q210,28 200,0 Z" fill="#dc2626"/>
  </svg>`;

  const BOTTOM_SVG = `<svg viewBox="0 0 300 70" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;bottom:0;left:0;width:100%;height:70px;">
    <path d="M0,70 L0,20 Q90,-10 180,20 Q240,38 300,10 L300,70 Z" fill="#1e3a8a"/>
    <path d="M0,70 L0,35 Q80,20 170,35 Q230,48 300,30 L300,70 Z" fill="#dc2626" opacity="0.95"/>
  </svg>`;

  const BACK_MIDDLE_WAVE = `<svg viewBox="0 0 300 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:40px;display:block;">
    <path d="M0,0 L300,0 L300,20 Q220,45 150,20 Q70,-5 0,25 Z" fill="#1e3a8a"/>
    <path d="M0,0 L300,0 L300,12 Q220,32 150,12 Q70,-5 0,15 Z" fill="#dc2626" opacity="0.9"/>
  </svg>`;

  const printCard = () => {
    if (!emp) { toast.error("Select an employee"); return; }
    const logo = (typeof window !== "undefined" && window.localStorage?.getItem("ae_vm_logo")) || "/arun-logo.jpg";
    const photo = emp.photoUrl || "";
    const hideMobile = isManagerRole(emp.designation);
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const emergency = emp.contactAltMobile || emp.contactMobile || "—";
    const empEmail = emp.contactEmail || "";
    const empMobile = emp.contactMobile || "";
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>ID Card ${esc(emp.empCode || "")}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 0; color: #0f172a; }
  .wrap { display: flex; flex-direction: column; gap: 18px; align-items: center; padding: 20px; }
  .pair { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; }
  .card { width: 60mm; height: 95mm; border-radius: 5mm; overflow: hidden; background: #fff; position: relative; box-shadow: 0 6px 18px rgba(15,23,42,.25); border: 1px solid #cbd5e1; }
  .lanyard { position: absolute; top: 3mm; left: 50%; transform: translateX(-50%); width: 10mm; height: 2.2mm; background: #0f172a; border-radius: 2mm; z-index: 5; }
  /* FRONT — solid 3-section layout matching back */
  .front { display: flex; flex-direction: column; }
  .front .ftop { background: #1e3a8a; color: #fff; padding: 5mm 3mm 2mm; display: flex; flex-direction: column; align-items: center; }
  .front .ftop .logo-box { width: 13mm; height: 13mm; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0.8mm 2mm rgba(0,0,0,.3); border: 0.4mm solid #fff; }
  .front .ftop .logo-box img { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }
  .front .ftop .cn { font-size: 11.5px; font-weight: 900; letter-spacing: 1.4px; margin-top: 1.2mm; }
  .front .ftop .tag { font-size: 6.5px; font-weight: 700; letter-spacing: .3px; color: #fbbf24; margin-top: 0.8mm; width: 92%; text-align: center; line-height: 1.2; }
  .front .fmid { padding: 2mm 3mm 0.5mm; flex: 1; display: flex; flex-direction: column; align-items: center; }
  .front .fmid .photo-ring { width: 30mm; height: 35mm; border-radius: 1.5mm; border: 0.6mm solid #1e3a8a; overflow: hidden; background: #f1f5f9 center/cover no-repeat; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #64748b; font-weight: 700; box-shadow: 0 0.5mm 1.5mm rgba(30,58,138,.25); flex-shrink: 0; }
  .front .fmid .name { font-size: 11px; font-weight: 900; letter-spacing: .8px; color: #1e3a8a; margin-top: 1.2mm; text-align: center; line-height: 1.1; }
  .front .fmid .desig { font-size: 8px; font-weight: 800; color: #dc2626; letter-spacing: 1.1px; text-transform: uppercase; margin-top: 0.5mm; text-align: center; }
  .front .fmid .rule { width: 16mm; height: 0.25mm; background: linear-gradient(90deg, transparent, #1e3a8a 25%, #dc2626 75%, transparent); margin: 1.2mm auto; }
  .front .fmid .data { width: 100%; margin-top: 0.5mm; font-size: 8.5px; }
  .front .fmid .data div { display: grid; grid-template-columns: 22mm 2mm 1fr; align-items: center; padding: 0.5mm 0; letter-spacing: .3px; border-bottom: 0.1mm solid #f1f5f9; }
  .front .fmid .data .k { font-weight: 800; color: #0f172a; letter-spacing: .4px; font-size: 8px; }
  .front .fmid .data .sep { color: #475569; font-weight: 800; text-align: center; }
  .front .fmid .data .v { font-weight: 800; color: #1e3a8a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8.5px; }
  .front .fbot { background: #1e3a8a; color: #fff; padding: 1mm 3mm 1.2mm; text-align: center; }
  .front .fbot .sline { font-family: "Brush Script MT", "Lucida Handwriting", cursive; font-size: 11px; color: #fff; font-style: italic; line-height: 1; }
  .front .fbot .slabel { font-size: 6px; font-weight: 800; letter-spacing: 1px; color: #fbbf24; border-top: 0.3mm solid #fff; padding-top: 0.3mm; margin-top: 0.3mm; width: 30mm; margin-left: auto; margin-right: auto; }
  /* BACK */
  .back .btop { position: relative; height: 42mm; background: #1e3a8a; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
  .back .btop .logo-box { width: 20mm; height: 20mm; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 1.2mm 3mm rgba(0,0,0,.4); border: 0.6mm solid #fff; }
  .back .btop .logo-box img { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }
  .back .btop .cn { font-size: 13px; font-weight: 900; letter-spacing: 1.5px; margin-top: 2mm; }
  .back .btop .tag { font-size: 6px; font-weight: 700; letter-spacing: .4px; color: #fbbf24; margin-top: 1px; }
  .back .bmid { padding: 3mm 5mm 1mm; font-size: 8px; color: #0f172a; }
  .back .bmid .empstrip { padding: 2mm 2.5mm; margin-bottom: 2.5mm; background: #f8fafc; border: 0.3mm dashed #cbd5e1; border-radius: 1.5mm; }
  .back .bmid .empstrip .eid { font-size: 10px; font-weight: 900; color: #1e3a8a; letter-spacing: .5px; }
  .back .bmid .empstrip .enm { font-size: 8.5px; font-weight: 800; color: #0f172a; margin-top: 0.6mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .back .bmid .empstrip .edg { font-size: 6.5px; font-weight: 700; color: #dc2626; letter-spacing: .5px; text-transform: uppercase; margin-top: 0.4mm; }
  .back .bmid h5 { margin: 0 0 1mm; font-size: 8.5px; font-weight: 900; color: #dc2626; letter-spacing: .8px; display: flex; align-items: center; gap: 2mm; }
  .back .bmid .line { margin: 0.3mm 0; font-weight: 700; color: #0f172a; }
  .back .bmid .block { margin-bottom: 2.5mm; }
  .back .bmid .ico { color: #dc2626; font-size: 10px; }
  .back .bbot { position: relative; margin-top: auto; background: #1e3a8a; color: #fff; padding: 2mm 4mm 3mm; }
  .back .bbot h5 { margin: 0 0 1mm; font-size: 8px; font-weight: 900; color: #fff; letter-spacing: 1px; }
  .back .bbot ul { list-style: none; padding: 0; margin: 0; }
  .back .bbot ul li { font-size: 6.8px; padding: 0.3mm 0 0.3mm 2.5mm; position: relative; color: #e2e8f0; }
  .back .bbot ul li:before { content: "•"; color: #dc2626; position: absolute; left: 0; }
  .back .emg { background: #fff; color: #1e3a8a; padding: 1.5mm; margin-top: 2mm; text-align: center; border-radius: 1mm; }
  .back .emg .lbl { font-size: 6.5px; font-weight: 800; letter-spacing: .4px; color: #0f172a; }
  .back .emg .num { font-size: 11px; font-weight: 900; color: #dc2626; letter-spacing: 1px; margin-top: 0.5mm; }
  .noprint { padding: 10px 20px; background: #0f172a; color: #fff; border: none; border-radius: 5px; font-weight: 700; cursor: pointer; margin-top: 6px; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
<div class="wrap">
  <button class="noprint" onclick="window.print()">🖨 Print / Save as PDF</button>
  <div class="pair">
    <!-- FRONT -->
    <div class="card front">
      <div class="lanyard"></div>
      <div class="ftop">
        <div class="logo-box"><img src="${logo}" alt="logo" onerror="this.style.display='none'"/></div>
        <div class="cn">${esc(COMPANY.short)}</div>
        <div class="tag">${esc(COMPANY.tagline)}</div>
      </div>
      <div class="fmid">
        <div class="photo-ring" ${photo ? `style="background-image:url('${photo}')"` : ""}>${photo ? "" : "PHOTO"}</div>
        <div class="name">${esc(emp.fullName || "—").toUpperCase()}</div>
        <div class="desig">${esc(emp.designation || "—")}</div>
        <div class="rule"></div>
        <div class="data">
          <div><span class="k">EMPLOYEE ID</span><span class="sep">:</span><span class="v">${esc(emp.empCode || emp.tempCode || "—")}</span></div>
          <div><span class="k">DEPARTMENT</span><span class="sep">:</span><span class="v">${esc((emp.department || "—").toUpperCase())}</span></div>
          <div><span class="k">BLOOD GROUP</span><span class="sep">:</span><span class="v">${esc(emp.bloodGroup || "—")}</span></div>
          <div><span class="k">DATE OF JOINING</span><span class="sep">:</span><span class="v">${emp.doj ? new Date(emp.doj).toLocaleDateString("en-GB") : "—"}</span></div>
          ${hideMobile ? "" : `<div><span class="k">MOBILE</span><span class="sep">:</span><span class="v">${esc(empMobile || "—")}</span></div>`}
        </div>
      </div>
      <div class="fbot">
        <div class="sline">${esc(emp.fullName || "—").split(" ").slice(0, 2).join(" ")}</div>
        <div class="slabel">AUTHORIZED SIGNATURE</div>
      </div>
    </div>
    <!-- BACK -->
    <div class="card back">
      <div class="lanyard"></div>
      <div class="btop">
        <div class="logo-box"><img src="${logo}" alt="logo" onerror="this.style.display='none'"/></div>
        <div class="cn">${esc(COMPANY.short)}</div>
        <div class="tag">${esc(COMPANY.tagline)}</div>
      </div>
      <div class="bmid">
        <div class="block">
          <h5><span class="ico">📍</span> REGISTERED OFFICE</h5>
          ${COMPANY.addrLines.map((l) => `<div class="line">${esc(l)}</div>`).join("")}
        </div>
        <div class="block">
          <h5><span class="ico">📞</span> CONTACT DETAILS</h5>
          <div class="line">✉ ${esc(empEmail || "—")}</div>
          <div class="line">🌐 ${esc(COMPANY.phone)}</div>
        </div>
      </div>
      ${BACK_MIDDLE_WAVE}
      <div class="bbot">
        <h5>NOTE:</h5>
        <ul>
          <li>This ID Card is the property of Arun Enterprises.</li>
          <li>This card is non-transferable.</li>
          <li>Return this card if found.</li>
        </ul>
        <div class="emg">
          <div class="lbl">IN CASE OF EMERGENCY, PLEASE CONTACT</div>
          <div class="num">${esc(emergency)}</div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { toast.error("Allow pop-ups to generate the ID Card"); return; }
    w.document.open(); w.document.write(html); w.document.close();
    toast.success(`ID Card generated for ${emp.empCode || emp.fullName}`);
  };

  if (emps.length === 0) return <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No finalized employees yet. Finalize at least one employee first.</div>;

  const hideMobile = emp ? isManagerRole(emp.designation) : false;
  const emergency = emp ? (emp.contactAltMobile || emp.contactMobile || "—") : "—";

  // Reusable preview card dimensions
  const CARD_W = 270, CARD_H = 430;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap", padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Select Employee (by EMP Code):</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} data-testid="idcard-emp-select" style={{ ...inputStyle, maxWidth: 420, width: "auto", flex: "1 1 320px" }}>
          {emps.map((e) => <option key={e.id} value={e.id}>{`${e.empCode || e.tempCode} — ${e.fullName}${e.designation ? " · " + e.designation : ""}`}</option>)}
        </select>
        <button onClick={printCard} data-testid="idcard-print" style={{ padding: "8px 16px", background: "linear-gradient(135deg,#1e3a8a 0%,#dc2626 100%)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 4px rgba(30,58,138,.3)" }}>
          <Printer size={14} /> Print Card (Front + Back)
        </button>
      </div>

      {emp && (
        <div style={{ display: "flex", gap: 30, flexWrap: "wrap", justifyContent: "center", padding: 24, background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", borderRadius: 10 }} data-testid="idcard-preview">
          {/* FRONT PREVIEW */}
          <div style={{ width: CARD_W, height: CARD_H, position: "relative", background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(15,23,42,.25)", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column" }}>
            {/* Lanyard dot */}
            <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", width: 30, height: 6, background: "#0f172a", borderRadius: 3, zIndex: 5 }} />
            {/* Top navy block — compact to leave room for photo + data */}
            <div style={{ background: "#1e3a8a", color: "#fff", padding: "18px 10px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.25)", border: "2px solid #fff" }}>
                <img src="/arun-logo.jpg" alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} onError={(e) => { e.target.style.display = "none"; }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.5, marginTop: 5 }}>ARUN ENTERPRISES</div>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: .3, color: "#fbbf24", marginTop: 2, width: "92%", textAlign: "center", lineHeight: 1.2 }}>OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY</div>
            </div>
            {/* Middle white block — photo + name + designation + data rows */}
            <div style={{ padding: "8px 12px 4px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0 }}>
              <div style={{ width: 110, height: 130, borderRadius: 5, border: "2px solid #1e3a8a", overflow: "hidden", background: emp.photoUrl ? `#f1f5f9 center/cover no-repeat url('${emp.photoUrl}')` : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#64748b", fontWeight: 700, boxShadow: "0 2px 5px rgba(30,58,138,.25)", flexShrink: 0 }}>
                {emp.photoUrl ? "" : "PHOTO"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: .8, color: "#1e3a8a", marginTop: 5, textAlign: "center", lineHeight: 1.1 }}>{(emp.fullName || "—").toUpperCase()}</div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: "#dc2626", letterSpacing: 1.1, textTransform: "uppercase", marginTop: 1, textAlign: "center" }}>{emp.designation || "—"}</div>
              <div style={{ width: 46, height: 1, background: "linear-gradient(90deg, transparent, #1e3a8a 25%, #dc2626 75%, transparent)", margin: "4px auto" }} />
              <div style={{ width: "100%", fontSize: 9, lineHeight: 1.3, marginTop: 1 }}>
                {[
                  ["EMPLOYEE ID", emp.empCode || emp.tempCode || "—"],
                  ["DEPARTMENT", (emp.department || "—").toUpperCase()],
                  ["BLOOD GROUP", emp.bloodGroup || "—"],
                  ["DATE OF JOINING", emp.doj ? fmtDMY(emp.doj) : "—"],
                  ...(!hideMobile ? [["MOBILE", emp.contactMobile || "—"]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "88px 8px 1fr", alignItems: "center", padding: "1.5px 0", borderBottom: "0.5px solid #f1f5f9" }}>
                    <span style={{ fontWeight: 800, color: "#0f172a", letterSpacing: .3, fontSize: 8.5 }}>{k}</span>
                    <span style={{ color: "#475569", fontWeight: 800, textAlign: "center" }}>:</span>
                    <span style={{ fontWeight: 800, color: "#1e3a8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 9 }} title={v}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Bottom navy block — signature (compact) */}
            <div style={{ background: "#1e3a8a", color: "#fff", padding: "3px 12px 4px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Brush Script MT','Lucida Handwriting',cursive", fontSize: 12, fontStyle: "italic", color: "#fff", lineHeight: 1 }}>{(emp.fullName || "—").split(" ").slice(0, 2).join(" ")}</div>
              <div style={{ fontSize: 6, fontWeight: 800, letterSpacing: 1, color: "#fbbf24", borderTop: "0.5px solid #fff", paddingTop: 1, marginTop: 1, width: 110, marginLeft: "auto", marginRight: "auto" }}>AUTHORIZED SIGNATURE</div>
            </div>
          </div>

          {/* BACK PREVIEW */}
          <div style={{ width: CARD_W, height: CARD_H, position: "relative", background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(15,23,42,.25)", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column" }}>
            {/* Lanyard dot */}
            <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", width: 30, height: 6, background: "#0f172a", borderRadius: 3, zIndex: 5 }} />
            {/* Top navy block */}
            <div style={{ background: "#1e3a8a", color: "#fff", padding: "26px 10px 14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.25)", border: "2px solid #fff" }}>
                <img src="/arun-logo.jpg" alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} onError={(e) => { e.target.style.display = "none"; }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, marginTop: 7 }}>ARUN ENTERPRISES</div>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: .4, color: "#fbbf24", marginTop: 2 }}>OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY</div>
            </div>
            {/* Middle white block */}
            <div style={{ padding: "10px 12px", fontSize: 9, color: "#0f172a", flex: 1 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9.5, fontWeight: 900, color: "#dc2626", letterSpacing: .7, marginBottom: 3 }}>📍 REGISTERED OFFICE</div>
                {COMPANY.addrLines.map((l, i) => <div key={i} style={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{l}</div>)}
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 900, color: "#dc2626", letterSpacing: .7, marginBottom: 3 }}>📞 CONTACT DETAILS</div>
                <div style={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>✉ {emp.contactEmail || "—"}</div>
                <div style={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>🌐 {COMPANY.phone}</div>
              </div>
            </div>
            {/* Middle wave */}
            <svg viewBox="0 0 300 40" preserveAspectRatio="none" style={{ width: "100%", height: 28, display: "block" }}>
              <path d="M0,0 L300,0 L300,20 Q220,45 150,20 Q70,-5 0,25 Z" fill="#1e3a8a"/>
              <path d="M0,0 L300,0 L300,12 Q220,32 150,12 Q70,-5 0,15 Z" fill="#dc2626" opacity="0.9"/>
            </svg>
            {/* Bottom navy with NOTE + Emergency */}
            <div style={{ background: "#1e3a8a", color: "#fff", padding: "8px 12px 14px" }}>
              <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>NOTE:</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {["This ID Card is the property of Arun Enterprises.", "This card is non-transferable.", "Return this card if found."].map((t) => (
                  <li key={t} style={{ fontSize: 6.5, color: "#e2e8f0", padding: "1px 0 1px 8px", position: "relative", lineHeight: 1.35 }}>
                    <span style={{ position: "absolute", left: 0, color: "#dc2626" }}>•</span>{t}
                  </li>
                ))}
              </ul>
              <div style={{ background: "#fff", color: "#1e3a8a", padding: "4px 6px", marginTop: 6, textAlign: "center", borderRadius: 3 }}>
                <div style={{ fontSize: 6.5, fontWeight: 800, color: "#0f172a", letterSpacing: .3 }}>IN CASE OF EMERGENCY, PLEASE CONTACT</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#dc2626", letterSpacing: 1 }}>{emergency}</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// -------------- KPI dashboard --------------
const KpiTile = ({ label, value, tone, icon: Icon }) => (
  <div style={{ padding: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 1px 3px rgba(15,23,42,.05)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${tone}18`, color: tone, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} /></div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: .4, textTransform: "uppercase" }}>{label}</div>
    </div>
    <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{value}</div>
  </div>
);

// ================================================================
export default function HRManagement() {
  const [tab, setTab] = useState("dashboard");
  const write = canCreate();
  const approve = canApprove();

  const emps = getEmployees();
  const finalized = emps.filter((e) => Number(e.step) === 5).length;
  const pending = emps.filter((e) => Number(e.step) < 5).length;
  const now = new Date();
  const attKeyMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayKey = String(now.getDate()).padStart(2, "0");
  const onLeaveToday = emps.filter((e) => Number(e.step) === 5).filter((e) => {
    const rec = getMonthAttendance(e.id, now.getFullYear(), now.getMonth() + 1);
    return rec.days?.[todayKey] === "L" || rec.days?.[todayKey] === "A";
  }).length;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const joinersThisMonth = emps.filter((e) => (e.doj || "") >= startOfMonth).length;
  const exitPending = emps.filter((e) => (e.status || "") === "Exit Pending").length;

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div style={{ minHeight: "100vh", background: "#f1f5f9", paddingBottom: 40 }}>
        <div style={{ maxWidth: "100%", margin: "0 auto", padding: "18px 24px" }} data-testid="hr-page">

          {/* Hero */}
          <div style={{ background: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 45%, #db2777 100%)", color: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 10px 40px rgba(76,29,149,.28)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -30, top: -30, opacity: .08 }}><Users2 size={220} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 13, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><UserCheck size={28} /></div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: 3, color: "#fbcfe8", fontWeight: 700, textTransform: "uppercase" }}>HR Management · v1</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: .3 }}>Employees · Attendance · Payroll</div>
                  <div style={{ fontSize: 11.5, color: "#fce7f3", marginTop: 4 }}>5-step approval · Temp Code → Permanent EMP Code · Payroll auto-pushed to Accounts</div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }} data-testid="hr-kpi-grid">
            <KpiTile label="Total Employees" value={emps.length} tone="#0369a1" icon={Users2} />
            <KpiTile label="Finalized" value={finalized} tone="#16a34a" icon={CheckCircle2} />
            <KpiTile label="Pending Approval" value={pending} tone="#f59e0b" icon={Send} />
            <KpiTile label="On Leave Today" value={onLeaveToday} tone="#dc2626" icon={Calendar} />
            <KpiTile label="Joiners This Month" value={joinersThisMonth} tone="#7c3aed" icon={UserPlus} />
            <KpiTile label="Exit Pending" value={exitPending} tone="#991b1b" icon={LogOut} />
          </div>

          {/* Tabs */}
          <div style={{ marginTop: 18, background: "#fff", borderRadius: 10, padding: 5, display: "inline-flex", gap: 3, border: "1px solid #e2e8f0", flexWrap: "wrap" }} data-testid="hr-tabs">
            {[
              { id: "dashboard", label: "Dashboard", tone: "#0f172a", icon: Sparkles },
              { id: "employees", label: "Employees", tone: "#0369a1", icon: Users2 },
              { id: "attendance", label: "Attendance", tone: "#f59e0b", icon: Calendar },
              { id: "leaves", label: "Leaves", tone: "#0ea5e9", icon: FileText },
              { id: "payroll", label: "Payroll Slip", tone: "#dc2626", icon: IndianRupee },
              { id: "paybill", label: "Pay Bill", tone: "#be185d", icon: Receipt },
              { id: "advance", label: "Advance Reg.", tone: "#f59e0b", icon: Wallet },
              { id: "loans", label: "Loan Mgmt.", tone: "#0891b2", icon: Landmark },
              { id: "compliance", label: "Compliance", tone: "#7c3aed", icon: ShieldCheck },
              { id: "recruit", label: "Recruitment", tone: "#16a34a", icon: Briefcase },
              { id: "exit", label: "Exit & F&F", tone: "#991b1b", icon: LogOut },
              { id: "idcard", label: "ID Card", tone: "#0ea5e9", icon: UserCheck },
            ].map((t) => {
              const Icon = t.icon; const active = tab === t.id;
              return <button key={t.id} data-testid={`hr-tab-${t.id}`} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", background: active ? t.tone : "transparent", color: active ? "#fff" : "#334155", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={13} /> {t.label}</button>;
            })}
          </div>

          <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            {tab === "dashboard" && (
              <div style={{ padding: 20 }}>
                <CelebrationBanner emps={emps} />
                {/* Employees Directory — short card grid: photo + EMP ID + name + designation + dept + mobile */}
                <div style={{ marginTop: 20 }} data-testid="hr-emp-directory">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "#64748b", textTransform: "uppercase" }}>Team Directory</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", letterSpacing: .3 }}>Employees · Short View</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", padding: "4px 10px", background: "#f1f5f9", borderRadius: 20 }}>{emps.length} Total · {emps.filter((e) => Number(e.step) === 5).length} Finalized</div>
                  </div>
                  {emps.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, fontSize: 12 }}>No employees added yet. Go to Employees tab to add first employee.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
                      {emps.slice().sort((a, b) => (b.step || 0) - (a.step || 0) || (a.fullName || "").localeCompare(b.fullName || "")).map((e) => {
                        const finalized = Number(e.step) === 5;
                        return (
                          <div key={e.id} data-testid={`hr-dir-card-${e.id}`} style={{ display: "flex", gap: 10, padding: 10, background: "#fff", border: `1px solid ${finalized ? "#86efac" : "#fde68a"}`, borderLeft: `4px solid ${finalized ? "#16a34a" : "#f59e0b"}`, borderRadius: 8, boxShadow: "0 1px 3px rgba(15,23,42,.04)", transition: "all .2s" }}>
                            <div style={{ width: 56, height: 68, borderRadius: 5, border: "1.5px solid #1e3a8a", flexShrink: 0, overflow: "hidden", background: e.photoUrl ? `#f1f5f9 center/cover no-repeat url('${e.photoUrl}')` : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#64748b", fontWeight: 700 }}>
                              {e.photoUrl ? "" : "PHOTO"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 900, color: finalized ? "#166534" : "#78716c", letterSpacing: .5, lineHeight: 1.1 }}>{e.empCode || e.tempCode || "—"}</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.fullName}>{e.fullName || "—"}</div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "#dc2626", letterSpacing: .4, textTransform: "uppercase", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.designation || "—"}</div>
                              </div>
                              <div style={{ fontSize: 9.5, color: "#475569", marginTop: 3, lineHeight: 1.4 }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏢 {e.department || "—"}</div>
                                <div>📱 {e.contactMobile || "—"}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === "employees" && <EmployeeEditor writeAllowed={write} approveAllowed={approve} />}
            {tab === "attendance" && <AttendanceGrid />}
            {tab === "leaves" && <LeavesTab writeAllowed={write} approveAllowed={approve} />}
            {tab === "payroll" && <PayrollTab />}
            {tab === "paybill" && <PayBillTab writeAllowed={write} approveAllowed={approve} />}
            {tab === "advance" && <AdvanceRegisterTab />}
            {tab === "loans" && <LoansTab writeAllowed={write} approveAllowed={approve} />}
            {tab === "compliance" && <ComplianceTab />}
            {tab === "recruit" && <RecruitTab writeAllowed={write} />}
            {tab === "exit" && <ExitTab writeAllowed={write} approveAllowed={approve} />}
            {tab === "idcard" && <IDCardTab />}
          </div>
        </div>
      </div>
    </>
  );
}
