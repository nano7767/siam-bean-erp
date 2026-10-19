from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from erp.auth import ANY_ROLE, require
from erp.db import get_db
from erp.models import Invoice, Payment, Product, SalesOrder, User
from erp.rules import money, on_hand_subquery, today_bangkok

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(user: User = Depends(require(*ANY_ROLE)), db: Session = Depends(get_db)):
    """The owner's numbers, computed live from the same tables on every request."""
    company_id = user.company_id
    today = today_bangkok()

    sales_today = db.scalar(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.company_id == company_id, Invoice.issue_date == today, Invoice.status != "cancelled"
        )
    )

    open_count, open_total = db.execute(
        select(func.count(Invoice.id), func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.company_id == company_id, Invoice.status == "open"
        )
    ).one()
    paid_on_open = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .where(Invoice.company_id == company_id, Invoice.status == "open")
    )
    overdue_count = db.scalar(
        select(func.count(Invoice.id)).where(
            Invoice.company_id == company_id, Invoice.status == "open", Invoice.due_date < today
        )
    )

    stock = on_hand_subquery()
    on_hand = func.coalesce(stock.c.on_hand, 0)
    products = db.execute(
        select(Product, on_hand)
        .outerjoin(stock, stock.c.product_id == Product.id)
        .where(Product.company_id == company_id)
        .order_by(Product.id)
    ).all()
    low_stock = [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "unit": p.unit,
            "on_hand": int(qty),
            "reorder_level": p.reorder_level,
        }
        for p, qty in products
        if p.active and qty < p.reorder_level
    ]
    stock_value = sum((p.cost * int(qty) for p, qty in products), Decimal("0"))

    draft_orders = db.scalar(
        select(func.count(SalesOrder.id)).where(
            SalesOrder.company_id == company_id, SalesOrder.status == "draft"
        )
    )

    return {
        "date": today.isoformat(),
        "sales_today": money(Decimal(sales_today)),
        "low_stock_count": len(low_stock),
        "low_stock_products": low_stock,
        "open_invoices_count": open_count,
        "open_invoices_amount": money(Decimal(open_total) - Decimal(paid_on_open)),
        "overdue_invoices_count": overdue_count,
        "stock_value": money(stock_value),
        "draft_orders_count": draft_orders,
    }
