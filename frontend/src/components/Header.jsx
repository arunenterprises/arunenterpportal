import React, { useEffect, useState } from "react";
import { getLogo } from "../lib/store";

export const Header = ({ formTitle }) => {
  const [logo, setLogoState] = useState(getLogo());
  useEffect(() => {
    const sync = () => setLogoState(getLogo());
    window.addEventListener("ae-logo-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ae-logo-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const shownLogo = logo || "/arun-logo.jpg";
  return (
    <>
      <div className="doc-header" data-testid="doc-header">
        <div className="brand-logo" data-testid="doc-logo">
          <img src={shownLogo} alt="Company logo" data-testid="doc-logo-img" />
        </div>
        <h1>ARUN ENTERPRISES</h1>
        <p><b>Address:</b> 209H/1F/1 Ops Nagar Kalindipuram Prayagraj UP 211011</p>
        <p>
          <b>Toll Free:</b> 9429694552 &nbsp;|&nbsp;
          <b>Email:</b> info@arunenterprises.online &nbsp;|&nbsp;
          <b>Web:</b> www.arunenterprises.com.in
        </p>
      </div>
      {formTitle && <div className="form-title" data-testid="form-title">{formTitle}</div>}
    </>
  );
};

export default Header;
