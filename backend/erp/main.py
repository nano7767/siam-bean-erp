import os

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from erp.routers import customers, dashboard, invoices, orders, products, stock, users

app = FastAPI(title="Siam Bean Co. Mini ERP API")

# Comma-separated, e.g. "http://localhost:5173,https://siam-bean-erp.vercel.app"
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in allowed_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

FIELD_LABELS = {"sku": "SKU", "tax_id": "Tax ID", "customer_id": "Customer", "product_id": "Product"}


def readable(error: dict) -> str:
    """Turn the first Pydantic error into one sentence that says what to fix."""
    if error["type"] == "value_error":
        return error["msg"].removeprefix("Value error, ")
    field = next((str(p) for p in reversed(error["loc"]) if isinstance(p, str) and p != "body"), "")
    label = FIELD_LABELS.get(field, field.replace("_", " ").capitalize() or "Input")
    if error["type"] == "missing":
        return f"{label} is required"
    if error["type"] in ("int_parsing", "decimal_parsing", "int_from_float"):
        return f"{label} must be a number"
    return f"{label}: {error['msg']}"


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    return JSONResponse(
        status_code=422,
        content={"detail": readable(errors[0]), "errors": jsonable_encoder(errors)},
    )


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/health")
def health():
    return {"status": "ok"}


for module in (users, dashboard, products, customers, stock, orders, invoices):
    app.include_router(module.router)
