"""Business rules shared by every module: money, VAT, dates, numbering, stock on hand."""

from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from erp.models import DocumentCounter, StockMovement

VAT_RATE = Decimal("0.07")
BANGKOK = timezone(timedelta(hours=7))  # Thailand has no daylight saving time

DOC_PREFIX = {"sales_order": "SO", "invoice": "INV", "stock_in": "IN", "adjustment": "ADJ"}


def cents(amount: Decimal) -> Decimal:
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def vat_for(subtotal: Decimal) -> Decimal:
    return cents(subtotal * VAT_RATE)


def money(amount: Decimal) -> str:
    """Money goes over the wire as a string with two decimals, never as a float."""
    return f"{cents(Decimal(amount)):.2f}"


def thb(amount: Decimal) -> str:
    return f"{cents(Decimal(amount)):,.2f} THB"


def today_bangkok() -> date:
    return datetime.now(BANGKOK).date()


def next_number(db: Session, company_id: int, doc_type: str) -> str:
    """Next document number, inside the caller's transaction.

    The UPDATE locks the counter row until commit, so two users never get the same
    number, and a rolled-back transaction gives its number back.
    """
    last = db.execute(
        update(DocumentCounter)
        .where(DocumentCounter.company_id == company_id, DocumentCounter.doc_type == doc_type)
        .values(last_number=DocumentCounter.last_number + 1)
        .returning(DocumentCounter.last_number)
    ).scalar_one_or_none()
    if last is None:
        db.add(DocumentCounter(company_id=company_id, doc_type=doc_type, last_number=1))
        db.flush()
        last = 1
    return f"{DOC_PREFIX[doc_type]}-{last:04d}"


def on_hand_subquery():
    return (
        select(StockMovement.product_id, func.sum(StockMovement.quantity).label("on_hand"))
        .group_by(StockMovement.product_id)
        .subquery()
    )


def on_hand_for(db: Session, product_ids: Iterable[int]) -> dict[int, int]:
    ids = list(product_ids)
    rows = db.execute(
        select(StockMovement.product_id, func.sum(StockMovement.quantity))
        .where(StockMovement.product_id.in_(ids))
        .group_by(StockMovement.product_id)
    ).all()
    found = {product_id: int(total) for product_id, total in rows}
    return {product_id: found.get(product_id, 0) for product_id in ids}


def not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found")


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def invalid(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


# --- Pydantic field validators (the message is what the user sees) ---------------------


def required_text(label: str):
    def check(value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError(f"{label} is required")
        return value

    return check


def non_negative_money(label: str):
    def check(value: Decimal) -> Decimal:
        if value < 0:
            raise ValueError(f"{label} must be 0 or more")
        if value != cents(value):
            raise ValueError(f"{label} can have at most 2 decimals")
        return value

    return check


def non_negative_int(label: str):
    def check(value: int) -> int:
        if value < 0:
            raise ValueError(f"{label} must be 0 or more")
        return value

    return check


def positive_quantity(value: int) -> int:
    if value <= 0:
        raise ValueError("Quantity must be greater than zero")
    return value
