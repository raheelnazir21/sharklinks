"""
Textile Production & QC Analysis System — Backend Entry Point.
Initializes FastAPI, includes routers, and configures middlewares.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import time
import os

from app.core.config import settings
from app.api.v1 import api_router
from app.utils.response import error_response

from app.core.database import engine, Base
from app.core.schema_maintenance import ensure_runtime_schema, sync_postgres_enums
import app.models  # noqa: F401 - register every model before create_all
from app.models import order, user, audit_log, qc_report # Import modules to ensure models are registered
from app.models.order import OrderAudit  # Ensure audit table is created
from app.models import inline_qc  # noqa: F401 — registers all advanced QC models including RandomInlineQCReport
from app.models import comments_notifications  # noqa: F401 — registers StageComment and Notification tables
from app.models import pre_order_request  # noqa: F401 — registers PreOrderRequest table
from app.models import ai_chat  # noqa: F401 — registers AIChatSession and AIChatMessage tables

# Notification scheduler
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.api.v1.notifications import run_notification_scan
    _scheduler_available = True
except ImportError:
    _scheduler_available = False

# Create tables
Base.metadata.create_all(bind=engine)
ensure_runtime_schema(engine)
sync_postgres_enums(engine)

# Initialize FastAPI app
app = FastAPI(
    title="Textile QC System API",
    description="Professional Production & Quality Control Management System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Start notification scanner (runs every 15 minutes in background)
if _scheduler_available:
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(run_notification_scan, "interval", minutes=15, id="notification_scan")
    # Pre-order reminder/escalation scan (runs every hour)
    try:
        from app.services.pre_order_service import run_pre_order_reminder_scan
        _scheduler.add_job(run_pre_order_reminder_scan, "interval", hours=1, id="pre_order_reminder_scan")
    except Exception as _e:
        print(f"[Scheduler] Could not register pre-order reminder scan: {_e}")
    _scheduler.start()
    print("[Scheduler] Notification scanner started — runs every 15 minutes.")
    print("[Scheduler] Pre-order reminder scanner started — runs every hour.")

# Configure CORS (Allows frontend to communicate with backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging Middleware to track request time
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Static files for attachments
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
os.makedirs("uploads/audit", exist_ok=True)

@app.get("/api/uploads/{filename:path}", tags=["Uploads"])
def serve_uploaded_file(filename: str):
    # 1. Exact match (try to find the file exactly as requested)
    exact_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(exact_path) and os.path.isfile(exact_path):
        return FileResponse(exact_path)
        
    # 2. Case-insensitive lookup (Linux/AWS server casing fallback)
    dir_name = os.path.dirname(exact_path)
    base_name = os.path.basename(exact_path)
    
    if os.path.exists(dir_name):
        for f in os.listdir(dir_name):
            if f.lower() == base_name.lower():
                matched_path = os.path.join(dir_name, f)
                if os.path.isfile(matched_path):
                    return FileResponse(matched_path)
                    
    # 3. Fallback to 404
    raise HTTPException(status_code=404, detail="File not found")

# app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include all API routes
app.include_router(api_router)

# Root Health Check
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "message": "Textile QC System API is running.",
        "version": "1.0.0"
    }

@app.get("/docs", include_in_schema=False)
def docs_redirect():
    return RedirectResponse(url="/api/docs")

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return error_response(
        message="An unexpected error occurred.",
        status_code=500,
        details=str(exc)
    )
