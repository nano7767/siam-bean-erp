import os
from collections.abc import Iterator
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import DateTime, Engine, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()


class Base(DeclarativeBase):
    type_annotation_map = {str: Text, datetime: DateTime(timezone=True)}


def database_url() -> str:
    """Supabase gives a postgresql:// URL; SQLAlchemy needs the psycopg driver named."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (see backend/.env.example)")
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


_session_factory: sessionmaker[Session] | None = None


def make_engine() -> Engine:
    return create_engine(
        database_url(),
        pool_size=2,
        max_overflow=3,
        pool_pre_ping=True,
        pool_recycle=300,
        # Supabase's transaction pooler (port 6543) does not support prepared statements.
        connect_args={"prepare_threshold": None},
    )


def get_db() -> Iterator[Session]:
    """One session per request. Anything not committed is rolled back when it closes."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=make_engine(), expire_on_commit=False)
    with _session_factory() as db:
        yield db
