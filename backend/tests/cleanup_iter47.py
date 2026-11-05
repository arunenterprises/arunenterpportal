# Cleanup for iteration 47 UI-created test data (deletes by id of TEST-named records created in this run only)
import os
import requests

B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
s = requests.Session()
s.headers["Authorization"] = "Bearer " + s.post(f"{B}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
NAMES = {"TEST Core Civil Project UI", "TEST Core OHE Project UI"}
for k in ("core_project", "core_progress", "core_escalation"):
    for d in s.get(f"{B}/ops/{k}").json():
        if d.get("name") in NAMES or d.get("project") in NAMES or d.get("id", "").startswith("TEST_ui_"):
            print(k, d["id"], s.delete(f"{B}/ops/{k}/{d['id']}").status_code)
    print(k, "remaining:", [(d.get("id"), d.get("name") or d.get("project")) for d in s.get(f"{B}/ops/{k}").json()])
for em in ("test_ui_member_ohe@example.com", "test_ui_plain_user@example.com"):
    print(em, s.delete(f"{B}/users/{em}").status_code)
us = s.get(f"{B}/users").json()
us = us.get("users", us) if isinstance(us, dict) else us
print("test users left:", [u["email"] for u in us if u["email"].startswith("test_")])
