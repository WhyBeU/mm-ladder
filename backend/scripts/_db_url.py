"""Database-URL resolution shared by the scripts in this folder.

Nothing auto-loads `backend/.env`, so `--prod` reads the file directly rather than making
every invocation export a variable first. Passwords live inside these URLs — always run
them through `mask()` before printing.
"""

import os
import re
import sys
from pathlib import Path

DEFAULT_DB_URL = "sqlite:///./mm_ladder.db"
PROD_URL_ENV = "NEON_DIRECT_URL"  # sync psycopg URL for the Neon prod branch (see backend/.env)
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def env_file_value(key: str) -> str | None:
    """Read one KEY=value out of backend/.env, so --prod works without exporting anything."""
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip() == key:
            return value.strip().strip("\"'")
    return None


def prod_url() -> str:
    """The Neon prod URL, from the environment or backend/.env. Exits 2 when neither has it."""
    url = os.getenv(PROD_URL_ENV) or env_file_value(PROD_URL_ENV)
    if not url:
        print(f"prod access needs {PROD_URL_ENV} set in the environment or in {ENV_FILE}", file=sys.stderr)
        raise SystemExit(2)
    return url


def resolve_db_url(db_url: str | None, use_prod: bool) -> str:
    """--db-url wins, then --prod ($NEON_DIRECT_URL / backend/.env), then $DATABASE_URL, then local."""
    if db_url:
        return db_url
    if use_prod:
        return prod_url()
    return os.getenv("DATABASE_URL", DEFAULT_DB_URL)


def mask(url: str) -> str:
    """Hide the password before echoing a connection string to the terminal."""
    return re.sub(r"://([^:/@]+):[^@]+@", r"://\1:***@", url)
