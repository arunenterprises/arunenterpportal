import React from "react";
import { toast, Toaster } from "sonner";
import Header from "../components/Header";
import TopActionBar from "../components/TopActionBar";

export default function Home() {
  const noop = () => {};
  const handlePrint = () => window.print();
  const handleExportJSON = () => toast.info("Nothing to export on the Home page");

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopActionBar
          searchPlaceholder="Search…"
          onSearch={noop}
          nextLabel="Vendor Reg"
          nextTo="/vendor"
          onNew={noop}
          onSave={noop}
          onPrint={handlePrint}
          onExportJSON={handleExportJSON}
          onExportExcel={handleExportJSON}
        />

        <div className="a4 home-a4" data-testid="home-page">
          <Header formTitle="" />
          <div className="welcome" data-testid="welcome-banner">
            <div className="welcome-lead">Welcome To</div>
            <div className="welcome-title" data-testid="welcome-title">ARUN ENTERPRISES</div>
            <div className="welcome-sub">Vendor Management &amp; Bill Process</div>
          </div>
        </div>
      </div>
    </>
  );
}
