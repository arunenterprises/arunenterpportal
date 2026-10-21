# Client & Revenue (CRM + RA Billing) API tests: /api/crm/{name}, next-number, workflow approval guards
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
NONAPP_EMAIL = "test_crm_nonapprover@example.com"
NONAPP_PASS = "TestPass@123"


def _mongo():
    env = {}
    for line in open("/app/backend/.env"):
        if "=" in line:
            k, v = line.strip().split("=", 1)
            env[k] = v.strip('"')
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def nonapprover(admin):
    db = _mongo()
    db.users.delete_one({"email": NONAPP_EMAIL})
    r = admin.post(f"{BASE_URL}/api/auth/register", json={
        "email": NONAPP_EMAIL, "password": NONAPP_PASS, "name": "TEST CRM User", "role": "User",
        "permissions": {"create": True, "edit": True, "submit": True, "approve": False}})
    assert r.status_code in (200, 201), r.text
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": NONAPP_EMAIL, "password": NONAPP_PASS})
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    yield s
    db.users.delete_one({"email": NONAPP_EMAIL})


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    db = _mongo()
    for c in ["leads", "clients", "comms", "contracts", "mb", "ra_bills", "milestones", "change_orders", "retention_releases"]:
        db[f"crm_{c}"].delete_many({"id": {"$regex": "^TEST_"}})


def rid(p):
    return f"TEST_{p}_{uuid.uuid4().hex[:8]}"


class TestCrmBasics:
    def test_list_all_collections(self, admin):
        for c in ["leads", "clients", "comms", "contracts", "mb", "ra_bills", "milestones", "change_orders", "retention_releases"]:
            r = admin.get(f"{BASE_URL}/api/crm/{c}")
            assert r.status_code == 200, c
            assert isinstance(r.json(), list)
            assert all("_id" not in x for x in r.json())

    def test_unknown_collection_404(self, admin):
        assert admin.get(f"{BASE_URL}/api/crm/hacker").status_code == 404
        assert admin.post(f"{BASE_URL}/api/crm/hacker", json={"id": "TEST_x"}).status_code == 404

    def test_unauth_401(self):
        assert requests.get(f"{BASE_URL}/api/crm/leads").status_code in (401, 403)

    def test_id_required(self, admin):
        r = admin.post(f"{BASE_URL}/api/crm/leads", json={"name": "x"})
        assert r.status_code == 400

    def test_next_number_increments(self, admin):
        a = admin.post(f"{BASE_URL}/api/crm/next-number/ra_testkind_x", json={}).json()["serial"]
        b = admin.post(f"{BASE_URL}/api/crm/next-number/ra_testkind_x", json={}).json()["serial"]
        assert b == a + 1

    def test_lead_create_get_update_delete(self, admin):
        lid = rid("ld")
        r = admin.post(f"{BASE_URL}/api/crm/leads", json={"id": lid, "leadNo": "LD/TEST", "name": "TEST_Lead", "mobile": "999", "status": "New",
                                                           "followUps": [{"id": "f1", "note": "call", "nextDate": "2026-01-30"}]})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Lead" and d["createdByName"] and d["updatedAt"]
        got = [x for x in admin.get(f"{BASE_URL}/api/crm/leads").json() if x["id"] == lid]
        assert got and got[0]["followUps"][0]["note"] == "call"
        r = admin.post(f"{BASE_URL}/api/crm/leads", json={**d, "status": "Won"})
        assert r.json()["status"] == "Won" and r.json()["createdByName"] == d["createdByName"]
        assert admin.delete(f"{BASE_URL}/api/crm/leads/{lid}").json()["deleted"] == 1
        assert not [x for x in admin.get(f"{BASE_URL}/api/crm/leads").json() if x["id"] == lid]


class TestWorkflowGuards:
    def test_admin_approve_sets_approver(self, admin):
        mid = rid("mb")
        admin.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 1, "qty": 5})
        admin.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 2, "qty": 5})
        r = admin.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 3, "qty": 5, "approvedByName": "Fake"})
        assert r.status_code == 200
        assert r.json()["approvedByName"] != "Fake" and r.json()["approvedAt"]

    def test_nonapprover_submit_ok_approve_403(self, nonapprover):
        mid = rid("mb")
        assert nonapprover.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 1}).status_code == 200
        assert nonapprover.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 2}).status_code == 200
        r = nonapprover.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 3})
        assert r.status_code == 403

    def test_nonapprover_cannot_create_preapproved(self, nonapprover):
        r = nonapprover.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": rid("ra"), "step": 3})
        assert r.status_code == 403

    def test_nonapprover_cannot_skip_to_step4(self, nonapprover):
        # RA bill 1 -> 4 / 5 skips GM approval
        bid = rid("ra")
        nonapprover.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "step": 1})
        r = nonapprover.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "step": 5})
        assert r.status_code == 403, f"Non-approver jumped 1->5: {r.status_code}"

    def test_nonapprover_cannot_create_at_step5(self, nonapprover):
        r = nonapprover.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": rid("ra"), "step": 5})
        assert r.status_code == 403, f"Non-approver created step5 bill: {r.status_code}"

    def test_nonapprover_cannot_edit_approved_content(self, admin, nonapprover):
        bid = rid("ra")
        admin.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "step": 2, "net": 100})
        admin.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "step": 3, "net": 100})
        r = nonapprover.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "step": 3, "net": 999999})
        assert r.status_code == 403, f"Non-approver edited approved bill net: {r.status_code}"

    def test_nonapprover_delete_403(self, nonapprover):
        assert nonapprover.delete(f"{BASE_URL}/api/crm/leads/TEST_none").status_code == 403


# Work-order PDF AI parse (Gemini) — /api/crm/parse-work-order (1 AI call only)
class TestWorkOrderParse:
    def test_bad_mime_400(self, admin):
        r = admin.post(f"{BASE_URL}/api/crm/parse-work-order", json={"mimeType": "text/plain", "data": "aGVsbG8="})
        assert r.status_code == 400

    def test_empty_data_400(self, admin):
        r = admin.post(f"{BASE_URL}/api/crm/parse-work-order", json={"mimeType": "application/pdf", "data": ""})
        assert r.status_code == 400

    def test_unauth(self):
        r = requests.post(f"{BASE_URL}/api/crm/parse-work-order", json={"mimeType": "application/pdf", "data": "x"})
        assert r.status_code in (401, 403)

    def test_parse_sample_pdf(self, admin):
        import base64
        if not os.path.exists("/tmp/wo.pdf"):
            pytest.skip("no sample pdf")
        b64 = base64.b64encode(open("/tmp/wo.pdf", "rb").read()).decode()
        r = admin.post(f"{BASE_URL}/api/crm/parse-work-order", json={"fileName": "wo.pdf", "mimeType": "application/pdf",
                                                                       "data": f"data:application/pdf;base64,{b64}"}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        print("PARSED:", d)
        assert "PWD/WO/2026/118" in str(d.get("workOrderNo"))
        assert isinstance(d.get("items"), list) and len(d["items"]) == 3
        for it in d["items"]:
            assert it["description"] and float(it["qty"]) > 0 and float(it["rate"]) > 0 and it["unit"]


# Clients workflow (iteration 31): clients now in _CRM_WF
class TestClientWorkflow:
    def test_admin_client_3_step(self, admin):
        cid = rid("cl")
        r = admin.post(f"{BASE_URL}/api/crm/clients", json={"id": cid, "tempRefId": "TMP-CL-000001", "step": 1, "name": "TEST_Client", "mobile": "9999999999"})
        assert r.status_code == 200 and r.json()["step"] == 1
        r = admin.post(f"{BASE_URL}/api/crm/clients", json={**r.json(), "step": 2, "checkedByName": "Checker"})
        assert r.json()["step"] == 2 and not r.json().get("approvedAt")
        r = admin.post(f"{BASE_URL}/api/crm/clients", json={**r.json(), "step": 3, "clientCode": "CL/TEST", "approvedByName": "Fake"})
        d = r.json()
        assert d["step"] == 3 and d["clientCode"] == "CL/TEST" and d["approvedByName"] != "Fake" and d["approvedAt"]
        got = [x for x in admin.get(f"{BASE_URL}/api/crm/clients").json() if x["id"] == cid][0]
        assert got["tempRefId"] == "TMP-CL-000001" and got["step"] == 3

    def test_nonapprover_client_step3_403(self, nonapprover):
        cid = rid("cl")
        assert nonapprover.post(f"{BASE_URL}/api/crm/clients", json={"id": cid, "step": 1, "name": "TEST_C2"}).status_code == 200
        assert nonapprover.post(f"{BASE_URL}/api/crm/clients", json={"id": cid, "step": 2, "name": "TEST_C2"}).status_code == 200
        assert nonapprover.post(f"{BASE_URL}/api/crm/clients", json={"id": cid, "step": 3, "name": "TEST_C2"}).status_code == 403
        assert nonapprover.post(f"{BASE_URL}/api/crm/clients", json={"id": rid("cl"), "step": 3, "name": "TEST_C3"}).status_code == 403

    def test_client_next_number(self, admin):
        a = admin.post(f"{BASE_URL}/api/crm/next-number/client", json={}).json()["serial"]
        b = admin.post(f"{BASE_URL}/api/crm/next-number/client", json={}).json()["serial"]
        assert b == a + 1


# Retention release (regression: async-generator sum() caused 500)
class TestRetentionRelease:
    def test_release_within_and_over_balance(self, admin, nonapprover):
        ct = rid("ct")
        admin.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": rid("ra"), "contractId": ct, "step": 2, "retentionAmt": 500})
        bid = rid("ra")
        admin.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "contractId": ct, "step": 2, "retentionAmt": 300})
        admin.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "contractId": ct, "step": 3, "retentionAmt": 300})
        r = admin.post(f"{BASE_URL}/api/crm/retention_releases", json={"id": rid("rr"), "contractId": ct, "amount": 200})
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 200
        r = admin.post(f"{BASE_URL}/api/crm/retention_releases", json={"id": rid("rr"), "contractId": ct, "amount": 150})
        assert r.status_code == 400
        assert nonapprover.post(f"{BASE_URL}/api/crm/retention_releases", json={"id": rid("rr"), "contractId": ct, "amount": 1}).status_code == 403
