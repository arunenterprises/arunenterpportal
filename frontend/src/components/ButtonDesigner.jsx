import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Paintbrush, X, Save, RotateCcw } from "lucide-react";
import { apiGetUiButtons, apiSetUiButtons, getToken } from "../lib/api";
import { isSuperAdmin, currentUserEmail } from "../lib/store";

const LS = "uibtn_cache_v1";
const EMPTY = { global: {}, pages: {}, buttons: {} };
const DEF = { zoom: 1, font: "", radius: "", width: "", margin: "" };

const rule = (sel, s = {}) => {
  const p = [];
  if (s.zoom && Number(s.zoom) !== 1) p.push(`zoom:${s.zoom}`);
  if (s.font) p.push(`font-size:${s.font}px !important`);
  if (s.radius !== "" && s.radius != null) p.push(`border-radius:${s.radius}px !important`);
  if (s.width) p.push(`min-width:${s.width}px !important;justify-content:center !important`);
  if (s.margin) p.push(`margin:${s.margin}px !important`);
  return p.length ? `${sel}{${p.join(";")}}` : "";
};
const BTN = "button:not(.bd-ui)";
export const buildButtonCss = (v = EMPTY) => [
  rule(`body ${BTN}`, v.global),
  ...Object.entries(v.pages || {}).map(([p, s]) => rule(`body[data-route="${p}"] ${BTN}`, s)),
  ...Object.entries(v.buttons || {}).map(([k, s]) => { const [p, id] = k.split("|"); return rule(`body[data-route="${p}"] [data-testid="${id}"]`, s); }),
].filter(Boolean).join("\n");

const applyCss = (v) => {
  let el = document.getElementById("ae-btn-style");
  if (!el) { el = document.createElement("style"); el.id = "ae-btn-style"; document.head.appendChild(el); }
  el.textContent = buildButtonCss(v);
};
const readCache = () => { try { return JSON.parse(localStorage.getItem(LS)) || EMPTY; } catch { return EMPTY; } };

const Slider = ({ label, k, min, max, step, s, set, unit = "" }) => (
  <label className="bd-ui" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
    {label}: <b>{s[k] === "" || s[k] == null ? "default" : `${s[k]}${unit}`}</b>
    <input className="bd-ui" data-testid={`bd-${k}`} type="range" min={min} max={max} step={step} value={s[k] === "" || s[k] == null ? (k === "zoom" ? 1 : min) : s[k]}
      onChange={(e) => set({ ...s, [k]: e.target.value })} style={{ width: "100%" }} />
  </label>
);

// SuperAdmin button designer: pick any button, set size/font/radius/width/spacing for that button, its page, or the whole app.
export const ButtonDesigner = () => {
  const loc = useLocation();
  const [val, setVal] = useState(readCache);
  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState(null);
  const [scope, setScope] = useState("button");
  const [s, setS] = useState(DEF);
  const sa = isSuperAdmin(currentUserEmail());

  useEffect(() => { document.body.dataset.route = loc.pathname; }, [loc.pathname]);
  useEffect(() => { applyCss(val); }, [val]);
  useEffect(() => {
    if (!getToken()) return;
    apiGetUiButtons().then((r) => { setVal(r.value || EMPTY); localStorage.setItem(LS, JSON.stringify(r.value || EMPTY)); }).catch(() => {});
  }, [loc.pathname === "/login"]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = (sc, p, id) => (sc === "global" ? val.global : sc === "page" ? val.pages[p] : val.buttons[`${p}|${id}`]) || {};
  useEffect(() => {
    if (!on) return undefined;
    const h = (e) => {
      const b = e.target.closest && e.target.closest("button, a[data-testid]");
      if (!b || b.closest(".bd-ui")) return;
      e.preventDefault(); e.stopPropagation();
      const id = b.getAttribute("data-testid") || "";
      setPicked({ id, text: (b.innerText || "").trim().slice(0, 40), page: loc.pathname });
      const sc = id ? "button" : "page";
      setScope(sc); setS({ ...DEF, ...current(sc, loc.pathname, id) });
    };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [on, loc.pathname, val]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sa) return null;
  const page = picked?.page || loc.pathname;
  const changeScope = (sc) => { setScope(sc); setS({ ...DEF, ...current(sc, page, picked?.id) }); };
  const commit = async (next) => {
    try { const r = await apiSetUiButtons(next); setVal(r.value); localStorage.setItem(LS, JSON.stringify(r.value)); toast.success("Button layout saved \u2014 sabke liye lagu"); }
    catch (e) { toast.error(e.message); }
  };
  const withScope = (data) => {
    const next = { global: { ...val.global }, pages: { ...val.pages }, buttons: { ...val.buttons } };
    if (scope === "global") next.global = data || {};
    else if (scope === "page") { if (data) next.pages[page] = data; else delete next.pages[page]; }
    else { const k = `${page}|${picked.id}`; if (data) next.buttons[k] = data; else delete next.buttons[k]; }
    return next;
  };
  const panel = { position: "fixed", left: 14, bottom: 64, width: 300, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,.25)", padding: 12, zIndex: 9998 };
  return (
    <>
      <button className="bd-ui" data-testid="bd-toggle" onClick={() => { setOn(!on); setPicked(null); if (on) applyCss(val); }}
        style={{ position: "fixed", left: 14, bottom: 14, zIndex: 9999, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: on ? "#dc2626" : "#7c3aed", color: "#fff", border: "none", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,.25)" }}>
        <Paintbrush size={14} /> {on ? "Designer band karein" : "Button Designer"}
      </button>
      {on && (
        <div className="bd-ui" data-testid="bd-panel" style={panel}>
          <div className="bd-ui" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <b className="bd-ui" style={{ fontSize: 13 }}>Button Designer</b>
            <button className="bd-ui" data-testid="bd-close" onClick={() => { setOn(false); setPicked(null); applyCss(val); }} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
          </div>
          {!picked && scope !== "global" && scope !== "page" ? (
            <div className="bd-ui" style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              Kisi bhi button par click karke use chunein. Ya neeche se poore page / poore software ke buttons set karein.
              <div className="bd-ui" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="bd-ui" data-testid="bd-scope-page-direct" onClick={() => { setPicked({ id: "", text: "", page: loc.pathname }); changeScope("page"); }} style={{ flex: 1, padding: 6, fontSize: 11, cursor: "pointer" }}>Is Page ke sab</button>
                <button className="bd-ui" data-testid="bd-scope-global-direct" onClick={() => { setPicked({ id: "", text: "", page: loc.pathname }); changeScope("global"); }} style={{ flex: 1, padding: 6, fontSize: 11, cursor: "pointer" }}>Poora Software</button>
              </div>
            </div>
          ) : (
            <>
              {picked?.text && <div className="bd-ui" data-testid="bd-picked" style={{ fontSize: 11, background: "#f1f5f9", padding: 6, borderRadius: 6, marginBottom: 8 }}>Chuna: <b>{picked.text || picked.id}</b></div>}
              <select className="bd-ui" data-testid="bd-scope" value={scope} onChange={(e) => changeScope(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 8, fontSize: 12 }}>
                {picked?.id && <option value="button">Sirf yeh button</option>}
                <option value="page">Is page ({page}) ke sabhi buttons</option>
                <option value="global">Poore software ke sabhi buttons</option>
              </select>
              <Slider label="Size" k="zoom" min={0.6} max={1.6} step={0.05} s={s} set={(x) => { setS(x); applyCss({ ...val, ...withScope(x) }); }} unit="x" />
              <Slider label="Font" k="font" min={8} max={20} step={0.5} s={s} set={(x) => { setS(x); applyCss({ ...val, ...withScope(x) }); }} unit="px" />
              <Slider label="Golai (radius)" k="radius" min={0} max={24} step={1} s={s} set={(x) => { setS(x); applyCss({ ...val, ...withScope(x) }); }} unit="px" />
              <Slider label="Kam se kam chaudai" k="width" min={0} max={260} step={5} s={s} set={(x) => { setS(x); applyCss({ ...val, ...withScope(x) }); }} unit="px" />
              <Slider label="Doori (margin)" k="margin" min={0} max={16} step={1} s={s} set={(x) => { setS(x); applyCss({ ...val, ...withScope(x) }); }} unit="px" />
              <div className="bd-ui" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="bd-ui" data-testid="bd-save" onClick={() => commit(withScope(s))} style={{ flex: 1, padding: "7px 8px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Save size={13} /> Save</button>
                <button className="bd-ui" data-testid="bd-reset" onClick={() => { setS(DEF); commit(withScope(null)); }} style={{ flex: 1, padding: "7px 8px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><RotateCcw size={13} /> Default</button>
              </div>
              <div className="bd-ui" style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>Designer chalu rehne tak buttons click par kaam nahi karenge, sirf chune jayenge.</div>
              {null}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ButtonDesigner;
