"""Entry point for `fastapi dev main.py` and for Vercel, which looks for `app` here."""

from erp.main import app

__all__ = ["app"]
