"""
seed.py — Database initialization and seeding script.
Creates tables, default roles, and the first superadmin.
"""
import sys
import os

# Add the current directory to sys.path so we can import 'app'
sys.path.append(os.getcwd())

from app.core.database import engine, Base, SessionLocal
from app.models.user import Role, User, RoleEnum
from app.core.config import settings
from app.core.security import hash_password

def seed():
    print("🚀 Initializing Database...")
    # 1. Create all tables
    # IMPORTANT: We must import all models here so SQLAlchemy knows about them
    from app.models.user import Role, User, RefreshToken
    from app.models.order import Vendor, Order, ProductionStage, Attachment, OrderHistory
    from app.models.qc_report import QCReport, QCReportItem, DefectCode
    from app.models.audit_log import AuditLog
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 2. Check if roles exist, if not create them
        print("📝 Seeding Roles...")
        roles_to_create = [
            (RoleEnum.super_admin, "Full system access"),
            (RoleEnum.admin, "Administrative access"),
            (RoleEnum.manager, "Production & Approval access"),
            (RoleEnum.qc_officer, "QC entry only"),
            (RoleEnum.viewer, "Read-only access"),
        ]
        
        for name, desc in roles_to_create:
            role = db.query(Role).filter(Role.name == name.value).first()
            if not role:
                db.add(Role(name=name.value, description=desc))
        
        db.commit()

        # 3. Create Super Admin if not exists
        print(f"👤 Creating Super Admin: {settings.FIRST_ADMIN_EMAIL}...")
        admin = db.query(User).filter(User.email == settings.FIRST_ADMIN_EMAIL).first()
        if not admin:
            super_role = db.query(Role).filter(Role.name == RoleEnum.super_admin.value).first()
            new_admin = User(
                email=settings.FIRST_ADMIN_EMAIL,
                password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
                full_name=settings.FIRST_ADMIN_NAME,
                role_id=super_role.id,
                is_active=True
            )
            db.add(new_admin)
            db.commit()
            print("✅ Super Admin created successfully.")
        else:
            print("ℹ️ Super Admin already exists.")

        print("✨ Seeding Completed Successfully!")
        
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
