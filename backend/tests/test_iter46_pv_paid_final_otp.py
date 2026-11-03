# Iteration 46: Payment Voucher FINAL PAID lock + email-only OTP login
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
PID, PVNO = "TEST_pvX", "TEST/PVX/1"


def _mongo():
    env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l and not l.startswith("#"))
    return MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "otp_required" not in d or not d.get("otp_required")
    tok = d.get("token") or d.get("access_token")
    if tok:
        ss.headers["Authorization"] = f"Bearer {tok}"
    yield ss
    _mongo().payments.delete_many({"id": {"$in": [PID, "TEST_pvX2"]}})


def _get(s):
    return next((p for p in s.get(f"{BASE_URL}/api/payments").json() if p.get("id") == PID), None)


# SuperAdmin login gives token, no OTP
def test_superadmin_login_no_otp():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200
    d = r.json()
    assert not d.get("otp_required")
    assert d.get("token") or d.get("access_token") or r.cookies


# Approved voucher create
def test_create_approved(s):
    r = s.post(f"{BASE_URL}/api/payments/bulk", json={"items": [{"id": PID, "pvNo": PVNO, "status": "Approved", "amount": 100}]})
    assert r.status_code == 200 and r.json()["count"] == 1
    assert _get(s)["amount"] == 100


# paidFinal without UTR -> 400
def test_paid_final_without_utr_400(s):
    r = s.post(f"{BASE_URL}/api/payments/bulk", json={"items": [{"id": PID, "pvNo": PVNO, "status": "Approved", "amount": 100, "paidFinal": True, "paidDate": "2026-01-15"}]})
    assert r.status_code == 400
    assert not _get(s).get("paidFinal")


# paidFinal on non-approved -> 400
def test_paid_final_non_approved_400(s):
    r = s.post(f"{BASE_URL}/api/payments/bulk", json={"items": [{"id": "TEST_pvX2", "pvNo": "TEST/PVX/2", "status": "Pending", "amount": 1, "paidFinal": True, "utrNo": "U1", "paidDate": "2026-01-15"}]})
    assert r.status_code == 400


# mark paid final
def test_mark_paid_final(s):
    r = s.post(f"{BASE_URL}/api/payments/bulk", json={"items": [{"id": PID, "pvNo": PVNO, "status": "Approved", "amount": 100, "paidFinal": True, "utrNo": "UTR123", "paidDate": "2026-01-15"}]})
    assert r.status_code == 200 and r.json()["count"] == 1
    p = _get(s)
    assert p["paidFinal"] is True and p["utrNo"] == "UTR123" and p.get("paidFinalBy") and p.get("paidFinalAt")


# subsequent edit ignored
def test_edit_after_final_ignored(s):
    r = s.post(f"{BASE_URL}/api/payments/bulk", json={"items": [{"id": PID, "pvNo": PVNO, "status": "Rejected", "amount": 999, "paidFinal": False}]})
    assert r.status_code == 200 and r.json()["count"] == 0
    p = _get(s)
    assert p["amount"] == 100 and p["status"] == "Approved" and p["paidFinal"] is True
    # pvNo-only key also ignored
    r = s.post(f"{BASE_URL}/api/payments/bulk", json={"items": [{"pvNo": PVNO, "amount": 5}]})
    assert r.json()["count"] == 0


# delete blocked
def test_delete_final_403(s):
    r = s.delete(f"{BASE_URL}/api/payments/{PVNO}")
    assert r.status_code == 403
    r = s.post(f"{BASE_URL}/api/payments/delete_bulk", json={"pvNos": [PVNO]})
    assert r.status_code == 200 and r.json()["deleted"] == 0
    assert _get(s) is not None
