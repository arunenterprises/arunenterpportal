# Iteration 41: Invoice Cancel rules + /api/crm-all bulk endpoint
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SA = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
RUN = uuid.uuid4().hex[:6]
USER_EMAIL = f"test_iter41_u_{RUN}@example.com"
PW = "Test@1234"
CL = "TEST_cl1"
I = {k: f"TEST_inv41{k}_{RUN}" for k in ("a", "b", "c", "d", "e")}


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _inv(iid, **kw):
    b = {"id": iid, "clientId": CL, "invoiceDate": "2026-10-22", "refNo": "", "step": 1,
         "lines": [{"description": "TEST item", "qty": 10, "rate": 100, "gstPct": 18}], "total": 1180}
    b.update(kw)
    return b


def _post(tok, body):
    return requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(tok), json=body, timeout=30)


def _approved(tok, iid):
    assert _post(tok, _inv(iid)).status_code == 200
    assert _post(tok, _inv(iid, step=2)).status_code == 200
    r = _post(tok, _inv(iid, step=3))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def sa():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SA, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    requests.post(f"{BASE_URL}/api/crm/clients", headers=_h(tok), json={"id": CL, "name": "TEST UP Client", "state": "Uttar Pradesh", "gst": "09AAACG1395D1ZS", "step": 3}, timeout=30)
    return tok


@pytest.fixture(scope="module")
def user(sa):
    r = requests.post(f"{BASE_URL}/api/auth/register", headers=_h(sa),
                      json={"email": USER_EMAIL, "password": PW, "name": "TEST_iter41", "role": "User"}, timeout=30)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": USER_EMAIL, "password": PW}, timeout=30)
    assert r.status_code == 200, r.text
    yield r.json()["token"]
    requests.delete(f"{BASE_URL}/api/users/{USER_EMAIL}", headers=_h(sa), timeout=30)


# --- crm-all
def test_crm_all(sa):
    r = requests.get(f"{BASE_URL}/api/crm-all", headers=_h(sa), timeout=30)
    assert r.status_code == 200
    d = r.json()
    for n in ["leads", "clients", "comms", "contracts", "mb", "ra_bills", "milestones", "change_orders", "retention_releases", "invoices"]:
        assert isinstance(d[n], list), n
    assert any(c.get("id") == CL for c in d["clients"])
    assert all("_id" not in x for x in d["clients"])


def test_crm_all_requires_auth():
    r = requests.get(f"{BASE_URL}/api/crm-all", timeout=30)
    assert r.status_code in (401, 403)


# --- cancel rules
def test_cancel_from_approved(sa):
    out = _approved(sa, I["a"])
    no = out["invoiceNo"]
    assert no.startswith("A/E/INV/") and no.endswith("/2627")
    bad = _post(sa, {**out, "step": 6, "cancelReason": "  "})
    assert bad.status_code == 400
    r = _post(sa, {**out, "step": 6, "cancelReason": "TEST wrong rate", "invoiceNo": "HACK"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["step"] == 6 and j["invoiceNo"] == no and j["cancelReason"] == "TEST wrong rate"
    # changing cancelled invoice -> 400
    assert _post(sa, {**j, "step": 6, "cancelReason": "again"}).status_code == 400
    assert _post(sa, {**j, "step": 3}).status_code == 400
    # delete numbered cancelled -> 400
    d = requests.delete(f"{BASE_URL}/api/crm/invoices/{I['a']}", headers=_h(sa), timeout=30)
    assert d.status_code == 400


def test_cancel_from_sent(sa):
    out = _approved(sa, I["b"])
    s = _post(sa, {**out, "step": 4, "sentAt": "2026-10-23"})
    assert s.status_code == 200
    r = _post(sa, {**s.json(), "step": 6, "cancelReason": "TEST client rejected"})
    assert r.status_code == 200 and r.json()["step"] == 6


def test_cancel_from_draft_or_submitted_rejected(sa):
    assert _post(sa, _inv(I["c"])).status_code == 200
    assert _post(sa, _inv(I["c"], step=6, cancelReason="x")).status_code == 400
    assert _post(sa, _inv(I["c"], step=2)).status_code == 200
    assert _post(sa, _inv(I["c"], step=6, cancelReason="x")).status_code == 400


def test_cancel_from_paid_rejected(sa):
    out = _approved(sa, I["e"])
    p = _post(sa, {**out, "step": 4})
    p = _post(sa, {**p.json(), "step": 5, "utr": "TESTUTR"})
    assert p.status_code == 200
    assert _post(sa, {**p.json(), "step": 6, "cancelReason": "x"}).status_code == 400


def test_non_admin_cancel_forbidden(sa, user):
    out = _approved(sa, I["d"])
    r = _post(user, {**out, "step": 6, "cancelReason": "TEST by user"})
    assert r.status_code == 403
    r2 = requests.get(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), timeout=30).json()
    assert next(x for x in r2 if x["id"] == I["d"])["step"] == 3
