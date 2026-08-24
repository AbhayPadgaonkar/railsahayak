import os

import pytest

from backend.database import reset_database, set_db_url

_TEST_DB_URL = "postgresql://postgres:postgres@localhost:5432/railsahayak_test"


@pytest.fixture(autouse=True)
def _isolated_db():
    """Point Prisma at the test database and truncate tables before each test."""
    set_db_url(os.environ.get("DATABASE_URL_TEST", _TEST_DB_URL))
    reset_database()
    yield
