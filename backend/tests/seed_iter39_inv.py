# Seed / cleanup TEST_ clients for Client Tax Invoice testing (iteration 39)
import os, sys, requests
BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
tok = requests.post(f"{BASE}/api/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
CLIENTS = [
    {"id": "TEST_cl1", "name": "TEST UP Client", "state": "Uttar Pradesh", "gst": "09AAACG1395D1ZS", "address": "Lucknow", "step": 3},
    {"id": "TEST_cl2", "name": "TEST MH Client", "state": "Maharashtra", "gst": "27AAACG1395D1ZS", "address": "Mumbai", "step": 3},
]
if sys.argv[1:] == ["cleanup"]:
    for inv in requests.get(f"{BASE}/api/crm/invoices", headers=H).json():
        if str(inv.get("clientId", "")).startswith("TEST_") or str(inv.get("id", "")).startswith("TEST_"):
            print("del inv", inv["id"], requests.delete(f"{BASE}/api/crm/invoices/{inv['id']}", headers=H).status_code)
    for c in CLIENTS:
        print("del client", c["id"], requests.delete(f"{BASE}/api/crm/clients/{c['id']}", headers=H).status_code)
else:
    for c in CLIENTS:
        print(requests.post(f"{BASE}/api/crm/clients", headers=H, json=c).status_code)
