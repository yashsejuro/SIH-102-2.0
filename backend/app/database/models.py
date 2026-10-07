from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text

from app.database.base import Base


class DatasetModel(Base):
    __tablename__ = 'datasets'

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    storage_name = Column(String, nullable=True)
    dataset_type = Column(String, nullable=True)
    status = Column(String, default='uploaded')
    created_at = Column(DateTime, default=datetime.utcnow)
    raw_summary = Column(JSON, default=dict)
    detected_role = Column(String, nullable=True)
    selected_sheet = Column(String, nullable=True)
    mapping = Column(JSON, default=dict)
    run_id = Column(Integer, nullable=True, index=True)
    uploaded_by_user_id = Column(Integer, nullable=True, index=True)
    sha256_hash = Column(String(64), nullable=True)
    privacy_status = Column(String, nullable=True)
    privacy_summary = Column(JSON, default=dict)
    privacy_scanned_at = Column(DateTime, nullable=True)


class ProjectModel(Base):
    __tablename__ = 'projects'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=True, index=True)
    project_name = Column(String, nullable=True)
    project_code = Column(String, nullable=True)
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    constituency = Column(String, nullable=True)
    agency = Column(String, nullable=True)
    category = Column(String, nullable=True)
    sanction_amount = Column(Float, nullable=True)
    expenditure = Column(Float, nullable=True)
    utilization_ratio = Column(Float, nullable=True)
    expected_completion_date = Column(String, nullable=True)
    actual_completion_date = Column(String, nullable=True)
    status = Column(String, nullable=True)
    anomaly_score = Column(Float, nullable=True)
    ml_anomaly_flag = Column(Boolean, default=False)
    normalized_ml_score = Column(Float, nullable=True)
    peer_median = Column(Float, nullable=True)
    contextual_cost_deviation = Column(Float, nullable=True)
    delay_days = Column(Float, nullable=True)
    final_risk_score = Column(Float, nullable=True)
    risk_level = Column(String, nullable=True)
    reasons = Column(JSON, default=list)
    flags = Column(JSON, default=list)
    signal_components = Column(JSON, default=dict)
    primary_reason = Column(String, nullable=True)
    source_datasets = Column(JSON, default=list)
    source_lineage = Column(JSON, default=dict)
    cross_dataset_conflict = Column(Boolean, default=False)
    duplicate_flag = Column(Boolean, default=False)
    # Calamity-specific fields
    calamity_type = Column(String, nullable=True)
    calamity_name = Column(String, nullable=True)
    consent_date = Column(String, nullable=True)
    consent_amount = Column(Float, nullable=True)
    # MP information
    mp_name = Column(String, nullable=True)
    allocation_limit = Column(Float, nullable=True)
    vendor_name = Column(String, nullable=True)
    payment_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertModel(Base):
    __tablename__ = 'alerts'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=True, index=True)
    project_id = Column(Integer, nullable=True)
    alert_type = Column(String, nullable=False)
    severity = Column(String, default='MEDIUM')
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    project_name = Column(String, nullable=True)
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SecurityAlertModel(Base):
    __tablename__ = 'security_alerts'

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, default='INFO', index=True)
    status = Column(String, nullable=False, default='OPEN', index=True)
    title = Column(String, nullable=False)
    safe_description = Column(Text, nullable=False)
    source = Column(String, nullable=False, default='application')
    actor_user_id = Column(Integer, nullable=True, index=True)
    target_type = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    scope_state = Column(String, nullable=True, index=True)
    scope_id = Column(String, nullable=True, index=True)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    occurrence_count = Column(Integer, nullable=False, default=1)
    assigned_to_user_id = Column(Integer, nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditCaseModel(Base):
    __tablename__ = 'audit_cases'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=True, index=True)
    project_id = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    priority = Column(String, default='MEDIUM')
    status = Column(String, default='Pending Review')
    notes = Column(Text, nullable=True)
    assigned_authority = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditNoteModel(Base):
    __tablename__ = 'audit_notes'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    project_id = Column(Integer, nullable=False, index=True)
    author = Column(String, nullable=True)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditChecklistModel(Base):
    __tablename__ = 'audit_checklists'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    project_id = Column(Integer, nullable=False, index=True)
    item = Column(String, nullable=False)
    completed = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FraudRiskReviewModel(Base):
    __tablename__ = 'fraud_risk_reviews'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    project_id = Column(Integer, nullable=False, index=True)
    signal_code = Column(String, nullable=False)
    disposition = Column(String, nullable=False)
    decision_reason = Column(Text, nullable=True)
    evidence_reference = Column(Text, nullable=True)
    reviewer_user_id = Column(Integer, nullable=True, index=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow)


class DuplicateCandidateModel(Base):
    __tablename__ = 'duplicate_candidates'

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    project_a_id = Column(Integer, nullable=False)
    project_b_id = Column(Integer, nullable=False)
    similarity_score = Column(Float, nullable=False)
    reasons = Column(JSON, default=list)
    review_status = Column(String, default='Needs Investigation')
    created_at = Column(DateTime, default=datetime.utcnow)


class AnalysisRunModel(Base):
    __tablename__ = 'analysis_runs'

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, nullable=True)
    total_projects = Column(Integer, default=0)
    high_risk_count = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    status = Column(String, default='completed')
    is_active = Column(Boolean, default=False, index=True)
    summary = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserModel(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    identity_id = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default='PENDING_ACTIVATION', index=True)
    scope_type = Column(String, nullable=False)
    scope_id = Column(String, nullable=True)
    scope_state = Column(String, nullable=True)
    created_by = Column(Integer, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLogModel(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, nullable=True)
    actor_role = Column(String, nullable=True)
    action = Column(String, nullable=False)
    target_user_id = Column(Integer, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    previous_hash = Column(String(64), nullable=True)
    record_hash = Column(String(64), nullable=True)
