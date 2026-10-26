#!/usr/bin/env python3
"""
Cotton Collective WIP CSV & 6 Control Zones Directive Email Runner
- Generates the email matching the directive screenshot
- Can output local preview HTML or send via SMTP
"""
import os
import sys
import argparse

# Include backend path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
sys.path.insert(0, backend_dir)

from app.services.email_service import build_control_zones_directive_email, send_order_status_reminder
from app.core.config import settings

def main():
    parser = argparse.ArgumentParser(description="Cotton Collective WIP & Control Zones Email Generator")
    parser.add_argument("--send-to", help="Recipient email address to send test email to", default=None)
    parser.add_argument("--out", help="Output file path", default="email_previews/4_wip_control_zones_directive.html")
    args = parser.parse_args()

    data = {
        "po_references": "CC0910-CRPLIM // CC0910-CRPSNW // CC0910-FRGRN // CC0910-LIMO // CC0910-NVY // CC0910-BLK // CC0910-WHT",
        "brand_name": "COTTON COLLECTIVE",
        "wip_url": f"{settings.APP_BASE_URL}/tracking-dashboard",
    }

    subject, html = build_control_zones_directive_email(data)

    # Always ensure local preview file is written
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Local preview generated: {out_path}")
    print(f"   Subject: {subject}")

    if args.send_to:
        print(f"[*] Dispatching to {args.send_to} via email service...")
        result = send_order_status_reminder(
            template_type="wip_directive",
            order=data,
            recipients=[args.send_to],
            custom_note="Live test dispatch of Cotton Collective operational directive.",
        )
        print(f"✅ Email result: {result}")

if __name__ == "__main__":
    main()
