import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import VendorRegistration from "./pages/VendorRegistration";
import BillProcessing from "./pages/BillProcessing";
import Reports from "./pages/Reports";
import { isAuthed } from "./lib/store";

const RequireAuth = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/vendor" element={<RequireAuth><VendorRegistration /></RequireAuth>} />
          <Route path="/bill" element={<RequireAuth><BillProcessing /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/" element={<Navigate to={isAuthed() ? "/vendor" : "/login"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
