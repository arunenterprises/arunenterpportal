# Iter45: RBAC (System Management ACL) — settings/acl round-trip + role/user override enforcement on ops & crm
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
SA = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
TEST_EMAIL = f"test_rbac_{uuid.uuid4().hex[:6]}@example.com"
TEST_PW = "TestPw@1234"


def _login(ident, pw):
    r = requests.post(f"{API}/auth/login", json={"identifier": ident, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d, f"OTP required? {d}"
    return d["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def ctx():
    sa = _login(SA["identifier"], SA["password"])
    orig = requests.get(f"{API}/settings/acl", headers=H(sa)).json()["value"]
    r = requests.post(f"{API}/auth/register", headers=H(sa), json={"email": TEST_EMAIL, "name": "TEST_RBAC User", "password": TEST_PW, "role": "User"})
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/admin/users/{TEST_EMAIL}/otp-reset", headers=H(sa))
    assert r.status_code == 200, r.text
    ut = _login(TEST_EMAIL, TEST_PW)
    c = {"sa": sa, "orig": orig, "ut": ut, "dpr": [], "leads": []}
    yield c
    # cleanup
    for rid in c["dpr"]:
        requests.delete(f"{API}/ops/dpr/{rid}", headers=H(sa))
    for rid in c["leads"]:
        requests.delete(f"{API}/crm/leads/{rid}", headers=H(sa))
    requests.post(f"{API}/settings/acl", headers=H(sa), json={"value": orig})
    requests.delete(f"{API}/users/{TEST_EMAIL}", headers=H(sa))


def _set(ctx, value):
    r = requests.post(f"{API}/settings/acl", headers=H(ctx["sa"]), json={"value": value})
    assert r.status_code == 200, r.text


def _dpr(ctx, tok):
    rid = f"TEST_dpr_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/ops/dpr", headers=H(tok), json={"id": rid, "project": "TEST_", "date": "2026-10-25", "status": "Draft"})
    if r.status_code == 200:
        ctx["dpr"].append(rid)
    return rid, r


class TestAcl:
    def test_acl_roundtrip(self, ctx):
        val = {"User": {"site": {"v": True, "c": True}}, "_users": {TEST_EMAIL: {"hr": {"c": False}}},
               "_mask": {"User": ["card:kpi-receivable", "col:TDS"]}, "_userMask": {TEST_EMAIL: ["col:Net Payable"]}}
        _set(ctx, val)
        got = requests.get(f"{API}/settings/acl", headers=H(ctx["sa"])).json()["value"]
        assert got == val
        # non-SA can read but cannot write
        assert requests.get(f"{API}/settings/acl", headers=H(ctx["ut"])).status_code == 200
        assert requests.post(f"{API}/settings/acl", headers=H(ctx["ut"]), json={"value": {}}).status_code == 403
        assert requests.post(f"{API}/settings/acl", headers=H(ctx["sa"]), json={"value": "x"}).status_code == 400
        _set(ctx, ctx["orig"])

    def test_default_user_create_ok_delete_403(self, ctx):
        _set(ctx, {})
        rid, r = _dpr(ctx, ctx["ut"])
        assert r.status_code == 200, r.text
        assert r.json()["id"] == rid
        assert requests.delete(f"{API}/ops/dpr/{rid}", headers=H(ctx["ut"])).status_code == 403
        lid = f"TEST_lead_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/crm/leads", headers=H(ctx["ut"]), json={"id": lid, "name": "TEST_ lead"})
        assert r.status_code == 200, r.text
        ctx["leads"].append(lid)
        assert requests.delete(f"{API}/crm/leads/{lid}", headers=H(ctx["ut"])).status_code == 403
        # user cannot approve ops record by default
        r = requests.post(f"{API}/ops/dpr", headers=H(ctx["ut"]), json={"id": rid, "status": "Approved"})
        assert r.status_code == 403

    def test_role_delete_grant(self, ctx):
        _set(ctx, {"User": {"site": {"d": True}}})
        rid, r = _dpr(ctx, ctx["ut"])
        assert r.status_code == 200
        d = requests.delete(f"{API}/ops/dpr/{rid}", headers=H(ctx["ut"]))
        assert d.status_code == 200, d.text
        lst = requests.get(f"{API}/ops/dpr", headers=H(ctx["sa"])).json()
        assert not any(x["id"] == rid for x in lst)
        ctx["dpr"].remove(rid)

    def test_user_override_create_false(self, ctx):
        _set(ctx, {"User": {"site": {"d": True}}, "_users": {TEST_EMAIL: {"site": {"c": False}}}})
        _, r = _dpr(ctx, ctx["ut"])
        assert r.status_code == 403, r.text

    def test_role_client_create_false(self, ctx):
        _set(ctx, {"User": {"client": {"c": False}}})
        r = requests.post(f"{API}/crm/leads", headers=H(ctx["ut"]), json={"id": f"TEST_lead_{uuid.uuid4().hex[:8]}", "name": "x"})
        assert r.status_code == 403, r.text
        # edit of existing lead still allowed (e default true)
        if ctx["leads"]:
            r = requests.post(f"{API}/crm/leads", headers=H(ctx["ut"]), json={"id": ctx["leads"][0], "name": "TEST_ edited"})
            assert r.status_code == 200, r.text

    def test_view_false_backend_get(self, ctx):
        # Informational: does backend block GET when view=false?
        _set(ctx, {"User": {"site": {"v": False}}})
        r = requests.get(f"{API}/ops/dpr", headers=H(ctx["ut"]))
        print("GET /ops/dpr with site.v=false ->", r.status_code)
        _set(ctx, ctx["orig"])
        assert r.status_code == 403, "View permission not enforced on backend GET"

    def test_restore(self, ctx):
        _set(ctx, ctx["orig"])
        assert requests.get(f"{API}/settings/acl", headers=H(ctx["sa"])).json()["value"] == ctx["orig"]
