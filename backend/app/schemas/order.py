"""
Step 2 Schemas — Vendor & Order request/response shapes.
Pydantic validates all data coming in from the API.
"""
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.order import OrderStatus, OrderPriority, StageStatus, StageName, TrackType


# ─── Vendor Schemas ────────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    assigned_manager_id: Optional[str] = None

    @field_validator('email', 'assigned_manager_id', 'phone', 'country', 'contact_person', 'address', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    assigned_manager_id: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('name', 'email', 'assigned_manager_id', 'phone', 'country', 'contact_person', 'address', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class VendorOut(BaseModel):
    id: str
    name: str
    contact_person: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    country: Optional[str]
    is_active: bool
    created_at: datetime
    total_orders: Optional[int] = 0

    class Config:
        from_attributes = True


# ─── Sample Class Schemas ──────────────────────────────────────────────────

class SampleClassCreate(BaseModel):
    name: str
    serial_number: Optional[str] = None
    customer: Optional[str] = None
    vendor_id: Optional[str] = None
    remarks: Optional[str] = None

class SampleClassUpdate(BaseModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    customer: Optional[str] = None
    vendor_id: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

class SampleClassOut(BaseModel):
    id: str
    name: str
    serial_number: Optional[str]
    customer: Optional[str]
    vendor_id: Optional[str]
    status: str
    remarks: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Bulk Class Schemas ────────────────────────────────────────────────────

class BulkClassCreate(BaseModel):
    name: str
    serial_number: Optional[str] = None
    customer: Optional[str] = None
    remarks: Optional[str] = None

class BulkClassUpdate(BaseModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    customer: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

class BulkClassOut(BaseModel):
    id: str
    name: str
    serial_number: Optional[str]
    customer: Optional[str]
    status: str
    remarks: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ProductionAssignmentCreate(BaseModel):
    floor_id: Optional[str] = None
    line_ids: Optional[List[str]] = []
    notes: Optional[str] = None

class ReferenceAttachment(BaseModel):
    url: str
    requirement: Optional[str] = None
    filename: Optional[str] = None

class StageChunkCreate(BaseModel):
    name: str
    target_days: int
    stage_names: List[StageName]

class OrderCreate(BaseModel):
    vendor_id: str
    order_no: Optional[str] = None
    style_name: Optional[str] = None
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    fabric: Optional[str] = None
    tech_pack_no: Optional[str] = None
    quantity: int
    ex_factory_date: Optional[date] = None
    order_placement_date: Optional[date] = None
    priority: OrderPriority = OrderPriority.normal
    track_type: TrackType = TrackType.bulk
    total_target_days: Optional[int] = None
    remarks: Optional[str] = None
    requirements: Optional[str] = None
    reference_image: Optional[str] = None
    reference_attachments: Optional[List[ReferenceAttachment]] = []
    sample_class_id: Optional[str] = None
    bulk_class_id: Optional[str] = None
    sample_department_id: Optional[str] = None
    stages: Optional[List['StageCreate']] = None
    stage_chunks: Optional[List[StageChunkCreate]] = None
    assignments: Optional[List[ProductionAssignmentCreate]] = None

class BulkOrderCreate(BaseModel):
    bulk_class_id: str
    items: List[OrderCreate]




class OrderUpdate(BaseModel):
    vendor_id: Optional[str] = None
    order_no: Optional[str] = None
    style_name: Optional[str] = None
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    fabric: Optional[str] = None
    quantity: Optional[int] = None
    ex_factory_date: Optional[date] = None
    status: Optional[OrderStatus] = None
    track_type: Optional[TrackType] = None
    priority: Optional[OrderPriority] = None
    total_target_days: Optional[int] = None
    remarks: Optional[str] = None
    requirements: Optional[str] = None
    reference_image: Optional[str] = None
    reference_attachments: Optional[List[ReferenceAttachment]] = None
    stage_chunks: Optional[List[StageChunkCreate]] = None
    # Class assignment fields — required for Assign to Class and class-context editing
    sample_class_id: Optional[str] = None
    bulk_class_id: Optional[str] = None


class OrderOut(BaseModel):
    id: str
    vendor_id: str
    vendor_name: Optional[str] = None
    order_no: Optional[str]
    style_name: Optional[str]
    product_name: Optional[str]
    product_type: Optional[str]
    fabric: Optional[str]
    quantity: int
    ex_factory_date: Optional[date]
    status: str
    track_type: str
    priority: str
    total_target_days: Optional[int]
    is_delayed: bool = False
    requirements: Optional[str]
    reference_image: Optional[str]
    reference_attachments: Optional[List[ReferenceAttachment]] = []
    sample_class_id: Optional[str]
    current_stage_id: Optional[str]
    top_sample_status: str
    qa_audit_status: str
    delay_days: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Production Stage Schemas ─────────────────────────────────────────────

class StageCreate(BaseModel):
    module_type: TrackType
    stage_name: StageName
    stage_order: int
    is_required: bool = True
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    target_days: Optional[int] = None # Added for manual day assignment
    responsible_person_id: Optional[str] = None
    remarks: Optional[str] = None


class StageUpdate(BaseModel):
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    responsible_person_id: Optional[str] = None
    status: Optional[StageStatus] = None
    remarks: Optional[str] = None
    attachment_url: Optional[str] = None


class StageReworkRequest(BaseModel):
    repeat_from_stage_id: str
    reason: str
    plan: Optional[str] = None


class StageOut(BaseModel):
    id: str
    order_id: str
    module_type: str
    stage_name: str
    stage_order: int
    is_required: bool
    start_date: Optional[datetime]
    completion_date: Optional[datetime]
    target_date: Optional[datetime]
    status: str
    remarks: Optional[str]
    attachment_url: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


class StageChunkOut(BaseModel):
    id: str
    order_id: str
    name: str
    target_days: int
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    stage_names: List[str]

    class Config:
        from_attributes = True
