from collections import Counter
from datetime import timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import AfterValidator, BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from erp.auth import require
from erp.db import get_db
from erp.models import Customer, Invoice, OrderItem, Product, SalesOrder, StockMovement, User, utcnow
from erp.rules import (
    conflict,
    invalid,
    money,
    next_number,
    not_found,
    on_hand_for,
    positive_quantity,
    today_bangkok,
    vat_for,
)

router = APIRouter(prefix="/orders", tags=["orders"])

VIEWERS = ("admin", "sales", "accountant")
EDITORS = ("admin", "sales")


class LineIn(BaseModel):
    product_id: int
    quantity: Annotated[int, AfterValidator(positive_quantity)]


def at_least_one_line(lines: list[LineIn]) -> list[LineIn]:
    if not lines:
        raise ValueError("Add at least one product to the order")
    return lines


class OrderIn(BaseModel):
    customer_id: int
    lines: Annotated[list[LineIn], AfterValidator(at_least_one_line)]
    note: str | None = None


def order_totals(order: SalesOrder) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum((line.line_total for line in order.lines), Decimal("0"))
    vat = vat_for(subtotal)
    return subtotal, vat, subtotal + vat


def line_out(line: OrderItem) -> dict:
    return {
        "id": line.id,
        "product_id": line.product_id,
        "sku": line.product.sku,
        "name": line.product.name,
        "unit": line.product.unit,
        "quantity": line.quantity,
        "unit_price": money(line.unit_price),
        "line_total": money(line.line_total),
    }


def order_out(order: SalesOrder) -> dict:
    subtotal, vat, total = order_totals(order)
    invoice = order.invoice
    return {
        "id": order.id,
        "number": order.number,
        "status": order.status,
        "order_date": order.order_date.isoformat(),
        "note": order.note,
        "customer": {
            "id": order.customer.id,
            "name": order.customer.name,
            "tax_id": order.customer.tax_id,
            "payment_terms_days": order.customer.payment_terms_days,
        },
        "lines": [line_out(line) for line in order.lines],
        "subtotal": money(subtotal),
        "vat": money(vat),
        "total": money(total),
        "invoice": {"id": invoice.id, "number": invoice.number, "status": invoice.status} if invoice else None,
        "created_by_name": order.creator.name if order.creator else None,
        "created_at": order.created_at.isoformat(),
    }


def get_order(db: Session, company_id: int, order_id: int, lock: bool = False) -> SalesOrder:
    query = select(SalesOrder).where(SalesOrder.id == order_id, SalesOrder.company_id == company_id)
    if lock:
        query = query.with_for_update()
    order = db.scalar(query)
    if order is None:
        raise not_found("Sales order")
    return order


def load_customer(db: Session, company_id: int, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None or customer.company_id != company_id:
        raise invalid("Choose a customer from the list")
    if not customer.active:
        raise invalid(f"{customer.name} is deactivated and cannot place orders")
    return customer


def build_lines(db: Session, company_id: int, lines: list[LineIn]) -> list[OrderItem]:
    """Copy today's price and cost onto each line: later price changes never touch it."""
    ids = {line.product_id for line in lines}
    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.company_id == company_id, Product.id.in_(ids)))
    }
    items = []
    for line in lines:
        product = products.get(line.product_id)
        if product is None:
            raise invalid("Choose products from the list")
        if not product.active:
            raise invalid(f"{product.sku} is deactivated and cannot be ordered")
        items.append(
            OrderItem(
                product=product, quantity=line.quantity, unit_price=product.price, unit_cost=product.cost
            )
        )
    return items


@router.get("")
def list_orders(
    status: Literal["draft", "confirmed", "paid", "cancelled"] | None = None,
    user: User = Depends(require(*VIEWERS)),
    db: Session = Depends(get_db),
):
    query = select(SalesOrder).where(SalesOrder.company_id == user.company_id)
    if status:
        query = query.where(SalesOrder.status == status)
    orders = db.scalars(query.order_by(SalesOrder.id.desc())).all()
    rows = []
    for order in orders:
        _, _, total = order_totals(order)
        rows.append(
            {
                "id": order.id,
                "number": order.number,
                "status": order.status,
                "order_date": order.order_date.isoformat(),
                "customer_name": order.customer.name,
                "total": money(total),
                "invoice_id": order.invoice.id if order.invoice else None,
                "invoice_number": order.invoice.number if order.invoice else None,
            }
        )
    return rows


@router.post("", status_code=201)
def create_order(body: OrderIn, user: User = Depends(require(*EDITORS)), db: Session = Depends(get_db)):
    customer = load_customer(db, user.company_id, body.customer_id)
    lines = build_lines(db, user.company_id, body.lines)
    order = SalesOrder(
        company_id=user.company_id,
        number=next_number(db, user.company_id, "sales_order"),
        customer=customer,
        order_date=today_bangkok(),
        note=(body.note or "").strip() or None,
        created_by=user.id,
        lines=lines,
    )
    db.add(order)
    db.commit()
    return order_out(order)


@router.get("/{order_id}")
def read_order(order_id: int, user: User = Depends(require(*VIEWERS)), db: Session = Depends(get_db)):
    return order_out(get_order(db, user.company_id, order_id))


def ensure_draft(order: SalesOrder):
    if order.status != "draft":
        raise conflict(f"{order.number} is already {order.status}")


@router.put("/{order_id}")
def update_order(
    order_id: int, body: OrderIn, user: User = Depends(require(*EDITORS)), db: Session = Depends(get_db)
):
    order = get_order(db, user.company_id, order_id, lock=True)
    ensure_draft(order)
    order.customer = load_customer(db, user.company_id, body.customer_id)
    order.lines = build_lines(db, user.company_id, body.lines)
    order.note = (body.note or "").strip() or None
    db.commit()
    return order_out(order)


@router.post("/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(require(*EDITORS)), db: Session = Depends(get_db)):
    order = get_order(db, user.company_id, order_id, lock=True)
    ensure_draft(order)
    order.status = "cancelled"
    db.commit()
    return order_out(order)


@router.post("/{order_id}/confirm")
def confirm_order(order_id: int, user: User = Depends(require(*EDITORS)), db: Session = Depends(get_db)):
    """US-1. One transaction: check stock, move stock, confirm, issue the invoice.

    Any error raises before commit, the session rolls back, and nothing changes.
    """
    order = get_order(db, user.company_id, order_id, lock=True)
    ensure_draft(order)
    customer = order.customer
    if not customer.active:
        raise invalid(f"{customer.name} is deactivated and cannot place orders")

    needed = Counter()
    for line in order.lines:
        needed[line.product_id] += line.quantity
    # Lock the products (in id order, to avoid deadlocks) so two confirms cannot sell the same beans.
    products = db.scalars(
        select(Product).where(Product.id.in_(needed)).order_by(Product.id).with_for_update()
    ).all()
    on_hand = on_hand_for(db, needed)
    for product in products:
        if not product.active:
            raise invalid(f"{product.sku} is deactivated and cannot be ordered")
        if on_hand[product.id] < needed[product.id]:
            raise conflict(
                f"Not enough stock for {product.sku}: {on_hand[product.id]} {product.unit} on hand, "
                f"the order needs {needed[product.id]}"
            )

    for line in order.lines:
        db.add(
            StockMovement(
                company_id=order.company_id,
                product_id=line.product_id,
                quantity=-line.quantity,
                ref_doc=order.number,
                note=f"Sold to {customer.name}",
                created_by=user.id,
            )
        )
    order.status = "confirmed"
    order.confirmed_by = user.id
    order.confirmed_at = utcnow()

    subtotal, vat, total = order_totals(order)
    issue_date = today_bangkok()
    invoice = Invoice(
        company_id=order.company_id,
        number=next_number(db, order.company_id, "invoice"),
        order=order,
        customer_id=customer.id,
        subtotal=subtotal,
        vat=vat,
        total=total,
        issue_date=issue_date,
        due_date=issue_date + timedelta(days=customer.payment_terms_days),
        created_by=user.id,
    )
    db.add(invoice)
    db.commit()
    return {
        "order": order_out(order),
        "invoice": {
            "id": invoice.id,
            "number": invoice.number,
            "status": invoice.status,
            "subtotal": money(invoice.subtotal),
            "vat": money(invoice.vat),
            "total": money(invoice.total),
            "issue_date": invoice.issue_date.isoformat(),
            "due_date": invoice.due_date.isoformat(),
        },
    }
