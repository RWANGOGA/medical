"""Migration: Add missing columns to existing tables.

Run this script to sync the database schema with the current models.
"""
from sqlmodel import Session, text
from app.db import engine


def migrate():
    with Session(engine) as session:
        # Check and add entered_by to patient table
        try:
            session.execute(text("SELECT entered_by FROM patient LIMIT 0"))
            print("✓ patient.entered_by already exists")
        except Exception:
            session.execute(text("ALTER TABLE patient ADD COLUMN entered_by VARCHAR DEFAULT ''"))
            print("✓ Added patient.entered_by")

        # Check and add reactions to chatmessage table
        try:
            session.execute(text("SELECT reactions FROM chatmessage LIMIT 0"))
            print("✓ chatmessage.reactions already exists")
        except Exception:
            session.execute(text("ALTER TABLE chatmessage ADD COLUMN reactions JSON DEFAULT '[]'"))
            print("✓ Added chatmessage.reactions")

        # Check and add is_deleted to chatmessage table
        try:
            session.execute(text("SELECT is_deleted FROM chatmessage LIMIT 0"))
            print("✓ chatmessage.is_deleted already exists")
        except Exception:
            session.execute(text("ALTER TABLE chatmessage ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE"))
            print("✓ Added chatmessage.is_deleted")

        # Check and add is_edited to chatmessage table
        try:
            session.execute(text("SELECT is_edited FROM chatmessage LIMIT 0"))
            print("✓ chatmessage.is_edited already exists")
        except Exception:
            session.execute(text("ALTER TABLE chatmessage ADD COLUMN is_edited BOOLEAN DEFAULT FALSE"))
            print("✓ Added chatmessage.is_edited")

        # Check and add read_by to chatmessage table
        try:
            session.execute(text("SELECT read_by FROM chatmessage LIMIT 0"))
            print("✓ chatmessage.read_by already exists")
        except Exception:
            session.execute(text("ALTER TABLE chatmessage ADD COLUMN read_by JSON DEFAULT '[]'"))
            print("✓ Added chatmessage.read_by")

        # Check and add file_name to chatmessage table
        try:
            session.execute(text("SELECT file_name FROM chatmessage LIMIT 0"))
            print("✓ chatmessage.file_name already exists")
        except Exception:
            session.execute(text("ALTER TABLE chatmessage ADD COLUMN file_name VARCHAR DEFAULT NULL"))
            print("✓ Added chatmessage.file_name")

        # Check and add patient_id to labresult table
        try:
            session.execute(text("SELECT patient_id FROM labresult LIMIT 0"))
            print("✓ labresult.patient_id already exists")
        except Exception:
            session.execute(text("ALTER TABLE labresult ADD COLUMN patient_id INTEGER DEFAULT NULL"))
            print("✓ Added labresult.patient_id")

        session.commit()
        print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
