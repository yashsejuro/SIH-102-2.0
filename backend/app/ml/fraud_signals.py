"""Deterministic potential fraud-risk signals; never findings of wrongdoing."""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from datetime import datetime
from typing import Any


DISCLAIMER = 'Potential fraud-risk signal requiring human verification; it is not proof of wrongdoing.'


def normalize_entity(value: Any) -> dict[str, Any]:
    raw = '' if value is None else str(value)
    normalized = unicodedata.normalize('NFKC', raw).casefold().strip()
    normalized = re.sub(r'\b(m/s|ms|ltd|limited|pvt|private)\b', '', normalized)
    normalized = re.sub(r'[^\w]+', ' ', normalized).strip()
    return {'normalized_value': normalized, 'matching_method': 'UNICODE_CASEFOLD_PUNCTUATION_NORMALIZATION', 'confidence': 1.0 if normalized else 0.0, 'ambiguous': False, 'candidate_ids': []}


def _get(row: Any, key: str, default=None): return row.get(key, default) if isinstance(row, dict) else getattr(row, key, default)
def _num(value: Any):
    try:
        result = float(value) if value is not None else None
        return result if result is not None and result == result and abs(result) != float('inf') else None
    except (TypeError, ValueError): return None


def _date(value: Any):
    if value is None or not str(value).strip():
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).date()
    except ValueError:
        try:
            return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
        except ValueError:
            return None
def _signal(code, severity, title, explanation, project_id, evidence, verification):
    return {'signal_code': code, 'severity': severity, 'confidence': 0.8, 'title': title, 'explanation': explanation, 'evidence': evidence, 'project_id': project_id, 'recommended_verification': verification, 'disclaimer': DISCLAIMER}


def evaluate_signals(records: list[Any]) -> dict[Any, list[dict]]:
    """Return signals keyed by local project id, using safe aggregates only."""
    output = {_get(row, 'id', _get(row, 'project_id')): [] for row in records}
    descriptions = Counter(normalize_entity(_get(row, 'project_name'))['normalized_value'] for row in records)
    vendors = Counter(normalize_entity(_get(row, 'vendor_name'))['normalized_value'] for row in records)
    codes = Counter(normalize_entity(_get(row, 'project_code', _get(row, 'project_id')))['normalized_value'] for row in records)
    payment_references = Counter(normalize_entity(_get(row, 'payment_reference', _get(row, 'payment_id')))['normalized_value'] for row in records)
    cluster_counts = Counter(
        (
            normalize_entity(_get(row, 'project_name'))['normalized_value'],
            normalize_entity(_get(row, 'vendor_name'))['normalized_value'],
            normalize_entity(_get(row, 'district'))['normalized_value'],
        )
        for row in records
    )
    year_counts = Counter(
        (
            normalize_entity(_get(row, 'project_name'))['normalized_value'],
            _date(_get(row, 'sanction_date')).year if _date(_get(row, 'sanction_date')) else None,
        )
        for row in records
    )
    description_years: dict[str, set[int]] = {}
    for row in records:
        description_key = normalize_entity(_get(row, 'project_name'))['normalized_value']
        sanction_date = _date(_get(row, 'sanction_date'))
        if description_key and sanction_date:
            description_years.setdefault(description_key, set()).add(sanction_date.year)
    for row in records:
        pid = _get(row, 'id', _get(row, 'project_id')); bucket = output[pid]
        code = normalize_entity(_get(row, 'project_code', _get(row, 'project_id')))['normalized_value']
        description = normalize_entity(_get(row, 'project_name'))['normalized_value']; vendor = normalize_entity(_get(row, 'vendor_name'))['normalized_value']
        sanction, expense, utilization = _num(_get(row, 'sanction_amount')), _num(_get(row, 'expenditure')), _num(_get(row, 'utilization_ratio'))
        payment_reference = normalize_entity(_get(row, 'payment_reference', _get(row, 'payment_id')))['normalized_value']
        if code and codes[code] > 1: bucket.append(_signal('DUPLICATE_PROJECT_IDENTIFIER', 'HIGH', 'Duplicate project identifier', 'The identifier appears on multiple projects in this run.', pid, {'project_code': code, 'count': codes[code]}, 'Reconcile authoritative registers.'))
        if payment_reference and payment_references[payment_reference] > 1: bucket.append(_signal('DUPLICATE_PAYMENT_REFERENCE', 'HIGH', 'Duplicate payment reference', 'The payment reference appears on multiple projects in this run.', pid, {'payment_reference': payment_reference, 'count': payment_references[payment_reference]}, 'Reconcile the payment ledger and source vouchers.'))
        if description and descriptions[description] > 1: bucket.append(_signal('REPEATED_WORK_DESCRIPTION', 'MEDIUM', 'Repeated work description', 'A near-identical work description appears more than once.', pid, {'description_key': description, 'count': descriptions[description]}, 'Compare locations, approvals and measurement books.'))
        if vendor and vendors[vendor] >= 3: bucket.append(_signal('VENDOR_CONCENTRATION', 'MEDIUM', 'Vendor concentration', 'This vendor appears across multiple projects in the visible run.', pid, {'vendor_key': vendor, 'projects': vendors[vendor]}, 'Review procurement competition and contract records.'))
        if sanction is not None and expense is not None and expense > sanction: bucket.append(_signal('EXPENDITURE_ABOVE_SANCTION', 'HIGH', 'Expenditure above sanction', 'Reported expenditure exceeds sanctioned amount.', pid, {'sanction_amount': sanction, 'expenditure': expense}, 'Verify sanction amendments, bills and payments.'))
        if utilization is not None and utilization > 1.1: bucket.append(_signal('EXCESSIVE_UTILIZATION', 'HIGH', 'Excessive utilization', 'Utilization exceeds 110 percent.', pid, {'utilization_ratio': utilization}, 'Reconcile disbursement ledger with sanctions.'))
        cluster_key = (description, vendor, normalize_entity(_get(row, 'district'))['normalized_value'])
        if description and cluster_counts[cluster_key] >= 2 and vendor:
            bucket.append(_signal('POSSIBLE_PROJECT_SPLITTING', 'HIGH', 'Possible project splitting pattern', 'Similar works for the same vendor and district appear as separate projects.', pid, {'cluster_count': cluster_counts[cluster_key], 'district_key': cluster_key[2], 'vendor_key': vendor}, 'Compare approvals, work scope, dates and procurement records.'))
        sanction_date = _date(_get(row, 'sanction_date'))
        payment_date = _date(_get(row, 'payment_date'))
        completion_date = _date(_get(row, 'actual_completion_date'))
        if payment_date and sanction_date and payment_date < sanction_date:
            bucket.append(_signal('PAYMENT_BEFORE_SANCTION', 'HIGH', 'Payment precedes sanction', 'A payment date precedes the recorded sanction date.', pid, {'payment_date': payment_date.isoformat(), 'sanction_date': sanction_date.isoformat()}, 'Verify payment authorization and sanction chronology.'))
        if payment_date and completion_date and payment_date > completion_date:
            bucket.append(_signal('PAYMENT_AFTER_COMPLETION', 'MEDIUM', 'Payment follows completion', 'A payment date follows the recorded completion date.', pid, {'payment_date': payment_date.isoformat(), 'completion_date': completion_date.isoformat()}, 'Verify final bills, retention payments and completion records.'))
        if description and sanction_date and year_counts[(description, sanction_date.year)] > 1:
            bucket.append(_signal('REPEATED_WORKS_SAME_YEAR', 'MEDIUM', 'Repeated works in the same year', 'The normalized work description appears more than once in the same sanction year.', pid, {'description_key': description, 'year': sanction_date.year, 'count': year_counts[(description, sanction_date.year)]}, 'Compare locations, beneficiaries and approvals.'))
        if description and len(description_years.get(description, set())) > 1:
            bucket.append(_signal('REPEATED_WORKS_ACROSS_YEARS', 'MEDIUM', 'Repeated works across years', 'The normalized work description appears in multiple sanction years.', pid, {'description_key': description, 'years': sorted(description_years[description])}, 'Compare work scope, beneficiaries and historical approvals.'))
        if bool(_get(row, 'cross_dataset_conflict', False)): bucket.append(_signal('CROSS_SOURCE_FINANCIAL_CONFLICT', 'MEDIUM', 'Cross-source conflict', 'Source datasets contain conflicting project values.', pid, {}, 'Reconcile against authoritative source records.'))
    return output


def vendor_analytics(records: list[Any]) -> list[dict]:
    grouped: dict[str, list[Any]] = {}
    for row in records:
        key = normalize_entity(_get(row, 'vendor_name'))['normalized_value']
        if key: grouped.setdefault(key, []).append(row)
    total = max(len(records), 1)
    return sorted([{'vendor': key, 'projects': len(rows), 'sanctioned_amount': sum(_num(_get(r, 'sanction_amount')) or 0 for r in rows), 'expenditure': sum(_num(_get(r, 'expenditure')) or 0 for r in rows), 'average_utilization': sum(_num(_get(r, 'utilization_ratio')) or 0 for r in rows) / len(rows), 'district_count': len({str(_get(r, 'district') or '') for r in rows}), 'constituency_count': len({str(_get(r, 'constituency') or '') for r in rows}), 'agency_count': len({str(_get(r, 'agency') or '') for r in rows}), 'high_risk_count': sum(_get(r, 'risk_level') in {'HIGH', 'CRITICAL'} for r in rows), 'critical_count': sum(_get(r, 'risk_level') == 'CRITICAL' for r in rows), 'anomaly_count': sum(bool(_get(r, 'ml_anomaly_flag')) for r in rows), 'concentration_percentage': round(100 * len(rows) / total, 2)} for key, rows in grouped.items()], key=lambda item: item['projects'], reverse=True)
