"""Migration: Add missing columns to existing tables.

Run with:
  DATABASE_URL="postgresql+psycopg2://..." python migrate.py
Or for local Docker:
  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/amr_db" python migrate.py
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2


def migrate():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL to psycopg2 DSN
    # postgresql+psycopg2://user:pass@host/db -> postgresql://user:pass@host/db
    dsn = db_url.replace("postgresql+psycopg2://", "postgresql://")

    print(f"Connecting to database...")
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    migrations = [
        ("patient", "entered_by", "VARCHAR DEFAULT ''"),
        ("chatmessage", "reactions", "JSON DEFAULT '[]'"),
        ("chatmessage", "is_deleted", "BOOLEAN DEFAULT FALSE"),
        ("chatmessage", "is_edited", "BOOLEAN DEFAULT FALSE"),
        ("chatmessage", "read_by", "JSON DEFAULT '[]'"),
        ("chatmessage", "file_name", "VARCHAR DEFAULT NULL"),
        ("labresult", "patient_id", "INTEGER DEFAULT NULL"),
    ]

    for table, column, dtype in migrations:
        try:
            cur.execute(f"SELECT {column} FROM {table} LIMIT 0")
            print(f"  ✓ {table}.{column} already exists")
        except Exception:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {dtype}")
                print(f"  ✓ Added {table}.{column}")
            except Exception as e:
                print(f"  ✗ Failed to add {table}.{column}: {e}")

    cur.close()
    conn.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
