import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Paintbrush, X, Save, RotateCcw } from "lucide-react";
import { apiGetUiButtons, apiSetUiButtons, getToken } from "../lib/api";
import { isSuperAdmin, currentUserEmail } from "../lib/store";

const LS = "uibtn_cache_v1";
const EMPTY = { global: {}, pages: {}, buttons: {}, elements: {} };
const DEF = { zoom: 1, font: "", radius: "", width: "", margin: "" };
const EDEF = { font: "", width: "", padding: "", margin: "", bg: "", color: "", hide: false };

const erule = (sel, s = {}) => {
  const p = [];
  if (s.hide) p.push("display:none !important");
  if (s.font) p.push(`font-size:${s.font}px !important`);
  if (s.width) p.push(`width:${s.width}% !important;max-width:${s.width}% !important`);
  if (s.padding !== "" && s.padding != null) p.push(`padding:${s.padding}px !important`);
  if (s.margin !== "" && s.margin != null) p.push(`margin:${s.margin}px !important`);
  if (s.bg) p.push(`background:${s.bg} !important`);
  if (s.color) p.push(`color:${s.color} !important`);
  return p.length ? `${sel}{${p.join(";")}}` : "";
};
// Stable selector: nearest data-testid ancestor, then nth-child path down to the element.
const cssPath = (el) => {
  const parts = [];
  let n = el;
  while (n && n !== document.body) {
    const id = n.getAttribute && n.getAttribute("data-testid");
    if (id) { parts.unshift(`[data-testid="${id.replace(/"/g, "")}"]`); return parts.join(" > "); }
    const p = n.parentElement;
    if (!p) break;
    parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${[...p.children].indexOf(n) + 1})`);
    n = p;
  }
  return `> ${parts.join(" > ")}`;
};

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
  ...Object.entries(v.buttons || {}).map(([k, s]) => { const [p, id] = k.split("|"); return rule(`body[data-route="${p}"] button[data-testid="${id}"]:not(.bd-ui), body[data-route="${p}"] a[data-testid="${id}"][data-testid]`, s); }),
  ...Object.entries(v.elements || {}).map(([k, s]) => { const i = k.indexOf("|"); return erule(`body[data-route="${k.slice(0, i)}"] ${k.slice(i + 1)}`, s); }),
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
  const [mode, setMode] = useState("button");
  const [el, setEl] = useState(null);
  const [es, setEs] = useState(EDEF);
  const [tog, setTog] = useState(() => { try { return { x: 6, y: 56, scale: 1, ...(JSON.parse(localStorage.getItem("bd_toggle_v1")) || {}) }; } catch { return { x: 6, y: 56, scale: 1 }; } });
  const saveTog = (t) => { setTog(t); localStorage.setItem("bd_toggle_v1", JSON.stringify(t)); };
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
      if (e.target.closest && e.target.closest(".bd-ui")) return;
      if (mode === "layout") {
        e.preventDefault(); e.stopPropagation();
        const t = e.target;
        document.querySelectorAll("[data-bd-sel]").forEach((x) => { x.style.outline = ""; x.removeAttribute("data-bd-sel"); });
        t.setAttribute("data-bd-sel", "1"); t.style.outline = "2px dashed #7c3aed";
        const sel = cssPath(t);
        setEl({ sel, page: loc.pathname, label: `${t.tagName.toLowerCase()} · ${(t.innerText || "").trim().slice(0, 30)}` });
        setEs({ ...EDEF, ...((val.elements || {})[`${loc.pathname}|${sel}`] || {}) });
        return;
      }
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
  }, [on, mode, loc.pathname, val]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sa) return null;
  const page = picked?.page || loc.pathname;
  const changeScope = (sc) => { setScope(sc); setS({ ...DEF, ...current(sc, page, picked?.id) }); };
  const commit = async (next) => {
    try { const r = await apiSetUiButtons(next); setVal(r.value); localStorage.setItem(LS, JSON.stringify(r.value)); toast.success(mode === "layout" ? "Page layout saved, sabke liye lagu" : "Button layout saved, sabke liye lagu"); }
    catch (e) { toast.error(e.message); }
  };
  const withScope = (data) => {
    const next = { global: { ...val.global }, pages: { ...val.pages }, buttons: { ...val.buttons }, elements: { ...(val.elements || {}) } };
    if (scope === "global") next.global = data || {};
    else if (scope === "page") { if (data) next.pages[page] = data; else delete next.pages[page]; }
    else { const k = `${page}|${picked.id}`; if (data) next.buttons[k] = data; else delete next.buttons[k]; }
    return next;
  };
  const withEl = (data) => {
    const next = { ...val, elements: { ...(val.elements || {}) } };
    const k = `${el.page}|${el.sel}`;
    if (data) next.elements[k] = data; else delete next.elements[k];
    return next;
  };
  const setE = (x) => { setEs(x); applyCss(withEl(x)); };
  const clearSel = () => document.querySelectorAll("[data-bd-sel]").forEach((x) => { x.style.outline = ""; x.removeAttribute("data-bd-sel"); });
  const panelTop = Math.min(tog.y + 28 * tog.scale, window.innerHeight - 420);
  const panelLeft = Math.max(6, Math.min(tog.x, window.innerWidth - 310));
  const panel = { position: "fixed", left: panelLeft, top: Math.max(6, panelTop), width: 300, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,.25)", padding: 12, zIndex: 9998 };
  const onDown = (e) => {
    const sx = e.clientX, sy = e.clientY, ox = tog.x, oy = tog.y;
    let moved = false;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      setTog((t) => ({ ...t, x: Math.max(0, Math.min(window.innerWidth - 40, ox + dx)), y: Math.max(0, Math.min(window.innerHeight - 20, oy + dy)) }));
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      if (moved) setTog((t) => { localStorage.setItem("bd_toggle_v1", JSON.stringify(t)); return t; });
      else { setOn((o) => { if (o) applyCss(val); return !o; }); setPicked(null); }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const onWheel = (e) => saveTog({ ...tog, scale: Math.max(0.7, Math.min(2.5, +(tog.scale + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))) });
  return (
    <>
      <button className="bd-ui" data-testid="bd-toggle" onPointerDown={onDown} onWheel={onWheel} title="Pakad kar khiskayein · mouse wheel se chota/bada karein"
        style={{ position: "fixed", left: tog.x, top: tog.y, transform: `scale(${tog.scale})`, transformOrigin: "top left", touchAction: "none", userSelect: "none", zIndex: 9999, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: on ? "#dc2626" : "#7c3aed", color: "#fff", border: "none", borderRadius: 999, fontWeight: 700, fontSize: 10, cursor: "grab", boxShadow: "0 2px 6px rgba(0,0,0,.2)", opacity: on ? 1 : .85 }}>
        <Paintbrush size={11} /> {on ? "Designer band" : "Designer"}
      </button>
      {on && (
        <div className="bd-ui" data-testid="bd-panel" style={panel}>
          <div className="bd-ui" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <b className="bd-ui" style={{ fontSize: 13 }}>Designer</b>
            <span className="bd-ui" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 10, color: "#64748b" }}>
              Designer btn:
              <button className="bd-ui" data-testid="bd-tog-smaller" onClick={() => saveTog({ ...tog, scale: Math.max(0.7, +(tog.scale - 0.1).toFixed(2)) })} style={{ padding: "0 6px", cursor: "pointer" }}>−</button>
              <button className="bd-ui" data-testid="bd-tog-bigger" onClick={() => saveTog({ ...tog, scale: Math.min(2.5, +(tog.scale + 0.1).toFixed(2)) })} style={{ padding: "0 6px", cursor: "pointer" }}>+</button>
              <button className="bd-ui" data-testid="bd-tog-reset" onClick={() => saveTog({ x: 6, y: 56, scale: 1 })} style={{ padding: "0 5px", cursor: "pointer" }}>↺</button>
            </span>
            <button className="bd-ui" data-testid="bd-close" onClick={() => { setOn(false); setPicked(null); setEl(null); clearSel(); applyCss(val); }} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
          </div>
          <div className="bd-ui" style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[["button", "Buttons"], ["layout", "Page Layout"]].map(([m, l]) => (
              <button key={m} className="bd-ui" data-testid={`bd-mode-${m}`} onClick={() => { setMode(m); setPicked(null); setEl(null); clearSel(); applyCss(val); }}
                style={{ flex: 1, padding: "5px 6px", fontSize: 11, fontWeight: 800, cursor: "pointer", borderRadius: 6, border: "1px solid #c4b5fd", background: mode === m ? "#7c3aed" : "#f5f3ff", color: mode === m ? "#fff" : "#5b21b6" }}>{l}</button>
            ))}
          </div>
          {mode === "layout" ? (
            !el ? <div className="bd-ui" data-testid="bd-layout-hint" style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>Page ka koi bhi hissa (box, card, section, table, input, heading) click karke chunein. Badlav sirf is page ({loc.pathname}) par lagu honge.
              {Object.keys(val.elements || {}).filter((k) => k.startsWith(`${loc.pathname}|`)).length > 0 && (
                <div className="bd-ui" data-testid="bd-el-list" style={{ marginTop: 8, maxHeight: 160, overflow: "auto", borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                  <b className="bd-ui" style={{ fontSize: 11 }}>Is page ke saved badlav:</b>
                  {Object.entries(val.elements).filter(([k]) => k.startsWith(`${loc.pathname}|`)).map(([k, v], i) => (
                    <div key={k} className="bd-ui" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, marginTop: 4 }}>
                      <span className="bd-ui" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>{v.hide ? "[Chhupa] " : ""}{k.split("|")[1].slice(-40)}</span>
                      <button className="bd-ui" data-testid={`bd-el-remove-${i}`} onClick={() => { const next = { ...val, elements: { ...val.elements } }; delete next.elements[k]; commit(next); }} style={{ fontSize: 10, cursor: "pointer", color: "#b91c1c" }}>Hatayein</button>
                    </div>
                  ))}
                </div>
              )}
            </div> : (
              <>
                <div className="bd-ui" data-testid="bd-el-picked" style={{ fontSize: 11, background: "#f1f5f9", padding: 6, borderRadius: 6, marginBottom: 8, wordBreak: "break-all" }}>Chuna: <b>{el.label}</b>
                  <button className="bd-ui" data-testid="bd-el-parent" onClick={() => {
                    const cur = document.querySelector("[data-bd-sel]"); const p = cur && cur.parentElement;
                    if (!p || p === document.body) return;
                    clearSel(); p.setAttribute("data-bd-sel", "1"); p.style.outline = "2px dashed #7c3aed";
                    const sel = cssPath(p); setEl({ sel, page: loc.pathname, label: `${p.tagName.toLowerCase()} · ${(p.innerText || "").trim().slice(0, 30)}` });
                    setEs({ ...EDEF, ...((val.elements || {})[`${loc.pathname}|${sel}`] || {}) });
                  }} style={{ marginLeft: 6, fontSize: 10, cursor: "pointer" }}>↑ Bada hissa chunein</button>
                </div>
                <Slider label="Font" k="font" min={8} max={28} step={0.5} s={es} set={setE} unit="px" />
                <Slider label="Chaudai" k="width" min={10} max={100} step={1} s={es} set={setE} unit="%" />
                <Slider label="Andar ki jagah (padding)" k="padding" min={0} max={40} step={1} s={es} set={setE} unit="px" />
                <Slider label="Bahar ki doori (margin)" k="margin" min={0} max={40} step={1} s={es} set={setE} unit="px" />
                <div className="bd-ui" style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 700, color: "#334155", alignItems: "center", marginBottom: 6 }}>
                  Background <input className="bd-ui" data-testid="bd-el-bg" type="color" value={es.bg || "#ffffff"} onChange={(e) => setE({ ...es, bg: e.target.value })} />
                  Text <input className="bd-ui" data-testid="bd-el-color" type="color" value={es.color || "#0f172a"} onChange={(e) => setE({ ...es, color: e.target.value })} />
                </div>
                <label className="bd-ui" style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", display: "flex", gap: 6, alignItems: "center" }}>
                  <input className="bd-ui" data-testid="bd-el-hide" type="checkbox" checked={!!es.hide} onChange={(e) => setE({ ...es, hide: e.target.checked })} /> Is hisse ko chhupa dein
                </label>
                <div className="bd-ui" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="bd-ui" data-testid="bd-el-save" onClick={() => commit(withEl(es))} style={{ flex: 1, padding: "7px 8px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Save</button>
                  <button className="bd-ui" data-testid="bd-el-reset" onClick={() => { setEs(EDEF); commit(withEl(null)); }} style={{ flex: 1, padding: "7px 8px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Default</button>
                </div>
                <button className="bd-ui" data-testid="bd-el-reset-page" onClick={() => { if (!window.confirm("Is page ke saare layout badlav hatayein?")) return; const next = { ...val, elements: Object.fromEntries(Object.entries(val.elements || {}).filter(([k]) => !k.startsWith(`${loc.pathname}|`))) }; setEl(null); clearSel(); commit(next); }} style={{ width: "100%", marginTop: 6, padding: "5px", fontSize: 10.5, cursor: "pointer", background: "#fff", border: "1px dashed #fca5a5", color: "#b91c1c", borderRadius: 6 }}>Is page ka poora layout default karein</button>
              </>
            )
          ) : !picked && scope !== "global" && scope !== "page" ? (
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
