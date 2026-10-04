"""Demo users aur vendors banata hai. Safe to run multiple times."""
import sys
from decimal import Decimal
from pathlib import Path

# backend folder ko import path me jodo, taaki `app` module mile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import User, Vendor  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

DEMO_USERS = [
    # email, naam, password, role, approval_limit
    ("admin@demo.com", "Admin User", "Admin@1234", "admin", None),
    ("finance@demo.com", "Finance Head", "Finance@1234", "approver", Decimal("1000000")),
    ("manager@demo.com", "Project Manager", "Manager@1234", "approver", Decimal("50000")),
    ("clerk@demo.com", "Accounts Clerk", "Clerk@1234", "uploader", None),
]

DEMO_VENDORS = [
    # naam, gstin (demo/fake), tally ledger naam
    ("Sharma Building Materials", "03ABCDE1234F1Z5", "Sharma Building Materials"),
    ("Punjab Electricals Pvt Ltd", "03PQRSX5678L1Z2", "Punjab Electricals Pvt Ltd"),
]


def main() -> None:
    db = SessionLocal()
    try:
        for email, name, password, role, limit in DEMO_USERS:
            exists = db.scalar(select(User).where(User.email == email))
            if exists:
                print(f"skip   user   {email} (already exists)")
                continue
            db.add(User(
                email=email,
                full_name=name,
                hashed_password=hash_password(password),
                role=role,
                approval_limit=limit,
            ))
            print(f"create user   {email}  role={role}")

        for name, gstin, ledger in DEMO_VENDORS:
            exists = db.scalar(select(Vendor).where(Vendor.gstin == gstin))
            if exists:
                print(f"skip   vendor {name} (already exists)")
                continue
            db.add(Vendor(name=name, gstin=gstin, tally_ledger_name=ledger))
            print(f"create vendor {name}")

        db.commit()
        print("\nSeed done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()