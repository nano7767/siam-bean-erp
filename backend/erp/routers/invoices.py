from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import AfterValidator, BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from erp.auth import require
from erp.db import get_db
from erp.models import Invoice, Payment, User
from erp.routers.orders import line_out
from erp.rules import cents, conflict, invalid, money, not_found, thb, today_bangkok

router = APIRouter(tags=["invoices"])

VIEWERS = ("admin", "sales", "accountant")
ACCOUNTING = ("admin", "accountant")


def positive_amount(value: Decimal) -> Decimal:
    if value <= 0:
        raise ValueError("Amount must be greater than zero")
    if value != cents(value):
        raise ValueError("Amount can have at most 2 decimals")
    return value


class PaymentIn(BaseModel):
    amount: Annotated[Decimal, AfterValidator(positive_amount)]
    method: Literal["bank_transfer", "promptpay", "cash", "cheque"] = "bank_transfer"
    reference: str | None = None


def invoice_row(invoice: Invoice) -> dict:
    return {
        "id": invoice.id,
        "number": invoice.number,
        "status": invoice.status,
        "issue_date": invoice.issue_date.isoformat(),
        "due_date": invoice.due_date.isoformat(),
        "overdue": invoice.status == "open" and invoice.due_date < today_bangkok(),
        "customer_name": invoice.customer.name,
        "order_number": invoice.order.number,
        "subtotal": money(invoice.subtotal),
        "vat": money(invoice.vat),
        "total": money(invoice.total),
        "amount_paid": money(invoice.amount_paid),
        "amount_due": money(invoice.amount_due),
    }


def payment_out(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "invoice_id": payment.invoice_id,
        "invoice_number": payment.invoice.number,
        "customer_name": payment.invoice.customer.name,
        "amount": money(payment.amount),
        "method": payment.method,
        "reference": payment.reference,
        "paid_at": payment.paid_at.isoformat(),
        "created_by_name": payment.creator.name if payment.creator else None,
    }


def invoice_out(invoice: Invoice) -> dict:
    company = invoice.company
    customer = invoice.customer
    return {
        **invoice_row(invoice),
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "tax_id": customer.tax_id,
            "address": customer.address,
            "payment_terms_days": customer.payment_terms_days,
        },
        "company": {"name": company.name, "tax_id": company.tax_id, "address": company.address},
        "order": {"id": invoice.order.id, "number": invoice.order.number, "status": invoice.order.status},
        "lines": [line_out(line) for line in invoice.order.lines],
        "payments": [payment_out(p) for p in invoice.payments],
    }


def get_invoice(db: Session, company_id: int, invoice_id: int, lock: bool = False) -> Invoice:
    query = select(Invoice).where(Invoice.id == invoice_id, Invoice.company_id == company_id)
    if lock:
        query = query.with_for_update()
    invoice = db.scalar(query)
    if invoice is None:
        raise not_found("Invoice")
    return invoice


@router.get("/invoices")
def list_invoices(
    status: Literal["open", "paid"] | None = None,
    user: User = Depends(require(*VIEWERS)),
    db: Session = Depends(get_db),
):
    query = select(Invoice).where(Invoice.company_id == user.company_id)
    if status:
        query = query.where(Invoice.status == status)
    return [invoice_row(i) for i in db.scalars(query.order_by(Invoice.id.desc()))]


@router.get("/invoices/{invoice_id}")
def read_invoice(invoice_id: int, user: User = Depends(require(*VIEWERS)), db: Session = Depends(get_db)):
    return invoice_out(get_invoice(db, user.company_id, invoice_id))


@router.post("/invoices/{invoice_id}/payments", status_code=201)
def record_payment(
    invoice_id: int,
    body: PaymentIn,
    user: User = Depends(require(*ACCOUNTING)),
    db: Session = Depends(get_db),
):
    """US-4. A payment that covers what is due marks the invoice (and its order) Paid."""
    invoice = get_invoice(db, user.company_id, invoice_id, lock=True)
    if invoice.status == "paid":
        raise conflict(f"{invoice.number} is already paid")
    if invoice.status != "open":
        raise conflict(f"{invoice.number} is {invoice.status}")
    due = invoice.amount_due
    if body.amount > due:
        raise invalid(f"Amount is more than the {thb(due)} still due on {invoice.number}")
    payment = Payment(
        company_id=invoice.company_id,
        invoice=invoice,
        amount=body.amount,
        method=body.method,
        reference=(body.reference or "").strip() or None,
        created_by=user.id,
    )
    db.add(payment)
    db.flush()
    if invoice.amount_due == 0:
        invoice.status = "paid"
        invoice.order.status = "paid"
    db.commit()
    return {"payment": payment_out(payment), "invoice": invoice_row(invoice)}


@router.get("/payments", tags=["accounting"])
def list_payments(user: User = Depends(require(*ACCOUNTING)), db: Session = Depends(get_db)):
    payments = db.scalars(
        select(Payment).where(Payment.company_id == user.company_id).order_by(Payment.id.desc()).limit(200)
    )
    return [payment_out(p) for p in payments]
