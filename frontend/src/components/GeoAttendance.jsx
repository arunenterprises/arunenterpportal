import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Crosshair } from "lucide-react";
import { apiOpsList, apiOpsSave } from "../lib/api";
import { canApprove, currentUser } from "../lib/store";

const uid = () => `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const dist = (a, b, c, d) => {
  const R = 6371000, r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
};
const gps = () => new Promise((ok, no) => {
  if (!navigator.geolocation) { no(new Error("Is browser mein GPS nahi hai")); return; }
  navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => no(new Error("Location permission dein (browser mein Allow karein)")), { enableHighAccuracy: true, timeout: 20000 });
});
const inp = { padding: "7px 9px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 5 };
const btn = (bg) => ({ padding: "7px 12px", background: bg, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 });

export default function GeoAttendance() {
  const [sites, setSites] = useState([]);
  const [att, setAtt] = useState([]);
  const [site, setSite] = useState({ name: "", lat: "", lng: "", radius: 200 });
  const [pick, setPick] = useState("");
  const [name, setName] = useState(currentUser() || "");
  const [busy, setBusy] = useState(false);
  const load = () => Promise.all([apiOpsList("geo_site"), apiOpsList("geo_att")]).then(([s, a]) => { setSites(s); setAtt(a); }).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const admin = canApprove();
  const t = new Date().toISOString().slice(0, 10);

  const here = async () => { try { const c = await gps(); setSite((s) => ({ ...s, lat: c.latitude.toFixed(6), lng: c.longitude.toFixed(6) })); } catch (e) { toast.error(e.message); } };
  const saveSite = async () => {
    if (!site.name.trim() || !site.lat || !site.lng) { toast.error("Site naam aur location bharein"); return; }
    try { await apiOpsSave("geo_site", { id: uid(), status: "Active", ...site, lat: Number(site.lat), lng: Number(site.lng), radius: Number(site.radius) || 200 }); toast.success("Site saved"); setSite({ name: "", lat: "", lng: "", radius: 200 }); load(); } catch (e) { toast.error(e.message); }
  };
  const mark = async () => {
    const s = sites.find((x) => x.id === pick);
    if (!s) { toast.error("Site chunein"); return; }
    if (!name.trim()) { toast.error("Employee / Labour naam bharein"); return; }
    setBusy(true);
    try {
      const c = await gps();
      const m = dist(c.latitude, c.longitude, s.lat, s.lng);
      if (m > s.radius) { toast.error(`Aap site se ${m} meter door hain — ${s.radius} m ke andar aakar attendance lagayein`); return; }
      await apiOpsSave("geo_att", { id: uid(), status: "Present", empName: name.trim(), siteId: s.id, siteName: s.name, project: s.name, lat: c.latitude, lng: c.longitude, distance: m, at: new Date().toISOString() });
      toast.success(`Attendance lag gayi · ${s.name} · ${m} m`); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const todays = att.filter((a) => (a.at || "").slice(0, 10) === t);

  return (
    <div data-testid="geo-attendance" style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#065f46", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><MapPin size={15} /> Geo-Fencing Attendance (site ke radius ke andar hi lagegi)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select data-testid="geo-site-pick" value={pick} onChange={(e) => setPick(e.target.value)} style={inp}><option value="">— Site chunein —</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.radius} m)</option>)}</select>
          <input data-testid="geo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee / Labour naam" style={inp} />
          <button data-testid="geo-mark" disabled={busy} onClick={mark} style={btn("#059669")}><Crosshair size={13} /> {busy ? "GPS le raha hai..." : "GPS se Attendance lagayein"}</button>
        </div>
      </div>
      {admin && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>Site Geo-Fence set karein (Admin)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input data-testid="geo-site-name" value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} placeholder="Site / Project naam" style={inp} />
            <input data-testid="geo-site-lat" value={site.lat} onChange={(e) => setSite({ ...site, lat: e.target.value })} placeholder="Latitude" style={{ ...inp, width: 120 }} />
            <input data-testid="geo-site-lng" value={site.lng} onChange={(e) => setSite({ ...site, lng: e.target.value })} placeholder="Longitude" style={{ ...inp, width: 120 }} />
            <input data-testid="geo-site-radius" type="number" value={site.radius} onChange={(e) => setSite({ ...site, radius: e.target.value })} style={{ ...inp, width: 90 }} title="Radius (meter)" />
            <button data-testid="geo-site-here" onClick={here} style={btn("#0369a1")}><Crosshair size={13} /> Abhi ki Location</button>
            <button data-testid="geo-site-save" onClick={saveSite} style={btn("#16a34a")}>Save Site</button>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#f1f5f9", fontWeight: 800, fontSize: 12 }}>Aaj ki Geo Attendance ({todays.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead><tr>{["Naam", "Site", "Time", "Distance"].map((h) => <th key={h} style={{ padding: 6, textAlign: "left", background: "#f8fafc" }}>{h}</th>)}</tr></thead>
          <tbody>{todays.map((a) => <tr key={a.id} data-testid={`geo-row-${a.id}`}><td style={{ padding: 6 }}>{a.empName}</td><td style={{ padding: 6 }}>{a.siteName}</td><td style={{ padding: 6 }}>{new Date(a.at).toLocaleTimeString("en-IN")}</td><td style={{ padding: 6 }}>{a.distance} m</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
