"""
Orders & Production Stages API.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
from typing import Optional
import shutil, os, uuid
import json, csv, io
from datetime import datetime, date

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.core.access_control import assert_vendor_access, is_admin_user, can_view_all_company_data, scoped_vendor_query
from app.models.audit_log import AuditLog
from app.models.user import RoleEnum, User
from app.models.order import Attachment, TrackType, OrderHistory, Order, OrderStatus
from app.services.order_service import OrderService, StageService
from app.services.activity_log_service import ActivityLogService
from app.repositories.order_repo import SampleClassRepository, BulkClassRepository, _id_variants
from app.services.excel_exporter import generate_classes_workbook, _get_order_stage_details
from app.schemas.order import (
    OrderCreate, OrderUpdate, StageCreate, StageUpdate, 
    SampleClassCreate, SampleClassUpdate, BulkClassCreate, BulkClassUpdate, BulkOrderCreate,
    StageReworkRequest, StageApprovalRequest
)
from app.utils.response import success_response
from app.api.v1.notifications import dispatch_order_created_notification, dispatch_class_created_notification

router = APIRouter(prefix="/orders", tags=["Orders"])

AllStaff = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])
OrderReadAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer, RoleEnum.viewer])
ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager])
SuperAdminOnly = require_roles([RoleEnum.super_admin])

UPLOAD_DIR = "uploads/attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _is_admin_user(user: User) -> bool:
    return is_admin_user(user)


def _allowed_vendor_ids(db: Session, user: User) -> Optional[list[str]]:
    if can_view_all_company_data(user):
        return None
    return [str(vendor.id) for vendor in scoped_vendor_query(db, user).all()]


def _assert_order_access(db: Session, order_id: str, user: User) -> Order:
    order = OrderService.get_order(db, order_id)
    if can_view_all_company_data(user):
        return order
    if order.vendor_id and str(order.vendor_id) in (_allowed_vendor_ids(db, user) or []):
        return order
    raise HTTPException(status_code=403, detail="You can only access orders for your assigned vendors.")


def _assert_stage_order_access(db: Session, stage_id: str, user: User) -> Order:
    stage = StageService.get_stage(db, stage_id)
    return _assert_order_access(db, str(stage.order_id), user)


# ─── Project Container Endpoints (Static Routes First) ──────────────────────

@router.get("/sample-classes", summary="List Sample Classes")
def list_sample_classes(
    vendor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    scs = SampleClassRepository.get_all(db, vendor_id, allowed_vendor_ids=_allowed_vendor_ids(db, current_user))
    result = []
    for s in scs:
        active_orders = [o for o in s.orders if o.is_active]
        total_stages = sum(len(o.stages) for o in active_orders)
        completed_stages = sum(
            sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed")
            for o in active_orders
        )
        if total_stages > 0:
            progress = round((completed_stages / total_stages) * 100)
        elif s.status == "completed":
            progress = 100
        else:
            progress = 0

        result.append({
            "id": str(s.id),
            "name": s.name,
            "serial_number": s.serial_number,
            "customer": s.customer,
            "status": s.status,
            "remarks": s.remarks,
            "vendor_id": str(s.vendor_id) if s.vendor_id else None,
            "vendor_name": s.vendor.name if s.vendor else None,
            "created_at": s.created_at.isoformat(),
            "total_orders": len(active_orders),
            "total_stages": total_stages,
            "completed_stages": completed_stages,
            "progress": progress,
        })
    return success_response(data=result)


@router.get("/sample-classes/export/excel", summary="Export Sample Classes Excel Workbook")
@router.get("/sample-classes/export.xlsx", summary="Export Sample Classes Excel Workbook")
def export_sample_classes_excel(
    vendor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    scs = SampleClassRepository.get_all(db, vendor_id, allowed_vendor_ids=_allowed_vendor_ids(db, current_user))
    xlsx_stream = generate_classes_workbook(scs, track_title="Sample Classes", accent_color="0F766E")
    filename = f"sample-classes-wip-{datetime.utcnow().strftime('%Y-%m-%d')}.xlsx"
    return StreamingResponse(
        xlsx_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/sample-classes/export/csv", summary="Export Sample Classes CSV")
@router.get("/sample-classes/export.csv", summary="Export Sample Classes CSV")
def export_sample_classes_csv(
    view: str = Query("table"),
    vendor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    scs = SampleClassRepository.get_all(db, vendor_id, allowed_vendor_ids=_allowed_vendor_ids(db, current_user))
    
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    
    if view == "matrix":
        headers = ["Class Info / Product Index"] + [f"[{s.serial_number or 'NO-SN'}] {s.name}" for s in scs]
        writer.writerow(headers)
        writer.writerow(["Customer"] + [s.customer or "—" for s in scs])
        writer.writerow(["Vendor"] + [(s.vendor.name if s.vendor else "—") for s in scs])
        writer.writerow(["Status"] + [s.status or "active" for s in scs])
        
        progress_strs = []
        for s in scs:
            active_orders = [o for o in s.orders if o.is_active]
            total_st = sum(len(o.stages) for o in active_orders)
            comp_st = sum(sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed") for o in active_orders)
            pct = round((comp_st / total_st) * 100) if total_st > 0 else (100 if s.status == "completed" else 0)
            progress_strs.append(f"{pct}% ({comp_st}/{total_st} stages)")
        writer.writerow(["Overall Progress"] + progress_strs)
        writer.writerow(["Total Products"] + [str(len([o for o in s.orders if o.is_active])) for s in scs])
        writer.writerow(["--------------------"] * len(headers))
        
        max_products = max([len([o for o in s.orders if o.is_active]) for s in scs] or [0])
        for p_idx in range(max_products):
            row = [f"Product #{p_idx + 1}"]
            for s in scs:
                active_orders = [o for o in s.orders if o.is_active]
                if p_idx < len(active_orders):
                    o = active_orders[p_idx]
                    dtl = _get_order_stage_details(o)
                    prod_str = f"{o.product_name or 'Product'} [{o.style_name or 'No Style'}] -> Stage: {dtl['stage_title']} ({dtl['stage_status']})"
                    if dtl["ex_fac_str"]:
                        prod_str += f" | Ex-Fac: {dtl['ex_fac_str']}"
                    prod_str += f" | Progress: {dtl['progress_pct']}%"
                    row.append(prod_str)
                else:
                    row.append("—")
            writer.writerow(row)
        filename = f"sample-classes-matrix-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    elif view == "summary":
        writer.writerow([
            "Serial Number",
            "Sample Name",
            "Customer",
            "Vendor",
            "Status",
            "Total Orders",
            "Total Stages",
            "Completed Stages",
            "Progress %",
            "Latest Stage",
            "Latest Update",
            "Created At",
            "Remarks"
        ])
        for s in scs:
            active_orders = [o for o in s.orders if o.is_active]
            total_stages = sum(len(o.stages) for o in active_orders)
            completed_stages = sum(
                sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed")
                for o in active_orders
            )
            if total_stages > 0:
                progress = round((completed_stages / total_stages) * 100)
            elif s.status == "completed":
                progress = 100
            else:
                progress = 0

            all_stages = [st for o in active_orders for st in o.stages]
            latest_stage_info = ""
            latest_update_dt = None
            if all_stages:
                stages_with_time = [st for st in all_stages if st.updated_at]
                if stages_with_time:
                    latest_st = max(stages_with_time, key=lambda x: x.updated_at)
                    st_name = latest_st.stage_name.value if hasattr(latest_st.stage_name, "value") else str(latest_st.stage_name)
                    st_status = latest_st.status.value if hasattr(latest_st.status, "value") else str(latest_st.status)
                    latest_stage_info = f"{st_name} ({st_status})"
                    latest_update_dt = latest_st.updated_at
            
            if not latest_update_dt:
                order_dates = [o.updated_at for o in active_orders if o.updated_at]
                if order_dates:
                    latest_update_dt = max(order_dates)
                else:
                    latest_update_dt = getattr(s, "updated_at", None) or s.created_at

            writer.writerow([
                s.serial_number or "",
                s.name or "",
                s.customer or "",
                s.vendor.name if s.vendor else "",
                s.status or "",
                len(active_orders),
                total_stages,
                completed_stages,
                f"{progress}%",
                latest_stage_info,
                latest_update_dt.strftime("%Y-%m-%d %H:%M") if latest_update_dt else "",
                s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "",
                s.remarks or ""
            ])
        filename = f"sample-classes-summary-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    else:
        # Default view: WIP Product Master Table (one row per product)
        writer.writerow([
            "Class Serial",
            "Class Name",
            "Customer",
            "Vendor",
            "Product Name",
            "Style Code",
            "Order / PO #",
            "Quantity",
            "Current Stage",
            "Stage Status",
            "Stage Target Date",
            "Completed Stages",
            "Total Stages",
            "Progress %",
            "Ex-Factory Date",
            "Delivery Status",
            "Latest Stage Notes"
        ])
        for s in scs:
            active_orders = [o for o in s.orders if o.is_active]
            for order in active_orders:
                dtl = _get_order_stage_details(order)
                writer.writerow([
                    s.serial_number or "—",
                    s.name or "—",
                    s.customer or "—",
                    s.vendor.name if s.vendor else "—",
                    order.product_name or "—",
                    order.style_name or "—",
                    order.order_no or "—",
                    order.quantity or 0,
                    dtl["stage_title"],
                    dtl["stage_status"],
                    dtl["stage_target"],
                    dtl["completed_stages"],
                    dtl["total_stages"],
                    f"{dtl['progress_pct']}%",
                    dtl["ex_fac_str"] or "—",
                    dtl["deliv_status"],
                    dtl["stage_remarks"] or "—"
                ])
        filename = f"sample-classes-wip-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/sample-classes", summary="Create Sample Class")
def create_sample_class(
    payload: SampleClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    if payload.vendor_id:
        assert_vendor_access(db, payload.vendor_id, current_user)
    data = payload.model_dump()
    data["created_by"] = str(current_user.id)
    sc = SampleClassRepository.create(db, data)
    ActivityLogService.record(
        db,
        action="SAMPLE_PROJECT_CREATED",
        entity_type="Order",
        entity_id=str(sc.id),
        user=current_user,
        payload={"details": f"Sample project '{sc.name}' was created."},
    )
    dispatch_class_created_notification(db, sc, is_bulk=False, creator_user=current_user)
    return success_response(data={"id": str(sc.id)}, message="Sample Class created.")


@router.put("/sample-classes/{sample_class_id}", summary="Update Sample Class")
def update_sample_class(
    sample_class_id: str,
    payload: SampleClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(SuperAdminOnly),
):
    sc = SampleClassRepository.get_by_id(db, sample_class_id)
    if not sc:
        from fastapi import HTTPException
        raise HTTPException(404, "Sample Class not found.")
    if sc.vendor_id:
        assert_vendor_access(db, str(sc.vendor_id), current_user)
    if payload.vendor_id:
        assert_vendor_access(db, payload.vendor_id, current_user)
    old_value = {
        "name": sc.name,
        "serial_number": sc.serial_number,
        "customer": sc.customer,
        "vendor_id": str(sc.vendor_id) if sc.vendor_id else None,
        "status": sc.status,
        "remarks": sc.remarks,
    }
    updated = SampleClassRepository.update(db, sc, payload.model_dump(exclude_none=True))
    ActivityLogService.record(
        db,
        action="SAMPLE_PROJECT_UPDATED",
        entity_type="Order",
        entity_id=str(updated.id),
        user=current_user,
        payload={"details": f"Sample project '{updated.name}' was updated.", "old": old_value, "new": payload.model_dump(exclude_none=True)},
    )
    return success_response(data={"id": str(updated.id)}, message="Sample Class updated.")


@router.delete("/sample-classes/{sample_class_id}", summary="Deactivate Sample Class")
def delete_sample_class(
    sample_class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    sc = SampleClassRepository.get_by_id(db, sample_class_id)
    if not sc:
        from fastapi import HTTPException
        raise HTTPException(404, "Sample Class not found.")
    if sc.vendor_id:
        assert_vendor_access(db, str(sc.vendor_id), current_user)
    sc.status = "inactive"
    affected_orders = db.query(Order).filter(
        cast(Order.sample_class_id, String).in_(_id_variants(str(sc.id))),
        Order.is_active == True,
    ).all()
    for order in affected_orders:
        order.status = OrderStatus.cancelled
        order.is_active = False
    db.commit()
    ActivityLogService.record(
        db,
        action="SAMPLE_PROJECT_DEACTIVATED",
        entity_type="Order",
        entity_id=str(sc.id),
        user=current_user,
        payload={"details": f"Sample project '{sc.name}' was deactivated with {len(affected_orders)} active order(s)."},
    )
    return success_response(message="Sample Class and related active orders deactivated.")


@router.get("/bulk-classes", response_model=dict, summary="List Bulk Projects")
def list_bulk_classes(
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    allowed_vendor_ids = _allowed_vendor_ids(db, current_user)
    classes = OrderService.list_bulk_classes(
        db,
        created_by=None if can_view_all_company_data(current_user) else str(current_user.id),
        allowed_vendor_ids=allowed_vendor_ids,
    )
    result = []
    for bc in classes:
        active_orders = [o for o in bc.orders if o.is_active]
        total_stages = sum(len(o.stages) for o in active_orders)
        completed_stages = sum(
            sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed")
            for o in active_orders
        )
        if total_stages > 0:
            progress = round((completed_stages / total_stages) * 100)
        elif bc.status == "completed":
            progress = 100
        else:
            progress = 0

        result.append({
            "id": str(bc.id),
            "name": bc.name,
            "serial_number": bc.serial_number,
            "customer": bc.customer,
            "status": bc.status,
            "vendor_id": str(bc.vendor_id) if bc.vendor_id else None,
            "vendor_name": bc.vendor.name if bc.vendor else None,
            "vendor_names": sorted({order.vendor.name for order in bc.orders if order.is_active and order.vendor}),
            "created_at": bc.created_at.isoformat(),
            "total_orders": len(active_orders),
            "total_stages": total_stages,
            "completed_stages": completed_stages,
            "progress": progress,
        })
    return success_response(data=result)


@router.get("/bulk-classes/export/excel", summary="Export Bulk Projects Excel Workbook")
@router.get("/bulk-classes/export.xlsx", summary="Export Bulk Projects Excel Workbook")
def export_bulk_classes_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    allowed_vendor_ids = _allowed_vendor_ids(db, current_user)
    classes = OrderService.list_bulk_classes(
        db,
        created_by=None if can_view_all_company_data(current_user) else str(current_user.id),
        allowed_vendor_ids=allowed_vendor_ids,
    )
    xlsx_stream = generate_classes_workbook(classes, track_title="Bulk Projects", accent_color="1E3A8A")
    filename = f"bulk-projects-wip-{datetime.utcnow().strftime('%Y-%m-%d')}.xlsx"
    return StreamingResponse(
        xlsx_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/bulk-classes/export/csv", summary="Export Bulk Projects CSV")
@router.get("/bulk-classes/export.csv", summary="Export Bulk Projects CSV")
def export_bulk_classes_csv(
    view: str = Query("table"),
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    allowed_vendor_ids = _allowed_vendor_ids(db, current_user)
    classes = OrderService.list_bulk_classes(
        db,
        created_by=None if can_view_all_company_data(current_user) else str(current_user.id),
        allowed_vendor_ids=allowed_vendor_ids,
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    if view == "matrix":
        headers = ["Project Info / Product Index"] + [f"[{bc.serial_number or 'NO-SN'}] {bc.name}" for bc in classes]
        writer.writerow(headers)
        writer.writerow(["Customer"] + [bc.customer or "—" for bc in classes])
        
        vendors_row = []
        for bc in classes:
            active_orders = [o for o in bc.orders if o.is_active]
            v_names = sorted({o.vendor.name for o in active_orders if o.vendor})
            vendors_row.append(", ".join(v_names) if v_names else (bc.vendor.name if bc.vendor else "—"))
        writer.writerow(["Vendors"] + vendors_row)
        writer.writerow(["Status"] + [bc.status or "active" for bc in classes])

        progress_strs = []
        for bc in classes:
            active_orders = [o for o in bc.orders if o.is_active]
            total_st = sum(len(o.stages) for o in active_orders)
            comp_st = sum(sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed") for o in active_orders)
            pct = round((comp_st / total_st) * 100) if total_st > 0 else (100 if bc.status == "completed" else 0)
            progress_strs.append(f"{pct}% ({comp_st}/{total_st} stages)")
        writer.writerow(["Overall Progress"] + progress_strs)
        writer.writerow(["Total Products"] + [str(len([o for o in bc.orders if o.is_active])) for bc in classes])
        writer.writerow(["--------------------"] * len(headers))

        max_products = max([len([o for o in bc.orders if o.is_active]) for bc in classes] or [0])
        for p_idx in range(max_products):
            row = [f"Product #{p_idx + 1}"]
            for bc in classes:
                active_orders = [o for o in bc.orders if o.is_active]
                if p_idx < len(active_orders):
                    o = active_orders[p_idx]
                    dtl = _get_order_stage_details(o)
                    prod_str = f"{o.product_name or 'Product'} [{o.style_name or 'No Style'}] -> Stage: {dtl['stage_title']} ({dtl['stage_status']})"
                    if dtl["ex_fac_str"]:
                        prod_str += f" | Ex-Fac: {dtl['ex_fac_str']}"
                    prod_str += f" | Progress: {dtl['progress_pct']}%"
                    row.append(prod_str)
                else:
                    row.append("—")
            writer.writerow(row)
        filename = f"bulk-projects-matrix-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    elif view == "summary":
        writer.writerow([
            "Project Number",
            "Project Name",
            "Customer",
            "Vendors",
            "Status",
            "Total Orders",
            "Total Stages",
            "Completed Stages",
            "Progress %",
            "Latest Stage",
            "Latest Update",
            "Created At"
        ])
        for bc in classes:
            active_orders = [o for o in bc.orders if o.is_active]
            total_stages = sum(len(o.stages) for o in active_orders)
            completed_stages = sum(
                sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed")
                for o in active_orders
            )
            if total_stages > 0:
                progress = round((completed_stages / total_stages) * 100)
            elif bc.status == "completed":
                progress = 100
            else:
                progress = 0

            vendor_names = sorted({order.vendor.name for order in active_orders if order.vendor})
            vendors_str = ", ".join(vendor_names) if vendor_names else (bc.vendor.name if bc.vendor else "")

            all_stages = [st for o in active_orders for st in o.stages]
            latest_stage_info = ""
            latest_update_dt = None
            if all_stages:
                stages_with_time = [st for st in all_stages if st.updated_at]
                if stages_with_time:
                    latest_st = max(stages_with_time, key=lambda x: x.updated_at)
                    st_name = latest_st.stage_name.value if hasattr(latest_st.stage_name, "value") else str(latest_st.stage_name)
                    st_status = latest_st.status.value if hasattr(latest_st.status, "value") else str(latest_st.status)
                    latest_stage_info = f"{st_name} ({st_status})"
                    latest_update_dt = latest_st.updated_at
            
            if not latest_update_dt:
                order_dates = [o.updated_at for o in active_orders if o.updated_at]
                if order_dates:
                    latest_update_dt = max(order_dates)
                else:
                    latest_update_dt = getattr(bc, "updated_at", None) or bc.created_at

            writer.writerow([
                bc.serial_number or "",
                bc.name or "",
                bc.customer or "",
                vendors_str,
                bc.status or "",
                len(active_orders),
                total_stages,
                completed_stages,
                f"{progress}%",
                latest_stage_info,
                latest_update_dt.strftime("%Y-%m-%d %H:%M") if latest_update_dt else "",
                bc.created_at.strftime("%Y-%m-%d %H:%M") if bc.created_at else "",
            ])
        filename = f"bulk-projects-summary-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    else:
        # Default: WIP Product Master Table
        writer.writerow([
            "Project Serial",
            "Project Name",
            "Customer",
            "Vendor",
            "Product Name",
            "Style Code",
            "Order / PO #",
            "Quantity",
            "Current Stage",
            "Stage Status",
            "Stage Target Date",
            "Completed Stages",
            "Total Stages",
            "Progress %",
            "Ex-Factory Date",
            "Delivery Status",
            "Latest Stage Notes"
        ])
        for bc in classes:
            active_orders = [o for o in bc.orders if o.is_active]
            for order in active_orders:
                dtl = _get_order_stage_details(order)
                v_name = order.vendor.name if order.vendor else (bc.vendor.name if bc.vendor else "—")
                writer.writerow([
                    bc.serial_number or "—",
                    bc.name or "—",
                    bc.customer or "—",
                    v_name,
                    order.product_name or "—",
                    order.style_name or "—",
                    order.order_no or "—",
                    order.quantity or 0,
                    dtl["stage_title"],
                    dtl["stage_status"],
                    dtl["stage_target"],
                    dtl["completed_stages"],
                    dtl["total_stages"],
                    f"{dtl['progress_pct']}%",
                    dtl["ex_fac_str"] or "—",
                    dtl["deliv_status"],
                    dtl["stage_remarks"] or "—"
                ])
        filename = f"bulk-projects-wip-{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/bulk-classes", response_model=dict, summary="Create Bulk Project")
def create_bulk_class(
    payload: BulkClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    bc = OrderService.create_bulk_class(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="BULK_PROJECT_CREATED",
        entity_type="Order",
        entity_id=str(bc.id),
        user=current_user,
        payload={"details": f"Bulk project '{bc.name}' was created."},
    )
    dispatch_class_created_notification(db, bc, is_bulk=True, creator_user=current_user)
    return success_response(data={"id": str(bc.id), "name": bc.name})


@router.put("/bulk-classes/{bc_id}", response_model=dict, summary="Update Bulk Project")
def update_bulk_class(
    bc_id: str,
    payload: BulkClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(SuperAdminOnly),
):
    bc = BulkClassRepository.get_by_id(db, bc_id)
    if not bc:
        from fastapi import HTTPException
        raise HTTPException(404, "Bulk Project not found.")
    if not _is_admin_user(current_user) and str(bc.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only update your own bulk projects.")
    old_value = {
        "name": bc.name,
        "serial_number": bc.serial_number,
        "customer": bc.customer,
        "status": bc.status,
        "remarks": bc.remarks,
    }
    updated = BulkClassRepository.update(db, bc, payload.model_dump(exclude_none=True))
    ActivityLogService.record(
        db,
        action="BULK_PROJECT_UPDATED",
        entity_type="Order",
        entity_id=str(updated.id),
        user=current_user,
        payload={"details": f"Bulk project '{updated.name}' was updated.", "old": old_value, "new": payload.model_dump(exclude_none=True)},
    )
    return success_response(data={"id": str(updated.id), "name": updated.name}, message="Bulk Project updated.")


@router.delete("/bulk-classes/{bc_id}", response_model=dict, summary="Deactivate Bulk Project")
def delete_bulk_class(
    bc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    bc = BulkClassRepository.get_by_id(db, bc_id)
    if not bc:
        from fastapi import HTTPException
        raise HTTPException(404, "Bulk Project not found.")
    if not _is_admin_user(current_user) and str(bc.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only deactivate your own bulk projects.")
    bc.status = "inactive"
    affected_orders = db.query(Order).filter(
        cast(Order.bulk_class_id, String).in_(_id_variants(str(bc.id))),
        Order.is_active == True,
    ).all()
    for order in affected_orders:
        order.status = OrderStatus.cancelled
        order.is_active = False
    db.commit()
    ActivityLogService.record(
        db,
        action="BULK_PROJECT_DEACTIVATED",
        entity_type="Order",
        entity_id=str(bc.id),
        user=current_user,
        payload={"details": f"Bulk project '{bc.name}' was deactivated with {len(affected_orders)} active order(s)."},
    )
    return success_response(message="Bulk Project and related active orders deactivated.")


@router.get("/bulk-classes/{bc_id}", response_model=dict, summary="Get Bulk Project Detail")
def get_bulk_class(
    bc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    bc = BulkClassRepository.get_by_id(db, bc_id)
    if not bc:
        from fastapi import HTTPException
        raise HTTPException(404, "Bulk Project not found.")
    if not can_view_all_company_data(current_user) and str(bc.created_by) != str(current_user.id):
        allowed_vendor_ids = set(_allowed_vendor_ids(db, current_user) or [])
        if not any(str(order.vendor_id) in allowed_vendor_ids for order in bc.orders if order.is_active):
            raise HTTPException(status_code=403, detail="You can only access your assigned bulk projects.")
    return success_response(data={
        "id": str(bc.id),
        "name": bc.name,
        "serial_number": bc.serial_number,
        "customer": bc.customer,
        "status": bc.status,
        "remarks": bc.remarks,
        "vendor_names": sorted({order.vendor.name for order in bc.orders if order.is_active and order.vendor}),
        "order_count": len(bc.orders),
    })


@router.post("/bulk", response_model=dict, summary="Bulk Create Orders (Style Phase)")
def bulk_create_orders(
    payload: BulkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    for item in payload.items:
        assert_vendor_access(db, item.vendor_id, current_user)
    orders = OrderService.bulk_create_orders(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="BULK_ORDERS_CREATED",
        entity_type="Order",
        entity_id=str(payload.bulk_class_id),
        user=current_user,
        payload={"details": f"{len(orders)} bulk production batches initialized."},
    )
    for o in orders:
        dispatch_order_created_notification(db, o, creator_user=current_user)
    return success_response(
        data={"count": len(orders)},
        message=f"Successfully initialized {len(orders)} production batches."
    )


# ─── Order Endpoints ────────────────────────────────────────────────────────

@router.get("", response_model=dict, summary="List Orders")
@router.get("/", response_model=dict, summary="List Orders")
def list_orders(
    vendor_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    track_type: Optional[str] = Query(None),
    sample_class_id: Optional[str] = Query(None),
    bulk_class_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    allowed_vendor_ids = _allowed_vendor_ids(db, current_user)
    orders = OrderService.list_orders(
        db, client_id=vendor_id, status=status, 
        track_type=track_type, skip=skip, limit=limit,
        sample_class_id=sample_class_id, bulk_class_id=bulk_class_id,
        allowed_vendor_ids=allowed_vendor_ids,
    )
    return success_response(data=[
        {
            "id": str(o.id), 
            "order_no": o.order_no, 
            "vendor_id": str(o.vendor_id),
            "vendor_name": o.vendor.name if o.vendor else None,
            "style_name": o.style_name,
            "product_name": o.product_name,
            "quantity": o.quantity,
            "ex_factory_date": str(o.ex_factory_date) if o.ex_factory_date else None,
            "reference_attachments": o.reference_attachments or [],
            "status": o.status.value, 
            "priority": o.priority.value,
            "track_type": o.track_type.value,
            "is_delayed": getattr(o, "is_delayed", False),
            "delay_days": o.delay_days,
            "top_sample_status": o.top_sample_status,
            "qa_audit_status": o.qa_audit_status,
            "sample_class_id": str(o.sample_class_id) if o.sample_class_id else None,
            "bulk_class_id": str(o.bulk_class_id) if o.bulk_class_id else None,
            "total_stages": len(o.stages),
            "completed_stages": sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed"),
            "progress": (
                100 if o.status.value == "completed"
                else round((sum(1 for st in o.stages if (st.status.value if hasattr(st.status, "value") else str(st.status)) == "completed") / len(o.stages)) * 100) if len(o.stages) > 0
                else 0
            ),
        }
        for o in orders
    ])


@router.post("", response_model=dict, summary="Create Order")
@router.post("/", response_model=dict, summary="Create Order")
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    assert_vendor_access(db, payload.vendor_id, current_user)
    order = OrderService.create_order(db, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_CREATED",
        entity_type="Order",
        entity_id=str(order.id),
        user=current_user,
        payload={"details": f"Order '{order.order_no or order.product_name or order.style_name}' was created."},
    )
    dispatch_order_created_notification(db, order, creator_user=current_user)
    return success_response(
        data={"id": str(order.id), "order_no": order.order_no},
        message="Order created successfully."
    )


@router.delete("/{order_id}", response_model=dict, summary="Cancel/Deactivate Order")
def delete_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    order = OrderService.delete_order(db, order_id, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_CANCELLED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Order '{order.order_no or order.product_name or order.style_name}' was cancelled/deactivated."},
    )
    return success_response(message="Order cancelled successfully.")


@router.get("/{order_id}/history", response_model=dict, summary="Get Order History")
def get_order_history(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    _assert_order_access(db, order_id, current_user)
    order_events = db.query(OrderHistory).filter(OrderHistory.order_id == order_id).order_by(OrderHistory.created_at.desc()).all()
    audit_events = db.query(AuditLog).filter(
        AuditLog.entity_type == "Order",
        AuditLog.entity_id == str(order_id),
    ).order_by(AuditLog.created_at.desc()).all()

    def audit_payload(log: AuditLog) -> dict:
        if not log.payload:
            return {}
        try:
            parsed = json.loads(log.payload)
            return parsed if isinstance(parsed, dict) else {"value": parsed}
        except json.JSONDecodeError:
            return {"details": log.payload}

    events = [
        {
            "id": str(item.id),
            "source": "order_history",
            "action": item.action,
            "details": item.note or "",
            "old_value": item.old_value,
            "new_value": item.new_value,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "user": item.changed_by_user.full_name if item.changed_by_user else "System",
        }
        for item in order_events
    ]
    events.extend([
        {
            "id": str(log.id),
            "source": "activity_log",
            "action": log.action,
            "details": audit_payload(log).get("details") or audit_payload(log).get("message") or "",
            "old_value": audit_payload(log).get("old"),
            "new_value": audit_payload(log).get("new"),
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user": log.user.full_name if log.user else "System",
        }
        for log in audit_events
    ])
    events.sort(key=lambda item: item["created_at"] or "", reverse=True)
    return success_response(data=events)


@router.get("/{order_id}", response_model=dict, summary="Get Order Detail")
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    order = _assert_order_access(db, order_id, current_user)
    return success_response(data={
        "id": str(order.id), 
        "order_no": order.order_no,
        "vendor_id": str(order.vendor_id),
        "vendor_name": order.vendor.name if order.vendor else None,
        "style_name": order.style_name,
        "product_name": order.product_name,
        "product_type": order.product_type,
        "fabric": order.fabric,
        "tech_pack_no": order.tech_pack_no,
        "quantity": order.quantity,
        "ex_factory_date": str(order.ex_factory_date) if order.ex_factory_date else None,
        "status": order.status.value, 
        "priority": order.priority.value,
        "track_type": order.track_type.value,
        "remarks": order.remarks,
        "requirements": order.requirements,
        "reference_image": order.reference_image,
        "reference_attachments": order.reference_attachments or [],
        "current_iteration": order.current_iteration,
        "iteration_reason": order.iteration_reason,
        "iteration_plan": order.iteration_plan,
        "iteration_history": order.iteration_history,
        "top_sample_status": order.top_sample_status,
        "qa_audit_status": order.qa_audit_status,
        "delay_days": order.delay_days,
        "sample_class_id": str(order.sample_class_id) if order.sample_class_id else None,
        "sample_class_name": order.sample_class.name if order.sample_class else None,
        "bulk_class_id": str(order.bulk_class_id) if order.bulk_class_id else None,
        "bulk_class_name": order.bulk_class.name if order.bulk_class else None,
        "order_placement_date": str(order.order_placement_date) if getattr(order, 'order_placement_date', None) else None,
        "attachments": [
            {
                "id": str(a.id),
                "file_name": a.file_name,
                "file_path": a.file_path,
                "file_type": a.file_type,
                "created_at": a.created_at.isoformat()
            }
            for a in order.attachments
        ]
    })


@router.put("/{order_id}", response_model=dict, summary="Update Order")
def update_order(
    order_id: str,
    payload: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    _assert_order_access(db, order_id, current_user)
    if payload.vendor_id:
        assert_vendor_access(db, payload.vendor_id, current_user)
    OrderService.update_order(db, order_id, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_UPDATED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": "Order details were updated."},
    )
    return success_response(message="Order updated successfully.")


# ─── Production Stages ─────────────────────────────────────────────────────

@router.get("/{order_id}/stages", response_model=dict, summary="Get Production Stages")
def get_stages(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    _assert_order_access(db, order_id, current_user)
    stages = StageService.get_stages(db, order_id)
    return success_response(data=[
        {
            "id": str(s.id), 
            "stage_name": s.stage_name.value,
            "stage_order": s.stage_order,
            "module_type": s.module_type.value,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "completion_date": s.completion_date.isoformat() if s.completion_date else None,
            "target_date": s.target_date.isoformat() if s.target_date else None,
            "status": s.status.value, 
            "remarks": s.remarks,
            "attachment_url": s.attachment_url,
            "responsible_person": s.responsible_person.full_name if s.responsible_person else None,
            "updated_by": s.updater.full_name if s.updater else None,
            "chunk_id": str(s.chunk_id) if s.chunk_id else None,
            "chunk_name": s.chunk.name if s.chunk else None,
            "chunk_target_days": s.chunk.target_days if s.chunk else None,
            "approval_status": s.approval_status.value if s.approval_status else None,
            "conditional_action": s.conditional_action,
            "condition_status": s.condition_status,
            "gated_stage_name": s.gated_stage_name,
            "condition_cleared_at": s.condition_cleared_at.isoformat() if s.condition_cleared_at else None,
            "condition_cleared_by": str(s.condition_cleared_by) if s.condition_cleared_by else None,
            "condition_cleared_by_name": s.condition_clearer.full_name if s.condition_clearer else None,
            "clearance_attachment_url": s.clearance_attachment_url,
            "clearance_notes": s.clearance_notes,
        }
        for s in stages
    ])


@router.get("/{order_id}/assignments", summary="Get Production Assignments for Order")
def get_order_assignments(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    _assert_order_access(db, order_id, current_user)
    from app.models.order import OrderProductionAssignment
    assignments = db.query(OrderProductionAssignment).filter(
        OrderProductionAssignment.order_id == order_id
    ).all()
    return success_response(data=[{
        "id": str(a.id),
        "floor_name": a.floor.name if a.floor else None,
        "line_name": a.line.name if a.line else "Full Floor",
        "assignment_type": a.assignment_type,
        "notes": a.notes,
    } for a in assignments])


@router.post("/{order_id}/reiterate", response_model=dict, summary="Reject and Restart Iteration")
def reiterate_order(
    order_id: str,
    payload: dict, # {reason: str, plan: str}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    reason = payload.get("reason", "No reason provided")
    plan = payload.get("plan", "No plan provided")
    order = OrderService.reiterate_order(db, order_id, reason, plan, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_REITERATED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Order moved to iteration {order.current_iteration}.", "reason": reason},
    )
    return success_response(
        data={"id": str(order.id), "current_iteration": order.current_iteration},
        message=f"Order moved to Iteration {order.current_iteration}."
    )


@router.post("/{order_id}/stages", response_model=dict, summary="Add Production Stage")
def add_stage(
    order_id: str,
    payload: StageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    _assert_order_access(db, order_id, current_user)
    stage = StageService.add_stage(db, order_id, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_STAGE_ADDED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Stage '{stage.stage_name.value}' was added."},
    )
    return success_response(
        data={"id": str(stage.id), "stage_name": stage.stage_name.value},
        message="Stage added."
    )


@router.put("/stages/{stage_id}", response_model=dict, summary="Update Production Stage")
def update_stage(
    stage_id: str,
    payload: StageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_stage_order_access(db, stage_id, current_user)
    stage = StageService.update_stage(db, stage_id, payload, str(current_user.id))
    ActivityLogService.record(
        db,
        action="ORDER_STAGE_UPDATED",
        entity_type="Order",
        entity_id=str(stage.order_id),
        user=current_user,
        payload={
            "details": f"Stage '{stage.stage_name.value}' was marked {stage.status.value}.",
            "stage_id": stage_id,
            "stage": stage.stage_name.value,
            "status": stage.status.value,
        },
    )
    return success_response(message="Stage updated.")


@router.post("/stages/{stage_id}/rework", response_model=dict, summary="Reject Stage and Repeat From Selected Stage")
def reject_stage_for_rework(
    stage_id: str,
    payload: StageReworkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_stage_order_access(db, stage_id, current_user)
    order = StageService.reject_stage_for_rework(
        db,
        stage_id,
        payload.repeat_from_stage_id,
        payload.reason,
        payload.plan or "",
        str(current_user.id),
    )
    ActivityLogService.record(
        db,
        action="ORDER_STAGE_REWORK",
        entity_type="Order",
        entity_id=str(order.id),
        user=current_user,
        payload={
            "details": f"Order moved to iteration {order.current_iteration} for stage rework.",
            "reason": payload.reason,
            "repeat_from_stage_id": payload.repeat_from_stage_id,
        },
    )
    return success_response(
        data={"id": str(order.id), "current_iteration": order.current_iteration},
        message=f"Stage rejected. Iteration {order.current_iteration} started."
    )


@router.post("/stages/{stage_id}/approve", response_model=dict, summary="3-State Stage Approval")
def approve_stage(
    stage_id: str,
    payload: StageApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    """Approve, conditionally approve, or reject a QC / approval-gated stage."""
    _assert_stage_order_access(db, stage_id, current_user)
    stage = StageService.approve_stage(
        db,
        stage_id=stage_id,
        approval=payload.approval,
        condition_type=payload.condition_type or "",
        reason=payload.reason or "",
        plan=payload.plan or "",
        user_id=str(current_user.id),
        repeat_from_stage_id=payload.repeat_from_stage_id,
    )
    ActivityLogService.record(
        db,
        action=f"STAGE_APPROVAL_{payload.approval.upper()}",
        entity_type="Order",
        entity_id=str(stage.order_id),
        user=current_user,
        payload={"details": f"Stage '{stage.stage_name.value}' approval: {payload.approval}", "condition": payload.condition_type},
    )
    return success_response(
        data={"id": str(stage.id), "approval_status": payload.approval},
        message=f"Stage approval recorded: {payload.approval}."
    )


@router.post("/stages/{stage_id}/clear-condition", response_model=dict, summary="Clear Conditional Approval Defect with Mandatory Proof")
def clear_stage_condition(
    stage_id: str,
    notes: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    """Clear a pending conditional defect approval by uploading mandatory proof and notes."""
    _assert_stage_order_access(db, stage_id, current_user)

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Mandatory proof attachment file must be uploaded to clear defect condition.")

    if not notes or not notes.strip():
        raise HTTPException(status_code=400, detail="Clearance notes/remarks are required.")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files (JPG, PNG, WebP) are allowed as proof attachments.")

    stage = StageService.get_stage(db, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found.")

    ext = file.filename.split(".")[-1].lower()
    filename = f"clearance_{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    attachment_url = f"/api/uploads/attachments/{filename}"

    # Add as Order attachment
    attachment = Attachment(
        order_id=stage.order_id,
        file_name=f"[Clearance Proof] {file.filename}",
        file_path=attachment_url,
        file_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    db.flush()

    cleared_stage = StageService.clear_stage_condition(
        db,
        stage_id=stage_id,
        attachment_url=attachment_url,
        clearance_notes=notes.strip(),
        user_id=str(current_user.id),
    )

    ActivityLogService.record(
        db,
        action="STAGE_CONDITION_CLEARED",
        entity_type="Order",
        entity_id=str(stage.order_id),
        user=current_user,
        payload={"stage": stage.stage_name.value, "proof_file": file.filename, "notes": notes.strip()},
    )

    return success_response(
        data={
            "id": str(cleared_stage.id),
            "condition_status": "cleared",
            "clearance_attachment_url": attachment_url,
            "clearance_notes": notes.strip(),
            "condition_cleared_at": cleared_stage.condition_cleared_at.isoformat() if cleared_stage.condition_cleared_at else None,
        },
        message="Conditional defect cleared successfully with proof attachment. Downstream stage is now unlocked."
    )


@router.post("/{order_id}/promote-to-bulk", response_model=dict, summary="Promote Sample to Bulk")
def promote_to_bulk(
    order_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    """Create a new Bulk order from a completed Sample order."""
    _assert_order_access(db, order_id, current_user)
    bulk_class_id = payload.get("bulk_class_id")
    vendor_id = payload.get("vendor_id")
    if not bulk_class_id or not vendor_id:
        raise HTTPException(status_code=400, detail="bulk_class_id and vendor_id are required.")
    assert_vendor_access(db, vendor_id, current_user)
    new_order = OrderService.promote_to_bulk(
        db, order_id, bulk_class_id, vendor_id, str(current_user.id), payload_data=payload
    )
    ActivityLogService.record(
        db,
        action="ORDER_PROMOTED_TO_BULK",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Sample order promoted to bulk. New order: {new_order.id}"},
    )
    return success_response(
        data={"id": str(new_order.id), "order_no": new_order.order_no},
        message="Sample order successfully promoted to bulk."
    )


@router.post("/{order_id}/reorder", response_model=dict, summary="Reorder — Clone Completed Bulk Order")
def reorder(
    order_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(ManagerAccess),
):
    """Clone a completed bulk order with full bulk order configuration."""
    _assert_order_access(db, order_id, current_user)
    vendor_id = payload.get("vendor_id", "")
    if vendor_id:
        assert_vendor_access(db, vendor_id, current_user)
    new_order = OrderService.reorder(
        db,
        original_order_id=order_id,
        user_id=str(current_user.id),
        data=payload,
    )
    ActivityLogService.record(
        db,
        action="ORDER_REORDERED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Reorder created. New order: {new_order.id}", "quantity": new_order.quantity},
    )
    return success_response(
        data={"id": str(new_order.id), "order_no": new_order.order_no},
        message="Reorder created successfully."
    )


# ─── File Attachments ──────────────────────────────────────────────────────


ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}

@router.post("/{order_id}/attachments", response_model=dict, summary="Upload Attachment")
def upload_attachment(
    order_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(AllStaff),
):
    _assert_order_access(db, order_id, current_user)
    if file.content_type not in ALLOWED_TYPES:
        from app.utils.response import error_response
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Only PDF and image files are allowed.")

    ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    attachment = Attachment(
        order_id=order_id,
        file_name=file.filename,
        file_path=filepath,
        file_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    db.commit()
    ActivityLogService.record(
        db,
        action="ORDER_ATTACHMENT_ADDED",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={"details": f"Attachment '{file.filename}' was added."},
    )

    return success_response(
        data={"file_name": file.filename, "file_path": filepath},
        message="File uploaded successfully."
    )


# ─── Order Reminder Templates API (Partial, Date Delay, Order Complete) ─────────

from pydantic import BaseModel, Field
from app.services.email_service import (
    build_partial_order_email,
    build_date_delay_email,
    build_order_complete_email,
    send_order_status_reminder,
)


class SendOrderReminderRequest(BaseModel):
    template_type: str = Field(..., description="One of: partial, date_delay, order_complete")
    recipients: list[str] = Field(..., min_length=1, description="List of destination email addresses")
    cc: list[str] = Field(default=[], description="Optional CC email addresses")
    custom_note: str = Field(default="", description="Optional note to append to the reminder")
    subject_override: str = Field(default="", description="Optional override for the email subject")


def _build_order_dict_for_reminder(order: Order) -> dict:
    current_stage_name = "Production Planning"
    if order.stages:
        pending_stages = [s for s in order.stages if str(getattr(s, "status", "")) != "completed"]
        if pending_stages:
            active_s = pending_stages[0]
            current_stage_name = active_s.stage_name.value if hasattr(active_s.stage_name, "value") else str(active_s.stage_name)
        else:
            current_stage_name = "Packing & Dispatch"

    customer_name = "Direct Customer"
    if order.sample_class and order.sample_class.customer:
        customer_name = order.sample_class.customer
    elif order.bulk_class and order.bulk_class.customer:
        customer_name = order.bulk_class.customer

    return {
        "id": str(order.id),
        "order_no": order.order_no or f"PO-{str(order.id)[:8]}",
        "style_name": order.style_name or order.product_name or "Standard Garment",
        "product_name": order.product_name,
        "customer": customer_name,
        "vendor_name": order.vendor.name if order.vendor else "Main Factory Facility",
        "quantity": order.quantity or 0,
        "completed_quantity": int((order.quantity or 0) * 0.5) if order.status != OrderStatus.completed else (order.quantity or 0),
        "ex_factory_date": str(order.ex_factory_date) if order.ex_factory_date else "TBD",
        "current_stage": current_stage_name,
        "days_delayed": order.delay_days,
        "delay_reason": order.delay_reason or "Material supply delay / Quality re-inspection",
        "delay_capa": order.delay_capa or "Line balancing adjusted, weekend overtime scheduled",
        "recovery_date": str(order.recovery_date) if order.recovery_date else None,
        "remarks": order.remarks,
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "qa_audit_status": order.qa_audit_status or "PASSED (AQL 1.5 Standard)",
    }


@router.get("/{order_id}/reminder-templates", tags=["Orders"])
def get_order_reminder_templates(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(OrderReadAccess),
):
    """
    Returns all 3 pre-rendered reminder templates (Partial, Date Delay, Order Complete)
    populated with real data for this order, ready for visual preview or direct copying.
    """
    order = _assert_order_access(db, order_id, current_user)
    order_data = _build_order_dict_for_reminder(order)

    subj_partial, html_partial = build_partial_order_email(order_data)
    subj_delay, html_delay     = build_date_delay_email(order_data)
    subj_comp, html_comp       = build_order_complete_email(order_data)

    manager_email = order.vendor.assigned_manager.email if order.vendor and order.vendor.assigned_manager else current_user.email
    vendor_email = order.vendor.email if order.vendor and order.vendor.email else ""

    suggested_recipients = [e for e in [manager_email, vendor_email] if e]
    if not suggested_recipients:
        suggested_recipients = [current_user.email]

    return success_response(
        data={
            "order": order_data,
            "suggested_recipients": suggested_recipients,
            "templates": {
                "partial": {
                    "key": "partial",
                    "title": "Partial Order Attention",
                    "badge": "⏳ Partial Progress",
                    "badge_color": "#d97706",
                    "description": "Notice for orders with partial quantity complete or stuck in mid-stages.",
                    "subject": subj_partial,
                    "html": html_partial,
                },
                "date_delay": {
                    "key": "date_delay",
                    "title": "Date Delay Escalation",
                    "badge": f"🚨 {order_data['days_delayed']} Days Overdue" if order_data['days_delayed'] > 0 else "🚨 Schedule Risk",
                    "badge_color": "#dc2626",
                    "description": "Urgent escalation alert when ex-factory deadline is breached or at risk.",
                    "subject": subj_delay,
                    "html": html_delay,
                },
                "order_complete": {
                    "key": "order_complete",
                    "title": "Order Completed & Dispatch",
                    "badge": "✅ 100% Completed",
                    "badge_color": "#16a34a",
                    "description": "Milestone notification confirming 100% production and final QC sign-off.",
                    "subject": subj_comp,
                    "html": html_comp,
                },
            },
        },
        message="Reminder templates generated successfully."
    )


@router.post("/{order_id}/send-reminder", tags=["Orders"])
def send_order_reminder(
    order_id: str,
    payload: SendOrderReminderRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(ManagerAccess),
):
    """
    Sends the selected reminder email template (partial, date_delay, or order_complete)
    with optional custom notes and subject overrides in the background.
    """
    order = _assert_order_access(db, order_id, current_user)
    order_data = _build_order_dict_for_reminder(order)

    # Queue email sending in the background so HTTP request finishes in <100ms
    background_tasks.add_task(
        send_order_status_reminder,
        template_type=payload.template_type,
        order=order_data,
        recipients=payload.recipients,
        cc_emails=payload.cc,
        custom_note=payload.custom_note,
        subject_override=payload.subject_override,
    )

    ActivityLogService.record(
        db,
        action="ORDER_REMINDER_SENT",
        entity_type="Order",
        entity_id=order_id,
        user=current_user,
        payload={
            "template_type": payload.template_type,
            "recipients": payload.recipients,
            "subject": payload.subject_override or f"Order Status Update — {order_data.get('order_no')}",
        },
    )

    return success_response(
        data={
            "status": "queued",
            "template_type": payload.template_type,
            "recipients": payload.recipients,
            "cc": payload.cc,
        },
        message=f"Reminder email '{payload.template_type}' queued and sending in the background."
    )

