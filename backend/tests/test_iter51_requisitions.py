# Iteration 51: Centralized Requisitions (Material / Finance / Machinery), role-based stage approvals, Discussion Window (>30L), evidence files
import os
import base64
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
TAG = uuid.uuid4().hex[:6]
PWD = "Test@1234"
ROLES = ["GM", "Sr. Site Operation Manager", "Member Civil", "Purchase Manager", "Accounts Manager", "Member Financial", "User", "Member Procurement"]
EMAILS = {r: f"test_i51_{''.join(c for c in r.lower() if c.isalnum())}_{TAG}@example.com" for r in ROLES}
REQ_IDS = []
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
COUNTER_EXISTED = mdb.counters.find_one({"key": "requisitions"}) is not None
_S = {}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    for role, em in EMAILS.items():
        r = s.post(f"{API}/auth/register", json={"email": em, "name": f"TEST i51 {role}", "password": PWD, "role": role})
        assert r.status_code == 200, f"{role}: {r.text}"
    yield s
    mdb.requisitions.delete_many({"id": {"$in": REQ_IDS}})
    mdb.req_files.delete_many({"reqId": {"$in": REQ_IDS}})
    mdb.notifications.delete_many({"path": {"$in": [f"/requisitions?id={i}" for i in REQ_IDS]}})
    mdb.notifications.delete_many({"to": {"$in": list(EMAILS.values())}})
    for em in EMAILS.values():
        s.delete(f"{API}/users/{em}")
    if not COUNTER_EXISTED and not mdb.requisitions.find_one({}):
        mdb.counters.delete_one({"key": "requisitions"})


def sess(admin, role):
    if role in _S:
        return _S[role]
    em = EMAILS[role]
    assert admin.post(f"{API}/admin/users/{em}/otp-reset").status_code == 200
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": em, "password": PWD})
    assert r.status_code == 200 and r.json().get("token"), r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    _S[role] = s
    return s


def create(s, **kw):
    r = s.post(f"{API}/requisitions", json=kw)
    if r.status_code == 200:
        REQ_IDS.append(r.json()["id"])
    return r


def notif_titles(role):
    return [n.get("title", "") for n in mdb.notifications.find({"to": EMAILS[role]}, {"_id": 0, "title": 1})]


# --- role assignment
def test_manager_roles_assignable(admin):
    u = mdb.users.find_one({"email": EMAILS["Purchase Manager"]}, {"_id": 0, "role": 1})
    assert u["role"] == "Purchase Manager"
    r = admin.patch(f"{API}/users/{EMAILS['User']}/role", json={"role": "Accounts Manager"})
    assert r.status_code == 200 and r.json()["role"] == "Accounts Manager", r.text
    r = admin.patch(f"{API}/users/{EMAILS['User']}/role", json={"role": "User"})
    assert r.status_code == 200


# --- create validation
def test_create_validation(admin):
    u = sess(admin, "User")
    assert create(u, rtype="Material", title="ab", discipline="CIVIL").status_code == 400
    assert create(u, rtype="Material", title="TEST_i51 nodisc").status_code == 400
    assert create(u, rtype="Finance", title="TEST_i51 fin zero", amount=0).status_code == 400
    assert create(u, rtype="Bogus", title="TEST_i51 bogus").status_code == 400
    assert create(u, rtype="Machinery", title="TEST_i51 neg", amount=-5).status_code == 400


# --- full Material flow
def test_material_civil_flow(admin):
    u = sess(admin, "User")
    r = create(u, rtype="Material", title="TEST_i51 Cement", discipline="CIVIL", amount=50000, project="TEST")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["reqNo"].startswith("AE/REQ/") and d["reqNo"].endswith(("/2526", "/2627"))
    assert d["status"] == "Pending" and not d["locked"]
    assert [s["role"] for s in d["stages"]] == ["Sr. Site Operation Manager", "Member Civil", "Purchase Manager", "GM"]
    rid = d["id"]
    ssom = sess(admin, "Sr. Site Operation Manager")
    inbox = ssom.get(f"{API}/requisitions?scope=inbox").json()
    assert any(x["id"] == rid for x in inbox)
    assert any(d["reqNo"] in t for t in notif_titles("Sr. Site Operation Manager"))
    # wrong role
    assert sess(admin, "Purchase Manager").post(f"{API}/requisitions/{rid}/action", json={"action": "approve"}).status_code == 403
    # SuperAdmin cannot approve
    assert admin.post(f"{API}/requisitions/{rid}/action", json={"action": "approve"}).status_code == 403
    for role in ["Sr. Site Operation Manager", "Member Civil", "Purchase Manager"]:
        r = sess(admin, role).post(f"{API}/requisitions/{rid}/action", json={"action": "approve"})
        assert r.status_code == 200, f"{role}: {r.text}"
    assert any(d["reqNo"] in t for t in notif_titles("Member Civil"))
    assert any(d["reqNo"] in t for t in notif_titles("Purchase Manager"))
    assert any(d["reqNo"] in t for t in notif_titles("GM"))
    r = sess(admin, "GM").post(f"{API}/requisitions/{rid}/action", json={"action": "approve"})
    assert r.status_code == 200 and r.json()["status"] == "Approved"
    assert any("Approved" in t and d["reqNo"] in t for t in notif_titles("User"))
    # closed -> 409
    assert sess(admin, "GM").post(f"{API}/requisitions/{rid}/action", json={"action": "approve"}).status_code == 409


def test_creator_cannot_approve_and_reject(admin):
    ssom = sess(admin, "Sr. Site Operation Manager")
    r = create(ssom, rtype="Material", title="TEST_i51 Own", discipline="OHE", amount=0)
    assert r.status_code == 200
    d = r.json()
    assert [s["role"] for s in d["stages"]] == ["Sr. Site Operation Manager", "Member OHE", "Purchase Manager"]
    assert ssom.post(f"{API}/requisitions/{d['id']}/action", json={"action": "approve"}).status_code == 403
    u = sess(admin, "User")
    r = create(u, rtype="Material", title="TEST_i51 Rej", discipline="CIVIL", amount=100)
    rid = r.json()["id"]
    assert ssom.post(f"{API}/requisitions/{rid}/action", json={"action": "reject", "remarks": "no"}).status_code == 400
    r = ssom.post(f"{API}/requisitions/{rid}/action", json={"action": "reject", "remarks": "TEST bad qty"})
    assert r.status_code == 200 and r.json()["status"] == "Rejected"
    assert any("Rejected" in t for t in notif_titles("User"))


def test_machinery_stages(admin):
    r = create(sess(admin, "User"), rtype="Machinery", title="TEST_i51 JCB", amount=1000)
    assert r.status_code == 200
    assert [s["role"] for s in r.json()["stages"]] == ["Sr. Site Operation Manager", "Member Procurement", "GM"]


# --- Finance > 30L Discussion Window
def test_finance_discussion_flow(admin):
    u = sess(admin, "User")
    r = create(u, rtype="Finance", title="TEST_i51 Big Pay", amount=4000000)
    assert r.status_code == 200
    d = r.json()
    rid = d["id"]
    assert d["status"] == "Discussion" and d["locked"] is True
    assert [s["role"] for s in d["stages"]] == ["Accounts Manager", "Member Financial", "GM"]
    gm, am, mf = sess(admin, "GM"), sess(admin, "Accounts Manager"), sess(admin, "Member Financial")
    assert gm.post(f"{API}/requisitions/{rid}/action", json={"action": "approve"}).status_code == 409
    assert am.post(f"{API}/requisitions/{rid}/action", json={"action": "approve"}).status_code == 409
    # comment before topic -> 409
    assert am.post(f"{API}/requisitions/{rid}/discussion/comment", json={"text": "early"}).status_code == 409
    # non-GM setup -> 403 ; GM bad payload -> 400
    assert admin.post(f"{API}/requisitions/{rid}/discussion", json={"topic": "x topic", "departments": ["Accounts Manager"]}).status_code == 403
    assert gm.post(f"{API}/requisitions/{rid}/discussion", json={"topic": "", "departments": ["Accounts Manager"]}).status_code == 400
    assert gm.post(f"{API}/requisitions/{rid}/discussion", json={"topic": "TEST topic", "departments": []}).status_code == 400
    r = gm.post(f"{API}/requisitions/{rid}/discussion", json={"topic": "TEST_i51 Budget", "departments": ["Accounts Manager"]})
    assert r.status_code == 200 and r.json()["discussion"]["departments"] == ["Accounts Manager"]
    assert any(x["id"] == rid for x in am.get(f"{API}/requisitions?scope=inbox").json())
    # conclude before any decision -> 409
    assert gm.post(f"{API}/requisitions/{rid}/discussion/conclude", json={"summary": "TEST summary"}).status_code == 409
    # non-assigned -> 403
    assert mf.post(f"{API}/requisitions/{rid}/discussion/comment", json={"text": "TEST mf"}).status_code == 403
    r = am.post(f"{API}/requisitions/{rid}/discussion/comment", json={"text": "TEST_i51 ok within limit", "decision": "Approve", "amount": 3500000})
    assert r.status_code == 200 and r.json()["discussion"]["comments"][0]["amount"] == 3500000
    assert gm.post(f"{API}/requisitions/{rid}/discussion/conclude", json={"summary": "x"}).status_code == 400
    r = gm.post(f"{API}/requisitions/{rid}/discussion/conclude", json={"summary": "TEST_i51 go ahead"})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "Pending" and d["stage"] == 0 and d["locked"] is False and d["discussion"]["concluded"]
    r = am.post(f"{API}/requisitions/{rid}/action", json={"action": "approve"})
    assert r.status_code == 200 and r.json()["stage"] == 1


# --- evidence files
def test_files(admin):
    u = sess(admin, "User")
    rid = create(u, rtype="Material", title="TEST_i51 Files", discipline="PSI", amount=0).json()["id"]
    pdf = base64.b64encode(b"%PDF-1.4 TEST").decode()
    r = u.post(f"{API}/requisitions/{rid}/files", json={"name": "t.pdf", "type": "application/pdf", "data": pdf})
    assert r.status_code == 200, r.text
    fid = r.json()["id"]
    assert u.post(f"{API}/requisitions/{rid}/files", json={"name": "t.png", "type": "image/png", "data": pdf}).status_code == 200
    assert u.post(f"{API}/requisitions/{rid}/files", json={"name": "t.txt", "type": "text/plain", "data": pdf}).status_code == 400
    big = base64.b64encode(b"0" * (2 * 1024 * 1024 + 100)).decode()
    assert u.post(f"{API}/requisitions/{rid}/files", json={"name": "b.pdf", "type": "application/pdf", "data": big}).status_code == 400
    g = u.get(f"{API}/requisitions/{rid}/files/{fid}")
    assert g.status_code == 200 and g.json()["data"] == pdf and g.json()["name"] == "t.pdf"
    # unrelated role (Member Financial not in Material stages) upload -> 403
    assert sess(admin, "Member Financial").post(f"{API}/requisitions/{rid}/files", json={"name": "t.pdf", "type": "application/pdf", "data": pdf}).status_code == 403


def test_file_download_acl(admin):
    """Unrelated user should not download another requisition's evidence (code-review check)."""
    u = sess(admin, "User")
    rid = create(u, rtype="Material", title="TEST_i51 FileAcl", discipline="CIVIL", amount=0).json()["id"]
    fid = u.post(f"{API}/requisitions/{rid}/files", json={"name": "t.pdf", "type": "application/pdf", "data": base64.b64encode(b"x").decode()}).json()["id"]
    r = sess(admin, "Member Financial").get(f"{API}/requisitions/{rid}/files/{fid}")
    assert r.status_code == 403, f"unrelated user downloaded file: {r.status_code}"


def test_scopes(admin):
    u = sess(admin, "User")
    assert u.get(f"{API}/requisitions?scope=all").status_code == 403
    mine = u.get(f"{API}/requisitions?scope=mine").json()
    assert mine and all(x["requestedBy"] == EMAILS["User"] for x in mine)
    assert sess(admin, "GM").get(f"{API}/requisitions?scope=all").status_code == 200
