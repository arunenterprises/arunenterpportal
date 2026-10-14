// HR Letter PDF generator (opens new window with A4 Portrait HTML + auto triggers print).
// Browser's "Save as PDF" option is used — no extra library required.

const LOGO = "/arun-logo.jpg";
const COMPANY = {
  name: "M/s ARUN ENTERPRISES",
  tagline: "OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY",
  subtag: "Govt. Civil Work Contractor & General Order Supplier",
  address: "209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011",
  phone: "9429694552",
  website: "www.arunenterprises.com.in",
  email: "info@arunenterprises.online",
  gstin: "09ABWFM0611J1ZY",
  pan: "ABWFM0611J",
};
const SIGNATORY = { name: "Ashish Srivastava", designation: "" };
const GM_SIGNATORY = { name: "K L Srivastava", designation: "General Manager" };

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
  .lh { border-bottom: 2.5px solid #c81e2b; padding-bottom: 6px; margin-bottom: 14px; }
  .lh .top { display: flex; justify-content: space-between; align-items: center; font-size: 10pt; font-weight: 700; color: #0f172a; padding: 0 2px 4px; flex-wrap: wrap; gap: 2px 10px; }
  .lh .main { display: flex; align-items: center; gap: 12px; }
  .lh img { width: 110px; height: 110px; object-fit: contain; background: #fff; }
  .lh .center { flex: 1; text-align: center; }
  .lh .name { font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif; font-size: 26pt; font-weight: 900; letter-spacing: 1.2px; color: #c81e2b; line-height: 1.05; text-transform: uppercase; font-style: normal; }
  .lh .tag { font-size: 10pt; font-weight: 700; color: #0f172a; letter-spacing: 1.3px; margin-top: 2px; text-transform: uppercase; }
  .lh .pill { display: inline-block; margin-top: 4px; padding: 2px 14px; background: #0ea5e9; color: #fff; font-weight: 700; font-size: 10pt; border-radius: 999px; }
  .lh .addr { font-size: 10pt; color: #0f172a; margin-top: 4px; font-weight: 600; }
  .lh .contact { font-size: 9.5pt; color: #0f172a; margin-top: 1px; }
  .lh .contact b { color: #0f172a; }
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
    <div class="top">
      <span><b>GSTIN:</b> ${COMPANY.gstin}</span>
      <span><b>PAN:</b> ${COMPANY.pan}</span>
      <span><b>Mob.:</b> ${COMPANY.phone}</span>
    </div>
    <div class="main">
      <img src="${LOGO}" alt="logo" onerror="this.style.display='none'" />
      <div class="center">
        <div class="name">${COMPANY.name}</div>
        <div class="tag">${COMPANY.tagline}</div>
        <div class="pill">${COMPANY.subtag}</div>
        <div class="addr">${COMPANY.address}</div>
        <div class="contact"><b>Email:</b> ${COMPANY.email} &nbsp;•&nbsp; <b>Web:</b> ${COMPANY.website}</div>
      </div>
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

// ============= ADVERTISEMENT / VACANCY NOTICE =============
export const printAdvertisementNotice = (r) => {
  const adNo = r.advertisementNo || "— (pending approval)";
  const today = fmtDMY(new Date().toISOString().slice(0, 10));
  const approvedOn = r.gmApprovedAt ? fmtDMY(r.gmApprovedAt) : "—";
  const esc = (s) => String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Advertisement - ${esc(r.position)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #0f172a; margin: 0; padding: 0; }
  .sheet { padding: 0; }
  .hdr { border: 3px double #0f172a; padding: 12px; margin-bottom: 10px; text-align: center; background: linear-gradient(135deg, #fef3c7 0%, #fff 100%); }
  .hdr .co { font-family: "Arial Black", sans-serif; font-size: 24pt; color: #c81e2b; font-weight: 900; letter-spacing: 1.5px; }
  .hdr .tag { font-size: 10pt; font-weight: 700; color: #0f172a; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase; }
  .hdr .addr { font-size: 9.5pt; margin-top: 4px; color: #334155; }
  .banner { background: #c81e2b; color: #fff; padding: 10px 14px; text-align: center; font-size: 20pt; font-weight: 900; letter-spacing: 3px; margin-bottom: 10px; text-transform: uppercase; }
  .ref-row { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 8px; padding: 6px 10px; background: #f1f5f9; border-left: 4px solid #c81e2b; }
  .ref-row b { color: #c81e2b; }
  .intro { font-size: 11pt; line-height: 1.6; text-align: justify; margin-bottom: 10px; padding: 0 6px; }
  .pos-box { background: #0f172a; color: #fff; padding: 10px 14px; margin: 10px 0 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .pos-box .lbl { font-size: 9pt; letter-spacing: 1.5px; color: #fbbf24; font-weight: 700; }
  .pos-box .val { font-size: 18pt; font-weight: 900; letter-spacing: .5px; }
  .pos-box .vac { background: #fbbf24; color: #78350f; padding: 3px 12px; border-radius: 20px; font-size: 11pt; font-weight: 900; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
  .cell { padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; }
  .cell .lbl { font-size: 8.5pt; color: #64748b; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .cell .val { font-size: 11pt; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .reason { padding: 8px 12px; background: #ecfdf5; border: 1px dashed #10b981; border-radius: 4px; margin: 8px 0; }
  .reason .lbl { font-size: 9pt; color: #065f46; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .reason .val { font-size: 10.5pt; margin-top: 2px; color: #0f172a; line-height: 1.5; }
  .apply { border: 2px solid #0f172a; padding: 12px; margin: 12px 0; background: #fef3c7; border-radius: 4px; }
  .apply h3 { margin: 0 0 6px; font-size: 13pt; color: #78350f; letter-spacing: 1px; text-align: center; }
  .apply ul { margin: 6px 0 0 18px; padding: 0; font-size: 10pt; line-height: 1.5; }
  .apply ul li { margin-bottom: 3px; }
  .foot { margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  .foot .left { font-size: 9pt; color: #64748b; }
  .foot .sig { text-align: right; }
  .foot .sig .name { font-weight: 700; font-size: 11pt; }
  .foot .sig .desig { font-size: 10pt; color: #64748b; }
  .foot .sig .line { border-top: 1px solid #0f172a; width: 180px; margin-left: auto; padding-top: 2px; }
  .stamp { position: absolute; right: 20mm; bottom: 50mm; opacity: .15; transform: rotate(-15deg); font-size: 48pt; font-weight: 900; color: #16a34a; letter-spacing: 4px; border: 4px solid #16a34a; padding: 8px 20px; border-radius: 8px; pointer-events: none; }
</style>
</head>
<body>
<div class="sheet">
  <div class="hdr">
    <div class="co">M/s ARUN ENTERPRISES</div>
    <div class="tag">Our Quality Oriented Service's is First Priority</div>
    <div class="addr">209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011 · Toll Free: 9429694552 · Email: info@arunenterprises.online</div>
  </div>
  <div class="banner">📢 Advertisement · Vacancy Notice</div>
  <div class="ref-row">
    <span><b>Advertisement No:</b> ${esc(adNo)}</span>
    <span><b>Requisition Date:</b> ${esc(fmtDMY(r.requisitionDate))}</span>
    <span><b>Published:</b> ${esc(today)}</span>
  </div>
  <div class="intro">
    M/s Arun Enterprises, a reputed Govt. Civil Work Contractor &amp; General Order Supplier based in Prayagraj (U.P.), invites applications from eligible, dynamic and self-motivated candidates for the following position(s) to join our growing team.
  </div>
  <div class="pos-box">
    <div><div class="lbl">POSITION</div><div class="val">${esc(r.position)}</div></div>
    <div><div class="lbl">DEPARTMENT</div><div class="val">${esc(r.department)}</div></div>
    <div class="vac">Vacancies: ${esc(r.vacancies || 1)}</div>
  </div>
  <div class="grid">
    <div class="cell"><div class="lbl">Qualification Required</div><div class="val">${esc(r.qualificationRequired || "—")}</div></div>
    <div class="cell"><div class="lbl">Experience Required</div><div class="val">${esc(r.experienceRequired || "—")}</div></div>
    <div class="cell"><div class="lbl">Compensation (Budget CTC)</div><div class="val">${r.budgetCTC ? inr(r.budgetCTC) + " per annum" : "As per industry standards"}</div></div>
    <div class="cell"><div class="lbl">Target Join Date</div><div class="val">${esc(fmtDMY(r.targetJoinDate) || "At the earliest")}</div></div>
  </div>
  ${r.reasonForHire ? `<div class="reason"><div class="lbl">Role Overview / Reason</div><div class="val">${esc(r.reasonForHire)}</div></div>` : ""}
  <div class="apply">
    <h3>How to Apply</h3>
    <ul>
      <li>Email your CV/resume with recent passport-size photograph to <b>info@arunenterprises.online</b></li>
      <li>Mention <b>"Application for ${esc(r.position)}"</b> &amp; Advertisement No <b>${esc(adNo)}</b> in the subject line</li>
      <li>Attach copies of educational, experience and KYC documents (Aadhaar, PAN)</li>
      <li>Shortlisted candidates will be contacted directly for an interview</li>
      <li>Walk-in interviews can be scheduled on prior appointment · Toll Free: <b>9429694552</b></li>
    </ul>
  </div>
  <div class="foot">
    <div class="left">
      Issued under authority of M/s Arun Enterprises<br/>
      ${r.gmApprovedByName ? `Approved by: <b>${esc(r.gmApprovedByName)}</b> on ${esc(approvedOn)}` : ""}
    </div>
    <div class="sig">
      <div class="line"></div>
      <div class="name">${esc(SIGNATORY.name)}</div>
      <div class="desig">${esc(SIGNATORY.designation)} · For M/s Arun Enterprises</div>
    </div>
  </div>
  ${Number(r.status) >= 3 ? '<div class="stamp">APPROVED</div>' : ''}
</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>`;
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) { alert("Please allow pop-ups to generate the Advertisement."); return; }
  w.document.open(); w.document.write(html); w.document.close();
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

// ============= FULL & FINAL SETTLEMENT STATEMENT =============
export const printFnFStatement = (emp, exit) => {
  if (!exit) return;
  const refNo = `AE/HR/FNF/${new Date().getFullYear()}/${String(emp?.empCode || emp?.id || exit.id || "").slice(-6).toUpperCase()}`;
  const today = fmtDMY(exit?.settledAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const doj = fmtDMY(emp?.doj);
  const resignDate = fmtDMY(exit?.resignDate);
  const lwd = fmtDMY(exit?.lastWorkingDay);

  const earnings = [
    ["Pending Salary / Dues", Number(exit.pendingDues) || 0],
    ["Bonus / Incentive Due", Number(exit.bonusDue) || 0],
    ["Leave Encashment", Number(exit.leaveEncash) || 0],
    ["Gratuity", Number(exit.gratuity) || 0],
  ];
  const deductions = [
    ["Loan / Advance Recovery", Number(exit.loanDeduction) || 0],
    ["Notice Period Recovery", Number(exit.noticeRecovery) || 0],
  ];
  const totalEarn = earnings.reduce((s, r) => s + r[1], 0);
  const totalDed = deductions.reduce((s, r) => s + r[1], 0);
  const net = totalEarn - totalDed;

  const earnRows = earnings.map(([k, v]) => `<tr><td>${k}</td><td class="num">${inr(v)}</td></tr>`).join("");
  const dedRows = deductions.map(([k, v]) => `<tr><td>${k}</td><td class="num">${inr(v)}</td></tr>`).join("");

  const clearance = exit.clearance || {};
  const clearRows = Object.keys(clearance).map((k) => {
    const label = k === "project" ? "Project Site" : k.toUpperCase();
    const done = clearance[k] ? "✓ Cleared" : "✗ Pending";
    const tone = clearance[k] ? "#166534" : "#991b1b";
    return `<tr><td>${label}</td><td style="color:${tone};font-weight:700">${done}</td></tr>`;
  }).join("");

  const body = `
    <div class="meta">
      <div class="ref">Ref: ${refNo}</div>
      <div>Date: ${today}</div>
    </div>
    <h1 class="title">Full &amp; Final Settlement Statement</h1>
    <table class="ctc" style="margin-top:14px">
      <tr><td style="font-weight:700;background:#f1f5f9;width:35%">Employee Name</td><td>${emp?.fullName || exit.empName || "—"}</td><td style="font-weight:700;background:#f1f5f9;width:20%">Emp Code</td><td>${emp?.empCode || exit.empCode || "—"}</td></tr>
      <tr><td style="font-weight:700;background:#f1f5f9">Designation</td><td>${emp?.designation || "—"}</td><td style="font-weight:700;background:#f1f5f9">Department</td><td>${emp?.department || exit.department || "—"}</td></tr>
      <tr><td style="font-weight:700;background:#f1f5f9">Date of Joining</td><td>${doj}</td><td style="font-weight:700;background:#f1f5f9">Resignation Date</td><td>${resignDate}</td></tr>
      <tr><td style="font-weight:700;background:#f1f5f9">Last Working Day</td><td>${lwd}</td><td style="font-weight:700;background:#f1f5f9">Reason</td><td>${exit.reason || "—"}</td></tr>
      <tr><td style="font-weight:700;background:#f1f5f9">PAN No.</td><td>${emp?.pan || "—"}</td><td style="font-weight:700;background:#f1f5f9">Aadhaar</td><td>${emp?.aadhaar || "—"}</td></tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:14px">
      <tr><td style="width:50%;vertical-align:top;padding-right:6px">
        <table class="ctc">
          <thead><tr><th colspan="2" style="background:#166534;color:#fff">Earnings / Payable (₹)</th></tr></thead>
          <tbody>
            ${earnRows}
            <tr class="total"><td style="font-weight:800">Total Earnings</td><td class="num" style="font-weight:800">${inr(totalEarn)}</td></tr>
          </tbody>
        </table>
      </td><td style="width:50%;vertical-align:top;padding-left:6px">
        <table class="ctc">
          <thead><tr><th colspan="2" style="background:#991b1b;color:#fff">Deductions / Recovery (₹)</th></tr></thead>
          <tbody>
            ${dedRows}
            <tr class="total"><td style="font-weight:800">Total Deductions</td><td class="num" style="font-weight:800">${inr(totalDed)}</td></tr>
          </tbody>
        </table>
      </td></tr>
    </table>

    <table class="ctc" style="margin-top:14px">
      <tr class="total">
        <td style="font-weight:800;font-size:12.5pt;background:#0f172a;color:#fff">NET F&amp;F PAYABLE ${net < 0 ? "(RECOVERABLE)" : ""}</td>
        <td class="num" style="font-weight:800;font-size:13pt;background:#0f172a;color:#fff">${inr(net)}</td>
      </tr>
    </table>

    <p style="margin-top:10px;font-size:10.5pt;padding:8px 10px;background:#f1f5f9;border-left:3px solid #0f172a">
      <b>Amount in Words:</b> <i>Rupees ${inr(net).replace("₹","").trim()} Only</i> (as per F&amp;F computation).
      ${exit.linkedPvNo ? `<br/><b>Payment Voucher:</b> ${exit.linkedPvNo}` : ""}
    </p>

    <h2 style="font-size:12pt;margin-top:16px;border-bottom:1px solid #0f172a;padding-bottom:3px">Departmental Clearance</h2>
    <table class="ctc"><tbody>${clearRows || `<tr><td colspan="2">— No clearance recorded —</td></tr>`}</tbody></table>

    <div class="sign-block">
      <div class="for">For ${COMPANY.name}</div>
      <div class="sig-name">${SIGNATORY.name}</div><br/>
      <div class="sig-desig">${SIGNATORY.designation} · Authorized Signatory</div>
    </div>
    <div class="accept">
      <b>Acknowledgement by Employee</b>
      <p style="font-size:10pt;margin-top:6px">I hereby acknowledge receipt of the Full &amp; Final Settlement amount as detailed above and confirm that I have no further claims against the Company whatsoever.</p>
      <div class="accept-grid">
        <div class="cell"><div class="line"></div>Signature of Employee</div>
        <div class="cell"><div class="line"></div>Name &amp; Date</div>
      </div>
    </div>
  `;
  openPrint("F&F Statement - " + (emp?.fullName || exit.empName || "Employee"), body);
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
      <div><b>Designation:</b> ${emp.designation || "—"}</div>
      <div><b>Department:</b> ${emp.department || "—"}</div>
      <div><b>Reporting Manager:</b> ${emp.reportingManager || "—"}</div>
      <div><b>Date of Joining:</b> ${fmtDMY(emp.doj)}</div>
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
          <div class="sig-line">Signature of Candidate / Employee<br/><span style="font-size:8.5pt;font-weight:400;color:#475569;">(${emp.fullName || "—"})</span></div>
        </div>
      </div>
    </div>

    <div class="wf-block">
      <div class="wf-head">HR Workflow &amp; Approval Chain</div>
      <table class="wf-tbl">
        <thead>
          <tr>
            <th>Prepared By (HR)</th>
            <th>Verified By</th>
            <th>Department Manager</th>
            <th>Authorized Signatory</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="sig-area"></td>
            <td class="sig-area"></td>
            <td class="sig-area"></td>
            <td class="sig-area">${SIGNATORY.name}<br/><span>${SIGNATORY.designation}</span></td>
          </tr>
          <tr class="nm">
            <td><b>${emp.createdByName || "—"}</b><br/><span>HR Executive</span><br/><span>Date: ${fmtDMY(emp.createdAt?.slice(0, 10) || emp.dateOfFiling)}</span></td>
            <td><b>${emp.verifiedByName || emp.checkedByName || "—"}</b><br/><span>HR Verifier</span><br/><span>Date: ${fmtDMY((emp.verifiedAt || emp.checkedAt || "").slice(0, 10))}</span></td>
            <td><b>${emp.approvedByName || "—"}</b><br/><span>Department Manager</span><br/><span>Date: ${fmtDMY((emp.approvedAt || "").slice(0, 10))}</span></td>
            <td><b>${emp.finalizedByName || SIGNATORY.name}</b><br/><span>${SIGNATORY.designation}</span><br/><span>Date: ${fmtDMY((emp.finalizedAt || "").slice(0, 10))}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="wf-foot">
      <b>Form Status:</b> ${Number(emp.step) >= 5 ? "FINAL APPROVED" : "APPROVAL PENDING"} · <b>Current Step:</b> ${emp.step || 1} / 5 · <b>Revision:</b> ${emp.revision || 0} · <b>Form Ref:</b> ${emp.empCode || emp.tempCode}
    </div>
  `;

  // Override letter CSS for application form
  const extraCss = `
    .app-head { text-align: center; margin: 4px 0 10px; }
    .app-title { font-size: 15pt; font-weight: 800; letter-spacing: 2px; text-decoration: underline; }
    .app-sub { font-size: 10pt; color: #475569; margin-top: 3px; }
    .refbox { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 14px; border: 1.5px solid #0f172a; background: #dbeafe; padding: 7px 10px; font-size: 10pt; margin-bottom: 10px; }
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
    .wf-block { margin-top: 14px; border: 1.5px solid #0f172a; }
    .wf-head { background: #0f172a; color: #fff; padding: 4px 10px; font-size: 10.5pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
    .wf-tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .wf-tbl th { background: #e2e8f0; padding: 4px 6px; border: 1px solid #334155; font-weight: 800; text-align: center; }
    .wf-tbl td.sig-area { height: 42px; border: 1px solid #334155; text-align: center; font-size: 8.5pt; color: #475569; vertical-align: bottom; padding: 2px; }
    .wf-tbl tr.nm td { padding: 4px 6px; border: 1px solid #334155; text-align: center; font-size: 8.5pt; line-height: 1.3; }
    .wf-tbl tr.nm td b { font-size: 9pt; color: #0f172a; }
    .wf-tbl tr.nm td span { color: #475569; font-size: 7.5pt; }
    .wf-foot { margin-top: 10px; padding: 6px 10px; background: #f1f5f9; border-left: 3px solid #0f172a; font-size: 9pt; color: #334155; }
    @media print { .noprint-btn { display: none; } }
  `;

  const html = `
    <style>${extraCss}</style>
    ${body}
  `;
  openPrint("Employee Application - " + (emp.fullName || emp.tempCode), html);
};

// ============= ATTENDANCE SHEET (A4 Landscape) =============
export const printAttendanceSheet = (emps, year, month, getMonthAttendance) => {
  const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long" });
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join("");

  const rows = emps.map((e, i) => {
    const rec = getMonthAttendance(e.id, year, month);
    const cells = Array.from({ length: daysInMonth }, (_, d) => {
      const key = String(d + 1).padStart(2, "0");
      const v = rec.days?.[key] || "";
      const tone = { P: "#dcfce7", A: "#fee2e2", L: "#fef3c7", H: "#dbeafe", W: "#f1f5f9", HL: "#ede9fe" }[v] || "#fff";
      return `<td style="background:${tone};font-weight:${v ? 700 : 400};">${v || "—"}</td>`;
    }).join("");
    const presentCount = Object.values(rec.days || {}).filter((s) => s === "P" || s === "H").length;
    const absentCount = Object.values(rec.days || {}).filter((s) => s === "A").length;
    const leaveCount = Object.values(rec.days || {}).filter((s) => s === "L").length;
    return `<tr${i % 2 ? ' class="alt"' : ""}><td class="sticky">${e.empCode || e.tempCode}</td><td class="sticky nm">${e.fullName}</td>${cells}<td class="sum p">${presentCount}</td><td class="sum a">${absentCount}</td><td class="sum l">${leaveCount}</td></tr>`;
  }).join("");

  const extraCss = `
    @page { size: A4 landscape; margin: 10mm 12mm; }
    .att-title { text-align: center; font-size: 15pt; font-weight: 800; text-decoration: underline; margin: 6px 0 10px; letter-spacing: 1.5px; }
    .att-meta { display: flex; justify-content: space-between; font-size: 10.5pt; margin-bottom: 8px; }
    table.att { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    table.att th, table.att td { border: 1px solid #334155; padding: 3px 2px; text-align: center; }
    table.att th { background: #0f172a; color: #fff; font-size: 7pt; }
    table.att td.sticky { background: #e2e8f0; font-weight: 700; text-align: left; padding: 3px 6px; font-size: 8pt; }
    table.att td.nm { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    table.att td.sum { font-weight: 800; font-size: 8pt; }
    table.att td.sum.p { background: #dcfce7; color: #166534; }
    table.att td.sum.a { background: #fee2e2; color: #991b1b; }
    table.att td.sum.l { background: #fef3c7; color: #78350f; }
    tr.alt td { background: #fafbfc; }
    .legend { margin-top: 8px; font-size: 8.5pt; display: flex; gap: 10px; flex-wrap: wrap; }
    .legend span { padding: 2px 7px; border-radius: 3px; font-weight: 700; }
    .att-sig { margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; font-size: 9.5pt; }
    .att-sig .cell { text-align: center; }
    .att-sig .ln { border-top: 1px solid #0f172a; margin-top: 36px; padding-top: 4px; font-weight: 700; }
  `;
  const body = `<style>${extraCss}</style>
    <div class="att-title">MONTHLY ATTENDANCE SHEET</div>
    <div class="att-meta">
      <div><b>Month:</b> ${monthName} ${year}</div>
      <div><b>Days:</b> ${daysInMonth} · <b>Employees:</b> ${emps.length}</div>
      <div><b>Generated:</b> ${fmtDMY(new Date().toISOString().slice(0, 10))}</div>
    </div>
    <table class="att">
      <thead><tr><th class="sticky">Code</th><th class="sticky">Name</th>${dayHeaders}<th style="background:#16a34a">P</th><th style="background:#dc2626">A</th><th style="background:#f59e0b">L</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${daysInMonth + 5}" style="padding:20px;color:#94a3b8;">No employees</td></tr>`}</tbody>
    </table>
    <div class="legend">
      <b>Legend:</b>
      <span style="background:#dcfce7;color:#166534">P = Present</span>
      <span style="background:#fee2e2;color:#991b1b">A = Absent</span>
      <span style="background:#fef3c7;color:#78350f">L = Leave</span>
      <span style="background:#dbeafe;color:#1e3a8a">H = Half-day</span>
      <span style="background:#f1f5f9;color:#334155">W = Week-off</span>
      <span style="background:#ede9fe;color:#5b21b6">HL = Holiday</span>
    </div>
    <div class="att-sig">
      <div class="cell"><div class="ln">Prepared By (HR)</div></div>
      <div class="cell"><div class="ln">Department Manager</div></div>
      <div class="cell"><div class="ln">${SIGNATORY.name}<br/><span style="font-size:8pt;color:#475569;font-weight:400;">${SIGNATORY.designation}</span></div></div>
    </div>
  `;
  openPrint(`Attendance ${monthName} ${year}`, body);
};

// ============= LEAVE APPLICATION (A4 Portrait) =============
export const printLeaveApplication = (leave, emp) => {
  const refNo = `AE/HR/LV/${new Date().getFullYear()}/${String(leave.id || "").slice(-5).toUpperCase()}`;
  const today = fmtDMY(new Date().toISOString().slice(0, 10));
  const statusMap = { 1: "Draft", 2: "Submitted to HR", 3: "Approved", 4: "Rejected" };

  const body = `
    <div class="meta">
      <div class="ref">Ref: ${refNo}</div>
      <div>Date: ${today}</div>
    </div>
    <h1 class="title">Leave Application</h1>
    <p>To,</p>
    <p><b>The HR Manager</b><br/>${COMPANY.name}</p>
    <p style="margin-top:14px;"><b>Subject:</b> Application for ${leave.type || "Leave"} from ${fmtDMY(leave.from)} to ${fmtDMY(leave.to)}</p>
    <p>Respected Sir / Madam,</p>
    <p>I, <b>${emp?.fullName || "—"}</b> (Employee Code: <b>${emp?.empCode || emp?.tempCode || "—"}</b>), working as <b>${emp?.designation || "—"}</b> in the <b>${emp?.department || "—"}</b> department, would like to request your approval for <b>${leave.type || "Leave"}</b> for a period of <b>${leave.days || 0} day(s)</b>, with effect from <b>${fmtDMY(leave.from)}</b> to <b>${fmtDMY(leave.to)}</b>.</p>
    <p><b>Reason:</b> ${leave.reason || "—"}</p>
    <p>During my absence, I will ensure that my pending work is handed over to a colleague and I remain reachable on <b>${emp?.contactMobile || "—"}</b> for any urgent matters.</p>
    <p>Kindly consider my request and grant me the above leave. I shall be thankful for your kind approval.</p>
    <p style="margin-top:18px;">Thanking you,</p>
    <p style="margin-top:30px;">Yours sincerely,<br/><br/><b>${emp?.fullName || "—"}</b><br/>${emp?.designation || "—"} · ${emp?.department || "—"}<br/>EMP Code: ${emp?.empCode || emp?.tempCode || "—"}<br/>Mobile: ${emp?.contactMobile || "—"}</p>
    <div class="wf-block" style="margin-top:30px;">
      <div class="wf-head">HR Decision</div>
      <table class="wf-tbl">
        <thead><tr><th>Status</th><th>Approved By</th><th>Date</th><th>Remarks</th></tr></thead>
        <tbody><tr class="nm">
          <td><b>${statusMap[leave.status] || "Pending"}</b></td>
          <td class="sig-area">${leave.decidedBy || "—"}</td>
          <td class="sig-area">${fmtDMY(leave.decidedAt?.slice(0, 10))}</td>
          <td class="sig-area">${leave.hrRemarks || "—"}</td>
        </tr></tbody>
      </table>
    </div>
    <style>
      .wf-block { border: 1.5px solid #0f172a; }
      .wf-head { background: #0f172a; color: #fff; padding: 4px 10px; font-size: 10.5pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      .wf-tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
      .wf-tbl th { background: #e2e8f0; padding: 4px 6px; border: 1px solid #334155; font-weight: 800; text-align: center; }
      .wf-tbl td { border: 1px solid #334155; padding: 6px; text-align: center; }
      .wf-tbl td.sig-area { height: 32px; }
    </style>
  `;
  openPrint("Leave Application - " + (emp?.fullName || ""), body);
};

// ============= PAYROLL SLIP (A4 Portrait with letterhead) =============
export const printPayrollSlipLetter = (emp, salary, year, month, daysInMonth, daysPresent) => {
  const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long" });
  const refNo = `AE/HR/PS/${year}${String(month).padStart(2, "0")}/${String(emp.empCode || emp.id || "").slice(-6).toUpperCase()}`;
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");

  const body = `
    <div class="meta">
      <div class="ref">Ref: ${refNo}</div>
      <div>Pay Period: <b>${monthName} ${year}</b></div>
    </div>
    <h1 class="title">Salary Slip</h1>

    <table class="emp-info">
      <tbody>
        <tr><td class="l">EMP Code</td><td class="v"><b>${emp.empCode || "—"}</b></td><td class="l">Name</td><td class="v"><b>${emp.fullName || "—"}</b></td></tr>
        <tr><td class="l">Designation</td><td class="v">${emp.designation || "—"}</td><td class="l">Department</td><td class="v">${emp.department || "—"}</td></tr>
        <tr><td class="l">PF No.</td><td class="v">${emp.pfNo || "—"}</td><td class="l">UAN</td><td class="v">${emp.uan || "—"}</td></tr>
        <tr><td class="l">PAN</td><td class="v">${emp.pan || "—"}</td><td class="l">Bank A/C</td><td class="v">${emp.bankAccount || "—"} (${emp.ifsc || "—"})</td></tr>
        <tr><td class="l">Days in Month</td><td class="v">${daysInMonth}</td><td class="l">Days Present</td><td class="v"><b>${daysPresent}</b></td></tr>
      </tbody>
    </table>

    <div class="pay-grid">
      <table class="pay earn">
        <thead><tr><th colspan="2">Earnings</th></tr></thead>
        <tbody>
          <tr><td>Basic</td><td class="num">${inrN(emp.basic)}</td></tr>
          <tr><td>HRA</td><td class="num">${inrN(emp.hra)}</td></tr>
          <tr><td>DA</td><td class="num">${inrN(emp.da)}</td></tr>
          <tr><td>Special Allowance</td><td class="num">${inrN(emp.special)}</td></tr>
          <tr><td>Bonus</td><td class="num">${inrN(emp.bonus)}</td></tr>
          <tr class="tot"><td>Gross Earned</td><td class="num">₹ ${inrN(salary.earned)}</td></tr>
        </tbody>
      </table>
      <table class="pay ded">
        <thead><tr><th colspan="2">Deductions</th></tr></thead>
        <tbody>
          <tr><td>Provident Fund (12%)</td><td class="num">${inrN(salary.pf)}</td></tr>
          <tr><td>ESIC (0.75%)</td><td class="num">${inrN(salary.esic)}</td></tr>
          <tr><td>Professional Tax</td><td class="num">${inrN(salary.proftax)}</td></tr>
          <tr><td>TDS</td><td class="num">${inrN(salary.tds)}</td></tr>
          <tr><td>—</td><td class="num">—</td></tr>
          <tr class="tot"><td>Total Deductions</td><td class="num">₹ ${inrN(salary.deductions)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="net-pay">
      <span>NET SALARY PAYABLE</span>
      <b>₹ ${inrN(salary.net)}</b>
    </div>
    <div class="in-words">Amount in Words: <i>Rupees ${inrN(salary.net)} only</i></div>

    <div class="wf-block" style="margin-top:20px;">
      <div class="wf-head">Payroll Authorization</div>
      <table class="auth-tbl">
        <thead><tr><th>Prepared By (Accounts)</th><th>Verified By (HR)</th><th>Authorized Signatory</th></tr></thead>
        <tbody><tr>
          <td class="sig-area"></td>
          <td class="sig-area"></td>
          <td class="sig-area"><b>${SIGNATORY.name}</b><br/><span>${SIGNATORY.designation}</span></td>
        </tr></tbody>
      </table>
    </div>

    <style>
      table.emp-info { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 12px; }
      table.emp-info td { border: 1px solid #334155; padding: 5px 10px; }
      table.emp-info td.l { background: #f1f5f9; width: 20%; font-weight: 700; font-size: 9pt; }
      .pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
      table.pay { width: 100%; border-collapse: collapse; font-size: 10pt; }
      table.pay th { padding: 6px; color: #fff; text-align: left; font-size: 10.5pt; }
      table.pay.earn th { background: #16a34a; }
      table.pay.ded th { background: #dc2626; }
      table.pay td { border: 1px solid #cbd5e1; padding: 5px 10px; }
      table.pay td.num { text-align: right; font-variant-numeric: tabular-nums; }
      table.pay tr.tot td { background: #0f172a; color: #fff; font-weight: 800; font-size: 11pt; }
      .net-pay { background: #0f172a; color: #fff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; font-size: 13pt; }
      .net-pay b { font-size: 18pt; }
      .in-words { padding: 6px 10px; background: #fef3c7; border: 1px solid #fcd34d; font-size: 10pt; margin-top: 6px; }
      .wf-block { border: 1.5px solid #0f172a; }
      .wf-head { background: #0f172a; color: #fff; padding: 4px 10px; font-size: 10.5pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      table.auth-tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
      table.auth-tbl th { background: #e2e8f0; padding: 4px 6px; border: 1px solid #334155; font-weight: 800; text-align: center; }
      table.auth-tbl td.sig-area { height: 50px; border: 1px solid #334155; text-align: center; vertical-align: bottom; padding: 4px; font-size: 9pt; }
      table.auth-tbl td.sig-area b { font-size: 9.5pt; }
      table.auth-tbl td.sig-area span { color: #475569; font-size: 8pt; }
    </style>
  `;
  openPrint(`Salary Slip ${monthName} ${year} - ${emp.fullName}`, body);
};

// ============= PAY BILL SHEET (A4 Landscape) =============
export const printPayBillSheet = (pb) => {
  if (!pb) return;
  const monthName = new Date(pb.year, pb.month - 1).toLocaleString("en-IN", { month: "long" });
  const statusMap = { 1: "Draft", 2: "Submitted to GM", 3: "GM Approved", 4: "Settled & Paid" };
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
  const rows = (pb.lines || []).map((l, i) => `
    <tr${i % 2 ? ' class="alt"' : ""}>
      <td>${i + 1}</td>
      <td class="nm">${l.empCode || "—"}</td>
      <td class="nm">${l.name || "—"}</td>
      <td>${l.designation || "—"}</td>
      <td>${l.daysPresent}/${l.daysInMonth}</td>
      <td class="num">${inrN(l.basic)}</td>
      <td class="num">${inrN(l.hra)}</td>
      <td class="num">${inrN(l.da)}</td>
      <td class="num">${inrN(l.special)}</td>
      <td class="num">${inrN(l.bonus)}</td>
      <td class="num tot">${inrN(l.gross)}</td>
      <td class="num ded">${inrN(l.pf)}</td>
      <td class="num ded">${inrN(l.esic)}</td>
      <td class="num ded">${inrN(l.proftax)}</td>
      <td class="num ded">${inrN(l.tds)}</td>
      <td class="num adv">${inrN(l.advance)}</td>
      <td class="num ded">${inrN(l.otherDeductions)}</td>
      <td class="num net">${inrN(l.net)}</td>
    </tr>`).join("");

  const extraCss = `
    @page { size: A4 landscape; margin: 10mm 12mm; }
    .pb-title { text-align: center; font-size: 15pt; font-weight: 800; text-decoration: underline; margin: 6px 0 8px; letter-spacing: 1.5px; }
    .pb-meta { display: flex; justify-content: space-between; font-size: 10.5pt; margin-bottom: 8px; }
    .pb-meta .st { padding: 2px 10px; border-radius: 4px; font-weight: 800; }
    .pb-meta .st-1 { background: #fef3c7; color: #78350f; }
    .pb-meta .st-2 { background: #dbeafe; color: #1e3a8a; }
    .pb-meta .st-3 { background: #dcfce7; color: #166534; }
    .pb-meta .st-4 { background: #0f172a; color: #fff; }
    table.pb { width: 100%; border-collapse: collapse; font-size: 7.8pt; }
    table.pb th { background: #0f172a; color: #fff; padding: 4px 3px; border: 1px solid #334155; text-align: center; font-size: 7pt; }
    table.pb td { padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; }
    table.pb td.nm { text-align: left; font-weight: 700; }
    table.pb td.num { text-align: right; font-variant-numeric: tabular-nums; }
    table.pb td.num.tot { background: #ecfdf5; font-weight: 700; }
    table.pb td.num.ded { background: #fef2f2; }
    table.pb td.num.adv { background: #fef3c7; }
    table.pb td.num.net { background: #0f172a; color: #fff; font-weight: 800; }
    table.pb tr.alt td { background: #fafbfc; }
    table.pb tr.sum td { background: #0f172a; color: #fff; font-weight: 800; font-size: 9pt; padding: 6px; }
    .pb-sig { margin-top: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; font-size: 9pt; }
    .pb-sig .cell { text-align: center; }
    .pb-sig .ln { border-top: 1.5px solid #0f172a; margin-top: 40px; padding-top: 4px; font-weight: 700; }
    .pb-sig .ln span { color: #475569; font-size: 7.5pt; font-weight: 400; display: block; }
  `;
  const body = `<style>${extraCss}</style>
    <div class="pb-title">MONTHLY PAY BILL</div>
    <div class="pb-meta">
      <div><b>Ref No.:</b> ${pb.refNo || "—"} · <b>Period:</b> ${monthName} ${pb.year}</div>
      <div><b>Employees:</b> ${pb.lines?.length || 0}</div>
      <div><b>Status:</b> <span class="st st-${pb.step || 1}">${statusMap[pb.step || 1]}</span></div>
    </div>
    <table class="pb">
      <thead>
        <tr>
          <th>#</th><th>EMP Code</th><th>Name</th><th>Designation</th><th>Days</th>
          <th>Basic</th><th>HRA</th><th>DA</th><th>Special</th><th>Bonus</th><th>GROSS</th>
          <th>PF</th><th>ESIC</th><th>P.Tax</th><th>TDS</th><th>Advance</th><th>Other</th>
          <th>NET</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="18" style="padding:14px;color:#94a3b8;">No employees in this pay bill</td></tr>`}
        <tr class="sum">
          <td colspan="10" style="text-align:right;">TOTALS →</td>
          <td class="num">₹ ${inrN(pb.totalGross)}</td>
          <td colspan="4" class="num">₹ ${inrN(pb.totalDeductions)} (total ded.)</td>
          <td class="num">₹ ${inrN(pb.totalAdvance)}</td>
          <td></td>
          <td class="num">₹ ${inrN(pb.totalNet)}</td>
        </tr>
      </tbody>
    </table>
    <div class="pb-sig">
      <div class="cell"><div class="ln">Prepared By (HR)<br/><span>${pb.createdByName || "—"} · ${fmtDMY((pb.createdAt || "").slice(0, 10))}</span></div></div>
      <div class="cell"><div class="ln">Verified By (Accounts)<br/><span>${pb.submittedByName || "—"} · ${fmtDMY((pb.submittedAt || "").slice(0, 10))}</span></div></div>
      <div class="cell"><div class="ln">Approved By (GM)<br/><span>${pb.approvedByName || "—"} · ${fmtDMY((pb.approvedAt || "").slice(0, 10))}</span></div></div>
      <div class="cell"><div class="ln">${SIGNATORY.name}<br/><span>${SIGNATORY.designation} · ${fmtDMY((pb.settledAt || "").slice(0, 10))}</span></div></div>
    </div>
  `;
  openPrint(`Pay Bill ${monthName} ${pb.year}`, body);
};

// Export Pay Bill as downloadable PDF (A4 landscape) via html2pdf.js
export const exportPayBillPDF = async (pb) => {
  if (!pb) return;
  const html2pdf = (await import("html2pdf.js")).default;
  const monthName = new Date(pb.year, pb.month - 1).toLocaleString("en-IN", { month: "long" });
  const statusMap = { 1: "Draft", 2: "Submitted to GM", 3: "GM Approved", 4: "Settled & Paid" };
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
  const rows = (pb.lines || []).map((l, i) => `
    <tr${i % 2 ? ' style="background:#fafbfc;"' : ""}>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:center;">${i + 1}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:left;font-weight:700;">${l.empCode || "—"}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:left;font-weight:700;">${l.name || "—"}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:center;">${l.designation || "—"}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:center;">${l.daysPresent}/${l.daysInMonth}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;">${inrN(l.basic)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;">${inrN(l.hra)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;">${inrN(l.da)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;">${inrN(l.special)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;">${inrN(l.bonus)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#ecfdf5;font-weight:700;">${inrN(l.gross)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#fef2f2;">${inrN(l.pf)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#fef2f2;">${inrN(l.esic)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#fef2f2;">${inrN(l.proftax)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#fef2f2;">${inrN(l.tds)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#fef3c7;">${inrN(l.advance)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#fef2f2;">${inrN(l.otherDeductions)}</td>
      <td style="padding:3px 4px;border:1px solid #cbd5e1;text-align:right;background:#0f172a;color:#fff;font-weight:800;">${inrN(l.net)}</td>
    </tr>`).join("");
  const container = document.createElement("div");
  container.style.cssText = "padding:12mm;font-family:Arial,sans-serif;color:#0f172a;background:#fff;";
  container.innerHTML = `
    <div style="text-align:center;font-size:15pt;font-weight:800;text-decoration:underline;margin:6px 0 8px;letter-spacing:1.5px;">MONTHLY PAY BILL</div>
    <div style="display:flex;justify-content:space-between;font-size:10.5pt;margin-bottom:8px;">
      <div><b>Ref No.:</b> ${pb.refNo || "—"} · <b>Period:</b> ${monthName} ${pb.year}</div>
      <div><b>Employees:</b> ${pb.lines?.length || 0}</div>
      <div><b>Status:</b> <span style="padding:2px 10px;border-radius:4px;font-weight:800;background:#dcfce7;color:#166534;">${statusMap[pb.step || 1]}</span></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:7.8pt;">
      <thead>
        <tr style="background:#0f172a;color:#fff;">
          ${["#","EMP Code","Name","Designation","Days","Basic","HRA","DA","Special","Bonus","GROSS","PF","ESIC","P.Tax","TDS","Advance","Other","NET"].map(h => `<th style="padding:4px 3px;border:1px solid #334155;text-align:center;font-size:7pt;">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="18" style="padding:14px;color:#94a3b8;text-align:center;">No employees in this pay bill</td></tr>`}
        <tr style="background:#0f172a;color:#fff;font-weight:800;font-size:9pt;">
          <td colspan="10" style="padding:6px;text-align:right;">TOTALS →</td>
          <td style="padding:6px;text-align:right;">₹ ${inrN(pb.totalGross)}</td>
          <td colspan="4" style="padding:6px;text-align:right;">₹ ${inrN(pb.totalDeductions)} (total ded.)</td>
          <td style="padding:6px;text-align:right;">₹ ${inrN(pb.totalAdvance)}</td>
          <td></td>
          <td style="padding:6px;text-align:right;">₹ ${inrN(pb.totalNet)}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;font-size:9pt;">
      <div style="text-align:center;"><div style="border-top:1.5px solid #0f172a;margin-top:40px;padding-top:4px;font-weight:700;">Prepared By (HR)<br/><span style="color:#475569;font-size:7.5pt;font-weight:400;">${pb.createdByName || "—"} · ${fmtDMY((pb.createdAt || "").slice(0, 10))}</span></div></div>
      <div style="text-align:center;"><div style="border-top:1.5px solid #0f172a;margin-top:40px;padding-top:4px;font-weight:700;">Verified By (Accounts)<br/><span style="color:#475569;font-size:7.5pt;font-weight:400;">${pb.submittedByName || "—"} · ${fmtDMY((pb.submittedAt || "").slice(0, 10))}</span></div></div>
      <div style="text-align:center;"><div style="border-top:1.5px solid #0f172a;margin-top:40px;padding-top:4px;font-weight:700;">Approved By (GM)<br/><span style="color:#475569;font-size:7.5pt;font-weight:400;">${pb.approvedByName || "—"} · ${fmtDMY((pb.approvedAt || "").slice(0, 10))}</span></div></div>
      <div style="text-align:center;"><div style="border-top:1.5px solid #0f172a;margin-top:40px;padding-top:4px;font-weight:700;">${SIGNATORY.name}<br/><span style="color:#475569;font-size:7.5pt;font-weight:400;">${SIGNATORY.designation} · ${fmtDMY((pb.settledAt || "").slice(0, 10))}</span></div></div>
    </div>
  `;
  document.body.appendChild(container);
  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `PayBill_${monthName}_${pb.year}_${pb.refNo?.replace(/[/\\]/g, "-") || "sheet"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
};

// ============= WHATSAPP PAYSLIP DELIVERY (wa.me deep link) =============
export const sendPayslipWhatsApp = (emp, salary, year, month) => {
  if (!emp?.contactMobile) { alert("Employee mobile number missing. Please update Contact Details first."); return; }
  const mobile = String(emp.contactMobile).replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) { alert("Invalid 10-digit mobile number: " + emp.contactMobile); return; }
  const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long" });
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
  const text = `*ARUN ENTERPRISES — Salary Slip*\n\nHi ${emp.fullName},\n\nAapki ${monthName} ${year} ki salary slip ready hai.\n\n*EMP Code:* ${emp.empCode}\n*Gross:* ₹ ${inrN(salary.earned)}\n*Deductions:* ₹ ${inrN(salary.deductions)}\n*Net Payable:* *₹ ${inrN(salary.net)}*\n\nAapka salary account me transfer ho chuka hai. Kisi bhi query ke liye HR department se contact kijiye.\n\nThanks,\n*HR Team · Arun Enterprises*`;
  const url = `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
};
// Advance Receipt (A4 Portrait) — printable receipt for an approved advance request
// with UTR / reference number + employee signature block.
export const printAdvanceReceipt = (req, emp = {}) => {
  if (!req) return;
  const inrN = (n) => Number(n || 0).toLocaleString("en-IN");
  const amtWords = (n) => {
    // Minimal in-words — rupees only, no paise
    const num = Math.floor(Number(n) || 0);
    if (!num) return "Zero Rupees Only";
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
      if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
      if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
      return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
    };
    return inWords(num) + " Rupees Only";
  };
  const periodLabel = new Date(req.targetYear || new Date().getFullYear(), (req.targetMonth || 1) - 1)
    .toLocaleString("en", { month: "long", year: "numeric" });
  const body = `
    <h1 class="title">Advance Payment Receipt</h1>
    <div class="meta">
      <div class="ref">Receipt No: <b>${req.refNo || "—"}</b></div>
      <div>Date: <b>${fmtDMY(req.requestDate)}</b></div>
    </div>
    <div class="addressee">
      Received with thanks from <b>${COMPANY.name}</b> the following sum towards advance payment, to be adjusted in the <b>${periodLabel}</b> pay bill as per the Repayment Mode noted below.
    </div>
    <table class="ctc" style="margin-top:14px;">
      <tr><th style="width:40%">Employee Name</th><td><b>${emp.fullName || req.empName || "—"}</b></td></tr>
      <tr><th>Employee Code</th><td class="num" style="text-align:left;font-family:monospace">${emp.empCode || req.empCode || "—"}</td></tr>
      <tr><th>Department / Designation</th><td>${(emp.department || req.department || "—")} · ${(emp.designation || req.designation || "—")}</td></tr>
      <tr class="sub"><th>Advance Amount</th><td class="num" style="font-weight:800;font-size:14pt;color:#0f172a">₹ ${inrN(req.amount)}</td></tr>
      <tr><th>Amount in Words</th><td style="font-style:italic">${amtWords(req.amount)}</td></tr>
      <tr><th>Target Month for Adjustment</th><td><b>${periodLabel}</b></td></tr>
      <tr><th>Repayment Mode</th><td>${req.repaymentMode || "Salary Deduction"}${req.repaymentMode === "EMI" ? ` · ${req.emiMonths || 2} months` : ""}</td></tr>
      <tr><th>Reason / Purpose</th><td>${req.reason || "—"}</td></tr>
      <tr class="total"><th>UTR / Reference No</th><td style="font-family:monospace;font-weight:800;color:#166534">${req.utrNo || "— (pending)"}</td></tr>
    </table>
    <p style="margin-top:16px;font-size:11pt">
      <b>Declaration:</b> I acknowledge receipt of the above advance amount and agree that it will be
      recovered as per the Repayment Mode mentioned above. Any dispute shall be subject to the
      jurisdiction of the courts at the registered office location.
    </p>
    <div class="accept-grid" style="margin-top:60px">
      <div class="cell">
        <div class="line"></div>
        <div style="font-weight:700">Received By (Employee)</div>
        <div style="font-size:10pt;color:#475569">${emp.fullName || req.empName || "—"}</div>
      </div>
      <div class="cell">
        <div class="line"></div>
        <div style="font-weight:700">Approved By (Accounts)</div>
        <div style="font-size:10pt;color:#475569">${req.approvedByName || "—"}${req.approvedAt ? " · " + fmtDMY(String(req.approvedAt).slice(0, 10)) : ""}</div>
      </div>
      <div class="cell">
        <div class="line"></div>
        <div style="font-weight:700">For ${COMPANY.name}</div>
        <div style="font-size:10pt;color:#475569">${SIGNATORY.name} · ${SIGNATORY.designation}</div>
      </div>
    </div>
  `;
  openPrint(`Advance Receipt ${req.refNo || ""}`, body);
};
