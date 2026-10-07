import os
import sys
from sqlalchemy import create_engine
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
from app.config import settings

engine = create_engine(settings.database_url)
with engine.connect() as conn:
    conn.execute(text("TRUNCATE projects, alerts, audit_cases, analysis_runs, datasets CASCADE;"))
    conn.commit()
    print("Database cleared!")
