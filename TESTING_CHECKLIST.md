# 🧪 Textile QC System — Testing & QA Checklist
> This document tracks the verification of every feature, logic, and security measure in the system.

## 1. 🔑 Authentication & Security
- [x] **Login API**: Correct credentials grant access.
- [x] **Login API**: Wrong password returns 401 Unauthorized.
- [x] **Refresh Token**: Access token is renewed correctly.
- [x] **Token Expiry**: Expired tokens are rejected.
- [x] **Password Security**: Passwords are hashed in DB (not plain text).
- [x] **Logout**: Refresh tokens are invalidated on logout.

## 2. 🛡️ RBAC (Role-Based Access Control)
- [x] **Admin**: Full access to Users, Clients, Orders, QC, Analytics.
- [x] **Manager**: Access to Clients, Orders, QC (with Approval/Rejection), Analytics.
- [x] **QC Officer**: Access to Orders and QC Feeding forms (Submit only).
- [x] **Viewer**: Read-only access to Analytics and Reports.
- [x] **Unauthorized**: Roles cannot access restricted endpoints (e.g., QC Officer deleting a client).

## 3. 📦 Backend API Verification (CRUD)
- [x] **Users**: Create, List, Update, Deactivate.
- [x] **Clients**: One client → multiple orders relationship.
- [x] **Orders**: Create with required fields, Update status, Ex-factory date validation.
- [x] **Production Stages**: Sequential or parallel stage tracking per order.
- [x] **QC Reports**: Submit report with multiple defect items.
- [x] **Defect Codes**: Master list retrieval and filtering.

## 4. 📊 Dashboard & Calculations
- [x] **DHU %**: `(Total Defects / Total Pieces) * 100` verified.
- [x] **FPY %**: `(Pass Pieces / Total Pieces) * 100` verified.
- [x] **On-Time %**: `(On-time Orders / Total Completed) * 100` verified.
- [x] **Top Defects**: Ranking by frequency confirmed.
- [x] **Line-wise Quality**: Aggregation by line_no verified.

## 5. 📂 Exports & File Handling
- [x] **PDF Export**: Professional layout with all report details.
- [x] **Excel Export**: Accurate data mapping for summary reports.
- [x] **File Upload**: Only PDF/Images allowed; size limits enforced.
- [x] **Audit Log**: Every change logged (User, Action, Time, Entity).

## 6. 🎨 Frontend Interface (UI/UX)
- [x] **Login Screen**: Validation and error handling.
- [x] **Dashboard**: Charts rendering with real data; KPI counts.
- [x] **Sidebar**: Role-based menu visibility.
- [x] **Filters**: Date, Client, and Type filters working on Report list.
- [x] **Search**: Global search for Order No and Style.
- [x] **Forms**: Validation for missing required fields (Red outlines/messages).

## 🐳 7. Deployment Readiness
- [x] **Docker Compose**: All services (DB, Backend, Frontend, Nginx) start cleanly.
- [x] **Environment**: `.env` variables mapped correctly.
- [x] **Persistence**: Database volumes keep data after container restart.
- [x] **Nginx**: Routing `/api` to backend and `/` to frontend works.
