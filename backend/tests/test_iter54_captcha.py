# Iter54: Login CAPTCHA (non-SA mandatory, SA exempt, one-time use)
import os, base64, hashlib, uuid, asyncio
from datetime import datetime, timezone, timedelta
import pytest, requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
NON_SA = ("komal.srivastava@arunenterprises.online", "Komal2026@12")
SA = ("arunenterprises2023@gmail.com", "Arun2023@12")


def _insert_known_captcha(text):
    """Insert a captcha with known text directly (test-only) so we can prove correct captcha passes the gate."""
    cid = "TEST_" + uuid.uuid4().hex

    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await c[os.environ["DB_NAME"]].captchas.insert_one({"id": cid, "hash": hashlib.sha256(text.encode()).hexdigest(),
                                                           "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=3)).isoformat()})
        c.close()
    asyncio.get_event_loop().run_until_complete(go()) if False else asyncio.run(go())
    return cid


class TestCaptcha:
    def test_get_captcha(self):
        r = requests.get(f"{BASE_URL}/api/auth/captcha")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["captcha_id"], str) and len(d["captcha_id"]) == 32
        assert d["image"].startswith("data:image/png;base64,")
        png = base64.b64decode(d["image"].split(",", 1)[1])
        assert png[:8] == b"\x89PNG\r\n\x1a\n"

    def test_non_sa_without_captcha(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": NON_SA[0], "password": NON_SA[1]})
        assert r.status_code == 400
        assert "Captcha galat" in r.json()["detail"]

    def test_non_sa_wrong_captcha(self):
        cid = requests.get(f"{BASE_URL}/api/auth/captcha").json()["captcha_id"]
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": NON_SA[0], "password": NON_SA[1], "captcha_id": cid, "captcha": "ZZZZZ"})
        assert r.status_code == 400
        assert "Captcha galat" in r.json()["detail"]

    def test_captcha_one_time(self):
        cid = _insert_known_captcha("AB234")
        # first use with correct captcha but wrong password -> passes captcha gate -> 401
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": NON_SA[0], "password": "TEST_wrong", "captcha_id": cid, "captcha": "ab234"})
        assert r1.status_code == 401, r1.text
        # reuse -> 400
        r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": NON_SA[0], "password": "TEST_wrong", "captcha_id": cid, "captcha": "AB234"})
        assert r2.status_code == 400
        assert "Captcha galat" in r2.json()["detail"]

    def test_sa_login_no_captcha(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": SA[0], "password": SA[1]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("token") or d.get("access_token") or "user" in d
