# Iter57: Accounting module (/api/acc/*) - COA, journals, auto-postings, receipts, BRS, tax/ITC, RBAC
import os, uuid, asyncio, hashlib
from datetime import datetime, timezone, timedelta
import pytest, requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
A = f"{BASE_URL}/api/acc"
CREATED = {"accounts": [], "journals": [], "receipts": [], "users": [], "brs": [], "itc": []}


def _db_run(coro_fn):
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        try:
            return await coro_fn(c[os.environ["DB_NAME"]])
        finally:
            c.close()
    return asyncio.run(go())


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    ss.headers.update({"Authorization": f"Bearer {tok}"})
    yield ss
    # cleanup only ids we created
    for aid in CREATED["accounts"]:
        ss.delete(f"{A}/accounts/{aid}")
    for em in CREATED["users"]:
        ss.delete(f"{BASE_URL}/api/users/{em}")

    async def clean(db):
        if CREATED["journals"]:
            await db.acc_journals.delete_many({"id": {"$in": CREATED["journals"]}})
        if CREATED["receipts"]:
            await db.acc_receipts.delete_many({"id": {"$in": CREATED["receipts"]}})
        if CREATED["brs"]:
            await db.acc_brs.delete_many({"key": {"$in": CREATED["brs"]}})
        if CREATED["accounts"]:
            await db.acc_accounts.delete_many({"id": {"$in": CREATED["accounts"]}})
    _db_run(clean)


def _role_session(s, role):
    em = f"test_{role.lower().replace(' ', '_')}_{uuid.uuid4().hex[:6]}@arun.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": em, "password": "Test@1234", "name": f"TEST_{role}", "role": role})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == role
    CREATED["users"].append(em)
    cid = "TEST_" + uuid.uuid4().hex

    async def prep(db):
        await db.users.update_one({"email": em}, {"$set": {"otp_bypass_until": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()}})
        await db.captchas.insert_one({"id": cid, "hash": hashlib.sha256(b"ABCDE").hexdigest(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat()})
    _db_run(prep)
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json={"identifier": em, "password": "Test@1234", "captcha_id": cid, "captcha": "ABCDE"})
    assert r.status_code == 200, r.text
    ss.headers.update({"Authorization": f"Bearer {r.json().get('token') or r.json().get('access_token')}"})
    return ss


# COA
def test_accounts_seeded(s):
    r = s.get(f"{A}/accounts")
    assert r.status_code == 200
    sys = [a for a in r.json() if a.get("system")]
    assert len(sys) == 24
    assert {"bank", "creditors", "debtors", "in_igst", "tds_pay"} <= {a["sysKey"] for a in sys}


def test_account_create_dup_delete(s):
    code = "9" + uuid.uuid4().hex[:3]
    r = s.post(f"{A}/accounts", json={"code": code, "name": "TEST_Ledger", "group": "Expenses", "subGroup": "Indirect Expenses"})
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    CREATED["accounts"].append(aid)
    assert r.json()["name"] == "TEST_Ledger"
    assert any(a["id"] == aid for a in s.get(f"{A}/accounts").json())
    d = s.post(f"{A}/accounts", json={"code": code, "name": "TEST_Dup", "group": "Expenses"})
    assert d.status_code == 400
    assert s.post(f"{A}/accounts", json={"code": "X1", "name": "TEST_bad", "group": "Foo"}).status_code == 400
    dl = s.delete(f"{A}/accounts/{aid}")
    assert dl.status_code == 200
    assert not any(a["id"] == aid for a in s.get(f"{A}/accounts").json())
    CREATED["accounts"].remove(aid)


def test_system_account_locked(s):
    assert s.delete(f"{A}/accounts/sys-bank").status_code == 400
    bank = next(a for a in s.get(f"{A}/accounts").json() if a["id"] == "sys-bank")
    r = s.post(f"{A}/accounts", json={**bank, "group": "Expenses"})
    assert r.status_code == 200
    assert r.json()["group"] == "Assets" and r.json()["system"] is True


# Journals
def test_journal_validation(s):
    base = {"date": "2026-06-01", "narration": "TEST_jv"}
    unbal = s.post(f"{A}/journals", json={**base, "lines": [{"accountId": "sys-bank", "dr": 100}, {"accountId": "sys-capital", "cr": 90}]})
    assert unbal.status_code == 400 and "barabar" in unbal.json()["detail"]
    both = s.post(f"{A}/journals", json={**base, "lines": [{"accountId": "sys-bank", "dr": 100, "cr": 100}, {"accountId": "sys-capital", "cr": 100}]})
    assert both.status_code == 400
    neither = s.post(f"{A}/journals", json={**base, "lines": [{"accountId": "sys-bank", "dr": 100}, {"accountId": "sys-capital"}, {"accountId": "sys-loans", "cr": 100}]})
    assert neither.status_code == 400
    nonarr = s.post(f"{A}/journals", json={"date": "2026-06-01", "narration": "", "lines": []})
    assert nonarr.status_code == 400


def test_journal_post_and_cancel(s):
    r = s.post(f"{A}/journals", json={"date": "2026-06-01", "narration": "TEST_jv post", "lines": [{"accountId": "sys-bank_chg", "dr": 123}, {"accountId": "sys-bank", "cr": 123}]})
    assert r.status_code == 200, r.text
    j = r.json()
    CREATED["journals"].append(j["id"])
    assert j["voucherNo"].startswith("AE/JV/2627/") and j["status"] == "Posted"
    e = s.get(f"{A}/entries").json()["entries"]
    assert len([x for x in e if x["key"] == f"jv:{j['id']}"]) == 2
    c = s.post(f"{A}/journals", json={**j, "status": "Cancelled"})
    assert c.status_code == 200 and c.json()["status"] == "Cancelled"
    assert c.json()["voucherNo"] == j["voucherNo"]
    e = s.get(f"{A}/entries").json()["entries"]
    assert not [x for x in e if x["key"] == f"jv:{j['id']}"]
    assert s.post(f"{A}/journals", json={**j}).status_code == 423


# Auto postings
def test_entries_autopost_and_balanced(s):
    d = s.get(f"{A}/entries").json()
    e = d["entries"]
    assert round(sum(x["dr"] for x in e), 2) == round(sum(x["cr"] for x in e), 2)
    bill = [x for x in e if x["key"] == "bill:TEST_b1"]
    assert bill, "TEST_b1 bill not auto-posted"
    by = {x["accountId"]: x for x in bill}
    assert by["sys-subcon"]["dr"] == 100000
    assert by["sys-in_cgst"]["dr"] == 9000 and by["sys-in_sgst"]["dr"] == 9000
    assert "sys-in_igst" not in by
    assert by["sys-tds_pay"]["cr"] == 2000 and by["sys-ret_pay"]["cr"] == 5000
    assert by["sys-creditors"]["cr"] == 111000 and by["sys-creditors"]["party"] == "TEST_V1"
    pay = [x for x in e if x["source"] == "Payment Voucher" and x.get("party") == "TEST_V1"]
    assert any(x["accountId"] == "sys-creditors" and x["dr"] == 50000 for x in pay)
    inv = {x["accountId"]: x for x in e if x["key"] == "inv:TEST_i1"}
    assert inv["sys-debtors"]["dr"] == 236000 and inv["sys-out_igst"]["cr"] == 36000 and inv["sys-revenue"]["cr"] == 200000
    jv = [x for x in e if x["key"] == "jv:TEST_j1"]
    assert sum(x["dr"] for x in jv) == 500000


# Receipts
def test_receipt_post(s):
    assert s.post(f"{A}/receipts", json={"clientId": "TEST_cl1", "amount": 0, "date": "2026-06-02"}).status_code == 400
    r = s.post(f"{A}/receipts", json={"clientId": "TEST_cl1", "invoiceId": "TEST_i1", "amount": 10000, "tdsDeducted": 200, "retentionHeld": 500, "date": "2026-06-02", "mode": "NEFT", "refNo": "TEST_UTR"})
    assert r.status_code == 200, r.text
    rv = r.json()
    CREATED["receipts"].append(rv["id"])
    assert rv["receiptNo"].startswith("AE/RV/2627/")
    e = {x["accountId"]: x for x in s.get(f"{A}/entries").json()["entries"] if x["key"] == f"rcpt:{rv['id']}"}
    assert e["sys-bank"]["dr"] == 10000 and e["sys-tds_recv"]["dr"] == 200 and e["sys-ret_recv"]["dr"] == 500
    assert e["sys-debtors"]["cr"] == 10700
    assert any(x["id"] == rv["id"] for x in s.get(f"{A}/receipts").json())


# BRS + Tax/ITC
def test_brs(s):
    key = "TEST_brs_key_" + uuid.uuid4().hex[:5]
    r = s.post(f"{A}/brs", json={"key": key, "clearDate": "2026-06-05"})
    assert r.status_code == 200
    CREATED["brs"].append(key)
    assert any(x["key"] == key and x["clearDate"] == "2026-06-05" for x in s.get(f"{A}/brs").json())
    assert s.post(f"{A}/brs", json={}).status_code == 400


def test_tax_and_itc(s):
    t = s.get(f"{A}/tax").json()
    tds = [x for x in t["tds"] if x["key"] == "bill:TEST_b1"]
    assert tds and tds[0]["section"] == "194C" and tds[0]["rate"] == 2 and tds[0]["tds"] == 2000
    gi = next(x for x in t["gstIn"] if x["key"] == "bill:TEST_b1")
    orig = gi["matched"]
    assert gi["cgst"] == 9000 and gi["igst"] == 0
    assert any(x["igst"] == 36000 for x in t["gstOut"])
    assert set(t["sections"]) == {"194C", "194J", "194I", "194H", "194Q", "206AA", "NA"}
    r = s.post(f"{A}/itc", json={"billKey": "bill:TEST_b1", "matched": not orig})
    assert r.status_code == 200
    assert next(x for x in s.get(f"{A}/tax").json()["gstIn"] if x["key"] == "bill:TEST_b1")["matched"] == (not orig)
    s.post(f"{A}/itc", json={"billKey": "bill:TEST_b1", "matched": orig})


def test_customers(s):
    c = next(x for x in s.get(f"{A}/customers").json() if x["id"] == "TEST_cl1")
    assert c["taxType"] == "IGST"


# RBAC
def test_unauth():
    assert requests.get(f"{A}/entries").status_code in (401, 403)


@pytest.mark.parametrize("role,expect", [("User", 403), ("Purchase", 403), ("Accounts Manager", 200), ("Member Financial", 200)])
def test_rbac(s, role, expect):
    ss = _role_session(s, role)
    assert ss.get(f"{A}/entries").status_code == expect
    if role == "Member Financial":
        # MF cannot delete
        assert ss.delete(f"{A}/accounts/nonexistent").status_code == 403
