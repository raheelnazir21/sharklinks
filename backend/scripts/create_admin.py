"""
Admin Seed Script
------------------
Run this ONCE after the first database migration to create:
  1. All default roles
  2. The first super admin user

Usage:
    cd backend
    python -m scripts.create_admin
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.core.config import settings
from app.models.user import User, Role, RoleEnum

# Default permissions per role
ROLE_PERMISSIONS = {
    RoleEnum.super_admin: ["*"],  # Full access
    RoleEnum.admin: [
        "read:all", "write:clients", "write:orders",
        "write:users", "read:reports", "read:analytics",
    ],
    RoleEnum.manager: [
        "read:all", "approve:qc_reports", "read:analytics",
        "write:orders", "read:reports",
    ],
    RoleEnum.qc_officer: [
        "read:orders", "write:qc_reports", "read:defects",
    ],
    RoleEnum.viewer: ["read:reports", "read:analytics"],
}


def seed():
    db = SessionLocal()
    try:
        print("🔄 Seeding roles...")
        for role_name, permissions in ROLE_PERMISSIONS.items():
            existing = db.query(Role).filter(Role.name == role_name).first()
            if not existing:
                role = Role(name=role_name, permissions=permissions)
                db.add(role)
                print(f"  ✅ Created role: {role_name.value}")
            else:
                print(f"  ⏭️  Role already exists: {role_name.value}")
        db.commit()

        print("\n🔄 Creating super admin user...")
        admin_role = db.query(Role).filter(Role.name == RoleEnum.super_admin).first()
        existing_admin = db.query(User).filter(
            User.email == settings.FIRST_ADMIN_EMAIL
        ).first()

        if not existing_admin:
            admin = User(
                email=settings.FIRST_ADMIN_EMAIL,
                password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
                full_name=settings.FIRST_ADMIN_NAME,
                role_id=admin_role.id,
            )
            db.add(admin)
            db.commit()
            print(f"  ✅ Admin created: {settings.FIRST_ADMIN_EMAIL}")
        else:
            print(f"  ⏭️  Admin already exists: {settings.FIRST_ADMIN_EMAIL}")

        print("\n🎉 Database seeded successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
