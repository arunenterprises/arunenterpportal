import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import VendorRegistration from "./pages/VendorRegistration";
import BillProcessing from "./pages/BillProcessing";
import ExpenseProcess from "./pages/ExpenseProcess";
import Reports from "./pages/Reports";
import UsersAdmin from "./pages/UsersAdmin";
import PurchaseManagement from "./pages/PurchaseManagement";
import GeneralManager from "./pages/GeneralManager";
import SplashScreen from "./components/SplashScreen";
import { isAuthed } from "./lib/store";

const RequireAuth = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <div className="App">
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
          <Route path="/final" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/reports" element={<Navigate to="/final" replace />} />
          <Route path="/users" element={<RequireAuth><UsersAdmin /></RequireAuth>} />
          <Route path="/" element={<Navigate to={isAuthed() ? "/home" : "/login"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
