# Iter55: Projects master / Contracts master (Single Source of Truth from crm_contracts)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text[:200]}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        ss.headers.update({"Authorization": f"Bearer {tok}"})
    return ss


def test_unauth_master():
    assert requests.get(f"{BASE_URL}/api/projects/master").status_code in (401, 403)
    assert requests.get(f"{BASE_URL}/api/contracts/master").status_code in (401, 403)


def test_projects_master_contract_row(s):
    r = s.get(f"{BASE_URL}/api/projects/master")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    naini = [x for x in rows if x.get("name") == "TEST_Naini Yard"]
    assert len(naini) == 1, naini
    n = naini[0]
    assert n["source"] == "contract"
    assert n["contractNo"] == "CT/TEST/77"
    assert n["tdsPct"] == 2
    assert n["siteLocation"] == "Naini"
    assert n["contractValue"] == 500000
    assert n["id"] == "crm-TEST_c1"
    it = n["items"][0]
    assert it["description"] == "Earthwork" and it["qty"] == 100 and it["rate"] == 250 and it["gstPct"] == 18
    assert all("_id" not in x for x in rows)


def test_projects_master_core_row(s):
    rows = s.get(f"{BASE_URL}/api/projects/master").json()
    core = [x for x in rows if x.get("name") == "TEST_Old Core Project"]
    assert len(core) == 1
    assert core[0]["source"] == "core"
    assert core[0]["id"].startswith("core-")


def test_projects_master_no_dup_names(s):
    rows = s.get(f"{BASE_URL}/api/projects/master").json()
    names = [x["name"].strip().lower() for x in rows]
    assert len(names) == len(set(names))


def test_contracts_master(s):
    r = s.get(f"{BASE_URL}/api/contracts/master")
    assert r.status_code == 200
    c = [x for x in r.json() if x.get("id") == "TEST_c1"]
    assert len(c) == 1
    c = c[0]
    assert c["contractNo"] == "CT/TEST/77"
    assert c["startDate"] and c["completionDate"]
    assert c["items"][0]["amount"] == 25000
    print(c)
