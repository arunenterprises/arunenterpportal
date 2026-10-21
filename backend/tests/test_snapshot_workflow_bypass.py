"""Security probe: can a plain User bypass _enforce_workflow by pushing a bill via /api/snapshot?"""
import uuid
import requests
from test_data_persistence import API, ADMIN, iso


def test_user_snapshot_cannot_approve_bill():
    H = {"Authorization": "Bearer " + requests.post(f"{API}/auth/login", json=ADMIN).json()["token"]}
    email = f"test_iter28b_{uuid.uuid4().hex[:6]}@arunenterprises.online"
    requests.post(f"{API}/auth/register", headers=H, json={"email": email, "password": "TestPass@123", "name": "TEST Bypass", "role": "User"})
    U = {"Authorization": "Bearer " + requests.post(f"{API}/auth/login", json={"identifier": email, "password": "TestPass@123"}).json()["token"]}
    bid = f"TEST_bypass_{uuid.uuid4().hex[:6]}"
    try:
        assert requests.post(f"{API}/bills", headers=U, json={"id": bid, "step": 5}).status_code == 403
        r = requests.post(f"{API}/snapshot", headers=U, json={"bills": [{"id": bid, "step": 5, "approvedByName": "FORGED", "updatedAt": iso()}]})
        got = [b for b in requests.get(f"{API}/bills", headers=H).json() if b.get("id") == bid]
        assert not got or int(got[0].get("step") or 1) < 3, f"BYPASS: user pushed bill to step {got[0].get('step')} via snapshot"
    finally:
        requests.delete(f"{API}/bills/{bid}", headers=H)
        requests.delete(f"{API}/users/{email}", headers=H)
