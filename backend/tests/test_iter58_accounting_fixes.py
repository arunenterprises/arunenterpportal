# Iter58: Accounting fixes - Accounts Manager designation RBAC (Komal), negative/empty validation, BRS date, TDS sections, regression
import os, uuid, asyncio, hashlib
from datetime import datetime, timezone, timedelta
import pytest, requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
A = f"{BASE_URL}/api/acc"
CREATED = {"journals": [], "receipts": [], "brs": [], "accounts": []}
KOMAL = ("komal.srivastava@arunenterprises.online", "Komal2026@12")


def _db_run(fn):
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        try:
            return await fn(c[os.environ["DB_NAME"]])
        finally:
            c.close()
    return asyncio.run(go())


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    ss.headers.update({"Authorization": f"Bearer {r.json().get('token') or r.json().get('access_token')}"})
    yield ss

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


@pytest.fixture(scope="module")
def komal():
    cid = "TEST_" + uuid.uuid4().hex

    async def prep(db):
        u = await db.users.find_one({"email": KOMAL[0]}, {"_id": 0, "otp_bypass_until": 1, "designation": 1, "role": 1})
        # one-shot OTP bypass (field is auto-unset on login) so no OTP email is sent to the real user
        await db.users.update_one({"email": KOMAL[0]}, {"$set": {"otp_bypass_until": (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat()}})
        await db.captchas.insert_one({"id": cid, "hash": hashlib.sha256(b"ABCDE").hexdigest(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat()})
        return u
    u = _db_run(prep)
    print("komal db:", u)
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json={"identifier": KOMAL[0], "password": KOMAL[1], "captcha_id": cid, "captcha": "ABCDE"})
    if r.status_code != 200 or not (r.json().get("token") or r.json().get("access_token")):
        pytest.skip(f"komal login: {r.status_code} {r.text[:200]}")
    ss.headers.update({"Authorization": f"Bearer {r.json().get('token') or r.json().get('access_token')}"})
    ss.me = r.json().get("user")
    return ss


# RBAC: Komal (Admin role, designation Accounts Manager)
def test_komal_profile(komal):
    assert komal.me["role"] == "Admin"
    assert "account" in str(komal.me.get("designation", "")).lower()


@pytest.mark.parametrize("ep", ["accounts", "entries", "journals", "customers", "receipts", "brs", "tax", "invoices"])
def test_komal_view(komal, ep):
    r = komal.get(f"{A}/{ep}")
    assert r.status_code == 200, r.text


def test_komal_create_journal_no_delete(komal):
    r = komal.post(f"{A}/journals", json={"date": "2026-06-03", "narration": "TEST_komal jv", "lines": [{"accountId": "sys-bank_chg", "dr": 11}, {"accountId": "sys-bank", "cr": 11}]})
    assert r.status_code == 200, r.text
    CREATED["journals"].append(r.json()["id"])
    assert r.json()["status"] == "Posted"
    # delete op not granted by designation
    code = "8" + uuid.uuid4().hex[:3]
    a = komal.post(f"{A}/accounts", json={"code": code, "name": "TEST_komal_ledger", "group": "Expenses"})
    assert a.status_code == 200, a.text
    CREATED["accounts"].append(a.json()["id"])
    d = komal.delete(f"{A}/accounts/{a.json()['id']}")
    print("komal delete:", d.status_code)
    assert d.status_code == 403


# Validation fixes
def test_negative_jv_rejected(s):
    r = s.post(f"{A}/journals", json={"date": "2026-06-01", "narration": "TEST_neg", "lines": [{"accountId": "sys-bank", "dr": -100}, {"accountId": "sys-capital", "cr": -100}]})
    assert r.status_code == 400
    r2 = s.post(f"{A}/journals", json={"date": "2026-06-01", "narration": "TEST_neg2", "lines": [{"accountId": "sys-bank", "dr": 100, "cr": -100}, {"accountId": "sys-capital", "cr": 0, "dr": -0.0}]})
    assert r2.status_code == 400


@pytest.mark.parametrize("payload", [
    {"amount": -500},
    {"amount": 500, "tdsDeducted": -10},
    {"amount": 500, "retentionHeld": -10},
])
def test_negative_receipt_rejected(s, payload):
    r = s.post(f"{A}/receipts", json={"clientId": "TEST_cl1", "date": "2026-06-02", **payload})
    assert r.status_code == 400, r.text


def test_account_without_code_rejected(s):
    assert s.post(f"{A}/accounts", json={"name": "TEST_nocode", "group": "Expenses"}).status_code == 400
    assert s.post(f"{A}/accounts", json={"code": "  ", "name": "TEST_nocode", "group": "Expenses"}).status_code == 400


def test_brs_clear_before_voucher(s):
    key = "TEST_brs58_" + uuid.uuid4().hex[:5]
    bad = s.post(f"{A}/brs", json={"key": key, "clearDate": "2026-05-01", "voucherDate": "2026-06-01"})
    assert bad.status_code == 400
    bad2 = s.post(f"{A}/brs", json={"key": key, "clearDate": "2026-13-45"})
    assert bad2.status_code == 400
    ok = s.post(f"{A}/brs", json={"key": key, "clearDate": "2026-06-05", "voucherDate": "2026-06-01"})
    assert ok.status_code == 200
    CREATED["brs"].append(key)
    assert any(x["key"] == key and x["clearDate"] == "2026-06-05" for x in s.get(f"{A}/brs").json())


def test_tds_sections(s):
    sec = s.get(f"{A}/tax").json()["sections"]
    for k in ("194C", "194J", "194J-T", "194I-PM", "194I", "194H", "194Q"):
        assert k in sec, k


# Regression data for reports
def test_regression_tax_and_ageing_inputs(s):
    t = s.get(f"{A}/tax").json()
    assert any(r.get("refNo") == "TEST_REF1" and r.get("section") == "194C" and abs(r.get("tds", 0) - 2000) < 0.01 for r in t["tds"])
    e = s.get(f"{A}/entries").json()
    dr = round(sum(x["dr"] for x in e["entries"]), 2)
    cr = round(sum(x["cr"] for x in e["entries"]), 2)
    assert dr == cr
    cred = next(a for a in e["accounts"] if a.get("sysKey") == "creditors")
    v1 = sum(x["cr"] - x["dr"] for x in e["entries"] if x["accountId"] == cred["id"] and x.get("party") == "TEST_V1")
    print("TEST_V1 outstanding", v1)
    assert abs(v1 - 61000) < 0.01


def test_regression_journal_cancel(s):
    r = s.post(f"{A}/journals", json={"date": "2026-06-04", "narration": "TEST_jv58", "lines": [{"accountId": "sys-bank_chg", "dr": 77}, {"accountId": "sys-bank", "cr": 77}]})
    assert r.status_code == 200
    j = r.json()
    CREATED["journals"].append(j["id"])
    assert j["voucherNo"].startswith("AE/JV/")
    c = s.post(f"{A}/journals", json={**j, "status": "Cancelled"})
    assert c.status_code == 200 and c.json()["status"] == "Cancelled"
    assert not any(x["key"] == f"jv:{j['id']}" for x in s.get(f"{A}/entries").json()["entries"])


def test_regression_receipt(s):
    r = s.post(f"{A}/receipts", json={"clientId": "TEST_cl1", "amount": 1000, "date": "2026-06-06", "mode": "NEFT", "refNo": "TEST_UTR58"})
    assert r.status_code == 200, r.text
    CREATED["receipts"].append(r.json()["id"])
    assert r.json()["receiptNo"].startswith("AE/RV/")
