import pytest
from app.models.user import User, Role, RoleEnum
from app.models.order import BulkClass, Order, Vendor, OrderStatus, TrackType, OrderPriority
from app.models.pre_order_request import PreOrderRequest, PreOrderStatus, PreOrderCategory, PreOrderPriority
from app.schemas.pre_order import PreOrderCreate
from app.services.pre_order_service import PreOrderService


def test_create_pre_order_and_auto_sync_existing_orders(db):
    # 1. Setup role and users
    admin_role = db.query(Role).filter(Role.name == RoleEnum.admin).first()
    if not admin_role:
        admin_role = Role(name=RoleEnum.admin, permissions=[])
        db.add(admin_role)
        db.commit()

    manager_user = User(
        email="manager_test@example.com",
        full_name="Factory Manager",
        password_hash="fakehash",
        role_id=admin_role.id,
        is_active=True,
    )
    admin_user = User(
        email="admin_test@example.com",
        full_name="Admin Test",
        password_hash="fakehash",
        role_id=admin_role.id,
        is_active=True,
    )
    vendor = Vendor(name="Wasaib Apparels", email="wasaib@example.com")
    db.add_all([manager_user, admin_user, vendor])
    db.commit()

    # 2. Suppose a BulkClass already exists with 2 orders assigned to it
    class_name = "CRPLIM // CRPSNW // FRGRN"
    bulk_class = BulkClass(
        name=class_name,
        customer="Bark Fashion",
        vendor_id=vendor.id,
        created_by=admin_user.id,
    )
    db.add(bulk_class)
    db.commit()

    order1 = Order(
        bulk_class_id=bulk_class.id,
        vendor_id=vendor.id,
        order_no="PO-2026-001",
        quantity=500,
        is_active=True,
        status=OrderStatus.pending,
        track_type=TrackType.bulk,
        priority=OrderPriority.normal,
    )
    order2 = Order(
        bulk_class_id=bulk_class.id,
        vendor_id=vendor.id,
        order_no="PO-2026-002",
        quantity=500,
        is_active=True,
        status=OrderStatus.pending,
        track_type=TrackType.bulk,
        priority=OrderPriority.normal,
    )
    db.add_all([order1, order2])
    db.commit()

    # 3. Create pre-order request for 10 products
    payload = PreOrderCreate(
        class_name=class_name,
        category=PreOrderCategory.bulk,
        customer="Bark Fashion",
        reference_po="PO-2026-001",
        total_product_count=10,
        quantity=12000,
        priority=PreOrderPriority.normal,
        notes="Total qty is split into 10 products",
        vendor_id=str(vendor.id),
        assigned_manager_id=str(manager_user.id),
    )

    result = PreOrderService.create(db, payload, admin_user)

    # 4. Verify pre-order was successfully created and auto-synced
    assert result is not None
    assert result["class_name"] == class_name
    assert result["assigned_manager_name"] == "Factory Manager"
    assert result["vendor_name"] == "Wasaib Apparels"
    assert result["total_product_count"] == 10
    # Because 2 orders were already in the class, it should detect them and mark status as partial
    assert result["processed_product_count"] == 2
    assert result["status"] == "partial"
    assert "PO-2026-001" in result["linked_order_id"]
    assert "PO-2026-002" in result["linked_order_id"]
