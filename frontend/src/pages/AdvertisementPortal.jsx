// Public Careers / Advertisement Portal — lists GM-approved recruitment requisitions.
// No auth required. Candidates can view & apply via email.
import React, { useEffect, useState } from "react";
import { Briefcase, MapPin, Mail, Phone, Calendar, GraduationCap, Clock, IndianRupee, Users2, ArrowRight } from "lucide-react";

const BASE = process.env.REACT_APP_BACKEND_URL;

const fmtDMY = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const Card = ({ r }) => {
  const subject = encodeURIComponent(`Application for ${r.position} · ${r.advertisementNo}`);
  const body = encodeURIComponent(
`Dear HR Team,

I would like to apply for the position of ${r.position} (Advertisement No: ${r.advertisementNo}) advertised by Arun Enterprises.

Please find my CV attached. I look forward to your response.

Regards,
`);
  return (
    <div data-testid={`job-card-${r.id}`} style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: "5px solid #c81e2b", borderRadius: 10, padding: 18, boxShadow: "0 2px 8px rgba(15,23,42,.05)", transition: "all .25s", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            {r.advertisementNo || "Advertisement"}
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a", lineHeight: 1.2 }}>{r.position}</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "#475569" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {r.department}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Users2 size={12} /> {r.vacancies} vacancy{r.vacancies > 1 ? "ies" : ""}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> Posted {fmtDMY(r.gmApprovedAt || r.requisitionDate)}</span>
          </div>
        </div>
        <span style={{ background: "#fbbf24", color: "#78350f", padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: 1, whiteSpace: "nowrap" }}>HIRING NOW</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 6, fontSize: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: .8, textTransform: "uppercase" }}><GraduationCap size={10} style={{ verticalAlign: -1 }} /> Qualification</div>
          <div style={{ fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{r.qualificationRequired || "As per role"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: .8, textTransform: "uppercase" }}><Clock size={10} style={{ verticalAlign: -1 }} /> Experience</div>
          <div style={{ fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{r.experienceRequired || "Open to all levels"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: .8, textTransform: "uppercase" }}><IndianRupee size={10} style={{ verticalAlign: -1 }} /> Compensation</div>
          <div style={{ fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{r.budgetCTC ? `₹ ${Number(r.budgetCTC).toLocaleString("en-IN")} p.a.` : "As per industry"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: .8, textTransform: "uppercase" }}><Calendar size={10} style={{ verticalAlign: -1 }} /> Target Join</div>
          <div style={{ fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{r.targetJoinDate ? fmtDMY(r.targetJoinDate) : "ASAP"}</div>
        </div>
      </div>

      {r.reasonForHire && (
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55, padding: "8px 0", borderTop: "1px dashed #cbd5e1" }}>
          <b style={{ color: "#0f172a" }}>Role Overview: </b>{r.reasonForHire}
        </div>
      )}

      <a
        href={`mailto:info@arunenterprises.online?subject=${subject}&body=${body}`}
        data-testid={`apply-btn-${r.id}`}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 18px", background: "linear-gradient(135deg, #c81e2b 0%, #991b1b 100%)", color: "#fff", textDecoration: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, letterSpacing: .3, boxShadow: "0 2px 8px rgba(200,30,43,.3)", alignSelf: "flex-start" }}
      >
        Apply via Email <ArrowRight size={14} />
      </a>
    </div>
  );
};

export default function AdvertisementPortal() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/public/recruitments`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => { setErr(String(e)); setRows([]); });
  }, []);

  return (
    <div data-testid="careers-page" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #c81e2b 100%)", color: "#fff", padding: "48px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, opacity: .08 }}><Briefcase size={260} /></div>
        <div style={{ fontSize: 10, letterSpacing: 4, fontWeight: 800, color: "#fbcfe8" }}>M/s ARUN ENTERPRISES · CAREERS</div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 36, fontWeight: 900, letterSpacing: .5 }}>Join Our Team</h1>
        <p style={{ margin: "0 auto", maxWidth: 640, color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
          Govt. Civil Work Contractor &amp; General Order Supplier · Prayagraj, U.P.<br />
          Explore current openings and apply directly. All applications reviewed by HR within 72 hours.
        </p>
        <div style={{ display: "inline-flex", gap: 20, marginTop: 16, padding: "8px 20px", background: "rgba(255,255,255,.1)", borderRadius: 999, fontSize: 12, fontWeight: 700, backdropFilter: "blur(4px)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mail size={13} /> info@arunenterprises.online</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Phone size={13} /> Toll Free 9429694552</span>
        </div>
      </div>

      {/* Jobs grid */}
      <div style={{ maxWidth: 1200, margin: "-32px auto 0", padding: "0 24px 48px" }}>
        {rows === null ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b", background: "#fff", borderRadius: 10 }}>Loading openings...</div>
        ) : rows.length === 0 ? (
          <div data-testid="no-jobs" style={{ textAlign: "center", padding: 60, color: "#64748b", background: "#fff", borderRadius: 10, border: "1px dashed #cbd5e1" }}>
            <Briefcase size={40} style={{ opacity: .3 }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10, color: "#334155" }}>No active openings right now</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Please check back soon or email your CV to <b>info@arunenterprises.online</b> for future openings.</div>
            {err && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 8 }}>({err})</div>}
          </div>
        ) : (
          <>
            <div data-testid="jobs-count" style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, padding: "0 4px" }}>
              {rows.length} Active Opening{rows.length > 1 ? "s" : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
              {rows.map((r) => <Card key={r.id} r={r} />)}
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", padding: "24px 16px 40px", fontSize: 11, color: "#64748b" }}>
        © {new Date().getFullYear()} M/s Arun Enterprises · 209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011
      </div>
    </div>
  );
}
