# Iteration 48: Core Committee access retest — default-deny for non-core roles, member discipline filter, delete discipline check
import copy
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
TAG = uuid.uuid4().hex[:6]
PWD = "Test@1234"
ROLES = ["User", "HR", "Accounts", "Viewer", "Admin", "GM", "Member OHE"]
EMAILS = {r: f"test_i48_{r.replace(' ', '').lower()}_{TAG}@example.com" for r in ROLES}
EMAILS["core_all"] = f"test_i48_coreall_{TAG}@example.com"
IDS = {"core_project": [], "core_progress": [], "core_escalation": []}
KINDS = list(IDS.keys())
CIVIL_ID = f"TEST_i48_civil_{TAG}"
OHE_ID = f"TEST_i48_ohe_{TAG}"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    # seed core records in each kind
    for k in KINDS:
        for rid, disc in ((f"{CIVIL_ID}_{k}", "CIVIL"), (f"{OHE_ID}_{k}", "OHE")):
            r = s.post(f"{BASE_URL}/api/ops/{k}", json={"id": rid, "discipline": disc, "name": f"TEST i48 {disc}", "project": f"TEST i48 {disc}"})
            assert r.status_code == 200, r.text
            IDS[k].append(rid)
    for key, em in EMAILS.items():
        role = "Member OHE" if key == "core_all" else key
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": em, "name": f"TEST i48 {key}", "password": PWD, "role": role})
        assert r.status_code == 200, f"{key}: {r.text}"
    r = s.patch(f"{BASE_URL}/api/users/{EMAILS['core_all']}/core-access", json={"core_all": True})
    assert r.status_code == 200
    yield s
    for k, ids in IDS.items():
        for rid in ids:
            s.delete(f"{BASE_URL}/api/ops/{k}/{rid}")
    for em in EMAILS.values():
        s.delete(f"{BASE_URL}/api/users/{em}")


_sessions = {}


def _login(admin, key):
    if key in _sessions:
        return _sessions[key]
    em = EMAILS[key]
    r = admin.post(f"{BASE_URL}/api/admin/users/{em}/otp-reset")
    assert r.status_code == 200, r.text
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": em, "password": PWD})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    _sessions[key] = s
    return s


def _mine(lst):
    return {x["id"] for x in lst if isinstance(x, dict) and x.get("id", "").endswith(tuple(f"_{k}" for k in KINDS)) and TAG in x["id"]}


@pytest.mark.parametrize("role", ["User", "HR", "Accounts", "Viewer", "Admin"])
def test_non_core_role_denied(admin, role):
    s = _login(admin, role)
    for k in KINDS:
        r = s.get(f"{BASE_URL}/api/ops/{k}")
        assert r.status_code in (200, 403), r.text
        if r.status_code == 200:
            assert r.json() == [], f"{role} GET {k} leaked {len(r.json())} rows"
        r = s.post(f"{BASE_URL}/api/ops/{k}", json={"id": f"TEST_i48_bad_{role}_{k}_{TAG}", "discipline": "CIVIL", "name": "TEST bad"})
        assert r.status_code == 403, f"{role} POST {k}: {r.status_code} {r.text}"
        r = s.delete(f"{BASE_URL}/api/ops/{k}/{CIVIL_ID}_{k}")
        assert r.status_code == 403, f"{role} DELETE {k}: {r.status_code} {r.text}"
    # confirm nothing got created/deleted
    for k in KINDS:
        ids = {x["id"] for x in admin.get(f"{BASE_URL}/api/ops/{k}").json()}
        assert f"{CIVIL_ID}_{k}" in ids
        assert f"TEST_i48_bad_{role}_{k}_{TAG}" not in ids


def test_superadmin_sees_all(admin):
    for k in KINDS:
        ids = _mine(admin.get(f"{BASE_URL}/api/ops/{k}").json())
        assert {f"{CIVIL_ID}_{k}", f"{OHE_ID}_{k}"} <= ids


def test_gm_sees_all_and_can_create(admin):
    s = _login(admin, "GM")
    for k in KINDS:
        ids = _mine(s.get(f"{BASE_URL}/api/ops/{k}").json())
        assert {f"{CIVIL_ID}_{k}", f"{OHE_ID}_{k}"} <= ids, k
    rid = f"TEST_i48_gm_{TAG}"
    r = s.post(f"{BASE_URL}/api/ops/core_project", json={"id": rid, "discipline": "PSI", "name": "TEST i48 GM"})
    assert r.status_code == 200, r.text
    IDS["core_project"].append(rid)


def test_member_ohe_only_ohe(admin):
    s = _login(admin, "Member OHE")
    for k in KINDS:
        lst = s.get(f"{BASE_URL}/api/ops/{k}").json()
        assert {x.get("discipline") for x in lst} <= {"OHE"}, k
        assert f"{OHE_ID}_{k}" in _mine(lst)
    r = s.post(f"{BASE_URL}/api/ops/core_project", json={"id": f"TEST_i48_mbad_{TAG}", "discipline": "CIVIL", "name": "x"})
    assert r.status_code == 403


def test_member_core_all_sees_all(admin):
    s = _login(admin, "core_all")
    for k in KINDS:
        ids = _mine(s.get(f"{BASE_URL}/api/ops/{k}").json())
        assert {f"{CIVIL_ID}_{k}", f"{OHE_ID}_{k}"} <= ids, k


def test_member_delete_other_discipline_403_even_with_delete_acl(admin):
    """Temporarily grant Member OHE per-user site delete; CIVIL delete must still be 403; restore ACL after."""
    orig = admin.get(f"{BASE_URL}/api/settings/acl").json()["value"]
    new = copy.deepcopy(orig)
    em = EMAILS["Member OHE"].lower()
    new.setdefault("_users", {}).setdefault(em, {}).setdefault("site", {})["d"] = True
    try:
        assert admin.post(f"{BASE_URL}/api/settings/acl", json={"value": new}).status_code == 200
        s = _login(admin, "Member OHE")
        r = s.delete(f"{BASE_URL}/api/ops/core_project/{CIVIL_ID}_core_project")
        assert r.status_code == 403, r.text
        ids = {x["id"] for x in admin.get(f"{BASE_URL}/api/ops/core_project").json()}
        assert f"{CIVIL_ID}_core_project" in ids
        # own discipline delete allowed with ACL
        rid = f"TEST_i48_ohe_del_{TAG}"
        assert s.post(f"{BASE_URL}/api/ops/core_project", json={"id": rid, "discipline": "OHE", "name": "TEST del"}).status_code == 200
        IDS["core_project"].append(rid)
        r = s.delete(f"{BASE_URL}/api/ops/core_project/{rid}")
        assert r.status_code == 200, r.text
    finally:
        assert admin.post(f"{BASE_URL}/api/settings/acl", json={"value": orig}).status_code == 200
        assert admin.get(f"{BASE_URL}/api/settings/acl").json()["value"] == orig
