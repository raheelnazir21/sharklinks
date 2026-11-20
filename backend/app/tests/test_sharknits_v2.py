"""
Acceptance Tests for Sharknits WIP & Production Management System v2.0.
Verifies all scenarios from Section 9 of the change request specification:
- Test 1: PO sequence generates SK100, then SK101 atomically without duplicates.
- Test 2: Style DZ_BJ generation and reuse across multiple POs.
- Test 3: Stage expense tracking: 100 + 250 at cutting, 150 at stitching -> stage totals 350 and 150, PO total 500.
- Test 4: Financial summary: Order value 1,200 and costs 500 -> remaining margin 700.
- Test 6: Removed stages (Small Wet Dye, Endline QC) not in default bulk sequence.
"""
import pytest
from datetime import date
from app.models.order import Order, Vendor, POSequence, Style, StageExpense, StageName, TrackType
from app.services.po_style_service import generate_next_po_number, resolve_or_create_style
from app.services.order_service import StageService


def test_scenario_1_po_auto_numbering(db):
    """Test 1: Creating first eligible PO generates SK100; second generates SK101."""
    # Ensure fresh sequence
    db.query(POSequence).delete()
    db.commit()

    po1 = generate_next_po_number(db, prefix="SK")
    po2 = generate_next_po_number(db, prefix="SK")
    po3 = generate_next_po_number(db, prefix="SK")

    assert po1 == "SK100"
    assert po2 == "SK101"
    assert po3 == "SK102"


def test_scenario_2_style_code_generation_and_reuse(db):
    """Test 2: Creating Delta Zeta Baseball Jersey yields DZ_BJ and can be reused."""
    db.query(Style).delete()
    db.commit()

    code1 = resolve_or_create_style(
        db,
        brand_name="Delta Zeta",
        article_type="Baseball Jersey"
    )
    assert code1 == "DZ_BJ"

    # Reusing the same style
    code1_reused = resolve_or_create_style(
        db,
        brand_name="Delta Zeta",
        article_type="Baseball Jersey"
    )
    assert code1_reused == "DZ_BJ"

    # Different design with same initials -> suffix collision handling
    code2 = resolve_or_create_style(
        db,
        brand_name="Danger Zone",
        article_type="Biker Jacket"
    )
    assert code2 == "DZ_BJ-2"


def test_scenario_3_and_4_stage_expenses_and_margin(db):
    """
    Test 3 & 4:
    Stage expenses 100 + 250 in Cutting, 150 in Stitching -> stage totals 350 and 150, PO total 500.
    With order value 1,200 and costs 500 -> remaining margin 700.
    """
    vendor = Vendor(name="Test Factory", country="USA")
    db.add(vendor)
    db.flush()

    order = Order(
        vendor_id=vendor.id,
        po_number="SK100",
        style_code="DZ_BJ",
        order_value=1200.0,
        quantity=500,
    )
    db.add(order)
    db.flush()

    # Add expenses
    e1 = StageExpense(order_id=order.id, stage_name="bulk_fabric_cutting", amount=100.0, description="Pattern paper")
    e2 = StageExpense(order_id=order.id, stage_name="bulk_fabric_cutting", amount=250.0, description="Blades & markers")
    e3 = StageExpense(order_id=order.id, stage_name="stitching", amount=150.0, description="Thread & needles")
    db.add_all([e1, e2, e3])
    db.commit()
    db.refresh(order)

    # Compute stage sums
    cutting_total = sum(e.amount for e in order.expenses if e.stage_name == "bulk_fabric_cutting")
    stitching_total = sum(e.amount for e in order.expenses if e.stage_name == "stitching")
    
    assert cutting_total == 350.0
    assert stitching_total == 150.0
    assert order.total_cost == 500.0
    assert order.remaining_margin == 700.0


def test_scenario_6_removed_stages_not_in_bulk_defaults():
    """Test 6: Removed stages ('Small Wet Dye', 'Endline QC') are excluded from new bulk orders."""
    stages = StageService._default_stage_names("bulk")
    stage_enum_names = [s[1] for s in stages]

    assert StageName.small_vet_dying not in stage_enum_names
    assert StageName.end_line_qc not in stage_enum_names
    assert len(stages) == 13
