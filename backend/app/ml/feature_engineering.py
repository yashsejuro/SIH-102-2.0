from __future__ import annotations

import numpy as np
import pandas as pd

from app.ml.peer_benchmarking import compute_peer_context


def clean_numeric_columns(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    result = df.copy()
    for col in cols:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors='coerce')
    return result


def engineer_features(df: pd.DataFrame, as_of_date: str | pd.Timestamp | None = None) -> pd.DataFrame:
    result = df.copy()
    result = clean_numeric_columns(result, ['sanction_amount', 'expenditure', 'peer_median'])

    # 1. Financial Flags & Ratios (Disbursement-to-Sanction Ratio)
    has_neg_sanction = result['sanction_amount'] < 0
    has_neg_expenditure = result['expenditure'] < 0
    result['negative_financial_flag'] = has_neg_sanction | has_neg_expenditure

    valid_sanction = result['sanction_amount'].gt(0) & ~has_neg_sanction
    valid_expenditure = result['expenditure'].notna() & ~has_neg_expenditure

    # Calculate utilization / disbursement ratio
    result['utilization_ratio'] = np.where(
        valid_sanction & valid_expenditure,
        result['expenditure'] / result['sanction_amount'],
        np.nan,
    )
    result['disbursement_to_sanction_ratio'] = result['utilization_ratio']

    # 2. Scope & Dates
    actual_completion = result.get('actual_completion_date')
    result['project_scope'] = np.where(
        actual_completion.notna() if actual_completion is not None else pd.Series(False, index=result.index),
        'Completed',
        'Ongoing / incomplete',
    )

    if 'expected_completion_date' in result.columns:
        result['expected_completion_date'] = pd.to_datetime(result['expected_completion_date'], errors='coerce')
    if 'actual_completion_date' in result.columns:
        result['actual_completion_date'] = pd.to_datetime(result['actual_completion_date'], errors='coerce')
    if 'sanction_date' in result.columns:
        result['sanction_date'] = pd.to_datetime(result['sanction_date'], errors='coerce')

    if as_of_date is None:
        as_of_date = pd.Timestamp.now(tz='UTC').tz_localize(None).normalize()
    as_of = pd.Timestamp(as_of_date)

    # 3. Duration_Days = Actual Completion Date - Sanction Date
    # CRITICAL: Negative durations MUST NOT silently disappear; they are retained & flagged.
    if 'sanction_date' in result.columns and 'actual_completion_date' in result.columns:
        duration_series = (result['actual_completion_date'] - result['sanction_date']).dt.days
        result['duration_days'] = duration_series
        result['negative_duration_flag'] = duration_series < 0
    else:
        result['duration_days'] = np.nan
        result['negative_duration_flag'] = False

    # 4. Overdue Delay Days (relative to expected completion date)
    if 'expected_completion_date' in result.columns:
        completion_date = result.get('actual_completion_date')
        reference_date = completion_date.fillna(as_of) if completion_date is not None else pd.Series(as_of, index=result.index)
        result['delay_days'] = (reference_date - result['expected_completion_date']).dt.days.clip(lower=0)
    else:
        result['delay_days'] = np.nan

    # 5. Elapsed days as of current monitoring snapshot
    if 'sanction_date' in result.columns:
        result['elapsed_days_as_of'] = (as_of - result['sanction_date']).dt.days.clip(lower=0)
    else:
        result['elapsed_days_as_of'] = np.nan

    # 6. Peer Benchmarking & Contextual Cost Deviation (Hierarchy + Leave-One-Out)
    result = compute_peer_context(result)
    if 'contextual_cost_deviation' not in result.columns:
        result['contextual_cost_deviation'] = np.nan

    # 7. Model Input Completeness
    result['missing_model_inputs'] = result[['sanction_amount', 'expenditure', 'peer_median', 'elapsed_days_as_of']].isna().any(axis=1)

    # 8. Duplicate Project Identifier & Identity Signal
    if {'project_name', 'state', 'district'}.issubset(result.columns):
        duplicate_key = (
            result[['project_name', 'state', 'district']]
            .fillna('')
            .astype(str)
            .apply(lambda column: column.str.strip().str.casefold())
            .agg('|'.join, axis=1)
        )
        has_identity = result[['project_name', 'state', 'district']].fillna('').astype(str).apply(
            lambda column: column.str.strip().ne('')
        ).any(axis=1)
        result['duplicate_flag'] = duplicate_key.duplicated(keep=False) & has_identity
    else:
        result['duplicate_flag'] = False

    # 9. Unified Data Quality Flag
    result['data_quality_flag'] = (
        result['negative_duration_flag']
        | result['negative_financial_flag']
        | result.get('cross_dataset_conflict', pd.Series(False, index=result.index)).fillna(False)
    )

    return result
