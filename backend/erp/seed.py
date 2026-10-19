"""Sample master data from docs/scenario.md. Used by the tests and by backend/seed.py."""

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from erp.models import Company, Customer, Product, StockMovement, User

# (role key, email, name, role)
SIAM_BEAN_USERS = [
    ("admin", "admin@siambean.example.com", "Khun Somchai", "admin"),
    ("sales", "sales@siambean.example.com", "Nok", "sales"),
    ("sales2", "ploy@siambean.example.com", "Ploy", "sales"),
    ("warehouse", "warehouse@siambean.example.com", "Lek", "warehouse"),
    ("accountant", "accountant@siambean.example.com", "Fon", "accountant"),
]
BAKERY_ADMIN_EMAIL = "bakery@chiangmaibakery.example.com"

# sku, name, unit, cost, price, reorder level, opening stock
SIAM_BEAN_PRODUCTS = [
    ("ARB-1KG", "Arabica, 1 kg bag", "kg", "320", "450", 50, 170),
    ("ROB-1KG", "Robusta, 1 kg bag", "kg", "220", "320", 40, 35),
    ("BLD-1KG", "House Blend, 1 kg bag", "kg", "260", "380", 30, 90),
    ("DRP-10", "Drip bags, box of 10", "box", "90", "150", 100, 240),
]

# name, tax id, payment terms (days, 0 = cash), address
SIAM_BEAN_CUSTOMERS = [
    ("Café Lune", "0105561000011", 30, "21 Soi Ari 1, Phaya Thai, Bangkok 10400"),
    ("Brew Lab Ari", "0105562000022", 0, "7 Phahon Yothin 7, Phaya Thai, Bangkok 10400"),
    ("Sukhumvit Corner Café", "0105563000033", 15, "150 Sukhumvit 24, Khlong Toei, Bangkok 10110"),
]


def _load_company(db, company, users, products, customers):
    db.add(company)
    db.flush()
    for user_id, email, name, role in users:
        db.add(User(id=user_id, company_id=company.id, email=email, name=name, role=role))
    db.flush()
    owner = users[0][0]
    for sku, name, unit, cost, price, reorder, opening in products:
        product = Product(
            company_id=company.id,
            sku=sku,
            name=name,
            unit=unit,
            cost=Decimal(cost),
            price=Decimal(price),
            reorder_level=reorder,
            created_by=owner,
        )
        db.add(product)
        db.flush()
        if opening:
            db.add(
                StockMovement(
                    company_id=company.id,
                    product_id=product.id,
                    quantity=opening,
                    ref_doc="OPENING",
                    note="Opening stock",
                    created_by=owner,
                )
            )
    for name, tax_id, terms, address in customers:
        db.add(
            Customer(
                company_id=company.id,
                name=name,
                tax_id=tax_id,
                payment_terms_days=terms,
                address=address,
                created_by=owner,
            )
        )
    db.flush()
    return company


def load_sample_data(db: Session, user_ids: dict[str, uuid.UUID]) -> Company:
    """Siam Bean Co. with the scenario's products, opening stock, customers and staff.

    `user_ids` maps a role key ("admin", "sales", "sales2", ...) to a Supabase Auth user id;
    staff without an id are skipped.
    """
    users = [(user_ids[key], email, name, role) for key, email, name, role in SIAM_BEAN_USERS if key in user_ids]
    company = Company(
        name="Siam Bean Co.",
        tax_id="0105560000001",
        address="88 Sukhumvit 55 (Thong Lo), Watthana, Bangkok 10110",
    )
    return _load_company(db, company, users, SIAM_BEAN_PRODUCTS, SIAM_BEAN_CUSTOMERS)


def load_second_company(db: Session, admin_id: uuid.UUID) -> Company:
    """Stretch goal: a second tenant that must never see Siam Bean's data."""
    company = Company(
        name="Chiang Mai Bakery", tax_id="0505560000002", address="9 Nimmanhaemin Rd, Chiang Mai 50200"
    )
    return _load_company(
        db,
        company,
        [(admin_id, BAKERY_ADMIN_EMAIL, "Khun Malee", "admin")],
        [
            ("FLR-25KG", "Bread flour, 25 kg sack", "sack", "650", "820", 5, 12),
            ("BTR-1KG", "Butter, 1 kg block", "kg", "280", "360", 10, 25),
        ],
        [("Nimman Coffee House", "0505561000044", 7, "Nimmanhaemin Soi 9, Chiang Mai 50200")],
    )
