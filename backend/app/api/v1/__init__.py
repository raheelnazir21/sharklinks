"""
Central API router — registers all v1 route modules here.
Add new route files here as the project grows.
"""
from fastapi import APIRouter
from app.api.v1 import auth, users, vendors, orders, qc_reports

api_router = APIRouter(prefix="/api/v1")

# Step 1 — Auth & Users
api_router.include_router(auth.router)
api_router.include_router(users.router)

# Step 2 — Vendors & Orders
api_router.include_router(vendors.router)
api_router.include_router(orders.router)

# Step 3 — QC Reports
api_router.include_router(qc_reports.router)

# Step 3b — Article Codes & Product Colors
from app.api.v1 import articles
api_router.include_router(articles.router)

# Step 4 — Analytics & Reporting
from app.api.v1 import analytics, reports
api_router.include_router(analytics.router)
api_router.include_router(reports.router)

# Step 5 — Utilities & Uploads
from app.api.v1 import uploads
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])

# Step 6 — Audit Stage
from app.api.v1 import audit
api_router.include_router(audit.router)

# Step 7 — Vendor Floors & Lines
from app.api.v1 import floors
api_router.include_router(floors.router)

# Step 8 — Advanced QC: Inline, Finish, Endline
from app.api.v1 import advanced_qc
api_router.include_router(advanced_qc.router)

# Step 9 — Activity Logs / Factory Historian
from app.api.v1 import activity_logs
api_router.include_router(activity_logs.router)
