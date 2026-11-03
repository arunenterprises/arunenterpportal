from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle, PageBreak, KeepTogether

OUT = "/app/frontend/public/ARUN_ERP_VPS_Setup_Guide.pdf"
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontSize=20, textColor=colors.HexColor("#0b1f4d"), spaceAfter=6)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontSize=13.5, textColor=colors.white, backColor=colors.HexColor("#1d4ed8"), borderPadding=(4, 6, 4, 6), spaceBefore=12, spaceAfter=8)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontSize=11, textColor=colors.HexColor("#0b1f4d"), spaceBefore=6, spaceAfter=3)
B = ParagraphStyle("B", parent=ss["BodyText"], fontSize=9.6, leading=13.5)
NOTE = ParagraphStyle("N", parent=B, backColor=colors.HexColor("#fef3c7"), borderColor=colors.HexColor("#f59e0b"), borderWidth=0.6, borderPadding=6, spaceBefore=4, spaceAfter=8)
CODE = ParagraphStyle("C", fontName="Courier", fontSize=7.8, leading=10.2, textColor=colors.HexColor("#0f172a"))

story = []
P = lambda t, s=B: story.append(Paragraph(t, s))
def C(t):
    pre = Preformatted(t.strip("\n"), CODE, maxLineLength=100, newLineChars="    ")
    box = Table([[pre]], colWidths=[180 * mm])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef2ff")), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#6366f1")),
                             ("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story.append(box); story.append(Spacer(1, 7))
def T(rows, w):
    t = Table(rows, colWidths=w, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                           ("FONTSIZE", (0, 0), (-1, -1), 8.6), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94a3b8")), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(t); story.append(Spacer(1, 6))
def W(x): return Paragraph(x, ParagraphStyle("t", parent=B, fontSize=8.6, leading=11))

P("ARUN ENTERPRISES ERP - Hostinger VPS Setup Guide", H1)
P("Step-by-step guide: Emergent par bane ERP (React + FastAPI + MongoDB) ko apne Hostinger VPS (50 GB) par chalane ke liye. Har command copy karke VPS terminal mein chalayein. Jahan <b>erp.yourdomain.com</b> likha hai, wahan apna domain likhein.")
P("<b>Zaroori:</b> Yeh kaam kisi technical vyakti (Linux / server jaanne wale) se karwayein. Live data shift karne se pehle Emergent wale app se poora backup zaroor download kar lein.", NOTE)

P("STEP 0 - Kya-kya chahiye (Checklist)", H2)
T([["Cheez", "Detail"],
   [W("Hostinger VPS"), W("Ubuntu 22.04 / 24.04, kam se kam 2 vCPU + 4 GB RAM (8 GB behtar), 50 GB disk - kaafi hai")],
   [W("Domain"), W("Jaise erp.yourdomain.com - DNS mein VPS ka IP lagana hoga")],
   [W("GitHub account"), W("Emergent ka 'Save to GitHub' (Standard ya upar ka plan) se code wahan jayega")],
   [W("Email service"), W("Login OTP aur backup mail ke liye - Gmail SMTP / Hostinger email / Zoho (Step 11)")],
   [W("Gemini API key"), W("AI Work Order (PDF padhna / AI scope) ke liye (Step 12)")],
   [W("Backup file"), W("System Management -> Nightly Backups se latest JSON backup download karein (Step 10)")]], [45 * mm, 125 * mm])

P("STEP 1 - Code ko GitHub par save karein", H2)
P("1. Emergent chat mein neeche <b>'Save to GitHub'</b> button dabayein.<br/>2. Apna GitHub account jodein, repository ka naam dein (jaise <b>arun-erp</b>), Private rakhein.<br/>3. Push hone ke baad GitHub par repo khol kar dekh lein ki <b>backend/</b> aur <b>frontend/</b> folder aa gaye.")
P("<b>.env files GitHub par nahi jaati</b> (security ke liye). Unhe Step 6 aur Step 8 mein VPS par khud banana hai.", NOTE)

P("STEP 2 - VPS mein login aur update", H2)
P("Hostinger hPanel -> VPS -> SSH details se IP aur root password lein. Apne computer ke terminal (Windows: PowerShell) mein:")
C("""
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
timedatectl set-timezone Asia/Kolkata
adduser erp            # naya user (password set karein)
usermod -aG sudo erp
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
""")

P("STEP 3 - Software install karein", H2)
P("Python 3.11, Node.js 20, Yarn, MongoDB 7, Nginx, Certbot:", H3)
C("""
apt install -y git curl build-essential nginx software-properties-common gnupg
add-apt-repository -y ppa:deadsnakes/ppa
apt install -y python3.11 python3.11-venv python3.11-dev
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs && npm install -g yarn
# MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-7.gpg
echo "deb [signed-by=/usr/share/keyrings/mongodb-7.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl enable --now mongod
apt install -y certbot python3-certbot-nginx
""")
P("Ubuntu 24.04 par MongoDB repo mein <b>jammy</b> ki jagah <b>noble</b> likhein (agar MongoDB ka noble package uplabdh ho).", NOTE)

P("STEP 4 - Code VPS par laayein", H2)
C("""
mkdir -p /opt/arun-erp && chown erp:erp /opt/arun-erp
su - erp
git clone https://github.com/YOUR_GITHUB/arun-erp.git /opt/arun-erp
cd /opt/arun-erp && ls      # backend  frontend  dikhna chahiye
""")

P("STEP 5 - MongoDB ko surakshit karein", H2)
C("""
mongosh
use admin
db.createUser({user: "erpadmin", pwd: "STRONG_DB_PASSWORD", roles: [{role: "readWrite", db: "arun_erp"}]})
exit
# /etc/mongod.conf mein:
#   net:  bindIp: 127.0.0.1        (bahar se band)
#   security:  authorization: enabled
sudo systemctl restart mongod
""")

P("STEP 6 - Backend (FastAPI) setup", H2)
C("""
cd /opt/arun-erp/backend
python3.11 -m venv venv && source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
""")
P("Ab <b>/opt/arun-erp/backend/.env</b> file banayein (nano .env). Har line apni value ke saath:", H3)
T([["Key", "Kya likhein"],
   [W("MONGO_URL"), W("mongodb://erpadmin:STRONG_DB_PASSWORD@127.0.0.1:27017/?authSource=admin")],
   [W("DB_NAME"), W("arun_erp")],
   [W("CORS_ORIGINS"), W("https://erp.yourdomain.com")],
   [W("JWT_SECRET"), W("lamba random text (openssl rand -hex 32 se banayein)")],
   [W("ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME"), W("SuperAdmin login (arunenterprises2023@gmail.com aur naya strong password)")],
   [W("LEGACY_ADMIN_EMAILS"), W("purane admin emails, comma se alag (ya khaali)")],
   [W("EMAIL_FROM_NAME"), W("Arun Enterprises")],
   [W("SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM_EMAIL"), W("Apne domain ka email (Step 11)")],
   [W("WEBHOOK_CRON_SECRET"), W("random text - nightly backup ke liye (Step 13)")],
   [W("GEMINI_API_KEY"), W("AI Work Order ke liye (Step 12)")]], [62 * mm, 108 * mm])
P("Test chalayein:", H3)
C("""
uvicorn server:app --host 127.0.0.1 --port 8001
# doosre terminal mein: curl http://127.0.0.1:8001/api/   -> jawab aana chahiye, phir Ctrl+C
""")

P("STEP 7 - Backend ko hamesha chalu rakhein (systemd)", H2)
P("File banayein: <b>sudo nano /etc/systemd/system/arun-erp.service</b>")
C("""
[Unit]
Description=Arun ERP Backend
After=network.target mongod.service

[Service]
User=erp
WorkingDirectory=/opt/arun-erp/backend
EnvironmentFile=/opt/arun-erp/backend/.env
ExecStart=/opt/arun-erp/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
""")
C("""
sudo systemctl daemon-reload
sudo systemctl enable --now arun-erp
sudo systemctl status arun-erp      # 'active (running)' dikhna chahiye
journalctl -u arun-erp -f           # error dekhne ke liye
""")

P("STEP 8 - Frontend (React) build", H2)
C("""
cd /opt/arun-erp/frontend
echo "REACT_APP_BACKEND_URL=https://erp.yourdomain.com" > .env
yarn install
yarn build          # 'build' folder banega
""")

P("STEP 9 - Nginx + Domain + SSL (https)", H2)
P("1. Domain ke DNS mein <b>A record</b>: erp -> YOUR_VPS_IP.<br/>2. File banayein: <b>sudo nano /etc/nginx/sites-available/arun-erp</b>")
C("""
server {
    listen 80;
    server_name erp.yourdomain.com;
    client_max_body_size 50M;
    root /opt/arun-erp/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    location / {
        try_files $uri /index.html;      # page refresh par blank screen nahi aayegi
    }
}
""")
C("""
sudo ln -s /etc/nginx/sites-available/arun-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d erp.yourdomain.com      # free SSL, auto-renew
""")
P("Ab browser mein https://erp.yourdomain.com kholein - Login page aana chahiye. SuperAdmin (ADMIN_EMAIL) se login karein.")

P("STEP 10 - Purana data naye server par laayein", H2)
P("1. Emergent wale live ERP mein SuperAdmin se login -> <b>10. System Management -> Nightly Backups</b> -> latest backup <b>Download (JSON)</b>. (Ya ARUN_ERP_DATA folder ki latest full backup JSON file.)<br/>2. File VPS par bhejein (apne computer se):")
C("""
scp backup.json erp@YOUR_VPS_IP:/opt/arun-erp/backup.json
""")
P("3. VPS par <b>/opt/arun-erp/restore.py</b> banayein aur chalayein:")
C("""
import json, os
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/opt/arun-erp/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
data = json.load(open("/opt/arun-erp/backup.json"))["collections"]
for name, docs in data.items():
    if docs:
        db[name].delete_many({})
        db[name].insert_many(docs)
    print(name, len(docs))
""")
C("""
cd /opt/arun-erp/backend && source venv/bin/activate
python ../restore.py
sudo systemctl restart arun-erp
""")
P("Restore ke baad Vendors, Bills, Invoices, HR, MB/RA Bills ki ginti purane ERP se milaayein. Users ke password backup mein hote hain, isliye sab purane password se login kar sakenge. Agar koi collection backup mein na ho to uska data naye server par khaali rahega - restore se pehle backup file ki ginti dekh lein.", NOTE)

P("STEP 11 - Email (Login OTP + Backup mail) badlein", H2)
P("Emergent par email <b>EMERGENT_EMAIL_KEY</b> se jaata hai. ERP mein ab apne domain ka email (SMTP) pehle se lagaya hua hai: VPS ki <b>backend/.env</b> mein yeh 5 keys bharte hi saare OTP / backup mail aapke domain se jayenge (koi code badalna nahi):")
C("""
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=email_ka_password
SMTP_FROM_EMAIL=noreply@yourdomain.com
""")
P("Hostinger hPanel -> Emails -> apne domain par mailbox banayein (jaise noreply@yourdomain.com). DNS mein Hostinger ke SPF, DKIM, DMARC records lagayein taaki mail Spam mein na jaye. Gmail ke liye: smtp.gmail.com, port 587, App Password.")
P("Gmail App Password: Google Account -> Security -> 2-Step ON -> App Password. Email bhejne ka code ERP mein pehle se hai, sirf .env bharna hai. SMTP_HOST khaali ho to Emergent ka email use hota hai (sirf Emergent par chalta hai).")

P("STEP 12 - AI Work Order (Google Gemini - aapki key)", H2)
P("AI Work Order (scope + terms) aur Work Order PDF padhna ab aapki apni <b>GEMINI_API_KEY</b> se chalta hai (Emergent key ki zarurat nahi). VPS ki backend/.env mein <b>GEMINI_API_KEY=...</b> daalein. Key aistudio.google.com/apikey se milti hai; Google AI Studio mein Billing ON karein, warna 'quota exceeded' aata hai.")

P("STEP 13 - Nightly Backup (roz 2 AM) - Linux cron", H2)
P("Emergent par backup apne-aap chalta tha. VPS par crontab lagayein (<b>crontab -e</b>):")
C("""
0 2 * * * curl -s -X POST https://erp.yourdomain.com/api/cron/nightly-backup \\
  -H "Authorization: Bearer YOUR_WEBHOOK_CRON_SECRET" -H "Content-Type: application/json" -d '{}'
# Extra: MongoDB ka poora dump roz 3 AM, 15 din purane hatayein
0 3 * * * mongodump --uri="mongodb://erpadmin:STRONG_DB_PASSWORD@127.0.0.1:27017/?authSource=admin" --db=arun_erp --out=/opt/backups/$(date +\\%F) && find /opt/backups -maxdepth 1 -mtime +15 -exec rm -rf {} +
""")
P("Backup ki ek copy VPS ke bahar (Google Drive / apna computer) bhi rakhein - VPS kharab hone par data bachega. SuperAdmin ka ARUN_ERP_DATA folder backup pehle jaisa chalega.")

P("STEP 14 - Naye badlav (Update) kaise karein", H2)
P("Emergent par badlav karne ke baad 'Save to GitHub' -> phir VPS par:")
C("""
cd /opt/arun-erp && git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
sudo systemctl restart arun-erp
cd ../frontend && yarn install && yarn build
sudo systemctl reload nginx
""")

P("STEP 15 - Final Check-list", H2)
T([["#", "Check", "Kaise dekhein"],
   ["1", W("Website khulti hai (https)"), W("https://erp.yourdomain.com par Login page")],
   ["2", W("SuperAdmin login"), W("ADMIN_EMAIL + ADMIN_PASSWORD")],
   ["3", W("User login + Email OTP"), W("Kisi user se login - OTP mail aana chahiye")],
   ["4", W("Purana data"), W("Vendors, Bills, Invoices, HR ginti milaayein")],
   ["5", W("Page refresh"), W("Kisi bhi page par F5 - blank screen na aaye")],
   ["6", W("Print / PDF / Excel"), W("Invoice, Abstract, Reports print karke dekhein")],
   ["7", W("Backup"), W("Agle din System Management -> Nightly Backups mein naya backup")],
   ["8", W("Service restart test"), W("sudo reboot - phir website apne-aap chalu ho")]], [10 * mm, 60 * mm, 100 * mm])

P("Samasya aaye to (Troubleshooting)", H2)
T([["Dikkat", "Upay"],
   [W("502 Bad Gateway"), W("Backend band hai: sudo systemctl status arun-erp, journalctl -u arun-erp -n 100")],
   [W("Login par 'Network error'"), W("frontend/.env ka REACT_APP_BACKEND_URL domain se mile, phir yarn build dobara")],
   [W("CORS error"), W("backend/.env ka CORS_ORIGINS = https://erp.yourdomain.com, phir restart")],
   [W("OTP mail nahi aata"), W("SMTP values / Gmail App Password check karein, logs dekhein")],
   [W("Disk bhar gayi"), W("df -h; /opt/backups ke purane folder hatayein")]], [50 * mm, 120 * mm])
P("<b>Yaad rakhein:</b> VPS par jaane ke baad server, security update, backup aur SSL ki zimmedari aapki (ya aapke technical vyakti ki) hogi. Emergent ka 'Publish' button VPS par kaam nahi karta.", NOTE)


def footer(c, d):
    c.saveState(); c.setFont("Helvetica", 7.5); c.setFillColor(colors.HexColor("#64748b"))
    c.drawString(15 * mm, 10 * mm, "Arun Enterprises ERP - VPS Setup Guide")
    c.drawRightString(195 * mm, 10 * mm, f"Page {d.page}"); c.restoreState()


SimpleDocTemplate(OUT, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=16 * mm,
                  title="Arun ERP VPS Setup Guide").build(story, onFirstPage=footer, onLaterPages=footer)
print("ok", OUT)
