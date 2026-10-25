import React, { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

const toDMY = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
const toISO = (t) => { const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec((t || "").trim()); if (!m) return null; const d = m[1].padStart(2, "0"), mo = m[2].padStart(2, "0"); const dt = new Date(`${m[3]}-${mo}-${d}T00:00:00`); return dt.getDate() === +d ? `${m[3]}-${mo}-${d}` : null; };

// Date box that always shows DD/MM/YYYY, but emits ISO (YYYY-MM-DD) to existing onChange handlers
export const DateInput = ({ value, defaultValue, onChange, onBlur, style, className, disabled, readOnly, min, max, type, ...rest }) => {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue || "");
  const iso = controlled ? value || "" : inner;
  const [txt, setTxt] = useState(toDMY(iso));
  const pick = useRef(null);
  useEffect(() => { setTxt(toDMY(iso)); }, [iso]);
  const emit = (v) => { if (!controlled) setInner(v); if (onChange) onChange({ target: { value: v, name: rest.name, type: "date" } }); };
  const onText = (e) => {
    const t = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
    setTxt(t);
    if (!t) emit("");
    else { const v = toISO(t); if (v) emit(v); }
  };
  const blur = () => {
    const v = txt ? toISO(txt) : "";
    if (v === null) setTxt(toDMY(iso));
    if (onBlur) onBlur({ target: { value: v === null ? iso : v } });
  };
  const off = disabled || readOnly;
  const w = style?.width;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", width: w || "100%", marginTop: style?.marginTop }}>
      <input {...rest} type="text" inputMode="numeric" placeholder="DD/MM/YYYY" value={txt} onChange={onText} onBlur={blur} disabled={disabled} readOnly={readOnly} className={className}
        style={{ ...(style || {}), marginTop: 0, width: "100%", paddingRight: 26 }} />
      {!off && (
        <button type="button" tabIndex={-1} aria-label="calendar" onClick={() => { try { pick.current.showPicker(); } catch { pick.current.click(); } }}
          style={{ position: "absolute", right: 4, background: "transparent", border: 0, padding: 2, cursor: "pointer", color: "#475569", display: "inline-flex" }}>
          <CalendarDays size={14} />
        </button>
      )}
      <input ref={pick} type="date" tabIndex={-1} value={iso} min={min} max={max} aria-hidden="true"
        onChange={(e) => { emit(e.target.value); if (!onChange && onBlur) onBlur({ target: { value: e.target.value } }); }}
        style={{ position: "absolute", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0 }} />
    </span>
  );
};
