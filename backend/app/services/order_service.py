"""
Order Service — business logic for orders and production stages.
Key rules:
- Auto-mark order as 'delayed' if today > ex_factory_date and not completed.
- Auto-mark order as 'completed' when all stages are done.
- Log every status change in order_history.
"""
from typing import List, Optional
from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.order_repo import OrderRepository, StageRepository, BulkClassRepository
from app.schemas.order import OrderCreate, OrderUpdate, StageCreate, StageUpdate, BulkOrderCreate, BulkClassCreate

from app.models.order import Order, ProductionStage, OrderStatus, StageStatus, OrderProductionAssignment, VendorFloor, VendorLine, VendorDepartment, LocationStatus, BulkClass, TrackType



class OrderService:

    @staticmethod
    def get_or_create_sampling_department(db: Session, vendor_id: str, department_id: Optional[str] = None) -> VendorDepartment:
        query = db.query(VendorDepartment).filter(
            VendorDepartment.vendor_id == vendor_id,
            VendorDepartment.department_type == "sampling",
            VendorDepartment.is_active == True,
        )
        department = query.filter(VendorDepartment.id == department_id).first() if department_id else query.first()
        if department:
            return department

        department = VendorDepartment(
            vendor_id=vendor_id,
            name="Sampling Department",
            department_type="sampling",
            description="Default sample development area for this vendor.",
        )
        db.add(department)
        db.flush()
        return department

    @staticmethod
    def list_orders(
        db: Session,
        client_id: Optional[str] = None,
        status: Optional[str] = None,
        track_type: Optional[str] = None,
        sample_class_id: Optional[str] = None,
        bulk_class_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Order]:
        orders = OrderRepository.get_all(
            db, 
            vendor_id=client_id, 
            status=status, 
            track_type=track_type, 
            sample_class_id=sample_class_id,
            bulk_class_id=bulk_class_id,
            skip=skip, 
            limit=limit
        )

        # Auto-flag delays in memory (not updating DB on every read — use a scheduled task for that)
        today = date.today()
        for order in orders:
            if (
                order.ex_factory_date
                and order.ex_factory_date < today
                and order.status not in (OrderStatus.completed, OrderStatus.cancelled)
            ):
                order.is_delayed = True
        return orders

    @staticmethod
    def get_order(db: Session, order_id: str) -> Order:
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        return order

    @staticmethod
    def create_order(db: Session, payload: OrderCreate, user_id: str) -> Order:
        data = payload.model_dump(exclude={"stages", "assignments", "sample_department_id"})
        data["created_by"] = user_id
        order = OrderRepository.create(db, data)
        
        # ─── 1. Initialize Sequential Stages ─────────────────────────────────────
        from datetime import timedelta, datetime as dt
        from app.models.order import StageName
        
        # Determine starting date for SLA calculation (Date Sent or Today)
        base_date = order.order_placement_date or date.today()
        current_target_dt = dt.combine(base_date, dt.min.time())
        track = order.track_type.value

        if payload.stages is not None:
            # Use manually assigned stages and days
            for s_in in payload.stages:
                if s_in.target_days:
                    current_target_dt += timedelta(days=s_in.target_days)
                
                StageRepository.create(db, {
                    "order_id": order.id,
                    "module_type": order.track_type,
                    "stage_name": s_in.stage_name,
                    "stage_order": s_in.stage_order,
                    "status": StageStatus.pending,
                    "is_required": s_in.is_required,
                    "target_date": current_target_dt
                })
        else:
            # Use default track stages
            stages_to_create = StageService._default_stage_names(track)

            for idx, s_name in stages_to_create:
                StageRepository.create(db, {
                    "order_id": order.id,
                    "module_type": order.track_type,
                    "stage_name": s_name,
                    "stage_order": idx,
                    "status": StageStatus.pending,
                    "is_required": True
                })


        # ─── 2. Handle Production Assignments ─────────────────────────────────────
        if order.track_type == TrackType.sampling or order.track_type.value == "sampling":
            department = OrderService.get_or_create_sampling_department(
                db,
                str(order.vendor_id),
                payload.sample_department_id,
            )
            db.add(OrderProductionAssignment(
                order_id=order.id,
                vendor_id=order.vendor_id,
                department_id=department.id,
                floor_id=None,
                line_id=None,
                assignment_type="sampling_department",
                notes="Assigned to vendor sampling department.",
            ))
        elif payload.assignments:
            for asgn in payload.assignments:
                # Basic assignment logic (simplified from floors.py)
                floor = db.query(VendorFloor).filter(VendorFloor.id == asgn.floor_id).first()
                if not floor: continue

                if not asgn.line_ids:
                    # Full floor
                    db.add(OrderProductionAssignment(
                        order_id=order.id, vendor_id=order.vendor_id,
                        floor_id=asgn.floor_id, line_id=None,
                        assignment_type="full_floor", notes=asgn.notes
                    ))
                    for line in floor.lines:
                        if line.is_active: line.status = LocationStatus.occupied
                    floor.status = LocationStatus.occupied
                else:
                    for line_id in asgn.line_ids:
                        line = db.query(VendorLine).filter(VendorLine.id == line_id).first()
                        if line:
                            db.add(OrderProductionAssignment(
                                order_id=order.id, vendor_id=order.vendor_id,
                                floor_id=asgn.floor_id, line_id=line_id,
                                assignment_type="single_line" if len(asgn.line_ids) == 1 else "multi_line",
                                notes=asgn.notes
                            ))
                            line.status = LocationStatus.occupied
                    # Update floor status
                    active_lines = [l for l in floor.lines if l.is_active]
                    occupied = [l for l in active_lines if l.status == LocationStatus.occupied]
                    if len(occupied) == len(active_lines): floor.status = LocationStatus.occupied
                    elif occupied: floor.status = LocationStatus.partial

        db.commit()

        OrderRepository.log_history(
            db, str(order.id), "created", user_id,
            new_value={"order_no": order.order_no, "status": order.status.value, "track": track}
        )
        return order

    @staticmethod
    def bulk_create_orders(db: Session, payload: BulkOrderCreate, user_id: str) -> List[Order]:
        created_orders = []
        for item in payload.items:
            # Associate with the bulk class
            item.bulk_class_id = payload.bulk_class_id
            order = OrderService.create_order(db, item, user_id)
            created_orders.append(order)
        return created_orders

    @staticmethod
    def create_bulk_class(db: Session, payload: BulkClassCreate) -> BulkClass:
        from app.models.order import BulkClass
        return BulkClassRepository.create(db, payload.model_dump())

    @staticmethod
    def list_bulk_classes(db: Session):
        return BulkClassRepository.get_all(db)



    @staticmethod
    def update_order(db: Session, order_id: str, payload: OrderUpdate, user_id: str) -> Order:
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")

        old_status = order.status.value if order.status else None
        old_value = {
            "order_no": order.order_no,
            "style_name": order.style_name,
            "product_name": order.product_name,
            "quantity": order.quantity,
            "ex_factory_date": order.ex_factory_date.isoformat() if order.ex_factory_date else None,
            "status": old_status,
            "track_type": order.track_type.value if order.track_type else None,
            "priority": order.priority.value if order.priority else None,
        }
        updates = payload.model_dump(exclude_none=True)
        updated = OrderRepository.update(db, order, updates)
        new_value = {
            "order_no": updated.order_no,
            "style_name": updated.style_name,
            "product_name": updated.product_name,
            "quantity": updated.quantity,
            "ex_factory_date": updated.ex_factory_date.isoformat() if updated.ex_factory_date else None,
            "status": updated.status.value if updated.status else None,
            "track_type": updated.track_type.value if updated.track_type else None,
            "priority": updated.priority.value if updated.priority else None,
        }

        OrderRepository.log_history(
            db, order_id, "updated", user_id,
            old_value=old_value,
            new_value=new_value,
            note="Order details were updated.",
        )

        if payload.status and old_status != payload.status.value:
            OrderRepository.log_history(
                db, order_id, "status_changed", user_id,
                old_value={"status": old_status},
                new_value={"status": payload.status.value},
            )
        return updated

    @staticmethod
    def delete_order(db: Session, order_id: str, user_id: str) -> Order:
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")

        old_value = {
            "order_no": order.order_no,
            "status": order.status.value if order.status else None,
            "is_active": order.is_active,
        }
        order.status = OrderStatus.cancelled
        deleted = OrderRepository.soft_delete(db, order)
        OrderRepository.log_history(
            db, order_id, "cancelled",
            user_id,
            old_value=old_value,
            new_value={"status": OrderStatus.cancelled.value, "is_active": False},
            note="Order was cancelled/deactivated.",
        )
        return deleted

    @staticmethod
    def _check_all_stages_complete(db: Session, order_id: str, user_id: str):
        """If every stage is complete, auto-update order status to 'completed'."""
        stages = StageRepository.get_by_order(db, order_id)
        if stages and all(s.status == StageStatus.completed for s in stages):
            order = OrderRepository.get_by_id(db, order_id)
            if order and order.status != OrderStatus.completed:
                OrderRepository.update(db, order, {"status": OrderStatus.completed})
                OrderRepository.log_history(
                    db, order_id, "auto_completed", user_id,
                    note="All production stages completed."
                )

    @staticmethod
    def reiterate_order(db: Session, order_id: str, reason: str, plan: str, user_id: str) -> Order:
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")

        # Archive current iteration
        history_entry = {
            "iteration": order.current_iteration,
            "reason": order.iteration_reason,
            "plan": order.iteration_plan,
            "date": date.today().isoformat()
        }
        history = list(order.iteration_history or [])
        history.append(history_entry)

        # Update order
        updates = {
            "current_iteration": order.current_iteration + 1,
            "iteration_reason": reason,
            "iteration_plan": plan,
            "iteration_history": history,
            "status": OrderStatus.in_progress
        }
        updated = OrderRepository.update(db, order, updates)

        # Reset all stages to pending to start again
        stages = StageRepository.get_by_order(db, order_id)
        for stage in stages:
            StageRepository.update(db, stage, {
                "status": StageStatus.pending,
                "completion_date": None,
                "start_date": None,
                "remarks": f"Iteration {updated.current_iteration} started."
            })

        OrderRepository.log_history(
            db, order_id, "reiterated", user_id,
            note=f"Rejected at Audit. Moving to Iteration {updated.current_iteration}.",
            new_value={"iteration": updated.current_iteration, "reason": reason}
        )

        return updated

    @staticmethod
    def approve_gate(db: Session, order_id: str, gate_type: str, user_id: str):
        """Manually approve a production gate (Top Sample or QA Audit)."""
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")

        if gate_type == "top_sample":
            order.top_sample_status = "approved"
            note = "Top Sample approved by manager."
        elif gate_type == "qa_audit":
            order.qa_audit_status = "approved"
            note = "Final Random QA Audit approved by manager."
        else:
            raise HTTPException(400, "Invalid gate type.")

        OrderRepository.log_history(
            db, order_id, "gate_approved", user_id,
            note=note,
            new_value={f"{gate_type}_status": "approved"}
        )
        db.commit()


class StageService:
    @staticmethod
    def _default_stage_names(track_type: str):
        from app.models.order import StageName

        if track_type == "sampling":
            return [
                (1, StageName.sample_start), (2, StageName.fabrication), (3, StageName.fabric_cutting),
                (4, StageName.embellishment), (5, StageName.stitching), (6, StageName.washing),
                (7, StageName.finishing), (8, StageName.qc_check), (9, StageName.dispatch),
                (10, StageName.sample_completed),
            ]
        return [
            (1, StageName.customer_order),
            (2, StageName.pp_sample_development),
            (3, StageName.customer_approval),
            (4, StageName.fabric_shade_approval),
            (5, StageName.bulk_fabric_cutting),
            (6, StageName.bulk_embellishment),
            (7, StageName.stitching),
            (8, StageName.end_line_qc),
            (9, StageName.washing),
            (10, StageName.pressing),
            (11, StageName.finishing),
            (12, StageName.packing),
            (13, StageName.final_random_inspection),
            (14, StageName.shipment),
        ]

    @staticmethod
    def ensure_default_stages(db: Session, order: Order) -> List[ProductionStage]:
        stages = StageRepository.get_by_order(db, str(order.id))
        if stages:
            return stages

        track = order.track_type.value if hasattr(order.track_type, "value") else str(order.track_type)
        for idx, stage_name in StageService._default_stage_names(track):
            StageRepository.create(db, {
                "order_id": order.id,
                "module_type": order.track_type,
                "stage_name": stage_name,
                "stage_order": idx,
                "status": StageStatus.pending,
                "is_required": True,
            })
        return StageRepository.get_by_order(db, str(order.id))

    @staticmethod
    def get_stages(db: Session, order_id: str) -> List[ProductionStage]:
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        return StageService.ensure_default_stages(db, order)

    @staticmethod
    def add_stage(db: Session, order_id: str, payload: StageCreate, user_id: str) -> ProductionStage:
        order = OrderRepository.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        data = payload.model_dump()
        data["order_id"] = order_id
        return StageRepository.create(db, data)

    @staticmethod
    def update_stage(db: Session, stage_id: str, payload: StageUpdate, user_id: str) -> ProductionStage:
        from datetime import datetime
        from app.models.order import StageName
        
        stage = StageRepository.get_by_id(db, stage_id)
        if not stage:
            raise HTTPException(status_code=404, detail="Stage not found.")
        
        order = OrderRepository.get_by_id(db, str(stage.order_id))
        if not order:
            raise HTTPException(404, "Associated order not found.")

        # ─── 1. Validation Rules ───────────────────────────────────────────────
        if payload.status in [StageStatus.in_progress, StageStatus.completed]:
            # Check previous stages are completed before starting or finishing this one
            prev_stages = db.query(ProductionStage).filter(
                ProductionStage.order_id == order.id,
                ProductionStage.stage_order < stage.stage_order,
                ProductionStage.status != StageStatus.completed
            ).all()
            
            if prev_stages:
                raise HTTPException(400, f"Cannot update this stage. Previous stage ({prev_stages[0].stage_name.value}) must be COMPLETED first.")

        # ─── 2. Handle Special Stages ──────────────────────────────────────────
        # No auto-approval here anymore, using manual gates.
        pass

        # ─── 3. Update the stage ──────────────────────────────────────────────
        old_stage_status = stage.status.value if stage.status else None
        updates = payload.model_dump(exclude_none=True)
        if payload.status == StageStatus.completed and not stage.completion_date:
            updates["completion_date"] = datetime.utcnow()
        if payload.status == StageStatus.in_progress and not stage.start_date:
            updates["start_date"] = datetime.utcnow()
        
        updates["updated_by"] = user_id
        updated = StageRepository.update(db, stage, updates)

        # ─── 4. Update Order Status ───────────────────────────────────────────
        order.current_stage_id = updated.id
        if payload.status:
            OrderRepository.log_history(
                db,
                str(stage.order_id),
                "stage_updated",
                user_id,
                old_value={"stage": stage.stage_name.value, "status": old_stage_status},
                new_value={"stage": updated.stage_name.value, "status": updated.status.value if updated.status else None},
                note=f"Stage '{updated.stage_name.value}' updated.",
            )
        if payload.status == StageStatus.completed:
            OrderService._check_all_stages_complete(db, str(stage.order_id), user_id)
        
        db.commit()
        return updated

    @staticmethod
    def reject_stage_for_rework(
        db: Session,
        qc_stage_id: str,
        repeat_from_stage_id: str,
        reason: str,
        plan: str,
        user_id: str,
    ) -> Order:
        reason = (reason or "").strip()
        if not reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required.")

        qc_stage = StageRepository.get_by_id(db, qc_stage_id)
        repeat_stage = StageRepository.get_by_id(db, repeat_from_stage_id)
        if not qc_stage or not repeat_stage:
            raise HTTPException(status_code=404, detail="Stage not found.")
        if str(qc_stage.order_id) != str(repeat_stage.order_id):
            raise HTTPException(status_code=400, detail="Repeat stage must belong to the same order.")

        order = OrderRepository.get_by_id(db, str(qc_stage.order_id))
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        if order.track_type.value == "sampling" and qc_stage.stage_name.value != "qc_check":
            raise HTTPException(status_code=400, detail="Sample rejection can only be raised from QC Check.")
        if repeat_stage.stage_order > qc_stage.stage_order:
            raise HTTPException(status_code=400, detail="Repeat stage must be the current stage or an earlier stage.")

        previous_iteration = order.current_iteration or 1
        next_iteration = previous_iteration + 1
        history = list(order.iteration_history or [])
        history.append({
            "iteration": previous_iteration,
            "rejected_stage": qc_stage.stage_name.value,
            "repeat_from_stage": repeat_stage.stage_name.value,
            "reason": reason,
            "plan": plan,
            "date": date.today().isoformat(),
        })

        order.current_iteration = next_iteration
        order.iteration_reason = reason
        order.iteration_plan = plan
        order.iteration_history = history
        order.status = OrderStatus.in_progress
        order.current_stage_id = repeat_stage.id

        stages = StageRepository.get_by_order(db, str(order.id))
        for stage in stages:
            if stage.stage_order >= repeat_stage.stage_order:
                stage.status = StageStatus.pending
                stage.start_date = None
                stage.completion_date = None
                note = f"Iteration {next_iteration}: repeating from {repeat_stage.stage_name.value}. Reason: {reason}"
                stage.remarks = f"{stage.remarks}\n{note}" if stage.remarks else note

        OrderRepository.log_history(
            db,
            str(order.id),
            "stage_rejected_for_rework",
            user_id,
            old_value={
                "iteration": previous_iteration,
                "rejected_stage": qc_stage.stage_name.value,
                "repeat_from_stage": repeat_stage.stage_name.value,
            },
            new_value={"iteration": next_iteration, "reason": reason, "plan": plan},
            note=f"{qc_stage.stage_name.value} rejected. Repeating from {repeat_stage.stage_name.value}. Reason: {reason}",
        )

        db.commit()
        db.refresh(order)
        return order
