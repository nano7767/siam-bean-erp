from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import AfterValidator, BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from erp.auth import ANY_ROLE, require
from erp.db import get_db
from erp.models import Product, StockMovement, User
from erp.rules import (
    conflict,
    money,
    non_negative_int,
    non_negative_money,
    not_found,
    on_hand_for,
    on_hand_subquery,
    required_text,
)

router = APIRouter(prefix="/products", tags=["products"])

PAGE_SIZE = 20

Sku = Annotated[str, AfterValidator(lambda v: required_text("SKU")(v).upper())]
Name = Annotated[str, AfterValidator(required_text("Name"))]
Unit = Annotated[str, AfterValidator(required_text("Unit"))]
Price = Annotated[Decimal, AfterValidator(non_negative_money("Price"))]
Cost = Annotated[Decimal, AfterValidator(non_negative_money("Cost"))]
ReorderLevel = Annotated[int, AfterValidator(non_negative_int("Reorder level"))]


class ProductIn(BaseModel):
    sku: Sku
    name: Name
    unit: Unit = "kg"
    price: Price
    cost: Cost
    reorder_level: ReorderLevel = 0


class ProductPatch(BaseModel):
    sku: Sku | None = None
    name: Name | None = None
    unit: Unit | None = None
    price: Price | None = None
    cost: Cost | None = None
    reorder_level: ReorderLevel | None = None
    active: bool | None = None


def product_out(product: Product, on_hand: int) -> dict:
    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "unit": product.unit,
        "price": money(product.price),
        "cost": money(product.cost),
        "reorder_level": product.reorder_level,
        "active": product.active,
        "on_hand": on_hand,
        "low_stock": product.active and on_hand < product.reorder_level,
    }


def get_product(db: Session, company_id: int, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.company_id != company_id:
        raise not_found("Product")
    return product


def ensure_unique_sku(db: Session, company_id: int, sku: str, exclude_id: int | None = None):
    query = select(Product.id).where(Product.company_id == company_id, Product.sku == sku)
    if exclude_id is not None:
        query = query.where(Product.id != exclude_id)
    if db.scalar(query) is not None:
        raise conflict(f"SKU {sku} already exists")


@router.get("")
def list_products(
    q: str = "",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = PAGE_SIZE,
    include_inactive: bool = False,
    low_stock_only: bool = False,
    user: User = Depends(require(*ANY_ROLE)),
    db: Session = Depends(get_db),
):
    stock = on_hand_subquery()
    on_hand = func.coalesce(stock.c.on_hand, 0)
    query = (
        select(Product, on_hand)
        .outerjoin(stock, stock.c.product_id == Product.id)
        .where(Product.company_id == user.company_id)
    )
    if not include_inactive:
        query = query.where(Product.active)
    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Product.sku.ilike(pattern), Product.name.ilike(pattern)))
    if low_stock_only:
        query = query.where(Product.active, on_hand < Product.reorder_level)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.execute(query.order_by(Product.id).limit(page_size).offset((page - 1) * page_size))
    return {
        "items": [product_out(product, int(qty)) for product, qty in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def create_product(body: ProductIn, user: User = Depends(require("admin")), db: Session = Depends(get_db)):
    ensure_unique_sku(db, user.company_id, body.sku)
    product = Product(company_id=user.company_id, created_by=user.id, **body.model_dump())
    db.add(product)
    db.commit()
    return product_out(product, 0)


@router.patch("/{product_id}")
def update_product(
    product_id: int, body: ProductPatch, user: User = Depends(require("admin")), db: Session = Depends(get_db)
):
    product = get_product(db, user.company_id, product_id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "sku" in changes:
        ensure_unique_sku(db, user.company_id, changes["sku"], exclude_id=product.id)
    for field, value in changes.items():
        setattr(product, field, value)
    db.commit()
    return product_out(product, on_hand_for(db, [product.id])[product.id])


@router.get("/{product_id}/movements")
def stock_card(
    product_id: int, user: User = Depends(require("admin", "warehouse")), db: Session = Depends(get_db)
):
    """Every movement of one product with the running balance, newest first."""
    product = get_product(db, user.company_id, product_id)
    movements = db.scalars(
        select(StockMovement).where(StockMovement.product_id == product.id).order_by(StockMovement.id)
    ).all()
    balance = 0
    card = []
    for movement in movements:
        balance += movement.quantity
        card.append(
            {
                "id": movement.id,
                "ref_doc": movement.ref_doc,
                "quantity": movement.quantity,
                "balance": balance,
                "note": movement.note,
                "created_at": movement.created_at.isoformat(),
                "created_by_name": movement.creator.name if movement.creator else None,
            }
        )
    return list(reversed(card))
