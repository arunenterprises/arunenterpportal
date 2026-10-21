"""Iteration 28 — data-loss fixes: snapshot merge (updatedAt), counters $max,
fooding sync, workflow submit by creator, next-vendor serial."""
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or
            open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}


def iso(delta_min=0):
    return (datetime.now(timezone.utc) + timedelta(minutes=delta_min)).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_H(H):
    email = f"test_iter28_{uuid.uuid4().hex[:6]}@arunenterprises.online"
    r = requests.post(f"{API}/auth/register", headers=H,
                      json={"email": email, "password": "TestPass@123", "name": "TEST Iter28 User", "role": "User"})
    assert r.status_code == 200, r.text
    r2 = requests.post(f"{API}/auth/login", json={"identifier": email, "password": "TestPass@123"})
    assert r2.status_code == 200
    yield {"Authorization": f"Bearer {r2.json()['token']}", "Content-Type": "application/json"}
    requests.delete(f"{API}/users/{email}", headers=H)


CREATED = {"bills": [], "expenses": [], "fooding": [], "vendors": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(H):
    yield
    for bid in CREATED["bills"]:
        requests.delete(f"{API}/bills/{bid}", headers=H)
    for xid in CREATED["expenses"]:
        requests.delete(f"{API}/expenses/{xid}", headers=H)
    for fid in CREATED["fooding"]:
        requests.delete(f"{API}/fooding/{fid}", headers=H)
    for vid in CREATED["vendors"]:
        requests.delete(f"{API}/vendors/{vid}", headers=H)


def _snap(H):
    r = requests.get(f"{API}/snapshot", headers=H, timeout=30)
    assert r.status_code == 200
    return r.json()


# ---- Counters ----
def test_snapshot_without_counters_keeps_counters(H):
    before = requests.get(f"{API}/counters", headers=H).json()
    r = requests.post(f"{API}/snapshot", headers=H, json={"bills": []})
    assert r.status_code == 200
    after = requests.get(f"{API}/counters", headers=H).json()
    for k in ("vendorSerial", "billSerial", "pvSerial"):
        assert after.get(k) == before.get(k), (k, before, after)


def test_snapshot_with_zero_counters_does_not_decrease(H):
    before = requests.get(f"{API}/counters", headers=H).json()
    r = requests.post(f"{API}/snapshot", headers=H,
                      json={"counters": {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0}})
    assert r.status_code == 200
    after = requests.get(f"{API}/counters", headers=H).json()
    for k in ("vendorSerial", "billSerial", "pvSerial"):
        assert int(after.get(k) or 0) >= int(before.get(k) or 0)


def test_post_counters_lower_values_not_decrease(H):
    before = requests.get(f"{API}/counters", headers=H).json()
    r = requests.post(f"{API}/counters", headers=H, json={"vendorSerial": 0, "billSerial": 0})
    assert r.status_code == 200
    after = r.json()
    assert int(after.get("vendorSerial") or 0) == int(before.get("vendorSerial") or 0)
    assert int(after.get("billSerial") or 0) == int(before.get("billSerial") or 0)


# ---- Snapshot merge semantics ----
def test_snapshot_older_updatedAt_does_not_overwrite(H):
    bid = f"TEST_b_{uuid.uuid4().hex[:8]}"
    CREATED["bills"].append(bid)
    new = {"id": bid, "invoiceNo": "TEST_NEW", "step": 1, "updatedAt": iso(0)}
    assert requests.post(f"{API}/snapshot", headers=H, json={"bills": [new]}).status_code == 200
    old = {"id": bid, "invoiceNo": "TEST_OLD", "step": 1, "updatedAt": iso(-60)}
    r = requests.post(f"{API}/snapshot", headers=H, json={"bills": [old]})
    assert r.status_code == 200 and r.json().get("bills") == 0
    got = [b for b in requests.get(f"{API}/bills", headers=H).json() if b.get("id") == bid]
    assert got and got[0]["invoiceNo"] == "TEST_NEW"


def test_snapshot_newer_updatedAt_overwrites(H):
    bid = f"TEST_b_{uuid.uuid4().hex[:8]}"
    CREATED["bills"].append(bid)
    requests.post(f"{API}/snapshot", headers=H, json={"bills": [{"id": bid, "invoiceNo": "TEST_V1", "updatedAt": iso(-5)}]})
    requests.post(f"{API}/snapshot", headers=H, json={"bills": [{"id": bid, "invoiceNo": "TEST_V2", "updatedAt": iso(0)}]})
    got = [b for b in requests.get(f"{API}/bills", headers=H).json() if b.get("id") == bid]
    assert got and got[0]["invoiceNo"] == "TEST_V2"


def test_snapshot_push_does_not_delete_other_records(H):
    bid = f"TEST_b_{uuid.uuid4().hex[:8]}"
    CREATED["bills"].append(bid)
    requests.post(f"{API}/snapshot", headers=H, json={"bills": [{"id": bid, "invoiceNo": "TEST_KEEP", "updatedAt": iso()}]})
    # Another device pushes a snapshot without this bill
    requests.post(f"{API}/snapshot", headers=H, json={"bills": []})
    ids = [b.get("id") for b in requests.get(f"{API}/bills", headers=H).json()]
    assert bid in ids


# ---- Bills ----
def test_bill_create_and_submit_by_user(user_H, H):
    bid = f"TEST_bill_{uuid.uuid4().hex[:8]}"
    CREATED["bills"].append(bid)
    body = {"id": bid, "invoiceNo": "TEST_INV1", "woNo": "TEST_WO", "basicAmount": 1000, "step": 1, "updatedAt": iso()}
    r = requests.post(f"{API}/bills", headers=user_H, json=body)
    assert r.status_code == 200, r.text
    body["step"] = 2
    body["updatedAt"] = iso(1)
    r = requests.post(f"{API}/bills", headers=user_H, json=body)
    assert r.status_code == 200, r.text  # creator may submit 1 -> 2
    got = [b for b in requests.get(f"{API}/bills", headers=H).json() if b.get("id") == bid]
    assert got and int(got[0]["step"]) == 2
    assert got[0].get("submittedByName")


def test_bill_user_cannot_jump_to_step3(user_H):
    bid = f"TEST_bill_{uuid.uuid4().hex[:8]}"
    CREATED["bills"].append(bid)
    r = requests.post(f"{API}/bills", headers=user_H, json={"id": bid, "step": 3})
    assert r.status_code == 403


# ---- Expenses ----
def test_expense_create_submit_persist(H):
    xid = f"TEST_x_{uuid.uuid4().hex[:8]}"
    CREATED["expenses"].append(xid)
    body = {"id": xid, "title": "TEST_Expense", "amount": 500, "step": 1, "updatedAt": iso()}
    assert requests.post(f"{API}/expenses", headers=H, json=body).status_code == 200
    body.update({"step": 2, "updatedAt": iso(1)})
    assert requests.post(f"{API}/expenses", headers=H, json=body).status_code == 200
    # a stale device pushes its old copy via snapshot
    stale = {"id": xid, "title": "TEST_Expense", "amount": 500, "step": 1, "updatedAt": iso(-10)}
    requests.post(f"{API}/snapshot", headers=H, json={"expenses": [stale]})
    got = [x for x in _snap(H)["expenses"] if x.get("id") == xid]
    assert got and int(got[0]["step"]) == 2


# ---- Fooding ----
def test_fooding_upsert_in_snapshot_and_delete(H):
    fid = f"TEST_WF-{uuid.uuid4().hex[:8]}"
    rec = {"id": fid, "refNo": "TEST_WF-REF", "circle": "TEST", "status": "Draft",
           "lines": [{"id": "l1", "amount": 100}], "updatedAt": iso()}
    r = requests.post(f"{API}/fooding", headers=H, json=rec)
    assert r.status_code == 200 and r.json()["id"] == fid
    got = [f for f in _snap(H).get("fooding", []) if f.get("id") == fid]
    assert got and got[0]["circle"] == "TEST"
    r = requests.delete(f"{API}/fooding/{fid}", headers=H)
    assert r.status_code == 200 and r.json()["deleted"] == 1
    assert not [f for f in _snap(H).get("fooding", []) if f.get("id") == fid]


def test_fooding_requires_id(H):
    assert requests.post(f"{API}/fooding", headers=H, json={"circle": "x"}).status_code == 400


def test_fooding_via_snapshot_push(H):
    fid = f"TEST_WF-{uuid.uuid4().hex[:8]}"
    CREATED["fooding"].append(fid)
    r = requests.post(f"{API}/snapshot", headers=H, json={"fooding": [{"id": fid, "circle": "TEST_SNAP", "updatedAt": iso()}]})
    assert r.status_code == 200 and r.json().get("fooding") == 1
    assert [f for f in _snap(H)["fooding"] if f.get("id") == fid]


def test_fooding_requires_auth():
    assert requests.post(f"{API}/fooding", json={"id": "x"}).status_code in (401, 403)


# ---- Vendor serial ----
def test_next_vendor_serial_continues_from_max(H):
    vendors = requests.get(f"{API}/vendors", headers=H).json()
    import re
    mx = 0
    for v in vendors:
        m = re.match(r"^AE(\d{4})JV", v.get("vendorCode") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    r = requests.post(f"{API}/counters/next-vendor", headers=H)
    assert r.status_code == 200
    d = r.json()
    assert d["maxUsed"] == mx
    assert d["nextSerial"] > mx
    assert d["nextSerial"] >= 1
