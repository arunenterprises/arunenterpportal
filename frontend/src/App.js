import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import Login from "./pages/Login";
import Home from "./pages/Home";
import VendorRegistration from "./pages/VendorRegistration";
import BillProcessing from "./pages/BillProcessing";
import ExpenseProcess from "./pages/ExpenseProcess";
import Reports from "./pages/Reports";
import UsersAdmin from "./pages/UsersAdmin";
import PurchaseManagement from "./pages/PurchaseManagement";
import GeneralManager from "./pages/GeneralManager";
import HRManagement from "./pages/HRManagement";
import VendorPortalWO from "./pages/VendorPortalWO";
import AdvertisementPortal from "./pages/AdvertisementPortal";
import SplashScreen from "./components/SplashScreen";
import { isAuthed, retryPendingSyncs, getPendingSyncCount } from "./lib/store";

const RequireAuth = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/login" replace />;
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
  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <SplashScreen />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/vendor" element={<RequireAuth><VendorRegistration /></RequireAuth>} />
          <Route path="/purchase" element={<RequireAuth><PurchaseManagement /></RequireAuth>} />
          <Route path="/bill" element={<RequireAuth><BillProcessing /></RequireAuth>} />
          <Route path="/accounts" element={<Navigate to="/bill" replace />} />
          <Route path="/expense" element={<RequireAuth><ExpenseProcess /></RequireAuth>} />
          <Route path="/gm" element={<RequireAuth><GeneralManager /></RequireAuth>} />
          <Route path="/hr" element={<RequireAuth><HRManagement /></RequireAuth>} />
          <Route path="/final" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/reports" element={<Navigate to="/final" replace />} />
          <Route path="/users" element={<RequireAuth><UsersAdmin /></RequireAuth>} />
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
