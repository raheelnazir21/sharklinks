from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FIRST_ADMIN_EMAIL: str = "admin@textile.com"
    FIRST_ADMIN_PASSWORD: str = "Admin@123"
    FIRST_ADMIN_NAME: str = "Super Admin"

    # ─── Outbound Email (SMTP relay) ─────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True          # STARTTLS on 587; set False + port 465 for implicit SSL
    EMAIL_FROM: str = "noreply@localhost"
    EMAIL_FROM_NAME: str = "Textile QC System"
    EMAIL_REPLY_TO: str = ""

    # When True, emails are written to EMAIL_OUTBOX_DIR as .html instead of sent.
    # Keep True until SMTP credentials are verified — avoids spamming real users.
    EMAIL_DRY_RUN: bool = True
    EMAIL_OUTBOX_DIR: str = "uploads/email_outbox"

    # ─── Digest Scheduler ────────────────────────────────────────────────
    # Only the real API process should schedule jobs. Migration scripts and
    # pytest import app.main too, and must not start a scheduler.
    ENABLE_SCHEDULER: bool = True
    NOTIFICATION_SCAN_MINUTES: int = 15

    DIGEST_TIMEZONE: str = "America/New_York"
    DIGEST_DAILY_HOUR: int = 16        # 4:00 PM in DIGEST_TIMEZONE
    DIGEST_DAILY_MINUTE: int = 0
    DIGEST_WEEKLY_DAY: str = "mon"     # mon|tue|wed|thu|fri|sat|sun
    DIGEST_SEND_WHEN_EMPTY: bool = False  # skip the send if there's nothing to report

    # Used to build "View in dashboard" links inside the email
    APP_BASE_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
