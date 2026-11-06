"""Double-entry accounting: COA, journals, receipts, auto-postings from ERP vouchers, BRS, GST/TDS registers."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Body, Depends, HTTPException

ACC_ROLES = {"GM", "Accounts Manager", "Member Financial"}
HOME_STATE = "09"  # Uttar Pradesh

DEFAULT_COA = [
    ("cash", "1001", "Cash in Hand", "Assets", "Cash & Bank"),
    ("bank", "1010", "Main Bank Account", "Assets", "Cash & Bank"),
    ("debtors", "1100", "Sundry Debtors (Clients)", "Assets", "Receivables"),
    ("in_cgst", "1200", "Input CGST", "Assets", "Duties & Taxes"),
    ("in_sgst", "1201", "Input SGST", "Assets", "Duties & Taxes"),
    ("in_igst", "1202", "Input IGST", "Assets", "Duties & Taxes"),
    ("tds_recv", "1210", "TDS Receivable (deducted by Client)", "Assets", "Duties & Taxes"),
    ("ret_recv", "1220", "Retention Receivable (Client)", "Assets", "Receivables"),
    ("staff_adv", "1300", "Advances to Staff", "Assets", "Loans & Advances"),
    ("fixed", "1400", "Fixed Assets - Plant & Machinery", "Assets", "Fixed Assets"),
    ("creditors", "2100", "Sundry Creditors (Vendors)", "Liabilities", "Payables"),
    ("out_cgst", "2200", "Output CGST", "Liabilities", "Duties & Taxes"),
    ("out_sgst", "2201", "Output SGST", "Liabilities", "Duties & Taxes"),
    ("out_igst", "2202", "Output IGST", "Liabilities", "Duties & Taxes"),
    ("tds_pay", "2210", "TDS Payable", "Liabilities", "Duties & Taxes"),
    ("ret_pay", "2220", "Retention Payable (Vendor)", "Liabilities", "Payables"),
    ("loans", "2300", "Unsecured Loans", "Liabilities", "Loans"),
    ("capital", "3001", "Capital Account", "Equity", "Capital"),
    ("revenue", "4001", "Contract Revenue", "Income", "Direct Income"),
    ("other_inc", "4100", "Other Income / Deductions Recovered", "Income", "Indirect Income"),
    ("subcon", "5001", "Sub-contract & Purchase Expense", "Expenses", "Direct Expenses"),
    ("salary", "5100", "Salary & Wages", "Expenses", "Direct Expenses"),
    ("site_exp", "5200", "Site & Office Expenses", "Expenses", "Indirect Expenses"),
    ("bank_chg", "5300", "Bank Charges", "Expenses", "Indirect Expenses"),
]
GROUPS = ["Assets", "Liabilities", "Equity", "Income", "Expenses"]
TDS_SECTIONS = {"194C": "Contractor", "194J": "Professional / Technical", "194I": "Rent", "194H": "Commission", "194Q": "Purchase of Goods", "206AA": "No PAN", "NA": "No TDS"}


def make_router(db, get_current_user, acl_ok, num, list_collection) -> APIRouter:
    r = APIRouter(prefix="/acc")

    def guard(op: str):
        async def dep(user: Dict = Depends(get_current_user)) -> Dict:
            if not await acl_ok(user, "accounting", op):
                raise HTTPException(status_code=403, detail="Accounting module ki permission nahi hai (SuperAdmin se permission lein)")
            return user
        return dep

    async def accounts() -> List[Dict]:
        have = {a.get("sysKey") for a in await db.acc_accounts.find({"sysKey": {"$ne": None}}, {"_id": 0, "sysKey": 1}).to_list(500)}
        now = datetime.now(timezone.utc).isoformat()
        for key, code, name, grp, sub in DEFAULT_COA:
            if key not in have:
                await db.acc_accounts.update_one({"sysKey": key}, {"$setOnInsert": {"id": f"sys-{key}", "sysKey": key, "code": code, "name": name, "group": grp, "subGroup": sub,
                                                  "opening": 0, "openingType": "Dr", "system": True, "isBank": key == "bank", "isCash": key == "cash", "createdAt": now}}, upsert=True)
        return await db.acc_accounts.find({}, {"_id": 0}).sort("code", 1).to_list(2000)

    async def fy_no(prefix: str, date: str) -> str:
        d = datetime.fromisoformat((date or datetime.now().date().isoformat())[:10])
        y = d.year if d.month >= 4 else d.year - 1
        fy = f"{str(y)[2:]}{str(y + 1)[2:]}"
        c = await db.counters.find_one_and_update({"key": "acc"}, {"$inc": {f"{prefix}_{fy}": 1}}, upsert=True, return_document=True)
        return f"AE/{prefix}/{fy}/{int(c[f'{prefix}_{fy}']):04d}"

    def gst_split(gst: float, gstin: str, side: str) -> List[tuple]:
        g = str(gstin or "").strip()
        if g and not g.startswith(HOME_STATE):
            return [(f"{side}_igst", round(gst, 2))]
        half = round(gst / 2, 2)
        return [(f"{side}_cgst", half), (f"{side}_sgst", round(gst - half, 2))]

    async def entries() -> List[Dict]:
        acc = await accounts()
        sid = {a["sysKey"]: a["id"] for a in acc if a.get("sysKey")}
        bank_default = sid["bank"]
        out: List[Dict] = []

        def post(key, date, vno, source, narr, lines):
            lines = [(a, p, round(dr, 2), round(cr, 2)) for a, p, dr, cr in lines if round(dr, 2) or round(cr, 2)]
            for a, p, dr, cr in lines:
                out.append({"key": key, "date": (date or "")[:10], "vno": vno, "source": source, "narration": narr, "accountId": sid.get(a, a), "party": p, "dr": dr, "cr": cr})

        for b in await list_collection("bills"):
            if int(num(b.get("step"))) < 5:
                continue
            basic, gst = num(b.get("basicAmount")), round(num(b.get("basicAmount")) * num(b.get("gstSlab")) / 100, 2)
            tds = round(basic * num(b.get("tdsRate")) / 100, 2)
            ret = round(basic * num(b.get("retentionPct")) / 100, 2)
            oth = num(b.get("otherDeductions"))
            party = b.get("vendorCode") or "UNKNOWN"
            net = round(basic + gst - tds - ret - oth, 2)
            exp = "salary" if b.get("isPayrollBill") or party == "HR-INTERNAL" else "subcon"
            gl = gst_split(gst, (b.get("vendorSnapshot") or {}).get("gstNo"), "in")
            vno = b.get("permanentBillNo") or b.get("refNo") or b.get("billNo") or b.get("id")
            post(f"bill:{b.get('id')}", b.get("billDate") or b.get("approvalDate") or b.get("createdAt"), vno, "Vendor Bill",
                 f"Bill {b.get('billNo') or ''} · {(b.get('vendorSnapshot') or {}).get('firmName') or party} · TDS {b.get('tdsSection') or '194C'} @{num(b.get('tdsRate')):g}%",
                 [(exp, "", basic, 0)] + [(a, "", v, 0) for a, v in gl] + [("creditors", party, 0, net), ("tds_pay", party, 0, tds), ("ret_pay", party, 0, ret), ("other_inc", party, 0, oth)])

        for e in await list_collection("expenses"):
            if int(num(e.get("step"))) < 4 and not e.get("permanentExpenseNo"):
                continue
            basic = num(e.get("basicAmount"))
            gst = round(basic * num(e.get("gstSlab")) / 100, 2)
            tds = round(basic * num(e.get("tdsRate")) / 100, 2)
            oth = num(e.get("otherDeductions"))
            party = e.get("paidToName") or "Expense Payee"
            post(f"exp:{e.get('id')}", e.get("date"), e.get("permanentExpenseNo") or e.get("refNo") or e.get("id"), "Expense", f"{e.get('category') or 'Expense'} · {party}",
                 [("site_exp", "", basic, 0)] + [(a, "", v, 0) for a, v in gst_split(gst, e.get("gstNo"), "in")]
                 + [("creditors", party, 0, round(basic + gst - tds - oth, 2)), ("tds_pay", party, 0, tds), ("other_inc", party, 0, oth)])

        for p in await list_collection("payments"):
            if not p.get("paidFinal"):
                continue
            amt = num(p.get("amount"))
            party = p.get("vendorCode") or (p.get("vendorSnapshot") or {}).get("vendorCode") or "UNKNOWN"
            post(f"pay:{p.get('pvNo') or p.get('id')}", p.get("paidDate") or p.get("pvDate"), p.get("pvNo"), "Payment Voucher", f"Paid {party} · UTR {p.get('utrNo') or '—'}",
                 [("creditors", party, amt, 0), (p.get("bankAccountId") or bank_default, "", 0, amt)])

        receipts = await db.acc_receipts.find({"status": {"$ne": "Cancelled"}}, {"_id": 0}).to_list(20000)
        got = {x.get("invoiceId") for x in receipts if x.get("invoiceId")}
        for inv in await db.crm_invoices.find({}, {"_id": 0, "lines": 0}).to_list(20000):
            st = int(num(inv.get("step")))
            if st < 3 or st == 6:
                continue
            party = inv.get("clientId") or "CLIENT"
            vno = inv.get("invoiceNo") or inv.get("refNo")
            post(f"inv:{inv.get('id')}", inv.get("invoiceDate"), vno, "Sales Invoice", f"Tax Invoice {vno} · {inv.get('projectName') or ''}",
                 [("debtors", party, num(inv.get("total")), 0), ("revenue", "", 0, num(inv.get("taxable"))), ("out_cgst", "", 0, num(inv.get("cgst"))),
                  ("out_sgst", "", 0, num(inv.get("sgst"))), ("out_igst", "", 0, num(inv.get("igst")))])
            if num(inv.get("receivedAmount")) and inv.get("id") not in got:
                ra = num(inv.get("receivedAmount"))
                post(f"invrec:{inv.get('id')}", inv.get("receivedDate") or inv.get("invoiceDate"), vno, "Receipt", f"Received against {vno} · UTR {inv.get('utr') or '—'}",
                     [(bank_default, "", ra, 0), ("debtors", party, 0, ra)])

        for x in receipts:
            amt, tds, ret = num(x.get("amount")), num(x.get("tdsDeducted")), num(x.get("retentionHeld"))
            post(f"rcpt:{x['id']}", x.get("date"), x.get("receiptNo"), "Receipt", x.get("narration") or f"Receipt from client · {x.get('mode') or ''} {x.get('refNo') or ''}",
                 [(x.get("bankAccountId") or bank_default, "", amt, 0), ("tds_recv", "", tds, 0), ("ret_recv", "", ret, 0), ("debtors", x.get("clientId") or "CLIENT", 0, amt + tds + ret)])

        for j in await db.acc_journals.find({"status": {"$ne": "Cancelled"}}, {"_id": 0}).to_list(20000):
            post(f"jv:{j['id']}", j.get("date"), j.get("voucherNo"), "Journal", j.get("narration") or "",
                 [(ln.get("accountId"), ln.get("party") or "", num(ln.get("dr")), num(ln.get("cr"))) for ln in j.get("lines") or []])
        return out

    @r.get("/accounts")
    async def list_accounts(user: Dict = Depends(guard("v"))):
        return await accounts()

    @r.post("/accounts")
    async def save_account(body: Dict = Body(...), user: Dict = Depends(guard("c"))):
        if not str(body.get("name") or "").strip() or body.get("group") not in GROUPS:
            raise HTTPException(status_code=400, detail="Account name aur sahi Group zaroori")
        await accounts()
        aid = body.get("id") or f"acc-{uuid.uuid4().hex[:10]}"
        ex = await db.acc_accounts.find_one({"id": aid}, {"_id": 0}) or {}
        if ex and not await acl_ok(user, "accounting", "e"):
            raise HTTPException(status_code=403, detail="Edit ki permission nahi hai")
        if await db.acc_accounts.find_one({"code": body.get("code"), "id": {"$ne": aid}}):
            raise HTTPException(status_code=400, detail=f"Account code {body.get('code')} pehle se hai")
        doc = {k: body.get(k) for k in ("code", "name", "group", "subGroup", "openingType", "isBank", "isCash", "bankName", "accountNo", "ifsc", "branch")}
        doc["opening"] = num(body.get("opening"))
        if ex.get("system"):
            doc.update({"group": ex["group"], "sysKey": ex["sysKey"], "system": True})
        doc.update({"id": aid, "updatedAt": datetime.now(timezone.utc).isoformat(), "updatedBy": user.get("name") or user.get("email")})
        await db.acc_accounts.update_one({"id": aid}, {"$set": doc}, upsert=True)
        return await db.acc_accounts.find_one({"id": aid}, {"_id": 0})

    @r.delete("/accounts/{aid}")
    async def delete_account(aid: str, user: Dict = Depends(guard("d"))):
        a = await db.acc_accounts.find_one({"id": aid}, {"_id": 0})
        if not a or a.get("system"):
            raise HTTPException(status_code=400, detail="System account delete nahi hoga")
        if any(e["accountId"] == aid for e in await entries()):
            raise HTTPException(status_code=400, detail="Is account mein entries hain — delete nahi hoga")
        await db.acc_accounts.delete_one({"id": aid})
        return {"ok": True}

    @r.get("/entries")
    async def list_entries(user: Dict = Depends(guard("v"))):
        return {"entries": await entries(), "accounts": await accounts()}

    async def check_lines(lines: List[Dict]) -> None:
        ids = {a["id"] for a in await accounts()}
        if len(lines) < 2 or any(ln.get("accountId") not in ids for ln in lines):
            raise HTTPException(status_code=400, detail="Kam se kam 2 lines aur har line par sahi Account chahiye")
        if any((num(ln.get("dr")) > 0) == (num(ln.get("cr")) > 0) for ln in lines):
            raise HTTPException(status_code=400, detail="Har line par sirf Debit YA Credit amount bharein")
        dr, cr = round(sum(num(ln.get("dr")) for ln in lines), 2), round(sum(num(ln.get("cr")) for ln in lines), 2)
        if dr != cr:
            raise HTTPException(status_code=400, detail=f"Debit ₹{dr:,.2f} aur Credit ₹{cr:,.2f} barabar nahi — double entry balance karein")

    @r.get("/journals")
    async def list_journals(user: Dict = Depends(guard("v"))):
        return await db.acc_journals.find({}, {"_id": 0}).sort("date", -1).to_list(20000)

    @r.post("/journals")
    async def save_journal(body: Dict = Body(...), user: Dict = Depends(guard("c"))):
        jid = body.get("id") or f"jv-{uuid.uuid4().hex[:10]}"
        ex = await db.acc_journals.find_one({"id": jid}, {"_id": 0}) or {}
        if ex.get("status") == "Cancelled":
            raise HTTPException(status_code=423, detail="Cancelled voucher badla nahi ja sakta")
        if ex and not await acl_ok(user, "accounting", "e"):
            raise HTTPException(status_code=403, detail="Edit ki permission nahi hai")
        if not body.get("date") or not str(body.get("narration") or "").strip():
            raise HTTPException(status_code=400, detail="Voucher Date aur Narration zaroori")
        cancel = body.get("status") == "Cancelled"
        if cancel and not await acl_ok(user, "accounting", "a"):
            raise HTTPException(status_code=403, detail="Cancel sirf approver karega")
        lines = [ln for ln in body.get("lines") or [] if ln.get("accountId") or num(ln.get("dr")) or num(ln.get("cr"))]
        if not cancel:
            await check_lines(lines)
        now = datetime.now(timezone.utc).isoformat()
        doc = {"id": jid, "date": body["date"][:10], "narration": body["narration"].strip(), "voucherType": body.get("voucherType") or "Journal",
               "lines": [{"accountId": ln["accountId"], "party": ln.get("party") or "", "dr": num(ln.get("dr")), "cr": num(ln.get("cr"))} for ln in lines] if not cancel else ex.get("lines", []),
               "status": "Cancelled" if cancel else "Posted", "voucherNo": ex.get("voucherNo") or await fy_no("JV", body["date"]),
               "createdAt": ex.get("createdAt") or now, "createdBy": ex.get("createdBy") or user.get("name") or user.get("email"), "updatedAt": now}
        await db.acc_journals.update_one({"id": jid}, {"$set": doc}, upsert=True)
        return doc

    @r.get("/customers")
    async def customers(user: Dict = Depends(guard("v"))):
        out = []
        for c in await list_collection("crm_clients"):
            g = str(c.get("gst") or "").strip().upper()
            intra = g.startswith(HOME_STATE) if g else str(c.get("state") or "Uttar Pradesh").strip().lower() in ("uttar pradesh", "up")
            out.append({"id": c.get("id"), "name": c.get("name", ""), "gst": g, "pan": c.get("pan", ""), "state": c.get("state", ""), "address": c.get("address", ""),
                        "contactPerson": c.get("contactPerson", ""), "mobile": c.get("mobile", ""), "email": c.get("email", ""), "taxType": "CGST + SGST" if intra else "IGST"})
        return out

    @r.get("/invoices")
    async def invoices(user: Dict = Depends(guard("v"))):
        return await db.crm_invoices.find({}, {"_id": 0, "lines": 0, "history": 0}).sort("invoiceDate", -1).to_list(20000)

    @r.get("/receipts")
    async def list_receipts(user: Dict = Depends(guard("v"))):
        return await db.acc_receipts.find({}, {"_id": 0}).sort("date", -1).to_list(20000)

    @r.post("/receipts")
    async def save_receipt(body: Dict = Body(...), user: Dict = Depends(guard("c"))):
        rid = body.get("id") or f"rv-{uuid.uuid4().hex[:10]}"
        ex = await db.acc_receipts.find_one({"id": rid}, {"_id": 0}) or {}
        if ex.get("status") == "Cancelled":
            raise HTTPException(status_code=423, detail="Cancelled receipt badla nahi ja sakta")
        cancel = body.get("status") == "Cancelled"
        if (ex or cancel) and not await acl_ok(user, "accounting", "a" if cancel else "e"):
            raise HTTPException(status_code=403, detail="Permission nahi hai")
        if not cancel and (not body.get("clientId") or num(body.get("amount")) <= 0 or not body.get("date")):
            raise HTTPException(status_code=400, detail="Client, Date aur Amount zaroori")
        now = datetime.now(timezone.utc).isoformat()
        doc = {**{k: body.get(k) for k in ("clientId", "invoiceId", "date", "mode", "refNo", "bankAccountId", "narration")}, "amount": num(body.get("amount")),
               "tdsDeducted": num(body.get("tdsDeducted")), "retentionHeld": num(body.get("retentionHeld")), "id": rid,
               "status": "Cancelled" if cancel else "Posted", "receiptNo": ex.get("receiptNo") or await fy_no("RV", body.get("date") or ex.get("date")),
               "createdAt": ex.get("createdAt") or now, "createdBy": ex.get("createdBy") or user.get("name") or user.get("email"), "updatedAt": now}
        if cancel:
            doc = {**ex, "status": "Cancelled", "updatedAt": now}
        await db.acc_receipts.update_one({"id": rid}, {"$set": doc}, upsert=True)
        return doc

    @r.get("/brs")
    async def brs(user: Dict = Depends(guard("v"))):
        return await db.acc_brs.find({}, {"_id": 0}).to_list(50000)

    @r.post("/brs")
    async def set_brs(body: Dict = Body(...), user: Dict = Depends(guard("e"))):
        if not body.get("key"):
            raise HTTPException(status_code=400, detail="key required")
        doc = {"key": body["key"], "clearDate": (body.get("clearDate") or "")[:10], "bankRef": body.get("bankRef") or "", "by": user.get("name") or user.get("email")}
        await db.acc_brs.update_one({"key": body["key"]}, {"$set": doc}, upsert=True)
        return doc

    @r.get("/tax")
    async def tax(user: Dict = Depends(guard("v"))):
        itc = {x["billKey"]: x for x in await db.acc_itc.find({}, {"_id": 0}).to_list(50000)}
        tds, gst_in = [], []
        for b in await list_collection("bills"):
            if int(num(b.get("step"))) < 5:
                continue
            v = b.get("vendorSnapshot") or {}
            basic = num(b.get("basicAmount"))
            key = f"bill:{b.get('id')}"
            row = {"key": key, "date": (b.get("billDate") or "")[:10], "billNo": b.get("billNo"), "refNo": b.get("permanentBillNo") or b.get("refNo"), "vendorCode": b.get("vendorCode"),
                   "vendor": v.get("firmName", ""), "pan": v.get("panNo", ""), "gstin": v.get("gstNo", ""), "basic": basic}
            if num(b.get("tdsRate")):
                tds.append({**row, "section": b.get("tdsSection") or "194C", "rate": num(b.get("tdsRate")), "tds": round(basic * num(b.get("tdsRate")) / 100, 2)})
            gst = round(basic * num(b.get("gstSlab")) / 100, 2)
            if gst:
                split = dict(gst_split(gst, v.get("gstNo"), "in"))
                gst_in.append({**row, "gstPct": num(b.get("gstSlab")), "cgst": split.get("in_cgst", 0), "sgst": split.get("in_sgst", 0), "igst": split.get("in_igst", 0), "gst": gst,
                               "matched": bool((itc.get(key) or {}).get("matched")), "matchRemarks": (itc.get(key) or {}).get("remarks", "")})
        gst_out = [{"date": (i.get("invoiceDate") or "")[:10], "invoiceNo": i.get("invoiceNo") or i.get("refNo"), "clientId": i.get("clientId"), "taxable": num(i.get("taxable")),
                    "cgst": num(i.get("cgst")), "sgst": num(i.get("sgst")), "igst": num(i.get("igst"))}
                   for i in await db.crm_invoices.find({}, {"_id": 0, "lines": 0}).to_list(20000) if 3 <= int(num(i.get("step"))) < 6]
        return {"tds": tds, "gstIn": gst_in, "gstOut": gst_out, "sections": TDS_SECTIONS}

    @r.post("/itc")
    async def set_itc(body: Dict = Body(...), user: Dict = Depends(guard("e"))):
        if not body.get("billKey"):
            raise HTTPException(status_code=400, detail="billKey required")
        doc = {"billKey": body["billKey"], "matched": bool(body.get("matched")), "remarks": body.get("remarks") or "", "by": user.get("name") or user.get("email"),
               "at": datetime.now(timezone.utc).isoformat()}
        await db.acc_itc.update_one({"billKey": body["billKey"]}, {"$set": doc}, upsert=True)
        return doc

    return r
