"""
Textile Production & QC Analysis System — Backend Entry Point.
Initializes FastAPI, includes routers, and configures middlewares.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
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

app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return error_response(
        message="An unexpected error occurred.",
        status_code=500,
        details=str(exc)
    )
