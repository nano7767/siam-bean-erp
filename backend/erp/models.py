"""The tables. Keep docs/er-diagram.md in sync with this file."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from erp.db import Base

# BIGINT identity in Postgres; SQLite only auto-increments an INTEGER primary key.
BigId = BigInteger().with_variant(Integer, "sqlite")
Money = Numeric(12, 2)

ROLES = ("admin", "sales", "warehouse", "accountant")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    name: Mapped[str]
    tax_id: Mapped[str | None]
    address: Mapped[str | None]


class User(Base):
    """A staff member. `id` is the Supabase Auth user id."""

    __tablename__ = "users"
    __table_args__ = (CheckConstraint(f"role in {ROLES}", name="users_role_check"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    email: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    role: Mapped[str]
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    company: Mapped[Company] = relationship()


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("payment_terms_days >= 0", name="customers_terms_check"),
        CheckConstraint("length(tax_id) = 13", name="customers_tax_id_check"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str]
    tax_id: Mapped[str]
    address: Mapped[str | None]
    contact: Mapped[str | None]
    payment_terms_days: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class Product(Base):
    """No quantity column: on hand is the sum of stock_movements."""

    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("company_id", "sku"),
        CheckConstraint("price >= 0", name="products_price_check"),
        CheckConstraint("cost >= 0", name="products_cost_check"),
        CheckConstraint("reorder_level >= 0", name="products_reorder_check"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    sku: Mapped[str]
    name: Mapped[str]
    unit: Mapped[str] = mapped_column(default="kg")
    price: Mapped[Decimal] = mapped_column(Money)
    cost: Mapped[Decimal] = mapped_column(Money)
    reorder_level: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class StockMovement(Base):
    """One row per change of stock: + in, − out. Never updated or deleted."""

    __tablename__ = "stock_movements"
    __table_args__ = (CheckConstraint("quantity <> 0", name="stock_movements_quantity_check"),)

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int]
    ref_doc: Mapped[str]
    note: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    product: Mapped[Product] = relationship()
    creator: Mapped[User | None] = relationship()


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        UniqueConstraint("company_id", "number"),
        CheckConstraint(
            "status in ('draft', 'confirmed', 'paid', 'cancelled')", name="sales_orders_status_check"
        ),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    number: Mapped[str]
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    status: Mapped[str] = mapped_column(default="draft")
    order_date: Mapped[date]
    note: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    confirmed_at: Mapped[datetime | None]

    customer: Mapped[Customer] = relationship()
    creator: Mapped[User | None] = relationship(foreign_keys=[created_by])
    lines: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    invoice: Mapped["Invoice | None"] = relationship(back_populates="order")


class OrderItem(Base):
    """Price and cost are copied from the product when the line is saved."""

    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="order_items_quantity_check"),
        CheckConstraint("unit_price >= 0", name="order_items_price_check"),
        CheckConstraint("unit_cost >= 0", name="order_items_cost_check"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Money)
    unit_cost: Mapped[Decimal] = mapped_column(Money)

    order: Mapped[SalesOrder] = relationship(back_populates="lines")
    product: Mapped[Product] = relationship()

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity


class Invoice(Base):
    """A frozen legal document: stores its own subtotal, VAT and total."""

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("company_id", "number"),
        CheckConstraint("status in ('open', 'paid', 'cancelled')", name="invoices_status_check"),
        CheckConstraint("total = subtotal + vat", name="invoices_total_check"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    number: Mapped[str]
    order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    subtotal: Mapped[Decimal] = mapped_column(Money)
    vat: Mapped[Decimal] = mapped_column(Money)
    total: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(default="open")
    issue_date: Mapped[date]
    due_date: Mapped[date]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    company: Mapped[Company] = relationship()
    order: Mapped[SalesOrder] = relationship(back_populates="invoice")
    customer: Mapped[Customer] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice", order_by="Payment.id")

    @property
    def amount_paid(self) -> Decimal:
        return sum((p.amount for p in self.payments), Decimal("0"))

    @property
    def amount_due(self) -> Decimal:
        return self.total - self.amount_paid


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint("amount > 0", name="payments_amount_check"),)

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Money)
    method: Mapped[str] = mapped_column(default="bank_transfer")
    reference: Mapped[str | None]
    paid_at: Mapped[datetime] = mapped_column(default=utcnow)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
    creator: Mapped[User | None] = relationship()


class DocumentCounter(Base):
    """Last number used per company and document type (SO, INV, IN, ADJ)."""

    __tablename__ = "document_counters"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    doc_type: Mapped[str] = mapped_column(primary_key=True)
    last_number: Mapped[int] = mapped_column(default=0)
