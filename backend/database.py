"""PostgreSQL persistence via Prisma Client Python (sync interface).

The ``Prisma`` client is generated from ``backend/prisma/schema.prisma``.
Runtime connection is configured through the ``DATABASE_URL`` environment
variable. Tests point the client at a separate database via
``database.set_db_url``.
"""

import atexit
import logging
import os

import prisma.errors
from prisma import Prisma

logger = logging.getLogger(__name__)

_DEFAULT_DB_URL = "postgresql://postgres:postgres@localhost:5432/railsahayak"
_db_url: str = os.environ.get("DATABASE_URL", _DEFAULT_DB_URL)
_prisma: Prisma | None = None


def set_db_url(url: str) -> None:
    """Override the database URL and force a reconnection on next use."""
    global _db_url, _prisma
    _db_url = url
    os.environ["DATABASE_URL"] = url
    if _prisma is not None:
        try:
            _prisma.disconnect()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Prisma disconnect failed: %s", exc)
        _prisma = None


def get_db_url() -> str:
    """Return the currently configured database URL."""
    return _db_url


def get_client() -> Prisma:
    """Return a connected singleton Prisma client (lazily created)."""
    global _prisma
    if _prisma is None:
        os.environ["DATABASE_URL"] = _db_url
        _prisma = Prisma()
        _prisma.connect()
        atexit.register(_disconnect)
    return _prisma


def _disconnect() -> None:
    global _prisma
    if _prisma is not None:
        try:
            _prisma.disconnect()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Prisma disconnect failed: %s", exc)
        _prisma = None


def reset_database() -> None:
    """Truncate all Prisma-managed tables. Useful for test isolation."""
    db = get_client()
    for table_delete in [
        db.auditaction.delete_many,
        db.crisis.delete_many,
        db.decision.delete_many,
        db.session.delete_many,
    ]:
        try:
            table_delete()
        except prisma.errors.TableNotFoundError:
            pass  # table may not exist in a fresh test database


def migrate() -> None:
    """Push the schema to the configured database.

    This is a dev convenience; production should run ``prisma migrate deploy``
    with generated migration files.
    """
    import subprocess
    import sys

    env = os.environ.copy()
    env["DATABASE_URL"] = _db_url
    subprocess.run(
        [sys.executable, "-m", "prisma", "db", "push", "--accept-data-loss"],
        cwd=os.path.dirname(__file__),
        env=env,
        check=True,
    )
