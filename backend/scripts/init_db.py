from app.core.database import engine, Base
from app.models.user import User, Role
from app.models.order import Client, Order, ProductionStage, OrderHistory
from app.models.audit_log import AuditLog

print("Creating all tables...")
Base.metadata.create_all(bind=engine)
print("Done!")
