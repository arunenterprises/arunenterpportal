import React from "react";

export const Header = ({ docTitle, docNo, pageLabel, status }) => {
  const today = new Date().toLocaleDateString("en-GB");
  return (
    <div className="doc-head" data-testid="doc-header">
      <div className="doc-logo">
        <div className="m">AE</div>
        <div className="s">EST. 2005</div>
      </div>
      <div className="doc-title">
        <h1>Arun Enterprises</h1>
        <p>209H/1F/1, Ops Nagar, Kalindipuram, Prayagraj, UP 211011</p>
        <p>
          Toll Free: <b>9429694552</b> &nbsp;|&nbsp; Email: <b>info@arunenterprises.online</b> &nbsp;|&nbsp;
          Web: <b>www.arunenterprises.com.in</b>
        </p>
        <div className="strap">{docTitle}</div>
      </div>
      <div className="doc-meta">
        <div className="badge">{pageLabel}</div>
        <div>Doc No.: <b data-testid="header-doc-no">{docNo || "—"}</b></div>
        <div>Date: <b>{today}</b></div>
        {status && <div>Status: <b>{status}</b></div>}
      </div>
    </div>
  );
};

export default Header;
