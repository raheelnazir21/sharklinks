import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from app.models.user import User, Role
from app.models.order import Vendor, Order, ProductionStage, OrderHistory
from app.models.audit_log import AuditLog
from scripts.create_admin import seed

def reset():
    print("🗑️ Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("🔄 Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("🌱 Seeding default data...")
    seed()
    print("✨ Database reset successfully!")

if __name__ == "__main__":
    reset()
