#!/usr/bin/env python3
"""
Cotton Collective WIP CSV & 6 Control Zones Directive Email Runner
- Generates the email matching the directive screenshot
- Can output local preview HTML or send via SMTP
- Features a built-in 1-minute (60s) delay between consecutive emails to safeguard sender reputation
"""
import os
import sys
import time
import argparse

# Include backend path (works locally and inside Docker container)
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(os.path.dirname(current_dir), "backend")
if os.path.exists(backend_path) and backend_path not in sys.path:
    sys.path.insert(0, backend_path)
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.services.email_service import build_control_zones_directive_email, send_order_status_reminder  # type: ignore # noqa: E402
# pyrefly: ignore[missing-import]
# pyright: reportMissingImports=false
from app.core.config import settings  # type: ignore # noqa: E402

def main():
    parser = argparse.ArgumentParser(description="Cotton Collective WIP & Control Zones Email Generator")
    parser.add_argument(
        "--send-to", 
        help="Recipient email address(es) to send email to (comma-separated for multiple)", 
        default=None
    )
    parser.add_argument(
        "--delay", 
        type=int, 
        default=60, 
        help="Delay in seconds between sending consecutive emails (default: 60s / 1 min)"
    )
    parser.add_argument(
        "--note", 
        default="Live operational directive from Cotton Collective Executive Management.", 
        help="Custom note inside directive email"
    )
    parser.add_argument(
        "--out", 
        help="Output file path", 
        default="email_previews/4_wip_control_zones_directive.html"
    )
    args = parser.parse_args()

    data = {
        "po_references": "CC0910-CRPLIM // CC0910-CRPSNW // CC0910-FRGRN // CC0910-LIMO // CC0910-NVY // CC0910-BLK // CC0910-WHT",
        "brand_name": "COTTON COLLECTIVE",
        "wip_url": f"{settings.APP_BASE_URL}/tracking-dashboard",
    }

    subject, html = build_control_zones_directive_email(data, custom_note=args.note)

    # Always ensure local preview file is written
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Local preview generated: {out_path}")
    print(f"   Subject: {subject}")

    if args.send_to:
        recipients = [r.strip() for r in args.send_to.split(",") if r.strip()]
        total = len(recipients)
        print(f"[*] Found {total} recipient(s) to process. Pacing delay: {args.delay}s per email.")

        for idx, recipient in enumerate(recipients, 1):
            print(f"\n[{idx}/{total}] Dispatching directive to: {recipient}")
            try:
                result = send_order_status_reminder(
                    template_type="wip_directive",
                    order=data,
                    recipients=[recipient],
                    custom_note=args.note,
                )
                print(f"   Status: {result.get('status')} | Dry-run: {result.get('dry_run')}")
            except Exception as e:
                print(f"❌ Failed sending to {recipient}: {e}")

            # If more recipients remain, enforce 1-minute safety delay
            if idx < total and args.delay > 0:
                print(f"⏳ Waiting {args.delay} seconds before sending to next recipient to protect domain reputation...")
                for remaining in range(args.delay, 0, -10):
                    print(f"   ... {remaining}s remaining")
                    time.sleep(min(10, remaining))

        print("\n🎉 All dispatches completed safely.")

if __name__ == "__main__":
    main()

