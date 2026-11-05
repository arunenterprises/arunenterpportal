import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { can, deptOfPath } from "./lib/acl";
import { useEffect } from "react";
import { toast } from "sonner";
import Login from "./pages/Login";
import Home from "./pages/Home";
import VendorRegistration from "./pages/VendorRegistration";
import BillProcessing from "./pages/BillProcessing";
import Reports from "./pages/Reports";
import UsersAdmin from "./pages/UsersAdmin";
import PurchaseManagement from "./pages/PurchaseManagement";
import GeneralManager from "./pages/GeneralManager";
import HRManagement from "./pages/HRManagement";
import ProjectManagement from "./pages/ProjectManagement";
import CoreDashboard from "./pages/CoreDashboard";
import MyTasks from "./pages/MyTasks";
import ReportsHub from "./pages/ReportsHub";
import ClientRevenue from "./pages/ClientRevenue";
import VendorPortalWO from "./pages/VendorPortalWO";
import AdvertisementPortal from "./pages/AdvertisementPortal";
import SplashScreen from "./components/SplashScreen";
import { isAuthed, retryPendingSyncs, getPendingSyncCount, autoSyncFromCloud } from "./lib/store";
import { loadCrmCache } from "./components/crm/crmShared";
import { MobileBlock, isPhone } from "./components/MobileBlock";
import ButtonDesigner from "./components/ButtonDesigner";
import { LocalFolderRunner } from "./components/LocalFolderBackup";
import ActionStripToggle from "./components/ActionStripToggle";
import { AppSidebar, AclGate } from "./components/AppSidebar";
import OpsDepartment from "./pages/OpsDepartment";

const RequireAuth = ({ children }) => {
  const loc = useLocation();
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return can(deptOfPath(loc.pathname), "v") ? children : null;
};

function App() {
  // Global sync-failure listener — surface silent background sync failures
  // to the user as a toast so no data loss happens silently.
  useEffect(() => {
    const onFail = (e) => {
      const n = getPendingSyncCount();
      toast.error(`Cloud sync failed · ${n} pending update${n !== 1 ? "s" : ""} queued for retry`, {
        duration: 6000,
        description: e?.detail?.fnName ? `Last: ${e.detail.fnName}` : undefined,
      });
    };
    const onFocus = () => { retryPendingSyncs().then((r) => { if (r?.retried) toast.success(`Synced ${r.retried} queued update${r.retried !== 1 ? "s" : ""} to cloud`); }); };
    window.addEventListener("ae-sync-failed", onFail);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("ae-sync-failed", onFail);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // ---- REAL-TIME CROSS-USER SYNC (Feb 2026 · user request) ----
  // Global 8-second polling while tab is visible so User A sees User B's
  // approvals / submissions / deletions within ~8s without manual refresh.
  // Pauses while tab is hidden to save battery / data. On focus → immediate
  // catch-up sync. Fires `ae-sync-done` so pages that listen re-render.
  useEffect(() => {
    if (!isAuthed()) return;
    let timer = null;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      autoSyncFromCloud(5000).then((snap) => {
        if (snap) { try { window.dispatchEvent(new CustomEvent("ae-sync-done")); } catch (e) { /* noop */ } }
      });
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const start = () => { stop(); timer = setInterval(tick, 8000); };
    autoSyncFromCloud(0).then((snap) => { if (snap) { try { window.dispatchEvent(new CustomEvent("ae-sync-done")); } catch (e) { /* noop */ } } });
    loadCrmCache().catch(() => {});
    const onVis = () => {
      if (document.visibilityState === "visible") {
        autoSyncFromCloud(0).then((snap) => { if (snap) { try { window.dispatchEvent(new CustomEvent("ae-sync-done")); } catch (e) { /* noop */ } } });
        start();
      } else {
        stop();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (isPhone) return <MobileBlock />;
  return (
    <div className="App">
      <SplashScreen />
      <BrowserRouter>
        <ButtonDesigner />
        <LocalFolderRunner />
        <ActionStripToggle />
        <AppSidebar />
        <AclGate />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/vendor" element={<RequireAuth><VendorRegistration /></RequireAuth>} />
          <Route path="/purchase" element={<RequireAuth><PurchaseManagement /></RequireAuth>} />
          <Route path="/bill" element={<RequireAuth><BillProcessing mode="process" /></RequireAuth>} />
          <Route path="/bill-create" element={<Navigate to="/purchase?tab=billing" replace />} />
          <Route path="/accounts" element={<Navigate to="/bill" replace />} />
          <Route path="/expense" element={<Navigate to="/bill?view=expense" replace />} />
          <Route path="/gm" element={<RequireAuth><GeneralManager /></RequireAuth>} />
          <Route path="/hr" element={<RequireAuth><HRManagement /></RequireAuth>} />
          <Route path="/final" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/reports" element={<Navigate to="/final" replace />} />
          <Route path="/users" element={<RequireAuth><UsersAdmin /></RequireAuth>} />
          <Route path="/project" element={<RequireAuth><ProjectManagement /></RequireAuth>} />
          <Route path="/core-dashboard" element={<RequireAuth><CoreDashboard /></RequireAuth>} />
          <Route path="/my-tasks" element={<RequireAuth><MyTasks /></RequireAuth>} />
          <Route path="/client-revenue" element={<RequireAuth><ClientRevenue /></RequireAuth>} />
          <Route path="/reports-hub" element={<RequireAuth><ReportsHub /></RequireAuth>} />
          <Route path="/site" element={<RequireAuth><OpsDepartment key="site" dept="site" /></RequireAuth>} />
          <Route path="/qc-safety" element={<RequireAuth><OpsDepartment key="qc" dept="qc" /></RequireAuth>} />
          <Route path="/plant" element={<RequireAuth><OpsDepartment key="plant" dept="plant" /></RequireAuth>} />
          <Route path="/vendor-portal/wo/:id" element={<VendorPortalWO />} />
          <Route path="/careers" element={<AdvertisementPortal />} />
          <Route path="/jobs" element={<Navigate to="/careers" replace />} />
          <Route path="/" element={<Navigate to={isAuthed() ? "/home" : "/login"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
