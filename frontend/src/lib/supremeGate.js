import { toast } from "sonner";
import { apiReqCreate, apiReqGate } from "./api";

export const SUPREME_LIMIT = 3000000;

// >₹30L: route record into Core Discussion Window (Finance requisition); returns requisition id
export const routeToDiscussion = async (title, amount, description) => {
  try {
    const r = await apiReqCreate({ rtype: "Finance", title, amount: Number(amount) || 0, description, project: "", discipline: "" });
    toast.warning(`₹30 lakh se upar · ${r.reqNo} Core Discussion Window mein bheja gaya`);
    return r.id;
  } catch (e) { toast.error(`Discussion routing fail: ${e.message}`); return ""; }
};

// true only when the linked discussion has been Concluded by assigned departments
export const discussionCleared = async (reqId) => {
  if (!reqId) return false;
  try { const g = await apiReqGate(reqId); return g.concluded; } catch { return false; }
};
