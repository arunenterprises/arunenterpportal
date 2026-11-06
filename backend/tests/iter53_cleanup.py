# Iteration 53 cleanup: removes TEST data created by E1 smoke test + testing agent UI runs (by explicit ids / TEST project names)
import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
s = requests.Session()
s.headers["Authorization"] = "Bearer " + s.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
PRJS = ["TEST_PRJ", "TEST_PRJ_UI53"]
UI_IDS = {"ops_proc_cs": ["cs_1793951589725_siehh"], "ops_proc_po": ["po_1793951596619_1"], "ops_core_hr_ticket": ["op_mw4offzdyqhwu"], "ops_stock_count": ["op_mw4oem7ngjymh"]}
for coll in ["ops_proc_invoice", "ops_proc_grn", "ops_proc_po", "ops_proc_cs", "ops_stock_count", "ops_dpr", "ops_indent", "ops_core_hr_ticket"]:
    q = {"$or": [{"id": {"$regex": "^TEST_"}}, {"project": {"$in": PRJS}}, {"id": {"$in": UI_IDS.get(coll, [])}}]}
    for d in list(db[coll].find(q, {"_id": 0, "id": 1})):
        r = s.delete(f"{API}/ops/{coll[4:]}/{d['id']}")
        print(coll, d["id"], r.status_code)
print("fraud_blocks", db.fraud_blocks.delete_many({"project": {"$in": PRJS}}).deleted_count)
print("notifications", db.notifications.delete_many({"path": "/core-dashboard?fraud=1", "body": {"$regex": "TEST_PRJ"}}).deleted_count)
for v in list(db.vendors.find({"firmName": {"$regex": "^TEST_UI53"}}, {"_id": 0, "id": 1})):
    print("vendor", v["id"], s.delete(f"{API}/vendors/{v['id']}").status_code)
print("junk vendors (no id)", db.vendors.delete_many({"id": {"$exists": False}, "firmName": {"$exists": False}}).deleted_count)
fids = [m["id"] for m in db.files_meta.find({"name": {"$in": ["t53.pdf"]}, "by": "arunenterprises2023@gmail.com"}, {"_id": 0, "id": 1})]
print("files", db.files_meta.delete_many({"id": {"$in": fids}}).deleted_count, db.files_chunks.delete_many({"fileId": {"$in": fids}}).deleted_count)
print("req TEST_i53", db.requisitions.delete_many({"title": {"$regex": "^TEST_i53"}}).deleted_count)
