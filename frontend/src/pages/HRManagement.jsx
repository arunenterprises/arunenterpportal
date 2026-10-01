import * as XLSX from "xlsx";
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  UserPlus, Users2, Calendar, IndianRupee, FileText, LogOut,
  UserCheck, Sparkles, Construction, Trash2, Save, Send, CheckCircle2, RefreshCw, Printer, Download,
  ArrowRight,
} from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import {
  getEmployees, createEmployeeDraft, upsertEmployee, advanceEmployeeStep, deleteEmployee,
  reapproveEmployee, EMPLOYEE_STEP_LABEL, computeSalary,
  getMonthAttendance, upsertAttendance, sendPayrollToAccounts,
  currentRole, canCreate, canApprove, currentUser, fmtDMY,
} from "../lib/store";

const DEPARTMENTS = ["Operations", "Site", "Purchase", "Accounts", "HR", "Admin", "Sales", "Store"];
const DESIGNATIONS = ["Engineer", "Supervisor", "Manager", "Accountant", "HR Officer", "Store Keeper", "Executive", "Assistant", "Director"];
const ATT_CODES = { P: { label: "Present", tone: "#16a34a" }, A: { label: "Absent", tone: "#dc2626" }, L: { label: "Leave", tone: "#f59e0b" }, H: { label: "Half-day", tone: "#0369a1" }, W: { label: "Week-off", tone: "#94a3b8" }, HL: { label: "Holiday", tone: "#7c3aed" } };
const nextCode = { "": "P", "P": "A", "A": "L", "L": "H", "H": "W", "W": "HL", "HL": "" };

// -------------- Employee editor --------------
const EmployeeEditor = ({ writeAllowed, approveAllowed, onSaved }) => {
  const [emp, setEmp] = useState(null);
  const [list, setList] = useState([]);
  const [locked, setLocked] = useState(false);

  useEffect(() => { setList(getEmployees()); if (!emp) setEmp(createEmployeeDraft()); }, []);
  const refresh = () => setList(getEmployees());
  const set = (k, v) => setEmp((p) => ({ ...p, [k]: v }));

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
    let cur = { ...emp };
    while (Number(cur.step) < 5) cur = advanceEmployeeStep(cur);
    setEmp(cur); setLocked(true); refresh();
    toast.success(`Finalized · Permanent EMP Code: ${cur.empCode}`);
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
  const F = ({ label, req, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{label}{req && <span style={{ color: "#dc2626" }}> *</span>}</label>
      {children}
    </div>
  );
  const inputStyle = { padding: "6px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, width: "100%" };

  return (
    <div style={{ padding: 14 }}>
      {/* Actions strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button data-testid="hr-emp-new" onClick={startNew} style={{ padding: "6px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><UserPlus size={13} style={{ verticalAlign: -2 }} /> New</button>
        <button data-testid="hr-emp-save" onClick={save} disabled={!writeAllowed || locked} style={{ padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked ? 1 : .5, fontWeight: 700, fontSize: 12 }}><Save size={13} style={{ verticalAlign: -2 }} /> Save</button>
        <button data-testid="hr-emp-submit" onClick={submit} disabled={!writeAllowed || locked || Number(emp.step) >= 5} style={{ padding: "6px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed && !locked ? "pointer" : "not-allowed", opacity: writeAllowed && !locked && Number(emp.step) < 5 ? 1 : .5, fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Submit / Advance</button>
        <button data-testid="hr-emp-approve" onClick={approve} disabled={!approveAllowed || Number(emp.step) >= 5} style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", opacity: approveAllowed && Number(emp.step) < 5 ? 1 : .5, fontWeight: 700, fontSize: 12 }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Final Approve</button>
        {Number(emp.step) >= 5 && (
          <button data-testid="hr-emp-reapprove" onClick={reapprove} disabled={!approveAllowed} style={{ padding: "6px 12px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 5, cursor: approveAllowed ? "pointer" : "not-allowed", opacity: approveAllowed ? 1 : .5, fontWeight: 700, fontSize: 12 }}><RefreshCw size={13} style={{ verticalAlign: -2 }} /> Re-Approve</button>
        )}
      </div>

      {/* Header codes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <F label="Temp Code (Alpha-Num)"><input value={emp.tempCode} readOnly style={{ ...inputStyle, background: "#fef9c3", fontWeight: 700, color: "#78716c" }} data-testid="emp-temp-code" /></F>
        <F label="Permanent EMP Code"><input value={emp.empCode} readOnly placeholder="Issued on Final Approval" style={{ ...inputStyle, background: emp.empCode ? "#dcfce7" : "#f1f5f9", fontWeight: 800, color: emp.empCode ? "#166534" : "#94a3b8", border: emp.empCode ? "1.5px solid #16a34a" : "1px solid #cbd5e1" }} data-testid="emp-perm-code" /></F>
        <F label="Status / Step"><input value={EMPLOYEE_STEP_LABEL[emp.step] || "-"} readOnly style={{ ...inputStyle, background: "#eef2ff", fontWeight: 700, color: "#1e3a8a" }} /></F>
        <F label="Revision"><input value={emp.revision || 0} readOnly style={{ ...inputStyle, background: "#f8fafc", textAlign: "center" }} /></F>
      </div>

      {/* Personal + Job */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>A. Personal & Job Details</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <F label="Full Name" req><input value={emp.fullName} onChange={(e) => set("fullName", e.target.value)} disabled={locked} style={inputStyle} data-testid="emp-name" /></F>
          <F label="Father's Name"><input value={emp.fatherName} onChange={(e) => set("fatherName", e.target.value)} disabled={locked} style={inputStyle} /></F>
          <F label="Date of Birth"><input type="date" value={emp.dob} onChange={(e) => set("dob", e.target.value)} disabled={locked} style={inputStyle} /></F>
          <F label="Gender"><select value={emp.gender} onChange={(e) => set("gender", e.target.value)} disabled={locked} style={inputStyle}><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></F>
          <F label="Date of Joining"><input type="date" value={emp.doj} onChange={(e) => set("doj", e.target.value)} disabled={locked} style={inputStyle} /></F>
          <F label="Designation" req><input list="hr-designations" value={emp.designation} onChange={(e) => set("designation", e.target.value)} disabled={locked} style={inputStyle} /></F>
          <F label="Department"><select value={emp.department} onChange={(e) => set("department", e.target.value)} disabled={locked} style={inputStyle}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></F>
          <F label="Status"><select value={emp.status || "Active"} onChange={(e) => set("status", e.target.value)} disabled={locked} style={inputStyle}><option>Active</option><option>Probation</option><option>On Leave</option><option>Exit Pending</option><option>Exited</option></select></F>
        </div>
        <datalist id="hr-designations">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>
      </div>

      {/* Contact */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>B. Contact & KYC</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <F label="Mobile" req><input value={emp.contactMobile} onChange={(e) => set("contactMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={locked} style={inputStyle} data-testid="emp-mobile" /></F>
          <F label="Email"><input value={emp.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} disabled={locked} style={inputStyle} /></F>
          <F label="Aadhaar"><input value={emp.aadhaar} onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))} disabled={locked} style={inputStyle} /></F>
          <F label="PAN"><input value={emp.pan} onChange={(e) => set("pan", e.target.value.toUpperCase().slice(0, 10))} disabled={locked} style={inputStyle} /></F>
          <F label="Address"><input value={emp.address} onChange={(e) => set("address", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 4" }} /></F>
        </div>
      </div>

      {/* Salary + Bank */}
      <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>C. Salary Structure (₹ / month)</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <F label="Basic"><input type="number" value={emp.basic} onChange={(e) => set("basic", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="HRA"><input type="number" value={emp.hra} onChange={(e) => set("hra", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="DA"><input type="number" value={emp.da} onChange={(e) => set("da", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="Special"><input type="number" value={emp.special} onChange={(e) => set("special", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="Bonus"><input type="number" value={emp.bonus} onChange={(e) => set("bonus", +e.target.value || 0)} disabled={locked} style={inputStyle} /></F>
          <F label="Gross (auto)"><input value={(+emp.basic || 0) + (+emp.hra || 0) + (+emp.da || 0) + (+emp.special || 0) + (+emp.bonus || 0)} readOnly style={{ ...inputStyle, background: "#eef2ff", fontWeight: 700, textAlign: "right" }} /></F>
          <F label="Bank Name"><input value={emp.bankName} onChange={(e) => set("bankName", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
          <F label="Account No."><input value={emp.bankAccount} onChange={(e) => set("bankAccount", e.target.value.replace(/\D/g, ""))} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
          <F label="IFSC"><input value={emp.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase().slice(0, 11))} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
          <F label="PF Number"><input value={emp.pfNo} onChange={(e) => set("pfNo", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
          <F label="UAN"><input value={emp.uan} onChange={(e) => set("uan", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
          <F label="ESIC"><input value={emp.esicNo} onChange={(e) => set("esicNo", e.target.value)} disabled={locked} style={{ ...inputStyle, gridColumn: "span 2" }} /></F>
        </div>
      </div>

      {/* All employees list */}
      {list.length > 0 && (
        <div className="section" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ padding: "8px 14px", fontWeight: 800, fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>D. All Employees ({list.length})</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead><tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Code</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Name</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Designation</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Dept</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Mobile</th>
              <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Status</th>
              <th style={{ padding: 6, textAlign: "center", borderBottom: "1px solid #e2e8f0", width: 160 }}>Actions</th>
            </tr></thead>
            <tbody>{list.map((e, i) => (
              <tr key={e.id} data-testid={`hr-emp-row-${e.id}`} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={{ padding: 6, fontWeight: 700, color: e.empCode ? "#166534" : "#78716c" }}>{e.empCode || e.tempCode}</td>
                <td style={{ padding: 6 }}>{e.fullName}</td>
                <td style={{ padding: 6 }}>{e.designation}</td>
                <td style={{ padding: 6 }}>{e.department}</td>
                <td style={{ padding: 6 }}>{e.contactMobile}</td>
                <td style={{ padding: 6, fontSize: 10.5 }}>{EMPLOYEE_STEP_LABEL[e.step] || "-"}</td>
                <td style={{ padding: 4, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => load(e)} data-testid={`hr-emp-edit-${e.id}`} style={{ padding: "3px 8px", background: "#dbeafe", color: "#1e3a8a", border: "1px solid #93c5fd", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✏ Edit</button>
                  <button onClick={() => remove(e.id, e.empCode || e.tempCode)} disabled={!writeAllowed || Number(e.step) >= 5} data-testid={`hr-emp-del-${e.id}`} style={{ padding: "3px 8px", background: (!writeAllowed || Number(e.step) >= 5) ? "#f1f5f9" : "#fee2e2", color: (!writeAllowed || Number(e.step) >= 5) ? "#94a3b8" : "#991b1b", border: `1px solid ${(!writeAllowed || Number(e.step) >= 5) ? "#cbd5e1" : "#fca5a5"}`, borderRadius: 3, cursor: (!writeAllowed || Number(e.step) >= 5) ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700 }}>🗑 Delete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
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
          {emps.map((e) => <option key={e.id} value={e.id}>{e.empCode} — {e.fullName}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: 5 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("en-IN", { month: "long" })}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: 5, width: 80 }} />
        <button data-testid="hr-payroll-print" onClick={() => window.print()} style={{ padding: "6px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Printer size={13} style={{ verticalAlign: -2 }} /> Print Slip</button>
        <button data-testid="hr-payroll-push" onClick={pushToAccounts} style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12 }}><Send size={13} style={{ verticalAlign: -2 }} /> Push Monthly Payroll → Accounts</button>
      </div>

      {emp && salary && (
        <div className="a4" style={{ background: "#fff", border: "1px solid #cbd5e1", padding: 24, borderRadius: 8, maxWidth: 800, margin: "0 auto" }} data-testid="hr-payroll-slip">
          <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #0f172a", paddingBottom: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>ARUN ENTERPRISES</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Salary Slip · {new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
            <tbody>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9", width: "25%" }}>Emp Code</td><td style={{ padding: 5 }}>{emp.empCode}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9", width: "25%" }}>Name</td><td style={{ padding: 5 }}>{emp.fullName}</td></tr>
              <tr><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Designation</td><td style={{ padding: 5 }}>{emp.designation}</td><td style={{ padding: 5, fontWeight: 700, background: "#f1f5f9" }}>Department</td><td style={{ padding: 5 }}>{emp.department}</td></tr>
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

          <div style={{ marginTop: 20, fontSize: 10, color: "#64748b", textAlign: "center" }}>
            System-generated slip. Payroll pushed to Accounts as monthly aggregate for GM final approval.
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
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "18px 20px" }} data-testid="hr-page">

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
          <div style={{ marginTop: 18, background: "#fff", borderRadius: 10, padding: 5, display: "inline-flex", gap: 3, border: "1px solid #e2e8f0" }} data-testid="hr-tabs">
            {[
              { id: "dashboard", label: "Dashboard", tone: "#0f172a", icon: Sparkles },
              { id: "employees", label: "Employees", tone: "#0369a1", icon: Users2 },
              { id: "attendance", label: "Attendance", tone: "#f59e0b", icon: Calendar },
              { id: "payroll", label: "Payroll & Slip", tone: "#dc2626", icon: IndianRupee },
            ].map((t) => {
              const Icon = t.icon; const active = tab === t.id;
              return <button key={t.id} data-testid={`hr-tab-${t.id}`} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", background: active ? t.tone : "transparent", color: active ? "#fff" : "#334155", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={13} /> {t.label}</button>;
            })}
          </div>

          <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            {tab === "dashboard" && (
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#4c1d95", letterSpacing: .5, textTransform: "uppercase", marginBottom: 12 }}>5-Step Approval Flow</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5].map((s, i) => (
                    <React.Fragment key={s}>
                      <div style={{ padding: "10px 14px", background: `#ddd6fe`, color: "#5b21b6", border: "1.5px solid #a78bfa", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {EMPLOYEE_STEP_LABEL[s]}
                      </div>
                      {i < 4 && <div style={{ flex: 1, minWidth: 8, height: 2, background: "linear-gradient(to right, #c4b5fd, #e9d5ff)" }} />}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: 16, padding: 12, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12, color: "#0c4a6e" }}>
                  <b>Temp Code (Alpha-Numeric)</b> Employee creation ke turant baad milta hai — draft me kaam karne ke liye. <b>Permanent EMP Code</b> sirf step-5 Final Approval ke baad issue hota hai — yahi employee ka PRIMARY KEY hai. Monthly payroll <b>automatically Accounts department me push</b> ho jata hai for GM's final approval.
                </div>
              </div>
            )}
            {tab === "employees" && <EmployeeEditor writeAllowed={write} approveAllowed={approve} />}
            {tab === "attendance" && <AttendanceGrid />}
            {tab === "payroll" && <PayrollTab />}
          </div>
        </div>
      </div>
    </>
  );
}
