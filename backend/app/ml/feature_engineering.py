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
    if 'utilization_ratio' not in result.columns:
        result['utilization_ratio'] = np.where(
            result['sanction_amount'].gt(0),
            result['expenditure'] / result['sanction_amount'],
            np.nan,
        )
    actual_completion = result.get('actual_completion_date')
    result['project_scope'] = np.where(actual_completion.notna() if actual_completion is not None else pd.Series(False, index=result.index), 'Completed', 'Ongoing / incomplete')
    if 'expected_completion_date' in result.columns:
        result['expected_completion_date'] = pd.to_datetime(result['expected_completion_date'], errors='coerce')
    if 'actual_completion_date' in result.columns:
        result['actual_completion_date'] = pd.to_datetime(result['actual_completion_date'], errors='coerce')
    if as_of_date is None:
        as_of_date = pd.Timestamp.now(tz='UTC').tz_localize(None).normalize()
    as_of = pd.Timestamp(as_of_date)
    if 'expected_completion_date' in result.columns:
        completion_date = result.get('actual_completion_date')
        # An incomplete work remains overdue after its expected completion date;
        # this is the early-warning case previously omitted by the pipeline.
        reference_date = completion_date.fillna(as_of) if completion_date is not None else pd.Series(as_of, index=result.index)
        result['delay_days'] = (reference_date - result['expected_completion_date']).dt.days.clip(lower=0)
    else:
        result['delay_days'] = np.nan
    if 'sanction_date' in result.columns:
        result['sanction_date'] = pd.to_datetime(result['sanction_date'], errors='coerce')
        result['elapsed_days_as_of'] = (as_of - result['sanction_date']).dt.days
    else:
        result['elapsed_days_as_of'] = np.nan
    result = compute_peer_context(result)
    if 'contextual_cost_deviation' not in result.columns:
        result['contextual_cost_deviation'] = np.nan
    result['missing_model_inputs'] = result[['sanction_amount', 'expenditure', 'peer_median', 'elapsed_days_as_of']].isna().any(axis=1)
    # Derive duplicate signals from the uploaded records themselves.  Do not
    # fabricate a default flag in an API handler; this keeps single-file and
    # multi-file analysis on the same feature pipeline.
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
    return result
