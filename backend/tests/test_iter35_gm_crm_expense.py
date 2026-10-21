# Iteration 35: GM CRM approve/reject via upsert, overdue RA seed, expense persistence (dedupe by id)
import os
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}


def rid(p):
    return f"TEST_{p}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def sa():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    yield s
    # cleanup
    for name in ("mb", "ra_bills"):
        for rec in s.get(f"{BASE_URL}/api/crm/{name}").json():
            if str(rec.get("id", "")).startswith("TEST_"):
                s.delete(f"{BASE_URL}/api/crm/{name}/{rec['id']}")
    for e in s.get(f"{BASE_URL}/api/snapshot").json().get("expenses", []):
        if str(e.get("id", "")).startswith("TEST_"):
            s.delete(f"{BASE_URL}/api/expenses/{e['id']}")


def _get(sa, name, i):
    return next((x for x in sa.get(f"{BASE_URL}/api/crm/{name}").json() if x["id"] == i), None)


# CRM MB approve (step 2 -> 3) sets approvedByName
def test_mb_approve(sa):
    i = rid("mb")
    r = sa.post(f"{BASE_URL}/api/crm/mb", json={"id": i, "mbNo": "TEST-MB-1", "itemDesc": "TEST item", "qty": 5, "unit": "cum", "step": 2})
    assert r.status_code == 200 and r.json()["step"] == 2
    r = sa.post(f"{BASE_URL}/api/crm/mb", json={**r.json(), "step": 3})
    assert r.status_code == 200
    g = _get(sa, "mb", i)
    assert g["step"] == 3 and g.get("approvedByName") and g.get("approvedAt")


# CRM RA reject (step 2 -> 1) keeps rejectedAt
def test_ra_reject(sa):
    i = rid("ra")
    r = sa.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": i, "raNo": "TEST-RA-1", "net": 1000, "step": 2})
    assert r.status_code == 200
    r = sa.post(f"{BASE_URL}/api/crm/ra_bills", json={**r.json(), "step": 1, "rejectedAt": datetime.now(timezone.utc).isoformat()})
    assert r.status_code == 200
    g = _get(sa, "ra_bills", i)
    assert g["step"] == 1 and g.get("rejectedAt")


# Overdue RA (step 4, sentAt 40d ago) persists
def test_ra_overdue_seed(sa):
    i = rid("ra_od")
    sent = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
    r = sa.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": i, "raNo": "TEST-RA-OD", "net": 5000, "step": 4, "sentAt": sent})
    assert r.status_code == 200
    g = _get(sa, "ra_bills", i)
    assert g["step"] == 4 and g["sentAt"] == sent


# Expenses: two with same refNo but different id both persist in snapshot
def test_expense_same_ref_both_persist(sa):
    a, b = rid("exp"), rid("exp")
    for x in (a, b):
        r = sa.post(f"{BASE_URL}/api/expenses", json={"id": x, "refNo": "TEST-EXP-REF", "basicAmount": 100, "step": 1})
        assert r.status_code == 200 and r.json()["id"] == x
    ids = {e["id"] for e in sa.get(f"{BASE_URL}/api/snapshot").json()["expenses"]}
    assert a in ids and b in ids
    for x in (a, b):
        assert sa.delete(f"{BASE_URL}/api/expenses/{x}").status_code == 200
    ids = {e["id"] for e in sa.get(f"{BASE_URL}/api/snapshot").json()["expenses"]}
    assert a not in ids and b not in ids
