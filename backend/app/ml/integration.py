from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any

import pandas as pd

from app.ml.workbook_reader import read_workbook
from app.ml.preprocessing import normalize_dataframe_columns, normalize_header

ROLE_NAMES = {
    'SANCTIONED_WORKS': 'Sanctioned works',
    'COMPLETED_WORKS': 'Completed works',
    'EXPENDITURE': 'Expenditure',
    'MP_ALLOCATION': 'MP allocation',
    'CALAMITY': 'Calamity',
    'OTHER': 'Other',
}


def normalize_key(value: object) -> str:
    """Normalize identifiers for comparison without conflating meaningful IDs.

    Separators, whitespace and case are presentation differences in the MPLADS
    workbooks.  Alphanumeric characters are retained, so e.g. ``A1`` and
    ``AI`` remain distinct.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return re.sub(r'[^0-9a-z]', '', str(value).strip().casefold())


def context_key(row: dict[str, Any] | pd.Series) -> tuple[str, ...]:
    return tuple(
        normalize_key(row.get(field, ''))
        for field in ['project_name', 'state', 'district', 'constituency', 'mp_name']
    )


def parse_district(ida: object) -> str:
    text = str(ida or '').strip()
    return text.split('(', 1)[0].strip().title() if text else 'Unknown'


def _header_frame(raw: pd.DataFrame) -> pd.DataFrame:
    if raw.empty:
        return raw
    if any(normalize_header(column) in {'project_id', 'project_name', 'sanction_amount', 'expenditure_amount'} for column in raw.columns):
        return raw.reset_index(drop=True)
    header_index = 0
    header_tokens = {'sr. no.', 'work', 'state', 'constituency', 'sanction date', 'completion date', 'work id', 'allocated amount ( ₹ )'}
    for index in range(min(8, len(raw))):
        values = {str(value).strip().lower() for value in raw.iloc[index].tolist() if str(value).strip()}
        if len(values & header_tokens) >= 2:
            header_index = index
            break
    frame = raw.iloc[header_index + 1:].copy()
    columns = [str(value).strip() if str(value).strip() else f'unnamed_{index}' for index, value in enumerate(raw.iloc[header_index].tolist())]
    frame.columns = columns
    return frame.reset_index(drop=True)


def detect_role(filename: str, sheet_name: str, columns: list[str]) -> tuple[str, float, str]:
    filename_lower = filename.lower()
    normalized_columns = {normalize_header(column) for column in columns}
    if filename_lower.endswith('.csv') and {'project_id', 'sanction_amount'}.issubset(normalized_columns) and (
        'expenditure' in normalized_columns or 'utilization_ratio' in normalized_columns
    ):
        return 'SANCTIONED_WORKS', 100.0, 'Generic project-register CSV with canonical identity and sanction fields'
    if 'expenditure' in filename_lower or 'on-going' in filename_lower:
        return 'EXPENDITURE', 99.0, 'Explicit expenditure workbook filename'
    if 'allocated limit' in filename_lower:
        return 'MP_ALLOCATION', 99.0, 'Explicit allocation workbook filename'
    if 'calamity' in filename_lower or 'consented' in filename_lower:
        return 'CALAMITY', 99.0, 'Explicit calamity workbook filename'
    if 'completed' in filename_lower:
        return 'COMPLETED_WORKS', 99.0, 'Explicit completed-work workbook filename'
    if 'sanctioned' in filename_lower:
        return 'SANCTIONED_WORKS', 99.0, 'Explicit sanctioned-work workbook filename'
    text = f'{filename} {sheet_name} {" ".join(columns)}'.lower()
    scores = {
        'SANCTIONED_WORKS': sum(term in text for term in ['sanction', 'recommended date', 'sanction amount']),
        'COMPLETED_WORKS': sum(term in text for term in ['completed', 'completion date', 'amount disbursed']),
        'EXPENDITURE': sum(term in text for term in ['expenditure', 'fund disbursed', 'payment status', 'vendor name']),
        'MP_ALLOCATION': sum(term in text for term in ['allocated', 'allocated amount', 'parliaments']),
        'CALAMITY': sum(term in text for term in ['calamity', 'consent', 'calamity type', 'consent amount']),
    }
    role, score = max(scores.items(), key=lambda pair: pair[1])
    confidence = min(99.0, 62.0 + score * 9.0) if score else 20.0
    reason = f'Filename, sheet, and {score} role-specific header signals'
    return (role if score else 'OTHER', confidence, reason)


def inspect_file(path: str | Path) -> dict[str, Any]:
    path = Path(path)
    sheets = read_workbook(path)
    sheet_details = []
    for name, raw in sheets.items():
        frame = _header_frame(raw)
        role, confidence, reason = detect_role(path.name, name, list(frame.columns))
        sheet_details.append({'sheet': name, 'rows': len(frame), 'columns': list(frame.columns), 'role': role, 'confidence': confidence, 'reason': reason})
    selected = max(sheet_details, key=lambda item: item['confidence'], default=None)
    return {'filename': path.name, 'path': str(path), 'file_type': path.suffix.lower().lstrip('.'), 'sheets': sheet_details, 'selected_sheet': selected['sheet'] if selected else None, 'detected_role': selected['role'] if selected else 'OTHER', 'confidence': selected['confidence'] if selected else 0.0}


def canonicalize_file(path: str | Path, role: str | None = None) -> tuple[pd.DataFrame, dict[str, Any]]:
    path = Path(path)
    metadata = inspect_file(path)
    role = role or metadata['detected_role']
    raw = read_workbook(path)[metadata['selected_sheet']]
    frame = _header_frame(raw)
    if path.suffix.lower() == '.csv':
        normalized = normalize_dataframe_columns(frame)

        def csv_column(name: str, default: object = None, raw_names: tuple[str, ...] = ()) -> pd.Series:
            for raw_name in raw_names:
                if raw_name in frame.columns:
                    return frame[raw_name]
            if name in normalized.columns:
                return normalized[name]
            return pd.Series([default] * len(normalized), index=normalized.index)

        output = pd.DataFrame(index=normalized.index)
        output['source_file'] = metadata['filename']
        output['source_sheet'] = metadata['selected_sheet']
        output['source_row'] = pd.Series(range(2, len(normalized) + 2), index=normalized.index)
        output['source_role'] = role or 'SANCTIONED_WORKS'
        output['project_id'] = csv_column('project_code', '', ('Project ID', 'Work ID', 'Project Code', 'Sr. No.')).map(lambda value: normalize_key(value) if pd.notna(value) else '')
        output['project_name'] = csv_column('project_name', None, ('Project Name', 'Work Description', 'Work'))
        # Some project registers identify a work only by its ID. Keep those
        # rows usable instead of discarding the entire upload.
        output['project_name'] = output['project_name'].where(
            output['project_name'].notna() & output['project_name'].astype(str).str.strip().ne(''),
            output['project_id'],
        )
        for field in ['state', 'district', 'constituency', 'category', 'agency', 'mp_name', 'sanction_date', 'expected_completion_date', 'actual_completion_date', 'completion_status', 'vendor_name', 'payment_status', 'calamity_type', 'calamity_name', 'consent_date']:
            output[field] = csv_column(field)
        output['category'] = csv_column('project_category', 'General', ('Category', 'Project Category', 'Work category'))
        output['completion_status'] = csv_column('status', 'Unknown', ('Status', 'Work Status', 'Completion Status'))
        output['vendor_name'] = csv_column('vendor_name', None, ('Vendor Name', 'Vendor', 'Contractor'))
        output['payment_status'] = csv_column('payment_status', None, ('Payment Status',))
        output['sanction_amount'] = pd.to_numeric(csv_column('sanction_amount', None, ('Sanction Amount', 'Sanction Amount ( ₹ )')), errors='coerce')
        output['expenditure_amount'] = pd.to_numeric(csv_column('expenditure', None, ('Expenditure Amount', 'Expenditure', 'Amount Disbursed')), errors='coerce')
        output['allocation_limit'] = pd.to_numeric(csv_column('allocation_limit'), errors='coerce')
        output['consent_amount'] = pd.to_numeric(csv_column('consent_amount'), errors='coerce')
        output['state'] = output['state'].fillna('Unknown').astype(str).str.strip()
        output['district'] = output['district'].fillna('Unknown').astype(str).str.strip()
        output['constituency'] = output['constituency'].fillna('').astype(str).str.strip()
        output['mp_name'] = output['mp_name'].fillna('').astype(str).str.strip()
        return output, metadata
    # Each supplied workbook ends with a displayed Grand Total.  It is useful in
    # Excel, but is not a project/source record and must never enter ML scoring.
    if 'Sr. No.' in frame.columns:
        frame = frame[frame['Sr. No.'].astype(str).str.strip().str.upper() != 'GRAND TOTAL'].copy()
    source_row = pd.Series(range(3, len(frame) + 3), index=frame.index)
    output = pd.DataFrame(index=frame.index)
    output['source_file'] = metadata['filename']
    output['source_sheet'] = metadata['selected_sheet']
    output['source_row'] = source_row
    output['source_role'] = role

    def column(*names: str) -> pd.Series:
        for name in names:
            if name in frame.columns:
                return frame[name]
        return pd.Series([None] * len(frame), index=frame.index)

    id_column = ('Work ID', 'Work') if role == 'EXPENDITURE' else ('Work', 'Work ID')
    output['project_id'] = column(*id_column).map(lambda value: str(value).strip() if pd.notna(value) else '')
    output['project_name'] = column('Work Description', 'Work description', 'Work')
    output['state'] = column('State')
    output['district'] = column('IDA').map(parse_district)
    output['constituency'] = column('Constituency')
    output['category'] = column('Work category', 'Work Category')
    output['mp_name'] = column("Hon'ble Members of Parliament", "Hon'ble Members of Parliaments")
    output['sanction_amount'] = pd.to_numeric(column('Sanction Amount ( ₹ )'), errors='coerce')
    output['expenditure_amount'] = pd.to_numeric(column('Amount Disbursed ( ₹ )', 'Fund Disbursed Amount ( ₹ )'), errors='coerce')
    output['sanction_date'] = column('Sanction Date', 'Recommended date')
    output['expected_completion_date'] = column('Expected Completion Date', 'Target Completion Date')
    output['actual_completion_date'] = column('Completion Date')
    output['completion_status'] = column('Work Status', 'Payment Status')
    output['allocation_limit'] = pd.to_numeric(column('Allocated AMOUNT ( ₹ )'), errors='coerce')
    output['vendor_name'] = column('Vendor Name')
    output['payment_status'] = column('Payment Status')
    
    # Calamity-specific fields
    output['calamity_type'] = column('Calamity Type')
    output['calamity_name'] = column('Calamity Name')
    output['consent_date'] = column('Date of Consent')
    output['consent_amount'] = pd.to_numeric(column('Consent Amount ( ₹ )'), errors='coerce')
    
    if role == 'MP_ALLOCATION':
        output['project_id'] = ''
        output['project_name'] = 'MP allocation context'
    if role == 'CALAMITY':
        output['project_name'] = output['calamity_name'].fillna('Calamity relief')
        output['sanction_amount'] = output['consent_amount']
        output['sanction_date'] = output['consent_date']
        output['category'] = output['calamity_type'].fillna('Calamity Relief')
        
    output['project_id'] = output['project_id'].map(lambda value: normalize_key(value) if value else '')
    output['state'] = output['state'].fillna('Unknown').astype(str).str.strip()
    output['district'] = output['district'].replace('', 'Unknown').fillna('Unknown')
    output['constituency'] = output['constituency'].fillna('').astype(str).str.strip()
    output['mp_name'] = output['mp_name'].fillna('').astype(str).str.strip()
    return output, metadata


def integrate_files(paths: list[str | Path], roles: dict[str, str] | None = None) -> tuple[pd.DataFrame, dict[str, Any]]:
    canonical_frames = []
    metadata = []
    for path in paths:
        role = (roles or {}).get(Path(path).name)
        frame, info = canonicalize_file(path, role)
        canonical_frames.append(frame)
        metadata.append(info)
    all_rows = pd.concat(canonical_frames, ignore_index=True) if canonical_frames else pd.DataFrame()
    sanctioned = all_rows[all_rows['source_role'] == 'SANCTIONED_WORKS'].copy()
    completed = all_rows[all_rows['source_role'] == 'COMPLETED_WORKS'].copy()
    expenditure = all_rows[all_rows['source_role'] == 'EXPENDITURE'].copy()
    allocation = all_rows[all_rows['source_role'] == 'MP_ALLOCATION'].copy()
    calamity = all_rows[all_rows['source_role'] == 'CALAMITY'].copy()
    projects: dict[str, dict[str, Any]] = {}
    lineage: dict[str, set[str]] = {}
    source_lineage: dict[str, list[dict[str, Any]]] = {}
    conflicts: list[dict[str, Any]] = []
    ambiguous_matches: list[dict[str, Any]] = []
    unmatched_rows: list[dict[str, Any]] = []

    sanctioned_context_index: dict[tuple[str, ...], list[str]] = {}

    def seed_project(row: pd.Series):
        project_id = str(row.get('project_id') or '')
        if not project_id:
            unmatched_rows.append({'source_file': row.get('source_file'), 'source_row': row.get('source_row'), 'source_role': 'SANCTIONED_WORKS', 'reason': 'MISSING_PROJECT_ID'})
            return
        if project_id in projects:
            conflicts.append({'project_id': project_id, 'field': 'project_id', 'existing': project_id, 'incoming': project_id, 'source': row.get('source_file'), 'reason': 'DUPLICATE_PROJECT_IDENTIFIER'})
            return
        projects[project_id] = row.to_dict()
        lineage.setdefault(project_id, set()).add('SANCTIONED_WORKS')
        source_lineage.setdefault(project_id, []).append({'source_file': row.get('source_file'), 'source_sheet': row.get('source_sheet'), 'source_row': row.get('source_row'), 'source_role': 'SANCTIONED_WORKS', 'match_method': 'PROJECT_ID'})
        sanctioned_context_index.setdefault(context_key(row.to_dict()), []).append(project_id)

    def merge_row(row: pd.Series, source_name: str, target_project_id: str | None = None):
        project_id = target_project_id or str(row.get('project_id') or '')
        if not project_id or project_id not in projects:
            return
        item = projects[project_id]
        lineage.setdefault(project_id, set()).add(source_name)
        source_lineage.setdefault(project_id, []).append({'source_file': row.get('source_file'), 'source_sheet': row.get('source_sheet'), 'source_row': row.get('source_row'), 'source_role': source_name, 'match_method': 'PROJECT_ID' if str(row.get('project_id') or '') else 'DESCRIPTIVE_FALLBACK'})
        for field in ['state', 'district', 'constituency', 'category', 'mp_name', 'project_name', 'sanction_amount', 'expenditure_amount', 'sanction_date', 'expected_completion_date', 'actual_completion_date', 'completion_status', 'calamity_type', 'calamity_name', 'consent_date', 'consent_amount', 'vendor_name', 'payment_status']:
            incoming = row.get(field)
            existing = item.get(field)
            if pd.notna(incoming) and str(incoming).strip() not in {'', 'Unknown', 'nan'}:
                # The expenditure workbook is authoritative for disbursement;
                # a sanctioned-register placeholder must not mask it.
                authoritative = {
                    'SANCTIONED_WORKS': {'sanction_amount', 'sanction_date', 'expected_completion_date'},
                    'EXPENDITURE': {'expenditure_amount', 'vendor_name', 'payment_status'},
                    'COMPLETED_WORKS': {'actual_completion_date', 'completion_status'},
                    'MP_ALLOCATION': {'allocation_limit'},
                }
                if field in authoritative.get(source_name, set()):
                    item[field] = incoming
                    continue
                if pd.notna(existing) and str(existing).strip() not in {'', 'Unknown', 'nan'} and str(existing) != str(incoming):
                    conflicts.append({'project_id': project_id, 'field': field, 'existing_value': existing, 'incoming_value': incoming, 'existing': existing, 'incoming': incoming, 'source': row.get('source_file'), 'source_role': source_name})
                elif pd.isna(existing) or str(existing).strip() in {'', 'Unknown', 'nan'}:
                    item[field] = incoming

    def resolve_context_match(row: pd.Series) -> str | None:
        row_project_id = str(row.get('project_id') or '')
        # A reliable source ID is authoritative even if descriptive fields vary.
        if row_project_id and row_project_id in projects:
            return row_project_id
        candidate_keys = sanctioned_context_index.get(context_key(row.to_dict()), [])
        if not candidate_keys:
            return None
        if len(candidate_keys) > 1:
            ambiguous_matches.append({'source_file': row.get('source_file'), 'source_row': row.get('source_row'), 'candidate_project_ids': sorted(candidate_keys), 'match_method': 'PROJECT_NAME_STATE_DISTRICT_CONSTITUENCY_MP', 'confidence': 0.0, 'reason': 'NON_UNIQUE_CONTEXT_KEY'})
            return None
        return candidate_keys[0]

    for row in sanctioned.to_dict('records'):
        seed_project(pd.Series(row))

    # Sanctioned works are the authoritative project register.  Completed and
    # expenditure records are enriched by context (project name, state,
    # district, constituency, and MP) when the workbook IDs do not align.
    for row in completed.to_dict('records'):
        target_id = resolve_context_match(pd.Series(row))
        if target_id:
            merge_row(pd.Series(row), 'COMPLETED_WORKS', target_id)
        else:
            unmatched_rows.append({'source_file': row.get('source_file'), 'source_row': row.get('source_row'), 'source_role': 'COMPLETED_WORKS', 'reason': 'AMBIGUOUS' if any(x.get('source_file') == row.get('source_file') and x.get('source_row') == row.get('source_row') for x in ambiguous_matches) else 'NO_MATCH'})
    for row in expenditure.to_dict('records'):
        target_id = resolve_context_match(pd.Series(row))
        if target_id:
            merge_row(pd.Series(row), 'EXPENDITURE', target_id)
        else:
            unmatched_rows.append({'source_file': row.get('source_file'), 'source_row': row.get('source_row'), 'source_role': 'EXPENDITURE', 'reason': 'AMBIGUOUS' if any(x.get('source_file') == row.get('source_file') and x.get('source_row') == row.get('source_row') for x in ambiguous_matches) else 'NO_MATCH'})

    allocation_keys = {(normalize_key(row['state']), normalize_key(row['mp_name']), normalize_key(row['constituency'])): row for row in allocation.to_dict('records')}
    conflict_ids = {conflict['project_id'] for conflict in conflicts}
    for project_id, item in projects.items():
        key = (normalize_key(item.get('state')), normalize_key(item.get('mp_name')), normalize_key(item.get('constituency')))
        allocation_row = allocation_keys.get(key)
        if allocation_row is not None:
            item['allocation_limit'] = allocation_row.get('allocation_limit')
            lineage.setdefault(project_id, set()).add('MP_ALLOCATION')
        item['source_datasets'] = sorted(lineage.get(project_id, set()))
        item['source_lineage'] = source_lineage.get(project_id, [])
        item['data_quality_flag'] = bool(project_id.startswith(('EXP:', 'CAL:')) or len(lineage.get(project_id, set())) == 1)
        item['cross_dataset_conflict'] = project_id in conflict_ids
    unified = pd.DataFrame(projects.values())
    if not unified.empty:
        unified['expenditure'] = unified['expenditure_amount']
        unified['project_category'] = unified['category'].replace('', 'General').fillna('General')
        unified['project_name'] = unified['project_name'].replace('', 'Unnamed project').fillna('Unnamed project')
    matched_completed = sum(1 for sources in lineage.values() if 'COMPLETED_WORKS' in sources)
    matched_expenditure = sum(1 for sources in lineage.values() if 'EXPENDITURE' in sources)
    roles_seen = {str(frame['source_role'].iloc[0]) for frame in canonical_frames if not frame.empty}
    coverage = {role: round(100.0 * sum(role in sources for sources in lineage.values()) / len(projects), 2) if projects else 0.0 for role in ['SANCTIONED_WORKS', 'COMPLETED_WORKS', 'EXPENDITURE', 'MP_ALLOCATION', 'CALAMITY']}
    missing_source_coverage = [role for role in ['SANCTIONED_WORKS', 'COMPLETED_WORKS', 'EXPENDITURE', 'MP_ALLOCATION', 'CALAMITY'] if role not in roles_seen]
    summary = {
        'datasets': metadata,
        'rows_processed': int(sum(len(frame) for frame in canonical_frames)),
        'projects_created': len(unified),
        'matched_completed': matched_completed,
        'matched_expenditure': matched_expenditure,
        'allocation_matched': int(sum('MP_ALLOCATION' in sources for sources in lineage.values())),
        'calamity_count': len(calamity),
        'conflicts': conflicts,
        'ambiguous_matches': ambiguous_matches,
        'unmatched_rows': unmatched_rows,
        'matched_rows': int(len(completed) + len(expenditure) - len([x for x in unmatched_rows if x['source_role'] in {'COMPLETED_WORKS', 'EXPENDITURE'}])),
        'unmatched_row_count': len(unmatched_rows),
        'ambiguous_match_count': len(ambiguous_matches),
        'conflict_count': len(conflicts),
        'coverage_percentages': coverage,
        'missing_source_coverage': missing_source_coverage,
        'relationship': 'Sanctioned works are the authoritative project register. Completed and expenditure rows are joined by normalized project context (project name, state, district, constituency, and MP) when workbook IDs differ; MP allocation is joined by state, MP, and constituency; calamity rows remain separate.',
    }
    return unified, summary
