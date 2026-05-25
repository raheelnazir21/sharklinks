"""
Floors & Lines API — Manage production floors and lines within a vendor facility.
Vendor → Floor → Line hierarchy with status tracking (idle/occupied/partial).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.models.order import (
    Vendor, VendorDepartment, VendorFloor, VendorLine, OrderProductionAssignment, LocationStatus
)
from app.utils.response import success_response

router = APIRouter(prefix="/vendors", tags=["Floors & Lines"])

ManagerAccess = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager])
AllStaff = require_roles([RoleEnum.super_admin, RoleEnum.admin, RoleEnum.manager, RoleEnum.qc_officer])


# ─── Schemas ───────────────────────────────────────────────────────────────

class FloorCreate(BaseModel):
    name: str
    description: Optional[str] = None
    total_lines: Optional[int] = 0

class FloorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    total_lines: Optional[int] = None
    status: Optional[str] = None

class LineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    capacity: Optional[int] = None

class LineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None

class DepartmentCreate(BaseModel):
    name: str = "Sampling Department"
    department_type: str = "sampling"
    description: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class AssignmentCreate(BaseModel):
    order_id: str
    floor_id: str
    line_ids: Optional[List[str]] = []  # Empty = full floor assignment
    notes: Optional[str] = None

    @property
    def assignment_type(self) -> str:
        if not self.line_ids:
            return "full_floor"
        return "single_line" if len(self.line_ids) == 1 else "multi_line"


# ─── Helper: compute floor status ──────────────────────────────────────────

def _compute_floor_status(floor: VendorFloor) -> str:
    """Derive floor status from its lines' statuses."""
    if not floor.lines:
        return "idle"
    statuses = [l.status for l in floor.lines if l.is_active]
    if all(s == LocationStatus.occupied for s in statuses):
        return "occupied"
    if any(s not in (LocationStatus.idle, LocationStatus.available) for s in statuses):
        return "partial"
    return "idle"


def _serialize_line(line: VendorLine) -> dict:
    return {
        "id": str(line.id),
        "floor_id": str(line.floor_id),
        "name": line.name,
        "description": line.description,
        "capacity": line.capacity,
        "status": line.status.value if hasattr(line.status, "value") else line.status,
        "is_active": line.is_active,
    }


def _serialize_floor(floor: VendorFloor, with_lines: bool = True) -> dict:
    data = {
        "id": str(floor.id),
        "vendor_id": str(floor.vendor_id),
        "name": floor.name,
        "description": floor.description,
        "total_lines": floor.total_lines,
        "status": _compute_floor_status(floor),
        "is_active": floor.is_active,
        "line_count": len([l for l in floor.lines if l.is_active]),
    }
    if with_lines:
        data["lines"] = [_serialize_line(l) for l in floor.lines if l.is_active]
    return data

def _serialize_department(department: VendorDepartment) -> dict:
    return {
        "id": str(department.id),
        "vendor_id": str(department.vendor_id),
        "name": department.name,
        "department_type": department.department_type,
        "description": department.description,
        "is_active": department.is_active,
    }

def _get_or_create_sampling_department(db: Session, vendor_id: str) -> VendorDepartment:
    department = db.query(VendorDepartment).filter(
        VendorDepartment.vendor_id == vendor_id,
        VendorDepartment.department_type == "sampling",
        VendorDepartment.is_active == True,
    ).first()
    if department:
        return department
    department = VendorDepartment(
        vendor_id=vendor_id,
        name="Sampling Department",
        department_type="sampling",
        description="Default sample development area for this vendor.",
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.get("/{vendor_id}/departments", summary="List Departments for a Vendor")
def list_departments(
    vendor_id: str,
    department_type: Optional[str] = Query(None),
    ensure_sampling: bool = Query(True),
    db: Session = Depends(get_db),
    _=Depends(AllStaff),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_active == True).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found.")
    if ensure_sampling and (department_type in (None, "", "sampling")):
        _get_or_create_sampling_department(db, vendor_id)
    query = db.query(VendorDepartment).filter(VendorDepartment.vendor_id == vendor_id, VendorDepartment.is_active == True)
    if department_type:
        query = query.filter(VendorDepartment.department_type == department_type)
    departments = query.order_by(VendorDepartment.name.asc()).all()
    return success_response(data=[_serialize_department(item) for item in departments])


@router.post("/{vendor_id}/departments", summary="Add Department to Vendor")
def create_department(
    vendor_id: str,
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_active == True).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found.")
    department = VendorDepartment(
        vendor_id=vendor_id,
        name=payload.name,
        department_type=payload.department_type,
        description=payload.description,
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return success_response(data=_serialize_department(department), message="Department added successfully.")


@router.put("/{vendor_id}/departments/{department_id}", summary="Update Department")
def update_department(
    vendor_id: str,
    department_id: str,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    department = db.query(VendorDepartment).filter(
        VendorDepartment.id == department_id,
        VendorDepartment.vendor_id == vendor_id,
    ).first()
    if not department:
        raise HTTPException(404, "Department not found.")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(department, key, value)
    db.commit()
    db.refresh(department)
    return success_response(data=_serialize_department(department), message="Department updated.")


# ═══════════════════════════════════════════════════════════════════════════
#  FLOOR ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{vendor_id}/floors", summary="List Floors for a Vendor")
def list_floors(
    vendor_id: str,
    idle_only: bool = Query(False, description="Return only idle/available floors"),
    db: Session = Depends(get_db),
    _=Depends(AllStaff),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_active == True).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found.")

    floors = [f for f in vendor.floors if f.is_active]
    if idle_only:
        floors = [f for f in floors if _compute_floor_status(f) in ("idle", "partial")]

    return success_response(data=[_serialize_floor(f) for f in floors])


@router.post("/{vendor_id}/floors", summary="Add Floor to Vendor")
def create_floor(
    vendor_id: str,
    payload: FloorCreate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_active == True).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found.")

    floor = VendorFloor(
        vendor_id=vendor_id,
        name=payload.name,
        description=payload.description,
        total_lines=payload.total_lines or 0,
    )
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return success_response(data=_serialize_floor(floor), message="Floor added successfully.")


@router.put("/{vendor_id}/floors/{floor_id}", summary="Update Floor")
def update_floor(
    vendor_id: str,
    floor_id: str,
    payload: FloorUpdate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    floor = db.query(VendorFloor).filter(
        VendorFloor.id == floor_id, VendorFloor.vendor_id == vendor_id, VendorFloor.is_active == True
    ).first()
    if not floor:
        raise HTTPException(404, "Floor not found.")

    for k, v in payload.dict(exclude_none=True).items():
        setattr(floor, k, v)
    db.commit()
    return success_response(data=_serialize_floor(floor), message="Floor updated.")


@router.delete("/{vendor_id}/floors/{floor_id}", summary="Delete Floor")
def delete_floor(
    vendor_id: str,
    floor_id: str,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    floor = db.query(VendorFloor).filter(
        VendorFloor.id == floor_id, VendorFloor.vendor_id == vendor_id
    ).first()
    if not floor:
        raise HTTPException(404, "Floor not found.")
    floor.is_active = False
    db.commit()
    return success_response(message="Floor removed.")


# ═══════════════════════════════════════════════════════════════════════════
#  LINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{vendor_id}/floors/{floor_id}/lines", summary="List Lines for a Floor")
def list_lines(
    vendor_id: str,
    floor_id: str,
    idle_only: bool = Query(False, description="Return only idle lines"),
    db: Session = Depends(get_db),
    _=Depends(AllStaff),
):
    floor = db.query(VendorFloor).filter(
        VendorFloor.id == floor_id, VendorFloor.vendor_id == vendor_id, VendorFloor.is_active == True
    ).first()
    if not floor:
        raise HTTPException(404, "Floor not found.")

    lines = [l for l in floor.lines if l.is_active]
    if idle_only:
        lines = [l for l in lines if l.status == LocationStatus.idle]

    return success_response(data=[_serialize_line(l) for l in lines])


@router.post("/{vendor_id}/floors/{floor_id}/lines", summary="Add Line to Floor")
def create_line(
    vendor_id: str,
    floor_id: str,
    payload: LineCreate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    floor = db.query(VendorFloor).filter(
        VendorFloor.id == floor_id, VendorFloor.vendor_id == vendor_id, VendorFloor.is_active == True
    ).first()
    if not floor:
        raise HTTPException(404, "Floor not found.")

    line = VendorLine(
        floor_id=floor_id,
        name=payload.name,
        description=payload.description,
        capacity=payload.capacity,
    )
    db.add(line)
    # Update total_lines counter
    floor.total_lines = len([l for l in floor.lines if l.is_active]) + 1
    db.commit()
    db.refresh(line)
    return success_response(data=_serialize_line(line), message="Line added successfully.")


@router.put("/{vendor_id}/floors/{floor_id}/lines/{line_id}", summary="Update Line")
def update_line(
    vendor_id: str,
    floor_id: str,
    line_id: str,
    payload: LineUpdate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    line = db.query(VendorLine).filter(
        VendorLine.id == line_id, VendorLine.floor_id == floor_id, VendorLine.is_active == True
    ).first()
    if not line:
        raise HTTPException(404, "Line not found.")

    for k, v in payload.dict(exclude_none=True).items():
        setattr(line, k, v)
    db.commit()
    return success_response(data=_serialize_line(line), message="Line updated.")


@router.delete("/{vendor_id}/floors/{floor_id}/lines/{line_id}", summary="Delete Line")
def delete_line(
    vendor_id: str,
    floor_id: str,
    line_id: str,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    line = db.query(VendorLine).filter(
        VendorLine.id == line_id, VendorLine.floor_id == floor_id
    ).first()
    if not line:
        raise HTTPException(404, "Line not found.")
    line.is_active = False
    # Recalculate total_lines
    floor = db.query(VendorFloor).filter(VendorFloor.id == floor_id).first()
    if floor:
        floor.total_lines = len([l for l in floor.lines if l.is_active and l.id != line.id])
    db.commit()
    return success_response(message="Line removed.")


# ═══════════════════════════════════════════════════════════════════════════
#  PRODUCTION ASSIGNMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/{vendor_id}/assign", summary="Assign Production Location to Order")
def assign_production(
    vendor_id: str,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    _=Depends(ManagerAccess),
):
    # Validate floor belongs to this vendor
    floor = db.query(VendorFloor).filter(
        VendorFloor.id == payload.floor_id, VendorFloor.vendor_id == vendor_id
    ).first()
    if not floor:
        raise HTTPException(404, "Floor not found for this vendor.")

    # Remove existing assignments for this order on this floor
    db.query(OrderProductionAssignment).filter(
        OrderProductionAssignment.order_id == payload.order_id,
        OrderProductionAssignment.floor_id == payload.floor_id,
    ).delete()

    created = []
    if not payload.line_ids:
        # Full floor assignment
        asgn = OrderProductionAssignment(
            order_id=payload.order_id,
            vendor_id=vendor_id,
            floor_id=payload.floor_id,
            line_id=None,
            assignment_type="full_floor",
            notes=payload.notes,
        )
        db.add(asgn)
        # Mark all lines on floor as occupied
        for line in floor.lines:
            if line.is_active:
                line.status = LocationStatus.occupied
        floor.status = LocationStatus.occupied
        created.append("full_floor")
    else:
        for line_id in payload.line_ids:
            line = db.query(VendorLine).filter(VendorLine.id == line_id, VendorLine.floor_id == payload.floor_id).first()
            if not line:
                continue
            asgn = OrderProductionAssignment(
                order_id=payload.order_id,
                vendor_id=vendor_id,
                floor_id=payload.floor_id,
                line_id=line_id,
                assignment_type="single_line" if len(payload.line_ids) == 1 else "multi_line",
                notes=payload.notes,
            )
            db.add(asgn)
            line.status = LocationStatus.occupied

        # Recalculate floor status
        active_lines = [l for l in floor.lines if l.is_active]
        occupied = [l for l in active_lines if l.status == LocationStatus.occupied]
        if len(occupied) == len(active_lines):
            floor.status = LocationStatus.occupied
        elif occupied:
            floor.status = LocationStatus.partial
        created = payload.line_ids

    db.commit()
    return success_response(
        data={"assigned": created, "assignment_type": payload.assignment_type},
        message="Production location assigned successfully."
    )


@router.get("/{vendor_id}/assignments", summary="Get all assignments for a vendor")
def list_vendor_assignments(
    vendor_id: str,
    db: Session = Depends(get_db),
    _=Depends(AllStaff),
):
    assignments = db.query(OrderProductionAssignment).filter(
        OrderProductionAssignment.vendor_id == vendor_id
    ).all()
    return success_response(data=[{
        "id": str(a.id),
        "order_id": str(a.order_id),
        "floor_id": str(a.floor_id),
        "floor_name": a.floor.name if a.floor else None,
        "line_id": str(a.line_id) if a.line_id else None,
        "line_name": a.line.name if a.line else None,
        "assignment_type": a.assignment_type,
        "notes": a.notes,
    } for a in assignments])
