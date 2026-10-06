"""
Order Repository — all DB queries for Orders, Stages, and History.
"""
from typing import List, Optional
import uuid
from datetime import date
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from app.models.order import Order, ProductionStage, OrderHistory, OrderStatus, Vendor, SampleClass, BulkClass


def _id_variants(value: str) -> list[str]:
    values = [value]
    try:
        parsed = uuid.UUID(str(value))
        values.extend([str(parsed), parsed.hex])
    except (TypeError, ValueError):
        pass
    return list(dict.fromkeys(values))


class SampleClassRepository:
    @staticmethod
    def get_all(db: Session, vendor_id: Optional[str] = None, allowed_vendor_ids: Optional[list[str]] = None):
        q = db.query(SampleClass).filter(SampleClass.status != "inactive")
        if vendor_id:
            q = q.filter(cast(SampleClass.vendor_id, String).in_(_id_variants(vendor_id)))
        if allowed_vendor_ids is not None:
            q = q.filter(cast(SampleClass.vendor_id, String).in_(allowed_vendor_ids))
        return q.order_by(SampleClass.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, sc_id: str):
        return db.query(SampleClass).filter(cast(SampleClass.id, String).in_(_id_variants(sc_id))).first()

    @staticmethod
    def create(db: Session, data: dict):
        sc = SampleClass(**data)
        db.add(sc)
        db.commit()
        db.refresh(sc)
        return sc

    @staticmethod
    def update(db: Session, sample_class: SampleClass, data: dict):
        for key, value in data.items():
            if value is not None:
                setattr(sample_class, key, value)
        db.commit()
        db.refresh(sample_class)
        return sample_class


class BulkClassRepository:
    @staticmethod
    def get_all(db: Session, created_by: Optional[str] = None, allowed_vendor_ids: Optional[list[str]] = None):
        q = db.query(BulkClass).filter(BulkClass.status != "inactive")
        if created_by:
            q = q.filter(cast(BulkClass.created_by, String).in_(_id_variants(created_by)))
        if allowed_vendor_ids is not None:
            q = q.outerjoin(Order, Order.bulk_class_id == BulkClass.id).filter(
                (cast(Order.vendor_id, String).in_(allowed_vendor_ids)) | (cast(BulkClass.created_by, String).in_(_id_variants(created_by or "")))
            ).distinct()
        return q.order_by(BulkClass.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, bc_id: str):
        return db.query(BulkClass).filter(cast(BulkClass.id, String).in_(_id_variants(bc_id))).first()

    @staticmethod
    def create(db: Session, data: dict):
        bc = BulkClass(**data)
        db.add(bc)
        db.commit()
        db.refresh(bc)
        return bc

    @staticmethod
    def update(db: Session, bulk_class: BulkClass, data: dict):
        for key, value in data.items():
            if value is not None:
                setattr(bulk_class, key, value)
        db.commit()
        db.refresh(bulk_class)
        return bulk_class



class OrderRepository:

    @staticmethod
    def get_all(
        db: Session,
        vendor_id: Optional[str] = None,
        status: Optional[str] = None,
        track_type: Optional[str] = None,
        sample_class_id: Optional[str] = None,
        bulk_class_id: Optional[str] = None,
        created_by: Optional[str] = None,
        allowed_vendor_ids: Optional[list[str]] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Order]:
        q = db.query(Order).filter(Order.is_active == True)
        if track_type:
            q = q.filter(Order.track_type == track_type)
        if vendor_id:
            q = q.filter(cast(Order.vendor_id, String).in_(_id_variants(vendor_id)))
        if status:
            q = q.filter(Order.status == status)
        if sample_class_id:
            # Look up the sample class to get its vendor_id for backward compatibility.
            # Existing orders created before class-scoping was added have sample_class_id = NULL.
            # We show: (a) orders properly linked to this class, OR
            #          (b) legacy orders with no class (NULL) that belong to the same vendor, OR
            #          (c) orders whose name contains the class name (to allow re-routing if misassigned).
            sc = db.query(SampleClass).filter(
                cast(SampleClass.id, String).in_(_id_variants(sample_class_id))
            ).first()
            if sc and sc.vendor_id:
                vendor_id_variants = _id_variants(str(sc.vendor_id))
                q = q.filter(or_(
                    cast(Order.sample_class_id, String).in_(_id_variants(sample_class_id)),
                    Order.product_name.ilike(f"%{sc.name}%"),
                    (Order.sample_class_id == None) & (cast(Order.vendor_id, String).in_(vendor_id_variants))
                ))
            elif sc:
                q = q.filter(or_(
                    cast(Order.sample_class_id, String).in_(_id_variants(sample_class_id)),
                    Order.product_name.ilike(f"%{sc.name}%")
                ))
            else:
                q = q.filter(cast(Order.sample_class_id, String).in_(_id_variants(sample_class_id)))
        if bulk_class_id:
            bc = db.query(BulkClass).filter(
                cast(BulkClass.id, String).in_(_id_variants(bulk_class_id))
            ).first()
            if bc:
                q = q.filter(or_(
                    cast(Order.bulk_class_id, String).in_(_id_variants(bulk_class_id)),
                    Order.style_name.ilike(f"%{bc.name}%")
                ))
            else:
                q = q.filter(cast(Order.bulk_class_id, String).in_(_id_variants(bulk_class_id)))
        if created_by:
            q = q.filter(cast(Order.created_by, String).in_(_id_variants(created_by)))
        if allowed_vendor_ids is not None:
            q = q.filter(cast(Order.vendor_id, String).in_(allowed_vendor_ids))

        
        # Eager load vendor and stages to eliminate N+1 queries during serialization
        return (
            q.options(
                joinedload(Order.vendor),
                selectinload(Order.stages),
            )
            .order_by(Order.ex_factory_date.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, order_id: str) -> Optional[Order]:
        return (
            db.query(Order)
            .options(
                joinedload(Order.vendor),
                selectinload(Order.stages),
            )
            .filter(
                cast(Order.id, String).in_(_id_variants(order_id)), Order.is_active == True
            )
            .first()
        )

    @staticmethod
    def get_by_order_no(db: Session, order_no: str) -> Optional[Order]:
        return db.query(Order).filter(Order.order_no == order_no).first()

    @staticmethod
    def create(db: Session, data: dict) -> Order:
        order = Order(**data)
        db.add(order)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def update(db: Session, order: Order, data: dict) -> Order:
        for key, value in data.items():
            if value is not None:
                setattr(order, key, value)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def soft_delete(db: Session, order: Order) -> Order:
        order.is_active = False
        db.commit()
        return order

    @staticmethod
    def log_history(db: Session, order_id: str, action: str, changed_by: str,
                    old_value: dict = None, new_value: dict = None, note: str = None):
        history = OrderHistory(
            order_id=order_id,
            action=action,
            changed_by=changed_by,
            old_value=old_value,
            new_value=new_value,
            note=note,
        )
        db.add(history)
        db.commit()


class StageRepository:

    @staticmethod
    def get_by_order(db: Session, order_id: str) -> List[ProductionStage]:
        return db.query(ProductionStage).filter(
            cast(ProductionStage.order_id, String).in_(_id_variants(order_id))
        ).order_by(ProductionStage.stage_order.asc()).all()

    @staticmethod
    def get_by_id(db: Session, stage_id: str) -> Optional[ProductionStage]:
        return db.query(ProductionStage).filter(
            cast(ProductionStage.id, String).in_(_id_variants(stage_id))
        ).first()

    @staticmethod
    def create(db: Session, data: dict) -> ProductionStage:
        stage = ProductionStage(**data)
        db.add(stage)
        db.commit()
        db.refresh(stage)
        return stage

    @staticmethod
    def update(db: Session, stage: ProductionStage, data: dict) -> ProductionStage:
        for key, value in data.items():
            if value is not None:
                setattr(stage, key, value)
        db.commit()
        db.refresh(stage)
        return stage
