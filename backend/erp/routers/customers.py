import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import AfterValidator, BaseModel, BeforeValidator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from erp.auth import require
from erp.db import get_db
from erp.models import Customer, User
from erp.rules import non_negative_int, not_found, required_text

router = APIRouter(prefix="/customers", tags=["customers"])

PAGE_SIZE = 20


def thai_tax_id(value: object) -> str:
    digits = re.sub(r"[\s-]", "", str(value or ""))
    if not re.fullmatch(r"\d{13}", digits):
        raise ValueError("Tax ID must be 13 digits")
    return digits


def optional_text(value: str | None) -> str | None:
    return (value or "").strip() or None


Name = Annotated[str, AfterValidator(required_text("Name"))]
TaxId = Annotated[str, BeforeValidator(thai_tax_id)]
Terms = Annotated[int, AfterValidator(non_negative_int("Payment terms"))]
OptionalText = Annotated[str | None, AfterValidator(optional_text)]


class CustomerIn(BaseModel):
    name: Name
    tax_id: TaxId
    address: OptionalText = None
    contact: OptionalText = None
    payment_terms_days: Terms = 0


class CustomerPatch(BaseModel):
    name: Name | None = None
    tax_id: TaxId | None = None
    address: OptionalText = None
    contact: OptionalText = None
    payment_terms_days: Terms | None = None
    active: bool | None = None


def customer_out(customer: Customer) -> dict:
    return {
        "id": customer.id,
        "name": customer.name,
        "tax_id": customer.tax_id,
        "address": customer.address,
        "contact": customer.contact,
        "payment_terms_days": customer.payment_terms_days,
        "active": customer.active,
    }


@router.get("")
def list_customers(
    q: str = "",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = PAGE_SIZE,
    include_inactive: bool = False,
    user: User = Depends(require("admin", "sales", "accountant")),
    db: Session = Depends(get_db),
):
    query = select(Customer).where(Customer.company_id == user.company_id)
    if not include_inactive:
        query = query.where(Customer.active)
    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Customer.name.ilike(pattern), Customer.tax_id.like(pattern)))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Customer.name, Customer.id).limit(page_size).offset((page - 1) * page_size))
    return {"items": [customer_out(c) for c in rows], "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
def create_customer(
    body: CustomerIn, user: User = Depends(require("admin", "sales")), db: Session = Depends(get_db)
):
    customer = Customer(company_id=user.company_id, created_by=user.id, **body.model_dump())
    db.add(customer)
    db.commit()
    return customer_out(customer)


@router.patch("/{customer_id}")
def update_customer(
    customer_id: int,
    body: CustomerPatch,
    user: User = Depends(require("admin", "sales")),
    db: Session = Depends(get_db),
):
    customer = db.get(Customer, customer_id)
    if customer is None or customer.company_id != user.company_id:
        raise not_found("Customer")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None and field not in ("address", "contact"):
            continue
        setattr(customer, field, value)
    db.commit()
    return customer_out(customer)
