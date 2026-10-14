import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Plus, Trash2, Save, Send, Printer, Download, CheckCircle2, Utensils } from "lucide-react";
import { getEmployees, getFY, getActiveFYOverride, APPROVER_NAME, canApprove } from "../lib/store";

// -------- Local storage CRUD for Weekly Fooding records --------
const KEY = "ae_vm_fooding";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (list) => { localStorage.setItem(KEY, JSON.stringify(list)); try { window.dispatchEvent(new CustomEvent("ae-sync-done")); } catch {} };
export const getFoodingList = () => read();
export const saveFoodingList = (list) => write(list);
export const upsertFooding = (r) => {
  const list = read();
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) list[i] = r; else list.push(r);
  write(list);
  return r;
};
export const deleteFooding = (id) => {
  write(read().filter((x) => x.id !== id));
};

const PAY_METHODS = ["NEFT", "RTGS", "UPI", "IMPS", "Cash", "Cheque", "NIL"];
const WEEKS = ["1st", "2nd", "3rd", "4th", "5th"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const uid = () => `FOOD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const emptyLine = () => ({ id: uid(), date: "", empId: "", empName: "", designation: "", weekNo: "1st", amount: 0, payMethod: "NIL", approver: "NIL", payDate: "", signature: "NIL", remark: "NIL" });

const emptyDraft = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return {
    id: `WF-${Date.now().toString(36)}`,
    refNo: `WF-${y}${String(m + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    month: MONTHS[m],
    year: y,
    projectRef: "E-101/NCR/G&B",
    detectable: "Detectable",
    circle: "",
    fromDate: fmt(start),
    toDate: fmt(end),
    fy: getActiveFYOverride() || getFY(),
    lines: [emptyLine()],
    status: "Draft", // Draft · Submitted · Approved
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
  };
};

const inrN = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WeeklyFoodingTab = ({ writeAllowed, approveAllowed }) => {
  const [list, setList] = useState([]);
  const [cur, setCur] = useState(() => emptyDraft());
  const [emps, setEmps] = useState([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setList(getFoodingList());
    setEmps(getEmployees().filter((e) => Number(e.step) >= 5 || e.empCode));
    const onSync = () => { setList(getFoodingList()); setEmps(getEmployees()); setRefresh((v) => v + 1); };
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  const locked = cur.status === "Approved";

  const totals = useMemo(() => {
    const sum = (cur.lines || []).reduce((s, l) => s + Number(l.amount || 0), 0);
    const paid = (cur.lines || []).filter((l) => l.payMethod !== "NIL" && Number(l.amount) > 0).reduce((s, l) => s + Number(l.amount || 0), 0);
    return { total: sum, paid, pending: sum - paid, count: (cur.lines || []).length };
  }, [cur]);

  const setLine = (idx, patch) => {
    const lines = [...(cur.lines || [])];
    lines[idx] = { ...lines[idx], ...patch };
    // Auto-fill emp name & designation when empId chosen
    if (patch.empId !== undefined) {
      const emp = emps.find((e) => (e.empCode || e.id) === patch.empId);
      if (emp) {
        lines[idx].empName = emp.fullName || emp.empName || "";
        lines[idx].designation = emp.designation || "";
      }
    }
    setCur({ ...cur, lines });
  };

  const addLine = () => { if (locked) return toast.error("Approved record locked"); setCur({ ...cur, lines: [...(cur.lines || []), emptyLine()] }); };
  const delLine = (idx) => { if (locked) return toast.error("Approved record locked"); const lines = [...(cur.lines || [])]; lines.splice(idx, 1); setCur({ ...cur, lines: lines.length ? lines : [emptyLine()] }); };

  const newDraft = () => { setCur(emptyDraft()); toast.info("New draft started"); };

  const saveDraft = () => {
    if (!writeAllowed) return toast.error("Not permitted");
    if (!cur.lines || cur.lines.length === 0) return toast.error("Add at least one line");
    if (!cur.circle?.trim()) return toast.error("Circle enter karein");
    const rec = { ...cur, status: cur.status === "Approved" ? "Approved" : "Draft", updatedAt: new Date().toISOString() };
    upsertFooding(rec);
    setCur(rec);
    setList(getFoodingList());
    toast.success(`Draft saved · ${rec.refNo}`);
  };

  const submit = () => {
    if (!writeAllowed) return toast.error("Not permitted");
    saveDraft();
    const rec = { ...cur, status: "Submitted", updatedAt: new Date().toISOString() };
    upsertFooding(rec);
    setCur(rec);
    setList(getFoodingList());
    toast.success(`Submitted for GM approval · ${rec.refNo}`);
  };

  const approve = () => {
    if (!approveAllowed) return toast.error("Only GM / Admin can approve");
    if (cur.status !== "Submitted") return toast.error("Submit the record first");
    // Auto-set approver name on each line that doesn't have one
    const lines = (cur.lines || []).map((l) => ({ ...l, approver: l.approver === "NIL" || !l.approver ? APPROVER_NAME : l.approver }));
    const rec = { ...cur, lines, status: "Approved", approvedAt: new Date().toISOString(), approvedBy: APPROVER_NAME };
    upsertFooding(rec);
    setCur(rec);
    setList(getFoodingList());
    toast.success(`✓ Approved by ${APPROVER_NAME}`);
  };

  const removeRecord = (id) => {
    if (!writeAllowed) return toast.error("Not permitted");
    if (!window.confirm("Delete this fooding record?")) return;
    deleteFooding(id);
    if (cur.id === id) setCur(emptyDraft());
    setList(getFoodingList());
    toast.success("Record deleted");
  };

  const loadRecord = (r) => { setCur({ ...r }); };

  const exportExcel = () => {
    const header = ["S.No", "Date", "Employee ID", "Employee Name", "Designation", "Week No", "Fooding Amount", "Payment Method", "Approver Name", "Payment Date", "Employee Signature", "Remark"];
    const rows = (cur.lines || []).map((l, i) => [i + 1, l.date, l.empId, l.empName, l.designation, l.weekNo, Number(l.amount || 0), l.payMethod, l.approver, l.payDate || "NIL", l.signature, l.remark]);
    const metaRows = [
      ["Month", cur.month, "", "Project Ref", cur.projectRef, "", cur.detectable, "", "Circle", cur.circle, "", cur.fromDate, "to", cur.toDate, "FY " + cur.fy],
      [],
      header,
      ...rows,
      [],
      ["TOTAL", "", "", "", "", "", totals.total],
    ];
    const ws = XLSX.utils.aoa_to_sheet(metaRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Weekly Fooding");
    XLSX.writeFile(wb, `WeeklyFooding_${cur.refNo}_${cur.month}_${cur.year}.xlsx`);
    toast.success("Excel exported");
  };

  const printReport = () => {
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) { toast.error("Pop-up blocked"); return; }
    const rows = (cur.lines || []).map((l, i) => `<tr>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${l.date || "-"}</td>
      <td style="border:1px solid #000;padding:3px 5px;background:#fef3c7;font-weight:700;text-align:center">${l.empId || "-"}</td>
      <td style="border:1px solid #000;padding:3px 5px">${l.empName || "-"}</td>
      <td style="border:1px solid #000;padding:3px 5px">${l.designation || "-"}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${l.weekNo || "-"}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right">${Number(l.amount) ? "₹ " + inrN(l.amount) : "₹ -"}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${l.payMethod || "NIL"}</td>
      <td style="border:1px solid #000;padding:3px 5px">${l.approver || "NIL"}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${l.payDate || "NIL"}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${l.signature || "NIL"}</td>
      <td style="border:1px solid #000;padding:3px 5px">${l.remark || "NIL"}</td>
    </tr>`).join("");
    win.document.write(`<!doctype html><html><head><title>Weekly Fooding · ${cur.refNo}</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#000;margin:0;padding:10px}
      h1{text-align:center;font-size:16px;margin:0 0 4px;letter-spacing:1px}
      .meta{width:100%;border-collapse:collapse;margin-bottom:6px}
      .meta td{border:1px solid #000;padding:4px 6px;font-size:11px}
      .meta .lbl{font-weight:800;background:#fef9c3}
      table.data{width:100%;border-collapse:collapse;margin-top:4px;font-size:10.5px}
      table.data th{background:#fef3c7;border:1px solid #000;padding:4px 6px;text-align:center;font-weight:800}
      .signblock{margin-top:14px;display:flex;justify-content:space-between;font-size:11px}
      </style></head><body>
      <h1>M/s ARUN ENTERPRISES · Weekly Fooding Register</h1>
      <table class="meta">
        <tr>
          <td class="lbl">Month</td><td>${cur.month}</td>
          <td class="lbl">Project Reference</td><td>${cur.projectRef}</td>
          <td class="lbl">${cur.detectable}</td><td></td>
          <td class="lbl">Circle</td><td>${cur.circle}</td>
          <td class="lbl">${cur.fromDate}</td><td class="lbl">to</td><td>${cur.toDate}</td>
          <td class="lbl">Financial Year</td><td>${cur.fy}</td>
        </tr>
      </table>
      <table class="data">
        <thead><tr>
          <th>S.No</th><th>Date</th><th>Employee ID</th><th>Employee Name</th><th>Designation</th><th>Week No</th><th>Fooding Amount</th><th>Payment Method</th><th>Approver Name</th><th>Payment Date</th><th>Employee Signature</th><th>Remark</th>
        </tr></thead>
        <tbody>${rows}
        <tr><td colspan="6" style="border:1px solid #000;padding:5px;background:#fef3c7;font-weight:900;text-align:right">TOTAL</td><td style="border:1px solid #000;padding:5px;background:#fef3c7;font-weight:900;text-align:right">₹ ${inrN(totals.total)}</td><td colspan="5" style="border:1px solid #000;padding:5px;background:#fef3c7"></td></tr>
        </tbody>
      </table>
      <div class="signblock">
        <div>Prepared By: _____________</div>
        <div>Approver: ${cur.approvedBy || APPROVER_NAME}</div>
        <div>Status: ${cur.status}</div>
      </div>
      <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`);
    win.document.close();
  };

  const statusTone = { Draft: "#64748b", Submitted: "#d97706", Approved: "#16a34a" }[cur.status] || "#64748b";

  return (
    <div data-testid="wf-tab" style={{ marginTop: 12 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", background: "#fff", padding: 10, border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: 10 }}>
        <button data-testid="wf-new" onClick={newDraft} style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Plus size={13} /> New Draft
        </button>
        <button data-testid="wf-save" onClick={saveDraft} disabled={locked || !writeAllowed} style={{ padding: "7px 14px", background: locked || !writeAllowed ? "#94a3b8" : "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: locked || !writeAllowed ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Save size={13} /> Save Draft
        </button>
        <button data-testid="wf-submit" onClick={submit} disabled={locked || !writeAllowed || cur.status === "Submitted"} style={{ padding: "7px 14px", background: locked || cur.status === "Submitted" ? "#94a3b8" : "#be185d", color: "#fff", border: "none", borderRadius: 4, cursor: locked ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Send size={13} /> Submit to GM
        </button>
        <button data-testid="wf-approve" onClick={approve} disabled={cur.status !== "Submitted" || !approveAllowed} style={{ padding: "7px 14px", background: cur.status === "Submitted" && approveAllowed ? "#166534" : "#94a3b8", color: "#fff", border: "none", borderRadius: 4, cursor: cur.status === "Submitted" && approveAllowed ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 size={13} /> Approve
        </button>
        <div style={{ flex: 1 }} />
        <button data-testid="wf-print" onClick={printReport} style={{ padding: "7px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Printer size={13} /> Print A4
        </button>
        <button data-testid="wf-excel" onClick={exportExcel} style={{ padding: "7px 14px", background: "#15803d", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Download size={13} /> Excel
        </button>
      </div>

      {/* Header meta */}
      <div style={{ background: "#fef9c3", border: "1.5px solid #fcd34d", borderRadius: 6, padding: 10, marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          <F label="Month">
            <select value={cur.month} onChange={(e) => setCur({ ...cur, month: e.target.value })} disabled={locked} data-testid="wf-month" style={inp}>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </F>
          <F label="Project Reference">
            <input value={cur.projectRef} onChange={(e) => setCur({ ...cur, projectRef: e.target.value })} disabled={locked} data-testid="wf-projref" style={inp} />
          </F>
          <F label="Type (Detectable / Non-Detectable)">
            <select value={cur.detectable} onChange={(e) => setCur({ ...cur, detectable: e.target.value })} disabled={locked} data-testid="wf-detectable" style={inp}>
              <option value="Detectable">Detectable</option>
              <option value="Non-Detectable">Non-Detectable</option>
            </select>
          </F>
          <F label="Circle *">
            <input value={cur.circle} onChange={(e) => setCur({ ...cur, circle: e.target.value })} disabled={locked} data-testid="wf-circle" placeholder="e.g. NOIDA-E" style={inp} />
          </F>
          <F label="Financial Year">
            <input value={cur.fy} readOnly data-testid="wf-fy" style={{ ...inp, background: "#dcfce7", fontWeight: 800 }} />
          </F>
          <F label="From Date">
            <input type="date" value={cur.fromDate} onChange={(e) => setCur({ ...cur, fromDate: e.target.value })} disabled={locked} data-testid="wf-from" style={inp} />
          </F>
          <F label="To Date">
            <input type="date" value={cur.toDate} onChange={(e) => setCur({ ...cur, toDate: e.target.value })} disabled={locked} data-testid="wf-to" style={inp} />
          </F>
          <F label="Ref No">
            <input value={cur.refNo} readOnly data-testid="wf-ref" style={{ ...inp, background: "#e0e7ff", fontWeight: 800, fontFamily: "monospace" }} />
          </F>
          <F label="Status">
            <input value={cur.status} readOnly data-testid="wf-status" style={{ ...inp, background: statusTone, color: "#fff", fontWeight: 800, textAlign: "center" }} />
          </F>
          <F label="Approver">
            <input value={cur.approvedBy || "— pending —"} readOnly data-testid="wf-approver" style={{ ...inp, background: cur.approvedBy ? "#dcfce7" : "#f1f5f9", fontWeight: 700 }} />
          </F>
        </div>
      </div>

      {/* Lines table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "auto" }}>
        <table data-testid="wf-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#1e293b", color: "#fff" }}>
              {["S.No", "Date", "Employee ID", "Employee Name", "Designation", "Week No", "Fooding Amount", "Payment Method", "Approver Name", "Payment Date", "Signature", "Remark", "Del"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", border: "1px solid #334155", textAlign: "center", fontSize: 10, letterSpacing: 0.3, fontWeight: 800 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(cur.lines || []).map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: 3, border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input type="date" value={l.date} onChange={(e) => setLine(i, { date: e.target.value })} disabled={locked} data-testid={`wf-date-${i}`} style={cellInp} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input list="wf-emp-list" value={l.empId} onChange={(e) => setLine(i, { empId: e.target.value })} disabled={locked} data-testid={`wf-emp-${i}`} placeholder="EMP ID" style={{ ...cellInp, background: "#fef3c7", fontWeight: 700, color: "#92400e" }} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input value={l.empName} onChange={(e) => setLine(i, { empName: e.target.value })} disabled={locked} style={cellInp} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} disabled={locked} style={cellInp} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <select value={l.weekNo} onChange={(e) => setLine(i, { weekNo: e.target.value })} disabled={locked} style={cellInp}>
                    {WEEKS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input type="number" value={l.amount || ""} onChange={(e) => setLine(i, { amount: Number(e.target.value) || 0 })} disabled={locked} data-testid={`wf-amt-${i}`} placeholder="0" style={{ ...cellInp, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <select value={l.payMethod} onChange={(e) => setLine(i, { payMethod: e.target.value })} disabled={locked} style={cellInp}>
                    {PAY_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input value={l.approver} onChange={(e) => setLine(i, { approver: e.target.value })} disabled={locked} style={cellInp} placeholder="Approver / NIL" />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input type="date" value={l.payDate} onChange={(e) => setLine(i, { payDate: e.target.value })} disabled={locked} style={cellInp} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input value={l.signature} onChange={(e) => setLine(i, { signature: e.target.value })} disabled={locked} style={cellInp} placeholder="NIL / Signed" />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0" }}>
                  <input value={l.remark} onChange={(e) => setLine(i, { remark: e.target.value })} disabled={locked} style={cellInp} />
                </td>
                <td style={{ padding: 3, border: "1px solid #e2e8f0", textAlign: "center" }}>
                  <button onClick={() => delLine(i)} disabled={locked} data-testid={`wf-del-${i}`} title="Delete row" style={{ padding: "3px 6px", background: locked ? "#cbd5e1" : "#dc2626", color: "#fff", border: "none", borderRadius: 3, cursor: locked ? "not-allowed" : "pointer" }}><Trash2 size={11} /></button>
                </td>
              </tr>
            ))}
            <tr style={{ background: "#fef3c7" }}>
              <td colSpan={6} style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 900 }}>TOTAL ({totals.count} rows)</td>
              <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 900, fontFamily: "monospace" }}>₹ {inrN(totals.total)}</td>
              <td colSpan={6} style={{ padding: 6, border: "1px solid #e2e8f0", fontSize: 10, color: "#78350f" }}>Paid: ₹{inrN(totals.paid)} · Pending: ₹{inrN(totals.pending)}</td>
            </tr>
          </tbody>
        </table>
        <datalist id="wf-emp-list">
          {emps.map((e) => <option key={e.id} value={e.empCode || e.id}>{`${e.fullName} · ${e.designation}`}</option>)}
        </datalist>
      </div>

      {!locked && (
        <div style={{ marginTop: 8 }}>
          <button onClick={addLine} data-testid="wf-addrow" style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Plus size={13} /> Add Row
          </button>
        </div>
      )}

      {/* Saved records */}
      <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        <div style={{ padding: "8px 12px", background: "#f1f5f9", fontWeight: 800, fontSize: 11.5, letterSpacing: 0.4, textTransform: "uppercase", color: "#334155", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 6 }}>
          <Utensils size={14} /> Saved Fooding Records · {list.length}
        </div>
        {list.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontStyle: "italic", fontSize: 11.5 }}>No records yet · Save your first draft above</div>
        ) : (
          <table data-testid="wf-saved-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Ref", "Month", "Circle", "FY", "Period", "Rows", "Total", "Status", "Approver", "Actions"].map((h) => <th key={h} style={{ padding: "5px 8px", border: "1px solid #e2e8f0", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.slice().reverse().map((r) => (
                <tr key={r.id} data-testid={`wf-row-${r.id}`} style={{ borderBottom: "1px solid #e2e8f0", background: r.id === cur.id ? "#fef9c3" : "#fff" }}>
                  <td style={{ padding: "4px 8px", fontFamily: "monospace", fontWeight: 700 }}>{r.refNo}</td>
                  <td style={{ padding: "4px 8px" }}>{r.month} {r.year}</td>
                  <td style={{ padding: "4px 8px" }}>{r.circle || "—"}</td>
                  <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{r.fy}</td>
                  <td style={{ padding: "4px 8px", fontSize: 10 }}>{r.fromDate} → {r.toDate}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{(r.lines || []).length}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#166534" }}>₹ {inrN((r.lines || []).reduce((s, l) => s + Number(l.amount || 0), 0))}</td>
                  <td style={{ padding: "4px 8px" }}>
                    <span style={{ padding: "1px 7px", background: { Draft: "#e2e8f0", Submitted: "#fef3c7", Approved: "#dcfce7" }[r.status] || "#e2e8f0", color: { Draft: "#64748b", Submitted: "#78350f", Approved: "#166534" }[r.status] || "#64748b", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{r.status}</span>
                  </td>
                  <td style={{ padding: "4px 8px" }}>{r.approvedBy || "—"}</td>
                  <td style={{ padding: "4px 8px" }}>
                    <button onClick={() => loadRecord(r)} style={{ padding: "2px 6px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 700, fontSize: 10, marginRight: 4 }}>Open</button>
                    <button onClick={() => removeRecord(r.id)} style={{ padding: "2px 6px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 700, fontSize: 10 }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const inp = { padding: "4px 6px", width: "100%", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 11 };
const cellInp = { padding: "3px 5px", width: "100%", border: "1px solid #e2e8f0", borderRadius: 2, fontSize: 10.5 };

const F = ({ label, children }) => (
  <div>
    <label style={{ fontSize: 9.5, letterSpacing: 0.4, fontWeight: 800, textTransform: "uppercase", color: "#78350f", display: "block", marginBottom: 2 }}>{label}</label>
    {children}
  </div>
);

export default WeeklyFoodingTab;
