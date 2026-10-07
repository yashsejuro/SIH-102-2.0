from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any


ALGORITHM = 'SHA-256'


def canonical_audit_record(record: Any) -> str:
    """Serialize hash-relevant audit fields deterministically."""
    payload = {
        'id': record.id,
        'actor_user_id': record.actor_user_id,
        'actor_role': record.actor_role,
        'action': record.action,
        'target_user_id': record.target_user_id,
        'metadata_json': record.metadata_json or {},
        'created_at': record.created_at.isoformat() if isinstance(record.created_at, datetime) else str(record.created_at),
        'previous_hash': record.previous_hash,
    }
    return json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(',', ':'))


def calculate_audit_hash(record: Any) -> str:
    return hashlib.sha256(canonical_audit_record(record).encode('utf-8')).hexdigest()


def verify_audit_chain(records: list[Any]) -> dict[str, Any]:
    """Verify a complete ordered audit chain without exposing audit contents."""
    if not records:
        return {'status': 'VALID', 'total_records': 0, 'verified_records': 0, 'first_failure': None}

    if any(record.record_hash is None for record in records):
        first_legacy = next(record for record in records if record.record_hash is None)
        return {
            'status': 'INTEGRITY_CHECK_NOT_AVAILABLE',
            'total_records': len(records),
            'verified_records': 0,
            'first_failure': {'audit_log_id': first_legacy.id, 'reason': 'HASH_NOT_AVAILABLE'},
        }

    previous = None
    verified = 0
    for record in records:
        if previous is not None and record.id != previous.id + 1:
            return {
                'status': 'FAILED',
                'total_records': len(records),
                'verified_records': verified,
                'first_failure': {'audit_log_id': record.id, 'reason': 'CHAIN_BROKEN'},
            }
        expected_previous = previous.record_hash if previous is not None else None
        if record.previous_hash != expected_previous:
            return {
                'status': 'FAILED',
                'total_records': len(records),
                'verified_records': verified,
                'first_failure': {'audit_log_id': record.id, 'reason': 'CHAIN_BROKEN'},
            }
        if record.record_hash != calculate_audit_hash(record):
            return {
                'status': 'FAILED',
                'total_records': len(records),
                'verified_records': verified,
                'first_failure': {'audit_log_id': record.id, 'reason': 'RECORD_HASH_MISMATCH'},
            }
        verified += 1
        previous = record

    return {'status': 'VALID', 'total_records': len(records), 'verified_records': verified, 'first_failure': None}