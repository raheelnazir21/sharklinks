"""
Zones Scheduler Service — Orchestration & Deduplication for 6 Control Zones Cycles.
Integrates with APScheduler to run nightly at 21:00 UTC (02:00 AM PKT),
persists run records in uploads/zones_cycle_last_run.json to guarantee idempotency,
and provides on-demand triggering for Super Admins and Managers.
"""
import os
import json
import logging
from datetime import date, datetime
from typing import Optional, Dict, Any, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

STATUS_FILE_NAME = "zones_cycle_last_run.json"


def _get_status_file_path() -> str:
    """Returns absolute path to zones_cycle_last_run.json inside uploads directory."""
    base_dir = getattr(settings, "EMAIL_OUTBOX_DIR", "uploads/email_outbox")
    uploads_dir = os.path.dirname(base_dir) if "email_outbox" in base_dir else "uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    return os.path.join(uploads_dir, STATUS_FILE_NAME)


def get_last_zones_run_info() -> Dict[str, Any]:
    """Reads the last execution record of the Control Zones cycle."""
    path = _get_status_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"[ZonesScheduler] Failed to read {path}: {e}")
    return {}


def record_zones_run_info(status: str, summary: Dict[str, Any]) -> None:
    """Saves the last execution record of the Control Zones cycle."""
    path = _get_status_file_path()
    data = {
        "last_run_date": str(date.today()),
        "last_run_timestamp": datetime.utcnow().isoformat() + "Z",
        "status": status,
        "summary": summary,
    }
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"[ZonesScheduler] Failed to write {path}: {e}")


def _count_working_days(start: date, end: date) -> int:
    """Counts working days (Mon–Fri) between two dates, exclusive of start, inclusive of end."""
    count = 0
    current = start
    while current < end:
        current = date(current.year, current.month, current.day + 1) if False else \
            date.fromordinal(current.toordinal() + 1)
        if current.weekday() < 5:  # 0=Mon, 4=Fri
            count += 1
    return count


def should_run_today(force: bool = False) -> Tuple[bool, str]:
    """
    Determines whether the Control Zones cycle should execute.
    - Honors ZONES_EMAIL_AUTO_ENABLED
    - Skips weekends (Saturday=5, Sunday=6) — only sends on working days (Mon–Fri)
    - Enforces interval in WORKING days (e.g. 3 = every 3 working days)
    - Deduplicates to prevent double-dispatch on the same calendar day unless forced
    """
    if force:
        return True, "Execution forced by caller."

    if not getattr(settings, "ZONES_EMAIL_AUTO_ENABLED", True):
        return False, "Automated 6 Control Zones cycle is disabled in settings (ZONES_EMAIL_AUTO_ENABLED=False)."

    today = date.today()

    # Skip weekends — never send on Saturday or Sunday
    if today.weekday() >= 5:
        day_name = "Saturday" if today.weekday() == 5 else "Sunday"
        return False, f"Today is {day_name} — email only sent on working days (Mon–Fri)."

    last_run = get_last_zones_run_info()
    last_date_str = last_run.get("last_run_date")

    if last_date_str:
        try:
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
            working_days_since = _count_working_days(last_date, today)
            interval = max(1, int(getattr(settings, "ZONES_EMAIL_INTERVAL_DAYS", 3)))

            if working_days_since < 1:
                return False, f"Cycle already executed today ({last_date_str}). Deduplication active."
            if working_days_since < interval:
                return False, (
                    f"Working-day interval not yet met: {working_days_since}/{interval} "
                    f"working days elapsed since last run ({last_date_str})."
                )
        except Exception as e:
            logger.warning(f"[ZonesScheduler] Date parsing error: {e}")

    return True, "Scheduled criteria satisfied (3 working days elapsed)."


def dispatch_zones_cycle(
    force: bool = False,
    dry_run: bool = False,
    admin_only: bool = False,
    test_recipient: Optional[str] = None,
    factory_filter: Optional[str] = None,
    skip_admin: bool = False,
) -> Dict[str, Any]:
    """
    Executes the 6 Control Zones automated cycle.
    Returns status dict with run details.
    """
    should_run, reason = should_run_today(force=force or bool(test_recipient) or dry_run)
    if not should_run:
        logger.info(f"[ZonesScheduler] Skipping cycle: {reason}")
        return {
            "status": "skipped",
            "reason": reason,
            "last_run": get_last_zones_run_info(),
        }

    # Dynamic import to avoid circular dependencies
    try:
        from scripts.run_tri_daily_zones_cycle import run_tri_daily_zones_cycle
    except ImportError:
        import sys
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        from scripts.run_tri_daily_zones_cycle import run_tri_daily_zones_cycle

    logger.info(
        f"[ZonesScheduler] Dispatching 6 Control Zones Cycle "
        f"(force={force}, dry_run={dry_run}, admin_only={admin_only}, test_to={test_recipient})..."
    )

    try:
        run_tri_daily_zones_cycle(
            test_recipient=test_recipient,
            dry_run=dry_run,
            admin_only=admin_only,
            factory_filter=factory_filter,
            skip_admin=skip_admin,
        )
        summary = {
            "test_recipient": test_recipient,
            "dry_run": dry_run,
            "admin_only": admin_only,
            "factory_filter": factory_filter,
            "skip_admin": skip_admin,
        }
        if not dry_run and not test_recipient:
            record_zones_run_info(status="success", summary=summary)

        return {
            "status": "success",
            "message": "6 Control Zones cycle executed successfully.",
            "executed_at": datetime.utcnow().isoformat() + "Z",
            "summary": summary,
        }
    except Exception as e:
        logger.error(f"[ZonesScheduler] Cycle execution error: {e}", exc_info=True)
        if not dry_run and not test_recipient:
            record_zones_run_info(status="failed", summary={"error": str(e)})
        return {
            "status": "error",
            "error": str(e),
            "executed_at": datetime.utcnow().isoformat() + "Z",
        }


def scheduled_zones_cycle_job() -> None:
    """
    Job target invoked automatically by APScheduler.
    Scheduled for 21:00 UTC (02:00 AM PKT).
    """
    logger.info("[Scheduler] Triggering automated nightly 6 Control Zones cycle...")
    print("🚀 [Scheduler] Automated Nightly 6 Control Zones cycle starting (21:00 UTC / 02:00 AM PKT)...")
    res = dispatch_zones_cycle(force=False, dry_run=getattr(settings, "EMAIL_DRY_RUN", False))
    print(f"🏁 [Scheduler] 6 Control Zones cycle result: {res.get('status')} - {res.get('message', res.get('reason', ''))}")
