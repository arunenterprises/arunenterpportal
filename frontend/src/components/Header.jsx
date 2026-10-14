import React, { useEffect, useState } from "react";
import { getLogo, getCompany, DEFAULT_COMPANY } from "../lib/store";

export const Header = ({ formTitle }) => {
  const [logo, setLogoState] = useState(getLogo());
  const [co, setCo] = useState(() => getCompany());
  useEffect(() => {
    const syncLogo = () => setLogoState(getLogo());
    const syncCo = () => setCo(getCompany());
    window.addEventListener("ae-logo-changed", syncLogo);
    window.addEventListener("ae-company-changed", syncCo);
    window.addEventListener("ae-sync-done", syncCo);
    window.addEventListener("storage", syncLogo);
    return () => {
      window.removeEventListener("ae-logo-changed", syncLogo);
      window.removeEventListener("ae-company-changed", syncCo);
      window.removeEventListener("ae-sync-done", syncCo);
      window.removeEventListener("storage", syncLogo);
    };
  }, []);
  const shownLogo = logo || "/arun-logo.jpg";
  const c = { ...DEFAULT_COMPANY, ...(co || {}) };
  return (
    <>
      <div className="doc-header" data-testid="doc-header">
        <div className="dh-banner">
          <div className="dh-top-row">
            <span className="dh-mob"><b>Toll Free:</b> {c.tollFree}</span>
          </div>
          <div className="dh-main">
            <div className="dh-logo" data-testid="doc-logo">
              <img src={shownLogo} alt="Company logo" data-testid="doc-logo-img" />
            </div>
            <div className="dh-center">
              <h1 className="dh-name">{c.name}</h1>
              {c.tagline && <div className="dh-tag">{c.tagline}</div>}
              {c.pillLine && <div className="dh-pill">{c.pillLine}</div>}
              {c.address && <div className="dh-addr">{c.address}</div>}
              <div className="dh-contact">
                {c.email && <><b>Email:</b> {c.email}&nbsp;</>}
                {c.website && <>&nbsp;•&nbsp; <b>Web:</b> {c.website}</>}
                {(c.gst || c.pan) && <><br /><b>GST:</b> {c.gst || "—"} &nbsp;•&nbsp; <b>PAN:</b> {c.pan || "—"}</>}
              </div>
            </div>
            <div className="dh-right" aria-hidden="true" />
          </div>
          <div className="dh-rule" />
        </div>
      </div>
      {formTitle && <div className="form-title" data-testid="form-title">{formTitle}</div>}
    </>
  );
};

export default Header;
