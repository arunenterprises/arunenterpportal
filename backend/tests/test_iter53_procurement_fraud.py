# Iteration 53: Procurement Module 4 + Anti-Fraud Engine (PO->GRN, 3-way invoice match, bill-locks, stock reconciliation blocks, chunked files, cron)
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
PRJ = f"TEST_PRJ53_{TAG}"
DATE = "2026-11-07"
PWD = "Test@1234"
ROLES = ["GM", "Member Procurement", "User"]
EMAILS = {r: f"test_i53_{''.join(c for c in r.lower() if c.isalnum())}_{TAG}@example.com" for r in ROLES}
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
IDS = {k: [] for k in ("proc_po", "proc_grn", "proc_invoice", "dpr", "stock_count", "indent")}
FILES, REQS = [], []
_S = {}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    for role, em in EMAILS.items():
        r = s.post(f"{API}/auth/register", json={"email": em, "name": f"TEST i53 {role}", "password": PWD, "role": role})
        assert r.status_code == 200, f"{role}: {r.text}"
    yield s
    for k, ids in IDS.items():
        for i in reversed(ids):  # API delete rolls counters back
            s.delete(f"{API}/ops/{k}/{i}")
        mdb[f"ops_{k}"].delete_many({"id": {"$in": ids}})
    mdb.fraud_blocks.delete_many({"project": PRJ})
    mdb.notifications.delete_many({"to": {"$in": list(EMAILS.values())}})
    mdb.files_meta.delete_many({"id": {"$in": FILES}})
    mdb.files_chunks.delete_many({"fileId": {"$in": FILES}})
    mdb.requisitions.delete_many({"id": {"$in": REQS}})
    for em in EMAILS.values():
        s.delete(f"{API}/users/{em}")


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


def ops(s, kind, **kw):
    kw.setdefault("id", f"TEST_{kind}_{uuid.uuid4().hex[:8]}")
    if kw["id"] not in IDS[kind]:
        IDS[kind].append(kw["id"])
    return s.post(f"{API}/ops/{kind}", json=kw)


@pytest.fixture(scope="module")
def po(admin):
    r = ops(admin, "proc_po", project=PRJ, vendorCode="TESTV53", material="TEST_Cement53", unit="Bag", qty=100, rate=400, gstPct=18, date=DATE, status="Approved")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "Approved" and d["permNo"] == d["docNo"]
    return d


# --- GRN on PO
def test_grn_requires_approved_po(admin):
    d = ops(admin, "proc_po", project=PRJ, vendorCode="TESTV53", material="X", qty=10, rate=1, status="Draft").json()
    r = ops(admin, "proc_grn", poNo=d["docNo"], receivedQty=5, qcStatus="Pass", date=DATE, project=PRJ)
    assert r.status_code == 400
    r = ops(admin, "proc_grn", poNo="NOPE/123", receivedQty=5, qcStatus="Pass", date=DATE)
    assert r.status_code == 400


def test_grn_autofill_qc_and_cumulative(admin, po):
    r = ops(admin, "proc_grn", poNo=po["docNo"], receivedQty=30, qcStatus="Under Lab Test", date=DATE, project=PRJ)
    assert r.status_code == 200, r.text
    g = r.json()
    assert g["vendorCode"] == "TESTV53" and g["material"] == "TEST_Cement53" and g["unit"] == "Bag" and g["acceptedQty"] == 0
    r = ops(admin, "proc_grn", poNo=po["docNo"], receivedQty=60, qcStatus="Pass", date=DATE, project=PRJ, status="Approved")
    assert r.status_code == 200, r.text
    assert r.json()["acceptedQty"] == 60
    po.setdefault("grn", r.json())
    # 60 + 50 > 100 -> reject
    r = ops(admin, "proc_grn", poNo=po["docNo"], receivedQty=50, qcStatus="Pass", date=DATE, project=PRJ)
    assert r.status_code == 400 and "PO qty" in r.json()["detail"]
    # 60 + 40 = 100 ok
    r = ops(admin, "proc_grn", poNo=po["docNo"], receivedQty=40, qcStatus="Pass", date=DATE, project=PRJ)
    assert r.status_code == 200, r.text


# --- 3-way invoice
def test_three_way_invoice(admin, po):
    grn = po["grn"]
    bad = ops(admin, "proc_invoice", poNo=po["docNo"], grnNo=grn["docNo"], vendorCode="TESTV53", billNo=f"TB{TAG}", invoiceQty=60, invoiceAmount=1000, status="Approved")
    assert bad.status_code == 423 and "LOCKED" in bad.json()["detail"]
    sub = ops(admin, "proc_invoice", poNo=po["docNo"], grnNo=grn["docNo"], vendorCode="TESTV53", billNo=f"TBX{TAG}", invoiceQty=60, invoiceAmount=1000, status="Submitted")
    assert sub.status_code == 200 and sub.json()["paymentLocked"] is True and sub.json()["matchStatus"].startswith("MISMATCH")
    mdb.ops_proc_invoice.delete_one({"id": sub.json()["id"]})
    amt = round(60 * 400 * 1.18, 2)
    ok = ops(admin, "proc_invoice", poNo=po["docNo"], grnNo=grn["docNo"], vendorCode="testv53", billNo=f"TB{TAG}", invoiceQty=60, invoiceAmount=amt, status="Approved")
    assert ok.status_code == 200, ok.text
    assert ok.json()["matchStatus"] == "MATCHED" and ok.json()["expectedAmount"] == amt
    dup = ops(admin, "proc_invoice", poNo=po["docNo"], grnNo=grn["docNo"], vendorCode="TESTV53", billNo=f"TB2{TAG}", invoiceQty=60, invoiceAmount=amt, status="Submitted")
    assert dup.status_code == 200
    assert any("double billing" in i for i in dup.json()["matchIssues"])
    # bill-locks
    r = admin.post(f"{API}/fraud/bill-locks", json={"bills": [
        {"vendorCode": "TESTV53", "billNo": f"TB{TAG}", "createdAt": "2026-11-07T00:00:00"},
        {"vendorCode": "TESTV53", "billNo": f"TB2{TAG}", "createdAt": "2026-11-07T00:00:00"},
        {"vendorCode": "TESTV53", "billNo": f"NEW{TAG}", "createdAt": "2026-11-06T10:00:00"},
        {"vendorCode": "TESTV53", "billNo": f"OLD{TAG}", "createdAt": "2026-11-05T23:00:00"}]})
    assert r.status_code == 200
    locks = r.json()
    assert f"TESTV53|TB{TAG}" not in locks
    assert f"TESTV53|TB2{TAG}" in locks and "double billing" in locks[f"TESTV53|TB2{TAG}"]
    assert f"TESTV53|NEW{TAG}" in locks and "3-Way" in locks[f"TESTV53|NEW{TAG}"]
    assert f"TESTV53|OLD{TAG}" not in locks


# --- stock reconciliation + blocks
def test_stock_variance_block_flow(admin):
    gm, mp, usr = sess(admin, "GM"), sess(admin, "Member Procurement"), sess(admin, "User")
    po2 = ops(admin, "proc_po", project=PRJ, vendorCode="TESTV53", material="TEST_Sand53", qty=100, rate=10, status="Approved").json()
    assert ops(admin, "proc_grn", poNo=po2["docNo"], receivedQty=50, qcStatus="Pass", date=DATE, project=PRJ).status_code == 200
    assert ops(admin, "dpr", project=PRJ, date=DATE, consumedMaterial="test_sand53", consumedQty=10).status_code == 200
    r = ops(admin, "stock_count", project=PRJ, date=DATE, material="TEST_Sand53", openingStock=20, physicalClosing=40)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["grnQty"] == 50 and s["consumedQty"] == 10 and s["bookClosing"] == 60
    assert s["variancePct"] == 33.33 and s["fraudFlag"] == "RED ALERT"
    blk = mdb.fraud_blocks.find_one({"stockId": s["id"], "active": True})
    assert blk
    for role in ("GM", "Member Procurement"):
        assert mdb.notifications.find_one({"to": EMAILS[role], "title": {"$regex": "RED ALERT"}}), role
    assert any(b["id"] == blk["id"] for b in admin.get(f"{API}/fraud/blocks").json())
    # indent blocked for User / Member Procurement, allowed for GM
    assert ops(usr, "indent", project=PRJ, material="Sand", qty=5).status_code == 423
    assert ops(mp, "indent", project=PRJ, material="Sand", qty=5).status_code == 423
    assert ops(gm, "indent", project=PRJ, material="Sand", qty=5).status_code == 200
    assert ops(usr, "indent", project=f"{PRJ}_other", material="Sand", qty=5).status_code == 200
    # material requisition blocked
    r = usr.post(f"{API}/requisitions", json={"rtype": "Material", "title": "TEST_i53 req", "project": PRJ, "discipline": "CIVIL", "amount": 100})
    if r.status_code == 200:
        REQS.append(r.json()["id"])
    assert r.status_code == 423
    # reconcile perms
    assert usr.post(f"{API}/fraud/reconcile").status_code == 403
    r = mp.post(f"{API}/fraud/reconcile")
    assert r.status_code == 200 and r.json()["activeBlocks"] >= 1
    # release perms
    assert mp.post(f"{API}/fraud/blocks/{blk['id']}/release", json={"remark": "checked ok"}).status_code == 403
    assert gm.post(f"{API}/fraud/blocks/{blk['id']}/release", json={"remark": "ok"}).status_code == 400
    assert gm.post(f"{API}/fraud/blocks/{blk['id']}/release", json={"remark": "Physical recount ok"}).status_code == 200
    assert gm.post(f"{API}/fraud/blocks/{blk['id']}/release", json={"remark": "Physical recount ok"}).status_code == 404
    assert ops(usr, "indent", project=PRJ, material="Sand", qty=5).status_code == 200


def test_stock_auto_clear(admin):
    r = ops(admin, "stock_count", project=PRJ, date="2026-11-08", material="TEST_Brick53", openingStock=100, physicalClosing=50)
    sid = r.json()["id"]
    assert r.json()["fraudFlag"] == "RED ALERT"
    assert mdb.fraud_blocks.find_one({"stockId": sid, "active": True})
    r = ops(admin, "stock_count", id=sid, project=PRJ, date="2026-11-08", material="TEST_Brick53", openingStock=100, physicalClosing=98)
    assert r.json()["fraudFlag"] == "OK"
    assert mdb.fraud_blocks.find_one({"stockId": sid})["active"] is False


# --- files + cron + gate
def test_chunk_upload_and_get(admin):
    raw = b"%PDF-1.4 hello " * 100
    half = len(raw) // 2
    r = admin.post(f"{API}/files/chunk", json={"index": 0, "total": 2, "name": "t.pdf", "size": len(raw), "type": "application/pdf", "data": base64.b64encode(raw[:half]).decode()})
    assert r.status_code == 200 and r.json()["done"] is False
    fid = r.json()["fileId"]
    FILES.append(fid)
    assert admin.get(f"{API}/files/{fid}").status_code == 404  # incomplete
    r = admin.post(f"{API}/files/chunk", json={"fileId": fid, "index": 1, "total": 2, "data": base64.b64encode(raw[half:]).decode()})
    assert r.status_code == 200 and r.json()["done"] is True
    g = admin.get(f"{API}/files/{fid}")
    assert g.status_code == 200 and g.content == raw and g.headers["content-type"].startswith("application/pdf")
    assert admin.post(f"{API}/files/chunk", json={"index": 0, "total": 1, "size": 26 * 1024 * 1024, "type": "application/pdf", "data": ""}).status_code == 400
    assert admin.post(f"{API}/files/chunk", json={"index": 0, "total": 1, "size": 10, "type": "text/html", "data": ""}).status_code == 400


def test_cron_and_gate(admin):
    assert requests.post(f"{API}/cron/stock-reconcile", json={}).status_code == 401
    assert requests.post(f"{API}/cron/stock-reconcile", json={}, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert admin.get(f"{API}/requisitions/nope_{TAG}/gate").status_code == 404
    r = admin.post(f"{API}/requisitions", json={"rtype": "Finance", "title": "TEST_i53 gate", "amount": 4000000})
    assert r.status_code == 200, r.text
    REQS.append(r.json()["id"])
    g = admin.get(f"{API}/requisitions/{r.json()['id']}/gate").json()
    assert g["status"] == "Discussion" and g["concluded"] is False and g["reqNo"] == r.json()["reqNo"]
