import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Load backend/.env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)

sender_email = os.getenv("SMTP_USER", "").strip() or "cricketermehar21@gmail.com"
password = os.getenv("SMTP_PASSWORD", "").strip()
to_email = "raheelnazir121@gmail.com"

print(f"[*] Sender: {sender_email}")
print(f"[*] Target Recipient: {to_email}")

if not password or password == "your-app-password-here":
    print("❌ ERROR: SMTP_PASSWORD is not set in backend/.env!")
    print("Please make sure you have saved your 16-character Google App Password in backend/.env:")
    print("   SMTP_PASSWORD=xxxx xxxx xxxx xxxx")
    sys.exit(1)

# Import email template builders
sys.path.insert(0, os.path.dirname(__file__))
from app.services.email_service import (
    build_partial_order_email,
    build_date_delay_email,
    build_order_complete_email,
)

sample_order = {
    "id": "ord-live-98421",
    "order_no": "PO-98421",
    "style_name": "Heavyweight Fleece Hoodie 420GSM",
    "customer": "Urban Trendwear NYC",
    "vendor_name": "Apex Knitwear Facility #3",
    "quantity": 12500,
    "completed_quantity": 6800,
    "ex_factory_date": "2026-10-18",
    "current_stage": "Sewing & Assembly (Line 4)",
    "days_delayed": 5,
    "delay_reason": "Rib collar dye batch variation - re-dyed 2 days ago",
    "delay_capa": "Parallel sewing lines activated + 2-hour daily overtime",
    "recovery_date": "2026-10-23",
    "qa_audit_status": "PASSED (AQL 1.5 Standard)",
    "completion_date": "2026-10-01",
    "remarks": "Live test dispatch for stakeholder verification.",
}

emails_to_send = [
    ("1. Partial Order Review", *build_partial_order_email(sample_order, "Floor manager instruction: Balance 5,700 pcs must be cleared by Tuesday.")),
    ("2. Date Delay Escalation", *build_date_delay_email(sample_order, "Urgent Directive: Overtime authorized for weekend. Recovery deadline Oct 23.")),
    ("3. Order Completed & Dispatch", *build_order_complete_email(sample_order, "Final Note: 100% inspection cleared. Forwarder pickup confirmed.")),
]

print(f"[*] Connecting to smtp.gmail.com:587...")
try:
    server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
    server.starttls()
    print(f"[*] Logging in as {sender_email}...")
    server.login(sender_email, password)
    print("✅ Authenticated successfully with Gmail SMTP!")

    for label, subject, html_content in emails_to_send:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Textile QC System <{sender_email}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        print(f"[*] Sending {label}...")
        server.sendmail(sender_email, [to_email], msg.as_string())
        print(f"   ✅ Sent: {subject}")

    server.quit()
    print("\n🎉 ALL 3 EMAILS DISPATCHED SUCCESSFULLY to raheelnazir121@gmail.com!")
except Exception as e:
    print(f"❌ Failed to send emails: {e}")
    sys.exit(1)
