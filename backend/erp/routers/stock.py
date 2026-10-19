from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from erp.auth import require
from erp.db import get_db
from erp.models import Product, StockMovement, User
from erp.routers.products import get_product
from erp.rules import conflict, next_number, on_hand_for

router = APIRouter(prefix="/stock", tags=["stock"])


class MovementIn(BaseModel):
    product_id: int
    kind: Literal["in", "adjust"] = "in"
    quantity: int
    note: str | None = None

    @model_validator(mode="after")
    def check_quantity(self):
        self.note = (self.note or "").strip() or None
        if self.kind == "in" and self.quantity <= 0:
            raise ValueError("Quantity must be greater than zero")
        if self.kind == "adjust":
            if self.quantity == 0:
                raise ValueError("Adjustment cannot be zero")
            if not self.note:
                raise ValueError("Say why you adjust the stock (e.g. damaged bags)")
        return self


def movement_out(movement: StockMovement) -> dict:
    return {
        "id": movement.id,
        "product_id": movement.product_id,
        "sku": movement.product.sku,
        "product_name": movement.product.name,
        "unit": movement.product.unit,
        "quantity": movement.quantity,
        "ref_doc": movement.ref_doc,
        "note": movement.note,
        "created_at": movement.created_at.isoformat(),
        "created_by_name": movement.creator.name if movement.creator else None,
    }


@router.get("/movements")
def list_movements(
    product_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    user: User = Depends(require("admin", "warehouse")),
    db: Session = Depends(get_db),
):
    query = select(StockMovement).where(StockMovement.company_id == user.company_id)
    if product_id is not None:
        query = query.where(StockMovement.product_id == product_id)
    return [movement_out(m) for m in db.scalars(query.order_by(StockMovement.id.desc()).limit(limit))]


@router.post("/movements", status_code=201)
def create_movement(
    body: MovementIn, user: User = Depends(require("admin", "warehouse")), db: Session = Depends(get_db)
):
    product = get_product(db, user.company_id, body.product_id)
    if body.quantity < 0:
        # Lock the product so two removals cannot both pass the check.
        db.execute(select(Product.id).where(Product.id == product.id).with_for_update())
        on_hand = on_hand_for(db, [product.id])[product.id]
        if on_hand + body.quantity < 0:
            raise conflict(
                f"Not enough stock for {product.sku}: {on_hand} on hand, cannot remove {-body.quantity}"
            )
    doc_type = "stock_in" if body.kind == "in" else "adjustment"
    movement = StockMovement(
        company_id=user.company_id,
        product_id=product.id,
        quantity=body.quantity,
        ref_doc=next_number(db, user.company_id, doc_type),
        note=body.note,
        created_by=user.id,
    )
    db.add(movement)
    db.commit()
    return {**movement_out(movement), "on_hand": on_hand_for(db, [product.id])[product.id]}
