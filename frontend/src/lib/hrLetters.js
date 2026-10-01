// HR Letter PDF generator (opens new window with A4 Portrait HTML + auto triggers print).
// Browser's "Save as PDF" option is used — no extra library required.

const LOGO = "/arun-logo.jpg";
const COMPANY = {
  name: "ARUN ENTERPRISES",
  tagline: "Quality · Commitment · Solutions & Services",
  address: "Corporate Office · Lucknow, Uttar Pradesh, India",
  cin: "",
  website: "www.arunenterprises.com.in",
  email: "arunenterprises2023@gmail.com",
};
const SIGNATORY = { name: "K.L. Srivastava", designation: "Director" };

const fmtDMY = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const inr = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");

// Build CTC breakup from annual CTC
const buildCTC = (annual) => {
  const a = Number(annual) || 0;
  const basic = Math.round(a * 0.50);
  const hra = Math.round(a * 0.20);
  const da = Math.round(a * 0.10);
  const special = Math.round(a * 0.15);
  const bonus = Math.round(a * 0.05);
  const monthlyGross = Math.round((basic + hra + da + special + bonus) / 12);
  // Employer contributions on top (part of CTC)
  const pfEmployer = Math.round(basic * 0.12);
  const gratuity = Math.round(basic * 0.0481);
  const totalCTC = basic + hra + da + special + bonus + pfEmployer + gratuity;
  return { basic, hra, da, special, bonus, monthlyGross, pfEmployer, gratuity, totalCTC };
};

const buildHtml = (title, bodyHtml) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #0f172a; margin: 0; padding: 0; font-size: 12pt; line-height: 1.55; }
  .sheet { padding: 0; }
  .lh { display: flex; align-items: center; gap: 14px; border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
  .lh img { width: 68px; height: 68px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; }
  .lh .name { font-size: 22pt; font-weight: 800; letter-spacing: 1px; color: #0f172a; line-height: 1.05; }
  .lh .tag { font-size: 9.5pt; color: #475569; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .lh .addr { font-size: 9pt; color: #64748b; margin-top: 3px; }
  .meta { display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 16px; }
  .meta .ref { font-weight: 700; }
  h1.title { font-size: 15pt; font-weight: 800; text-align: center; text-decoration: underline; letter-spacing: 1.5px; margin: 10px 0 18px; text-transform: uppercase; }
  p { margin: 0 0 11px; text-align: justify; }
  .salutation { font-weight: 700; margin-bottom: 10px; }
  .addressee { margin-bottom: 14px; font-size: 11pt; }
  .addressee b { font-size: 12pt; }
  table.ctc { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 10.5pt; }
  table.ctc th, table.ctc td { border: 1px solid #334155; padding: 6px 10px; text-align: left; }
  table.ctc th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 9.5pt; letter-spacing: .5px; }
  table.ctc td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.ctc tr.sub td { background: #f1f5f9; font-weight: 700; }
  table.ctc tr.total td { background: #fef3c7; font-weight: 800; font-size: 11.5pt; }
  ol.terms { padding-left: 20px; margin: 8px 0 14px; font-size: 11pt; }
  ol.terms li { margin-bottom: 6px; text-align: justify; }
  .sign-block { margin-top: 44px; }
  .sign-block .for { font-weight: 700; margin-bottom: 56px; }
  .sign-block .sig-name { font-weight: 800; border-top: 1px solid #0f172a; padding-top: 4px; display: inline-block; min-width: 220px; }
  .sign-block .sig-desig { font-size: 10.5pt; color: #475569; }
  .accept { margin-top: 30px; padding-top: 12px; border-top: 1px dashed #94a3b8; font-size: 10.5pt; }
  .accept-grid { display: flex; justify-content: space-between; gap: 20px; margin-top: 24px; }
  .accept-grid .cell { flex: 1; }
  .accept-grid .line { border-bottom: 1px solid #0f172a; height: 24px; margin-bottom: 4px; }
  .footer-note { position: fixed; bottom: 8mm; left: 18mm; right: 18mm; text-align: center; font-size: 8.5pt; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 4px; }
  .noprint-btn { position: fixed; top: 10px; right: 10px; padding: 10px 18px; background: #0f172a; color: #fff; border: none; border-radius: 6px; font-size: 11pt; cursor: pointer; font-weight: 700; }
  @media print { .noprint-btn { display: none; } }
</style>
</head>
<body>
<button class="noprint-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
<div class="sheet">
  <div class="lh">
    <img src="${LOGO}" alt="logo" onerror="this.style.display='none'" />
    <div>
      <div class="name">${COMPANY.name}</div>
      <div class="tag">${COMPANY.tagline}</div>
      <div class="addr">${COMPANY.address} · ${COMPANY.website} · ${COMPANY.email}</div>
    </div>
  </div>
  ${bodyHtml}
  <div class="footer-note">This is a computer-generated letter from ${COMPANY.name} HR Department. ${COMPANY.website}</div>
</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 400); };
</script>
</body>
</html>`;

const openPrint = (title, html) => {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) { alert("Please allow pop-ups to generate the letter."); return; }
  w.document.open();
  w.document.write(buildHtml(title, html));
  w.document.close();
};

// ============= OFFER LETTER =============
export const printOfferLetter = (recruit) => {
  const refNo = `AE/HR/OL/${new Date().getFullYear()}/${String(recruit.id || "").slice(-5).toUpperCase()}`;
  const today = fmtDMY(new Date().toISOString().slice(0, 10));
  const offerDate = fmtDMY(recruit.offerDate || new Date().toISOString().slice(0, 10));
  const joiningDate = fmtDMY(recruit.offerDate || new Date().toISOString().slice(0, 10));
  const c = buildCTC(recruit.offerCTC);

  const body = `
    <div class="meta">
      <div class="ref">Ref: ${refNo}</div>
      <div>Date: ${today}</div>
    </div>
    <h1 class="title">Offer of Appointment</h1>
    <div class="addressee">
      <b>${recruit.candidateName || "—"}</b><br/>
      ${recruit.candidateEmail || ""}${recruit.candidateMobile ? " · " + recruit.candidateMobile : ""}
    </div>
    <p class="salutation">Dear ${(recruit.candidateName || "Candidate").split(" ")[0]},</p>
    <p>With reference to your application and the subsequent interview you had with us, we are pleased to offer you the position of <b>${recruit.position || "—"}</b> in our <b>${recruit.department || "—"}</b> department at ${COMPANY.name}.</p>
    <p>Your appointment shall be effective from <b>${joiningDate}</b> and will be governed by the terms &amp; conditions laid down herein and the standing policies of the Company as amended from time to time.</p>
    <p><b>Compensation (Annual CTC Breakup):</b> Your Total Cost to Company (CTC) shall be <b>${inr(c.totalCTC || recruit.offerCTC)}</b> per annum, structured as follows:</p>
    <table class="ctc">
      <thead><tr><th>Component</th><th style="text-align:right">Annual (₹)</th><th style="text-align:right">Monthly (₹)</th></tr></thead>
      <tbody>
        <tr><td>Basic Salary</td><td class="num">${inr(c.basic)}</td><td class="num">${inr(Math.round(c.basic / 12))}</td></tr>
        <tr><td>House Rent Allowance (HRA)</td><td class="num">${inr(c.hra)}</td><td class="num">${inr(Math.round(c.hra / 12))}</td></tr>
        <tr><td>Dearness Allowance (DA)</td><td class="num">${inr(c.da)}</td><td class="num">${inr(Math.round(c.da / 12))}</td></tr>
        <tr><td>Special Allowance</td><td class="num">${inr(c.special)}</td><td class="num">${inr(Math.round(c.special / 12))}</td></tr>
        <tr><td>Statutory Bonus</td><td class="num">${inr(c.bonus)}</td><td class="num">${inr(Math.round(c.bonus / 12))}</td></tr>
        <tr class="sub"><td>Gross Monthly Earning</td><td class="num">${inr(c.basic + c.hra + c.da + c.special + c.bonus)}</td><td class="num">${inr(c.monthlyGross)}</td></tr>
        <tr><td>Employer PF Contribution (12% of Basic)</td><td class="num">${inr(c.pfEmployer)}</td><td class="num">${inr(Math.round(c.pfEmployer / 12))}</td></tr>
        <tr><td>Gratuity Provision (4.81% of Basic)</td><td class="num">${inr(c.gratuity)}</td><td class="num">${inr(Math.round(c.gratuity / 12))}</td></tr>
        <tr class="total"><td>TOTAL CTC</td><td class="num">${inr(c.totalCTC)}</td><td class="num">${inr(Math.round(c.totalCTC / 12))}</td></tr>
      </tbody>
    </table>
    <p><b>Terms &amp; Conditions:</b></p>
    <ol class="terms">
      <li>You shall be on <b>probation</b> for a period of six (6) months from the date of joining, extendable at the Company's discretion. Confirmation of services shall be subject to satisfactory performance and conduct.</li>
      <li>The notice period during probation shall be <b>one (1) month</b> and <b>two (2) months</b> post confirmation from either side, or pay in lieu thereof.</li>
      <li>You shall devote your entire time, attention and efforts to the business of the Company and shall not engage in any other employment or business, directly or indirectly, during the tenure of your service.</li>
      <li>You shall be bound by all policies, rules and regulations of the Company including Code of Conduct, IT &amp; Information Security Policy, Anti-Harassment Policy and such other policies as may be issued from time to time.</li>
      <li>You shall maintain strict <b>confidentiality</b> of all proprietary information, trade secrets, client data, drawings, estimates and any technical / commercial information of the Company both during and after your employment.</li>
      <li>This offer is subject to satisfactory <b>background verification</b>, submission of original KYC documents (Aadhaar, PAN, educational &amp; experience certificates) and medical fitness.</li>
      <li>Statutory benefits viz. Provident Fund, ESIC (if applicable) and Gratuity shall be governed as per the applicable laws of India.</li>
      <li>The Company reserves the right to transfer your services to any of its offices, projects or group companies in India as per business requirements.</li>
    </ol>
    <p>Please indicate your acceptance of this offer by signing the duplicate copy of this letter and returning the same to the HR department on or before your date of joining. We look forward to a long and mutually rewarding association with you.</p>
    <div class="sign-block">
      <div class="for">For ${COMPANY.name}</div>
      <div class="sig-name">${SIGNATORY.name}</div><br/>
      <div class="sig-desig">${SIGNATORY.designation} · Authorized Signatory</div>
    </div>
    <div class="accept">
      <b>Acceptance by Candidate</b>
      <div class="accept-grid">
        <div class="cell"><div class="line"></div>Signature of Candidate</div>
        <div class="cell"><div class="line"></div>Name &amp; Date</div>
      </div>
    </div>
  `;
  openPrint("Offer Letter - " + recruit.candidateName, body);
};

// ============= EXPERIENCE LETTER =============
export const printExperienceLetter = (emp, exit) => {
  const refNo = `AE/HR/EXP/${new Date().getFullYear()}/${String(emp.empCode || emp.id || "").slice(-6).toUpperCase()}`;
  const today = fmtDMY(exit?.settledAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const doj = fmtDMY(emp.doj);
  const lwd = fmtDMY(exit?.lastWorkingDay || emp.exitedAt?.slice(0, 10));

  const body = `
    <div class="meta">
      <div class="ref">Ref: ${refNo}</div>
      <div>Date: ${today}</div>
    </div>
    <h1 class="title">Experience Certificate</h1>
    <p style="margin-top:20px;">TO WHOMSOEVER IT MAY CONCERN</p>
    <p>This is to certify that <b>${emp.fullName || "—"}</b> (Employee Code: <b>${emp.empCode || "—"}</b>)${emp.fatherName ? ", S/o " + emp.fatherName : ""} was employed with <b>${COMPANY.name}</b> as <b>${emp.designation || "—"}</b> in the <b>${emp.department || "—"}</b> department from <b>${doj}</b> to <b>${lwd}</b>.</p>
    <p>During the tenure of his/her employment with the Company, we found him/her to be <b>sincere, hard-working, responsible and dedicated</b> towards the assigned duties and responsibilities. He/She has demonstrated good professional conduct, teamwork and a positive attitude at the workplace.</p>
    <p>He/She has handled responsibilities related to <b>${emp.department || "operations"}</b> and has made valuable contributions to the growth and development of the Company. His/Her overall performance during the tenure has been <b>satisfactory</b>.</p>
    <p>We wish him/her the very best in all future endeavours.</p>
    <div class="sign-block">
      <div class="for">For ${COMPANY.name}</div>
      <div class="sig-name">${SIGNATORY.name}</div><br/>
      <div class="sig-desig">${SIGNATORY.designation} · Authorized Signatory</div>
    </div>
  `;
  openPrint("Experience Letter - " + emp.fullName, body);
};

// ============= RELIEVING LETTER =============
export const printRelievingLetter = (emp, exit) => {
  const refNo = `AE/HR/REL/${new Date().getFullYear()}/${String(emp.empCode || emp.id || "").slice(-6).toUpperCase()}`;
  const today = fmtDMY(exit?.settledAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const doj = fmtDMY(emp.doj);
  const lwd = fmtDMY(exit?.lastWorkingDay || emp.exitedAt?.slice(0, 10));
  const resignDate = fmtDMY(exit?.resignDate);
  const fnfNet = Number(exit?.fnfNet || 0);

  const body = `
    <div class="meta">
      <div class="ref">Ref: ${refNo}</div>
      <div>Date: ${today}</div>
    </div>
    <h1 class="title">Relieving Letter</h1>
    <div class="addressee">
      <b>${emp.fullName || "—"}</b><br/>
      Employee Code: ${emp.empCode || "—"}<br/>
      ${emp.designation || "—"} · ${emp.department || "—"}
    </div>
    <p class="salutation">Dear ${(emp.fullName || "Employee").split(" ")[0]},</p>
    <p>With reference to your resignation letter dated <b>${resignDate}</b>, we hereby confirm the acceptance of your resignation from the services of <b>${COMPANY.name}</b>. You are being relieved from your duties with effect from the close of business hours on <b>${lwd}</b>, which shall be treated as your Last Working Day with the Company.</p>
    <p>You joined us on <b>${doj}</b> as <b>${emp.designation || "—"}</b> in the <b>${emp.department || "—"}</b> department. We confirm that you have completed all exit formalities including handover of Company property, documents and assets, and have obtained the necessary clearance from all concerned departments viz. HR, Accounts, Admin, IT and Store.</p>
    <p>Your <b>Full &amp; Final Settlement</b> of ${inr(fnfNet)} (Rupees ${fnfNet > 0 ? "payable to you" : "recoverable"}) has been settled as per the Company's F&amp;F computation sheet, after adjusting all applicable dues, deductions, statutory contributions and recoveries. The amount shall be/has been credited to your registered bank account.</p>
    <p>We take this opportunity to thank you for your valuable services and contribution to the Company during your tenure. We wish you the very best in all your future endeavours.</p>
    <p>Kindly acknowledge receipt of this letter at the earliest.</p>
    <div class="sign-block">
      <div class="for">For ${COMPANY.name}</div>
      <div class="sig-name">${SIGNATORY.name}</div><br/>
      <div class="sig-desig">${SIGNATORY.designation} · Authorized Signatory</div>
    </div>
    <div class="accept">
      <b>Acknowledgement by Employee</b>
      <div class="accept-grid">
        <div class="cell"><div class="line"></div>Signature of Employee</div>
        <div class="cell"><div class="line"></div>Name &amp; Date</div>
      </div>
    </div>
  `;
  openPrint("Relieving Letter - " + emp.fullName, body);
};

// ============= EMPLOYEE APPLICATION FORM (A4 Portrait) =============
export const printEmployeeApplication = (emp) => {
  if (!emp) return;
  const addr = (line, city, state, pin) => [line, city, state, pin].filter(Boolean).join(", ");
  const presentAddr = addr(emp.presentLine, emp.presentCity, emp.presentState, emp.presentPincode) || emp.presentAddress || emp.address || "—";
  const permAddr = emp.sameAsPresent ? presentAddr : (addr(emp.permanentLine, emp.permanentCity, emp.permanentState, emp.permanentPincode) || emp.permanentAddress || "—");

  const row = (lbl, val) => `<tr><td class="l">${lbl}</td><td class="v">${val || "—"}</td></tr>`;
  const dynSection = (title, rows, cols) => {
    if (!rows || rows.length === 0) return `<div class="dyn-empty">${title}: — None —</div>`;
    const head = cols.map((c) => `<th>${c.label}</th>`).join("");
    const body = rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c.key] ?? "—"}</td>`).join("")}</tr>`).join("");
    return `<div class="dyn"><div class="dyn-t">${title}</div><table class="dyn-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const body = `
    <div class="app-head">
      <div class="app-title">EMPLOYEE APPLICATION FORM</div>
      <div class="app-sub">Form Ref: ${emp.tempCode || "—"} ${emp.empCode ? " · EMP Code: <b>" + emp.empCode + "</b>" : ""}</div>
    </div>

    <div class="refbox">
      <div><b>Advertisement No.:</b> ${emp.advertisementNo || "—"}</div>
      <div><b>Date of Filing:</b> ${fmtDMY(emp.dateOfFiling)}</div>
      <div><b>Project / Site:</b> ${emp.projectSite || "—"}</div>
      <div><b>Location:</b> ${emp.location || "—"}</div>
      <div><b>Applied Post:</b> ${emp.appliedPost || "—"}</div>
    </div>

    <div class="row-top">
      <div class="photo-box">
        ${emp.photoUrl ? `<img src="${emp.photoUrl}" />` : `<div class="ph-ph">Passport Photo</div>`}
      </div>
      <table class="pers">
        <tbody>
          ${row("Full Name", `<b>${emp.fullName}</b>`)}
          ${row("Father's Name", emp.fatherName)}
          ${row("Mother's Name", emp.motherName)}
          ${row("Spouse Name", emp.spouseName)}
          ${row("Date of Birth", fmtDMY(emp.dob))}
          ${row("Gender", { M: "Male", F: "Female", O: "Other" }[emp.gender] || emp.gender)}
          ${row("Marital Status", emp.maritalStatus)}
          ${row("Blood Group", emp.bloodGroup)}
          ${row("Nationality", emp.nationality)}
          ${row("Religion", emp.religion)}
          ${row("Category", emp.category)}
          ${row("Aadhaar No.", emp.aadhaar)}
          ${row("PAN", emp.pan)}
        </tbody>
      </table>
    </div>

    <div class="sec-t">Contact Details</div>
    <table class="kv">
      <tbody>
        ${row("Mobile", emp.contactMobile)}
        ${row("Alternate Mobile", emp.contactAltMobile)}
        ${row("Email", emp.contactEmail)}
        ${row("Present / Communication Address", presentAddr)}
        ${row("Permanent Address", permAddr)}
      </tbody>
    </table>

    <div class="sec-t">Job / Position</div>
    <table class="kv">
      <tbody>
        ${row("Date of Joining", fmtDMY(emp.doj))}
        ${row("Designation", emp.designation)}
        ${row("Department", emp.department)}
        ${row("Reporting Manager", emp.reportingManager)}
      </tbody>
    </table>

    ${dynSection("Family Members", emp.familyMembers, [
      { key: "name", label: "Name" }, { key: "relation", label: "Relation" },
      { key: "dob", label: "DOB" }, { key: "occupation", label: "Occupation" }, { key: "contact", label: "Contact" },
    ])}
    ${dynSection("Educational Qualifications", emp.educations, [
      { key: "qualification", label: "Qualification" }, { key: "board", label: "Board / University" },
      { key: "institute", label: "Institute" }, { key: "year", label: "Year" }, { key: "percentage", label: "% / CGPA" },
    ])}
    ${dynSection("Previous Work Experience", emp.experiences, [
      { key: "company", label: "Company" }, { key: "designation", label: "Designation" },
      { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "lastSalary", label: "Last Salary" }, { key: "reason", label: "Reason" },
    ])}
    ${dynSection("References", emp.references, [
      { key: "name", label: "Name" }, { key: "designation", label: "Designation" },
      { key: "company", label: "Company / Org." }, { key: "mobile", label: "Mobile" }, { key: "relation", label: "Known For" },
    ])}

    <div class="sec-t">Bank &amp; Statutory Details</div>
    <table class="kv">
      <tbody>
        ${row("Bank Name", emp.bankName)}
        ${row("Branch", `${emp.bankBranch || "—"}${emp.bankCity ? ", " + emp.bankCity : ""}`)}
        ${row("Account No.", emp.bankAccount)}
        ${row("Account Type", emp.bankAccountType)}
        ${row("IFSC Code", emp.ifsc)}
        ${row("PF No. / UAN", `${emp.pfNo || "—"} / ${emp.uan || "—"}`)}
        ${row("ESIC No.", emp.esicNo)}
      </tbody>
    </table>

    <div class="decl">
      <div class="sec-t">Declaration</div>
      <p>I hereby declare that the information furnished above is true, correct and complete to the best of my knowledge and belief. I understand that in case any particular is found to be false or incorrect at any stage, my candidature / services are liable to be terminated without notice.</p>
      <div class="decl-foot">
        <div><b>Place:</b> ${emp.declarationPlace || "—"}</div>
        <div><b>Date:</b> ${fmtDMY(emp.declarationDate)}</div>
        <div class="sig-cell">
          ${emp.signatureUrl ? `<img src="${emp.signatureUrl}" class="sig-img" />` : ""}
          <div class="sig-line">Signature of Candidate</div>
        </div>
      </div>
    </div>

    <div class="wf-foot">
      <b>HR Workflow:</b> Create → Edit → Prepared → Submit → ${Number(emp.step) >= 5 ? "<b>Final Approved</b>" : "Approval Pending"} · Current Step: <b>${emp.step || 1}</b> · Revision: ${emp.revision || 0}
    </div>
  `;

  // Override letter CSS for application form
  const extraCss = `
    .app-head { text-align: center; margin: 4px 0 10px; }
    .app-title { font-size: 15pt; font-weight: 800; letter-spacing: 2px; text-decoration: underline; }
    .app-sub { font-size: 10pt; color: #475569; margin-top: 3px; }
    .refbox { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 14px; border: 1px solid #0f172a; background: #f8fafc; padding: 7px 10px; font-size: 10pt; margin-bottom: 10px; }
    .row-top { display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 10px; }
    .photo-box { width: 110px; height: 140px; border: 1.5px solid #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .ph-ph { font-size: 8.5pt; color: #94a3b8; text-align: center; padding: 4px; }
    table.pers, table.kv, table.dyn-tbl { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.pers td.l, table.kv td.l { width: 36%; background: #f1f5f9; padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: 700; }
    table.pers td.v, table.kv td.v { padding: 4px 8px; border: 1px solid #cbd5e1; }
    .sec-t { font-size: 10.5pt; font-weight: 800; background: #0f172a; color: #fff; padding: 4px 10px; margin: 10px 0 6px; letter-spacing: 1px; }
    .dyn-empty { font-size: 9.5pt; color: #94a3b8; padding: 4px 8px; border: 1px dashed #cbd5e1; margin-bottom: 8px; font-style: italic; }
    .dyn { margin-bottom: 8px; }
    .dyn-t { font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
    table.dyn-tbl th, table.dyn-tbl td { border: 1px solid #334155; padding: 3px 6px; text-align: left; font-size: 9pt; }
    table.dyn-tbl th { background: #e2e8f0; font-weight: 700; }
    .decl { margin-top: 10px; border: 1.5px solid #78350f; padding: 8px 10px; background: #fffbeb; }
    .decl p { font-size: 9.5pt; margin: 4px 0; text-align: justify; }
    .decl-foot { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 10px; margin-top: 20px; font-size: 10pt; }
    .sig-cell { text-align: right; }
    .sig-img { max-height: 40px; max-width: 180px; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 3px; font-size: 9pt; font-weight: 700; text-align: center; margin-top: 4px; }
    .wf-foot { margin-top: 14px; padding: 6px 10px; background: #f1f5f9; border-left: 3px solid #0f172a; font-size: 9pt; color: #334155; }
    @media print { .noprint-btn { display: none; } }
  `;

  const html = `
    <style>${extraCss}</style>
    ${body}
  `;
  openPrint("Employee Application - " + (emp.fullName || emp.tempCode), html);
};
