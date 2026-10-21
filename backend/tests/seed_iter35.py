# Seed/cleanup helper for iteration 35 UI tests. usage: python seed_iter35.py seed|clean|show
import os, sys, requests
from datetime import datetime, timedelta, timezone
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
s = requests.Session()
t = s.post(f"{B}/api/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
s.headers["Authorization"] = f"Bearer {t}"
cmd = sys.argv[1]
if cmd == "seed":
    print(s.post(f"{B}/api/crm/mb", json={"id": "TEST_ui_mb1", "mbNo": "TEST-MB-UI", "itemDesc": "TEST excavation", "qty": 10, "unit": "cum", "step": 2}).status_code)
    print(s.post(f"{B}/api/crm/ra_bills", json={"id": "TEST_ui_ra1", "raNo": "TEST-RA-UI", "net": 2500, "step": 2, "billDate": datetime.now().strftime("%Y-%m-%d")}).status_code)
    print(s.post(f"{B}/api/crm/ra_bills", json={"id": "TEST_ui_ra_od", "raNo": "TEST-RA-OD", "net": 9000, "step": 4, "sentAt": (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()}).status_code)
elif cmd == "show":
    for n in ("mb", "ra_bills"):
        print(n, [(x["id"], x.get("step")) for x in s.get(f"{B}/api/crm/{n}").json()])
    print("expenses", [(e["id"], e.get("refNo"), e.get("step")) for e in s.get(f"{B}/api/snapshot").json()["expenses"]])
elif cmd == "clean":
    for n in ("mb", "ra_bills"):
        for x in s.get(f"{B}/api/crm/{n}").json():
            if x["id"].startswith("TEST_"):
                print("del", n, x["id"], s.delete(f"{B}/api/crm/{n}/{x['id']}").status_code)
    for e in s.get(f"{B}/api/snapshot").json()["expenses"]:
        if str(e["id"]).startswith("TEST_") or str(e.get("vendorName", "")).startswith("TEST") or str(e.get("payeeName", "")).startswith("TEST") or str(e.get("paidToName", "")).startswith("TEST"):
            print("del exp", e["id"], s.delete(f"{B}/api/expenses/{e['id']}").status_code)
