# Iteration 36: /api/counters/next-expense incrementing + floor at max used, expense persistence via snapshot
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}


@pytest.fixture(scope="module")
def sa():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    yield s
    for e in s.get(f"{BASE_URL}/api/snapshot").json().get("expenses", []):
        if str(e.get("id", "")).startswith("TEST_"):
            s.delete(f"{BASE_URL}/api/expenses/{e['id']}")


def _max_used(sa):
    mx = 0
    for x in sa.get(f"{BASE_URL}/api/snapshot").json().get("expenses", []):
        for v in (x.get("refNo"), x.get("permanentExpenseNo")):
            m = re.match(r"^EX[RP](\d{4})", v or "")
            if m:
                mx = max(mx, int(m.group(1)))
        try:
            mx = max(mx, int(x.get("expenseSerial") or 0))
        except (TypeError, ValueError):
            pass
    return mx


# Counter requires auth
def test_next_expense_unauth():
    r = requests.post(f"{BASE_URL}/api/counters/next-expense")
    assert r.status_code in (401, 403)


# Counter increments and is > max used
def test_next_expense_increments(sa):
    mx = _max_used(sa)
    a = sa.post(f"{BASE_URL}/api/counters/next-expense")
    b = sa.post(f"{BASE_URL}/api/counters/next-expense")
    assert a.status_code == 200 and b.status_code == 200
    na, nb = a.json()["nextSerial"], b.json()["nextSerial"]
    assert isinstance(na, int) and nb == na + 1
    assert na > mx


# Floors at a newly saved high serial (skipped by default: permanently bumps the counter by ~50)
@pytest.mark.skip(reason="side-effect: advances expense counter; verified manually in iter36")
def test_next_expense_floors_to_saved(sa):
    cur = sa.post(f"{BASE_URL}/api/counters/next-expense").json()["nextSerial"]
    hi = cur + 50
    eid = f"TEST_x_{uuid.uuid4().hex[:8]}"
    r = sa.post(f"{BASE_URL}/api/expenses", json={"id": eid, "refNo": f"EXR{hi:04d}", "expenseSerial": hi,
                                                 "description": "TEST floor", "paidToName": "TEST", "basicAmount": 1})
    assert r.status_code == 200, r.text
    n = sa.post(f"{BASE_URL}/api/counters/next-expense").json()["nextSerial"]
    assert n == hi + 1
    sa.delete(f"{BASE_URL}/api/expenses/{eid}")


# Expense upsert persists in snapshot, no _id
def test_expense_persist_snapshot(sa):
    eid = f"TEST_x_{uuid.uuid4().hex[:8]}"
    n = sa.post(f"{BASE_URL}/api/counters/next-expense").json()["nextSerial"]
    r = sa.post(f"{BASE_URL}/api/expenses", json={"id": eid, "refNo": f"EXR{n:04d}", "expenseSerial": n,
                                                 "description": "TEST persist", "paidToName": "TEST", "basicAmount": 100})
    assert r.status_code == 200
    snap = sa.get(f"{BASE_URL}/api/snapshot").json()
    got = next((x for x in snap["expenses"] if x["id"] == eid), None)
    assert got and got["refNo"] == f"EXR{n:04d}" and "_id" not in got
    d = sa.delete(f"{BASE_URL}/api/expenses/{eid}")
    assert d.status_code == 200
    snap = sa.get(f"{BASE_URL}/api/snapshot").json()
    assert not any(x["id"] == eid for x in snap["expenses"])
