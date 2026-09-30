"""
Pre-Order Request Pydantic Schemas.
Validates all data coming in from the API for pre-order requests.
"""
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, field_validator
from app.models.pre_order_request import PreOrderCategory, PreOrderPriority, PreOrderStatus


class PreOrderCreate(BaseModel):
    class_name: str
    category: PreOrderCategory
    style_name: Optional[str] = None
    customer: Optional[str] = None
    reference_po: Optional[str] = None
    quantity: Optional[int] = None
    total_product_count: int = 1  # Required total number of products/orders expected
    ex_factory_date: Optional[date] = None
    priority: PreOrderPriority = PreOrderPriority.normal
    notes: Optional[str] = None
    vendor_id: Optional[str] = None
    assigned_manager_id: str

    @field_validator("class_name", "assigned_manager_id", mode="before")
    @classmethod
    def not_empty(cls, v):
        if isinstance(v, str) and not v.strip():
            raise ValueError("This field is required.")
        return v

    @field_validator("style_name", "customer", "reference_po", "notes", "vendor_id", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class PreOrderUpdate(BaseModel):
    class_name: Optional[str] = None
    category: Optional[PreOrderCategory] = None
    style_name: Optional[str] = None
    customer: Optional[str] = None
    reference_po: Optional[str] = None
    quantity: Optional[int] = None
    total_product_count: Optional[int] = None
    processed_product_count: Optional[int] = None
    ex_factory_date: Optional[date] = None
    priority: Optional[PreOrderPriority] = None
    notes: Optional[str] = None
    vendor_id: Optional[str] = None
    assigned_manager_id: Optional[str] = None
    linked_class_id: Optional[str] = None


class PreOrderLinkOrder(BaseModel):
    """Payload to link a pre-order to an actual order."""
    order_id: str
    products_count: Optional[int] = 1


class PreOrderIgnore(BaseModel):
    """Payload to mark a pre-order as ignored."""
    reason: Optional[str] = None


class PreOrderInitializeClass(BaseModel):
    """Payload to initialize or confirm collection class details."""
    class_name: Optional[str] = None
    customer: Optional[str] = None
    serial_number: Optional[str] = None
    vendor_id: Optional[str] = None
    remarks: Optional[str] = None


class PreOrderProceed(BaseModel):
    """Payload to convert/proceed a pre-order into a production order."""
    order_no: Optional[str] = None
    style_name: Optional[str] = None
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    fabric: Optional[str] = None
    tech_pack_no: Optional[str] = None
    quantity: Optional[int] = None
    products_count: Optional[int] = 1  # Number of products accounted for in this entry
    ex_factory_date: date
    order_placement_date: Optional[date] = None
    priority: Optional[PreOrderPriority] = None
    vendor_id: str
    remarks: Optional[str] = None
    requirements: Optional[str] = None


class PreOrderOut(BaseModel):
    id: str
    class_name: str
    category: str
    style_name: Optional[str]
    customer: Optional[str]
    reference_po: Optional[str]
    quantity: Optional[int]
    total_product_count: int = 1
    processed_product_count: int = 0
    ex_factory_date: Optional[date] = None
    priority: str
    notes: Optional[str]
    vendor_id: Optional[str]
    vendor_name: Optional[str] = None
    assigned_manager_id: str
    assigned_manager_name: Optional[str] = None
    assigned_manager_email: Optional[str] = None
    assigned_by_id: str
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    linked_class_id: Optional[str] = None
    linked_order_id: Optional[str] = None
    linked_at: Optional[datetime] = None
    status: str
    ignore_reason: Optional[str] = None
    hours_elapsed: Optional[float] = None
    days_elapsed: Optional[float] = None
    first_reminder_sent_at: Optional[datetime] = None
    second_reminder_sent_at: Optional[datetime] = None
    escalation_sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
