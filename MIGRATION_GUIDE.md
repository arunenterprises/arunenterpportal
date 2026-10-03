# 📦 Backup & Migration Guide — Arun Enterprises ERP

Yeh guide app ke **data backup**, **naye MongoDB Atlas cluster par shift**, aur
**source code ko GitHub par safe** rakhne ka complete process bataati hai.

Sab operations **SuperAdmin only** hain — login: `arunenterprises2023@gmail.com`

---

## 1️⃣ Daily / On-Demand Data Backup (App ke andar se)

Login karne ke baad:

1. **Users Management** (Super Admin Panel) kholo
2. Niche "Danger Zone" ke upar **"Download Backup (JSON)"** button par click karo
3. Browser ek file download karega:
   `ae-erp-backup-YYYY-MM-DD-HHMM.json`

Yeh file **sab kuch** contain karti hai:

| Collection | Kya hai |
|---|---|
| users | Login accounts (password hash preserved) |
| vendors | Vendor master |
| bills | Vendor bills |
| payments | Payment vouchers + bulk payments |
| expenses | Expense entries |
| boqs | BOQs |
| work_orders | Work Orders |
| employees | Employee master |
| attendance | Daily attendance |
| paybills | Monthly pay bills |
| loans | Employee loans |
| advance_requests | Advance requests |
| recruitments | Recruitment records |
| exits | Exit records |
| counters | Serial numbers (vendor/bill/PV) |
| settings | Company logo & misc config |

**Recommendation**: Har Sunday raat ko yeh backup download karo aur Google Drive
ya USB mein store kar lo. 1 JSON file se poora system restore ho sakta hai.

---

## 2️⃣ Backup Restore karna (same app ke andar)

Agar kabhi data corrupt ho jaye ya naye MongoDB cluster par shift karna ho:

1. SuperAdmin login karo
2. Users Management → **"Restore Backup"** button click karo
3. Pehle download ki hui `ae-erp-backup-*.json` file select karo
4. Confirm → data **upsert** ho jata hai (duplicates automatically merge)
5. Agar poora wipe + restore karna ho, "Wipe existing data first" checkbox tick karo

**Note**: SuperAdmin account kabhi delete nahi hoga, bhale "wipe" option on ho.

---

## 3️⃣ Database — Naye MongoDB Atlas Cluster par Shift

Jab aapko current cloud se naye MongoDB Atlas par migrate karna ho:

### Step A: Naya Atlas Cluster banao
1. [https://cloud.mongodb.com](https://cloud.mongodb.com) par account banao (free M0 cluster bhi chalega)
2. "Create Cluster" → provider & region choose karo (India ke liye Mumbai = `ap-south-1`)
3. "Database Access" → naya user banao (username + password note karo)
4. "Network Access" → `0.0.0.0/0` allow karo (ya apna static IP)
5. "Connect" → "Drivers" → connection string copy karo:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step B: App ko naye cluster se connect karo

Backend ke `/app/backend/.env` file mein 2 keys update karo:
```
MONGO_URL="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
DB_NAME="ae_erp_prod"
```

Backend restart karo:
```bash
sudo supervisorctl restart backend
```

> ⚠️ Deployed production app ke liye yeh keys **Emergent Deploy → Secrets panel**
> se update honi chahiye, local `.env` edit se nahi.

### Step C: Backup JSON ko naye cluster mein restore karo

1. Backend ab naye (khaali) Atlas cluster se connect hai
2. SuperAdmin login karo — login tab tak nahi chalega jab tak admin seed na ho
   (backend startup pe automatically seed ho jata hai)
3. Users Management → **Restore Backup** → pehle download ki hui JSON upload karo
4. "Wipe existing data first" checkbox **off rakho** (seeded admin preserve rahega)
5. Done — poora data naye cluster mein aa gaya

### Step D: Verify Migration

- Vendor list, Bills, Pay Bills, Employees — har tab check karo
- Agar sab theek dikh raha hai, purane cluster ko archive / delete kar sakte ho

---

## 4️⃣ Source Code ka Backup — GitHub par

Preview environment ke chat input mein neeche **"Save to GitHub"** button hai:

1. Button click karo
2. GitHub authorize karo (OAuth, pehli baar)
3. New repo name do (e.g. `arun-enterprises-erp`)
4. Public ya Private select karo (Private recommended for business apps)
5. Push ho jayega — har commit automatic sync hota rahega

**Alternative — Manual download**:
Chat input ke "⋯" menu mein **"Download Code"** option bhi hai, poora `/app` folder zip mein milega.

---

## 5️⃣ Uploaded Files / Documents

Current implementation mein uploaded images (bill scans, employee photos, logo)
**base64 string** ke roop mein MongoDB mein hi stored hote hain, separate file
storage nahi hai. Iska matlab:

✅ **Fayda**: JSON backup mein saari files automatically aa jaati hain
⚠️ **Nuksan**: Database size thoda bada ho sakta hai

Agar future mein files ko alag object storage (S3/Cloudflare R2) mein shift karna
ho, hume `integration_playbook_expert_v2` call karke proper playbook follow karna
hoga — abhi iski zaroorat nahi hai kyunki JSON backup self-contained hai.

---

## 6️⃣ Automatic Daily Backup (Future Enhancement)

Abhi backup **manual (button click)** par kaam karta hai. Agar roz raat 2 AM pe
automatic cloud backup chahiye (Google Drive ya S3 par), toh:

- `.emergent/crons.yml` mein scheduled task set kiya ja sakta hai
- Resend / Email via SendGrid se backup JSON SuperAdmin ke email par bhej sakte hain

Yeh enhancement ab Next Action Item ke roop mein pending hai. Jab chaho, bolo —
set up kar denge.

---

## Quick Checklist (TL;DR)

- [ ] Weekly: SuperAdmin panel se **Download Backup (JSON)** click karo
- [ ] Monthly: "Save to GitHub" se code backup lo
- [ ] Migration ke time: Naya Atlas cluster → `.env` update → Restore JSON upload

Problem ho toh SuperAdmin se contact karo. 🙏
