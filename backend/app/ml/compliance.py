"""Deterministic, explainable compliance review checks.

Findings are audit-prioritisation signals.  They do not establish fraud or any
other legal conclusion.
"""
from __future__ import annotations

from typing import Any
import math

import pandas as pd

DEFAULT_CONFIG = {'utilization_warning': 1.0, 'utilization_critical': 1.1, 'overdue_days': 0}


def _value(record: Any, name: str, default=None):
    return record.get(name, default) if isinstance(record, dict) else getattr(record, name, default)


def is_missing(value: Any) -> bool:
    """Pandas/ORM-safe missing-value check (including pd.NA and whitespace)."""
    if value is None or isinstance(value, str) and not value.strip():
        return True
    try:
        result = pd.isna(value)
        return bool(result) if not hasattr(result, 'all') else bool(result.all())
    except (TypeError, ValueError):
        return False


def numeric(value: Any) -> float | None:
    if is_missing(value):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def _finding(code: str, severity: str, title: str, explanation: str, project_id: Any, evidence: dict, action: str) -> dict:
    return {'rule_code': code, 'severity': severity, 'title': title, 'explanation': explanation,
            'evidence_fields': evidence, 'project_id': project_id, 'recommended_action': action,
            'disclaimer': 'Compliance review signal only; requires human verification.'}


def evaluate_project(record: Any, config: dict | None = None) -> list[dict]:
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    pid = _value(record, 'id', _value(record, 'project_id', _value(record, 'project_code')))
    sanction, expense = numeric(_value(record, 'sanction_amount')), numeric(_value(record, 'expenditure', _value(record, 'expenditure_amount')))
    utilization = numeric(_value(record, 'utilization_ratio'))
    status_value = _value(record, 'status', _value(record, 'completion_status', ''))
    status = '' if is_missing(status_value) else str(status_value).casefold()
    findings = []
    if sanction is None: findings.append(_finding('MISSING_SANCTION_AMOUNT', 'MEDIUM', 'Missing sanction amount', 'No valid sanction amount is available.', pid, {'sanction_amount': _value(record, 'sanction_amount')}, 'Obtain the sanction order.'))
    if expense is None: findings.append(_finding('MISSING_EXPENDITURE', 'MEDIUM', 'Missing expenditure', 'No valid expenditure record is available.', pid, {'expenditure': _value(record, 'expenditure', _value(record, 'expenditure_amount'))}, 'Obtain expenditure records.'))
    project_code = _value(record, 'project_code', _value(record, 'project_id', ''))
    if is_missing(project_code): findings.append(_finding('MISSING_PROJECT_ID', 'HIGH', 'Missing project identifier', 'The project cannot be reliably reconciled without an ID.', pid, {}, 'Verify the source register identifier.'))
    if sanction is not None and expense is not None and expense > sanction: findings.append(_finding('EXPENDITURE_EXCEEDS_SANCTION', 'HIGH', 'Expenditure exceeds sanction', 'Reported expenditure is greater than the sanctioned amount.', pid, {'sanction_amount': sanction, 'expenditure': expense}, 'Verify approvals, bills and payment records.'))
    if utilization is not None and utilization > cfg['utilization_warning']: findings.append(_finding('UTILIZATION_ABOVE_THRESHOLD', 'CRITICAL' if utilization > cfg['utilization_critical'] else 'HIGH', 'Utilization above threshold', 'Utilization exceeds the configured review threshold.', pid, {'utilization_ratio': utilization, 'threshold': cfg['utilization_warning']}, 'Reconcile disbursements with sanction and completion records.'))
    delay = numeric(_value(record, 'delay_days'))
    if delay is not None and delay > cfg['overdue_days'] and 'completed' not in status: findings.append(_finding('OVERDUE_ONGOING_PROJECT', 'MEDIUM', 'Overdue ongoing project', 'An ongoing project is beyond its expected completion date.', pid, {'delay_days': delay}, 'Obtain progress report and revised completion schedule.'))
    if 'completed' in status and is_missing(_value(record, 'actual_completion_date')): findings.append(_finding('COMPLETED_MISSING_DATE', 'HIGH', 'Completed project missing completion date', 'Completion status is recorded without a completion date.', pid, {'status': status}, 'Obtain completion certificate.'))
    payment_value = _value(record, 'payment_status', '')
    payment = '' if is_missing(payment_value) else str(payment_value).casefold()
    if 'completed' in status and payment in {'pending', 'unpaid', 'partially paid'}: findings.append(_finding('PAYMENT_COMPLETION_INCONSISTENCY', 'MEDIUM', 'Payment/completion inconsistency', 'Completion status conflicts with recorded payment status.', pid, {'status': status, 'payment_status': payment}, 'Verify payment ledger and completion certificate.'))
    if _value(record, 'cross_dataset_conflict', False): findings.append(_finding('CROSS_SOURCE_CONFLICT', 'MEDIUM', 'Cross-source conflict', 'Source records provide conflicting values.', pid, {}, 'Reconcile against authoritative source workbook.'))
    allocation = numeric(_value(record, 'allocation_limit'))
    if allocation is not None and sanction is not None and sanction > allocation: findings.append(_finding('ALLOCATION_LIMIT_EXCEEDED', 'HIGH', 'Allocation limit exceeded', 'Sanction amount exceeds the available allocation limit.', pid, {'sanction_amount': sanction, 'allocation_limit': allocation}, 'Verify allocation approval and MP limit.'))
    return findings


def evaluate_run(records: list[Any], integration_summary: dict | None = None, config: dict | None = None) -> list[dict]:
    findings = [finding for record in records for finding in evaluate_project(record, config)]
    summary = integration_summary or {}
    for role in summary.get('missing_source_coverage', []):
        findings.append(_finding('INCOMPLETE_SOURCE_COVERAGE', 'MEDIUM', 'Incomplete source coverage', f'{role} source was not supplied for this analysis run.', None, {'source_role': role}, 'Obtain and ingest the missing authoritative source.'))
    return findings
