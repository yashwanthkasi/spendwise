#!/usr/bin/env python3
"""
Apply a Supabase SQL migration file via direct Postgres connection.

Reads from .env (project root):
  - VITE_SUPABASE_URL          (required — used to derive the DB host)
  - SUPABASE_DB_PASSWORD       (required unless DATABASE_URL is set)
  - DATABASE_URL               (optional full postgres:// connection string)

The anon key cannot run DDL; you need the database password from:
  Supabase Dashboard → Project Settings → Database → Database password
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
DEFAULT_MIGRATION = ROOT / "supabase" / "migrations" / "0004_location.sql"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def project_ref_from_url(url: str) -> str:
    m = re.search(r"https://([a-z0-9-]+)\.supabase\.co", url)
    if not m:
        raise ValueError(f"Could not parse project ref from URL: {url}")
    return m.group(1)


def build_dsn(env: dict[str, str]) -> str:
    if env.get("DATABASE_URL"):
        return env["DATABASE_URL"]

    url = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
    password = env.get("SUPABASE_DB_PASSWORD") or env.get("DB_PASSWORD")
    if not url:
        raise ValueError("Missing VITE_SUPABASE_URL in .env")
    if not password:
        raise ValueError(
            "Missing SUPABASE_DB_PASSWORD in .env.\n"
            "Get it from Supabase Dashboard → Project Settings → Database → "
            "Database password, then add:\n"
            "  SUPABASE_DB_PASSWORD=your_password"
        )

    ref = project_ref_from_url(url)
    host = f"db.{ref}.supabase.co"
    user = env.get("SUPABASE_DB_USER", "postgres")
    db = env.get("SUPABASE_DB_NAME", "postgres")
    port = env.get("SUPABASE_DB_PORT", "5432")
    return f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{db}"


def run_sql_file(dsn: str, sql_path: Path) -> None:
    try:
        import psycopg2
    except ImportError as exc:
        raise SystemExit(
            "psycopg2 not installed. Run: pip install psycopg2-binary"
        ) from exc

    sql = sql_path.read_text(encoding="utf-8")
    if not sql.strip():
        raise ValueError(f"Migration file is empty: {sql_path}")

    print(f"Connecting to database…")
    print(f"Migration: {sql_path.relative_to(ROOT)}")

    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print("SUCCESS — migration applied.")
    finally:
        conn.close()


def main() -> int:
    migration = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MIGRATION
    if not migration.is_absolute():
        migration = ROOT / migration
    if not migration.exists():
        print(f"FAILURE — migration file not found: {migration}", file=sys.stderr)
        return 1

    env = load_env(ENV_PATH)
    # Allow password via shell env (avoids storing secrets in .env).
    for key in (
        "SUPABASE_DB_PASSWORD",
        "DB_PASSWORD",
        "DATABASE_URL",
        "VITE_SUPABASE_URL",
        "SUPABASE_URL",
    ):
        if os.environ.get(key):
            env.setdefault(key, os.environ[key])
    try:
        dsn = build_dsn(env)
        run_sql_file(dsn, migration)
        return 0
    except Exception as exc:
        print(f"FAILURE — {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
