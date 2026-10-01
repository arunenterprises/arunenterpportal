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
        <div className="dh-top-row">
          <span className="dh-gstin"><b>GSTIN:</b> 09ABWFM0611J1ZY</span>
          <span className="dh-pan"><b>PAN:</b> ABWFM0611Z</span>
          <span className="dh-mob"><b>Mob.:</b> 9429694552</span>
        </div>
        <div className="dh-main">
          <div className="dh-logo" data-testid="doc-logo">
            <img src={shownLogo} alt="Company logo" data-testid="doc-logo-img" />
          </div>
          <div className="dh-center">
            <h1 className="dh-name">M/s ARUN ENTERPRISES</h1>
            <div className="dh-tag">OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY</div>
            <div className="dh-pill">Govt. Civil Work Contractor &amp; General Order Supplier</div>
            <div className="dh-addr">209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011</div>
            <div className="dh-contact">
              <b>Email:</b> arunenterprises2023@gmail.com &nbsp;•&nbsp; <b>Web:</b> www.arunenterprises.com.in
            </div>
          </div>
        </div>
        <div className="dh-rule" />
      </div>
      {formTitle && <div className="form-title" data-testid="form-title">{formTitle}</div>}
    </>
  );
};

export default Header;
