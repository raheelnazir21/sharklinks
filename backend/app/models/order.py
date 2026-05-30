import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Boolean, Date, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.user import GUID

class OrderStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    delayed = "delayed"
    cancelled = "cancelled"

class OrderPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"

class TrackType(str, enum.Enum):
    sampling = "sampling"
    bulk = "bulk"

class StageStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"

class StageName(str, enum.Enum):
    # ─── Shared Stages ────────────────────────────────────────────────────────
    fabrication = "fabrication"
    stitching = "stitching"
    finishing = "finishing"
    completed = "completed"

    # ─── Sample Development Flow ──────────────────────────────────────────────
    sample_start = "sample_start"
    fabric_cutting = "fabric_cutting"
    embellishment = "embellishment"
    washing = "washing"
    qc_check = "qc_check"
    dispatch = "dispatch"
    sample_completed = "sample_completed"

    # ─── Bulk Production Flow ─────────────────────────────────────────────────
    customer_order = "customer_order_wrapping_card"
    pp_sample_development = "pp_sample_development"
    customer_approval = "customer_approval"
    fabric_shade_approval = "fabric_shade_continuity_approval"
    sublimation = "sublimation"
    bulk_fabric_cutting = "bulk_fabric_cutting"
    end_line_qc = "end_line_qc"
    pressing = "pressing"
    final_random_inspection = "final_random_inspection"
    shipment = "shipment_ex_factory"

    # Legacy bulk stage names kept for existing production data.
    bulk_start = "bulk_start"
    pp_sample = "pp_sample"
    bulk_cutting = "bulk_cutting"
    bulk_embellishment = "printing_embroidery_embellishment"
    top_sample_picked = "top_sample_picked_from_bulk"
    packing = "packing"
    final_qa_audit = "final_random_qa_audit"
    ex_factory = "ex_factory"

class LocationStatus(str, enum.Enum):
    idle = "idle"
    partial = "partial"
    available = "available"
    occupied = "occupied"
    maintenance = "maintenance"

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    assigned_manager_id = Column(GUID(), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sample_classes = relationship("SampleClass", back_populates="vendor")
    orders = relationship("Order", back_populates="vendor")
    floors = relationship("VendorFloor", back_populates="vendor")
    departments = relationship("VendorDepartment", back_populates="vendor")
    assigned_manager = relationship("User", foreign_keys=[assigned_manager_id])

class SampleClass(Base):
    __tablename__ = "sample_classes"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    serial_number = Column(String(100), nullable=True)
    customer = Column(String(100), nullable=True)
    vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=True)
    status = Column(String(50), default="active")
    remarks = Column(Text, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    vendor = relationship("Vendor", back_populates="sample_classes")
    orders = relationship("Order", back_populates="sample_class")

class BulkClass(Base):
    __tablename__ = "bulk_classes"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    serial_number = Column(String(100), nullable=True)
    customer = Column(String(100), nullable=True)
    status = Column(String(50), default="active")
    remarks = Column(Text, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    orders = relationship("Order", back_populates="bulk_class")

class Order(Base):
    __tablename__ = "orders"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=False)
    order_no = Column(String(100), nullable=True)
    style_name = Column(String(200), nullable=True)
    product_name = Column(String(200), nullable=True)
    product_type = Column(String(100), nullable=True)
    fabric = Column(String(200), nullable=True)
    tech_pack_no = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=False, default=0)
    ex_factory_date = Column(Date, nullable=True)
    order_placement_date = Column(Date, nullable=True)
    
    status = Column(Enum(OrderStatus), default=OrderStatus.pending)
    track_type = Column(Enum(TrackType), default=TrackType.bulk)
    priority = Column(Enum(OrderPriority), default=OrderPriority.normal)
    
    total_target_days = Column(Integer, nullable=True)
    remarks = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    reference_image = Column(String(500), nullable=True)
    reference_attachments = Column(JSON, default=[])
    
    sample_class_id = Column(GUID(), ForeignKey("sample_classes.id"), nullable=True)
    bulk_class_id = Column(GUID(), ForeignKey("bulk_classes.id"), nullable=True)
    
    top_sample_status = Column(String(50), default="pending")
    qa_audit_status = Column(String(50), default="pending")
    
    is_active = Column(Boolean, default=True)
    parent_id = Column(String(100), nullable=True)
    
    # Iteration Logic for Sampling
    current_iteration = Column(Integer, default=1)
    iteration_reason = Column(Text, nullable=True)
    iteration_plan = Column(Text, nullable=True)
    iteration_history = Column(JSON, default=[])
    
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="orders", foreign_keys=[vendor_id])
    sample_class = relationship("SampleClass", back_populates="orders")
    bulk_class = relationship("BulkClass", back_populates="orders")
    stages = relationship("ProductionStage", back_populates="order", order_by="ProductionStage.stage_order")
    stage_chunks = relationship("ProductionStageChunk", back_populates="order", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="order")
    assignments = relationship("OrderProductionAssignment", back_populates="order")
    history = relationship("OrderHistory", back_populates="order")

    @property
    def delay_days(self):
        if self.status == OrderStatus.completed: return 0
        if not self.ex_factory_date: return 0
        from datetime import date
        delta = date.today() - self.ex_factory_date
        return max(0, delta.days)

class ProductionStageChunk(Base):
    __tablename__ = "production_stage_chunks"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    name = Column(String(200), nullable=False)
    target_days = Column(Integer, nullable=False, default=1)
    
    start_date = Column(DateTime, nullable=True)
    target_date = Column(DateTime, nullable=True)
    completion_date = Column(DateTime, nullable=True)
    
    order = relationship("Order", back_populates="stage_chunks")
    stages = relationship("ProductionStage", back_populates="chunk", order_by="ProductionStage.stage_order")

class ProductionStage(Base):
    __tablename__ = "production_stages"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    chunk_id = Column(GUID(), ForeignKey("production_stage_chunks.id"), nullable=True)
    module_type = Column(Enum(TrackType), nullable=False)
    stage_name = Column(Enum(StageName), nullable=False)
    stage_order = Column(Integer, nullable=False)
    is_required = Column(Boolean, default=True)
    
    start_date = Column(DateTime, nullable=True)
    completion_date = Column(DateTime, nullable=True)
    target_date = Column(DateTime, nullable=True)
    
    responsible_person_id = Column(GUID(), ForeignKey("users.id"), nullable=True)
    status = Column(Enum(StageStatus), default=StageStatus.pending)
    remarks = Column(Text, nullable=True)
    attachment_url = Column(String(500), nullable=True)
    
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="stages")
    chunk = relationship("ProductionStageChunk", back_populates="stages")
    responsible_person = relationship("User", foreign_keys=[responsible_person_id])
    updater = relationship("User", foreign_keys=[updated_by])

class Attachment(Base):
    __tablename__ = "order_attachments"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=True)
    uploaded_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="attachments")

class OrderHistory(Base):
    __tablename__ = "order_history"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    action = Column(String(100), nullable=False)
    changed_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="history")
    changed_by_user = relationship("User", foreign_keys=[changed_by])

class OrderAudit(Base):
    __tablename__ = "order_audits"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    before_photo = Column(String(500), nullable=True)
    after_photo = Column(String(500), nullable=True)
    documents = Column(JSON, default=[])
    new_po_number = Column(String(100), nullable=True)
    new_vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=True)
    is_moved_to_bulk = Column(Boolean, default=False)
    moved_to_bulk_order_id = Column(GUID(), nullable=True)
    is_shipped = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", foreign_keys=[order_id])
    new_vendor = relationship("Vendor", foreign_keys=[new_vendor_id])

class OrderProductionAssignment(Base):
    __tablename__ = "order_production_assignments"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=False)
    floor_id = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=True)
    line_id = Column(GUID(), ForeignKey("vendor_lines.id"), nullable=True)
    department_id = Column(GUID(), ForeignKey("vendor_departments.id"), nullable=True)
    assignment_type = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="assignments")
    floor = relationship("VendorFloor", foreign_keys=[floor_id])
    line = relationship("VendorLine", foreign_keys=[line_id])
    department = relationship("VendorDepartment")

class VendorDepartment(Base):
    __tablename__ = "vendor_departments"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=False)
    name = Column(String(100), nullable=False, default="Sampling Department")
    department_type = Column(String(50), nullable=False, default="sampling")
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="departments")

class VendorFloor(Base):
    __tablename__ = "vendor_floors"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(GUID(), ForeignKey("vendors.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    total_lines = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    status = Column(Enum(LocationStatus), default=LocationStatus.available)
    vendor = relationship("Vendor", back_populates="floors")
    lines = relationship("VendorLine", back_populates="floor")

class VendorLine(Base):
    __tablename__ = "vendor_lines"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    floor_id = Column(GUID(), ForeignKey("vendor_floors.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    capacity = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    status = Column(Enum(LocationStatus), default=LocationStatus.available)
    floor = relationship("VendorFloor", back_populates="lines")
