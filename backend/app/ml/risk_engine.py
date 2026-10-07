from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


RISK_CONFIG = {
    'ml_anomaly_weight': 0.40,
    'utilization_weight': 0.20,
    'delay_weight': 0.15,
    'cost_overrun_weight': 0.10,
    'peer_deviation_weight': 0.10,
    'duplicate_weight': 0.03,
    'data_quality_weight': 0.02,
}


def classify_risk(score: float) -> str:
    """Classify numerical risk score into standardized audit priority tier.

    Strict boundary definitions:
    - CRITICAL: score >= 80.0
    - HIGH:     60.0 <= score < 80.0
    - MEDIUM:   35.0 <= score < 60.0
    - LOW:      score < 35.0
    """
    if pd.isna(score):
        return 'LOW'
    val = float(score)
    if val >= 80.0:
        return 'CRITICAL'
    if val >= 60.0:
        return 'HIGH'
    if val >= 35.0:
        return 'MEDIUM'
    return 'LOW'


def calculate_risk(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()

    # Determine eligibility for screening
    sanction_raw = pd.to_numeric(result.get('sanction_amount', pd.Series(np.nan, index=result.index)), errors='coerce')
    expenditure_raw = pd.to_numeric(result.get('expenditure', pd.Series(np.nan, index=result.index)), errors='coerce')
    project_id_raw = result.get('project_id', result.get('project_code', pd.Series('', index=result.index))).fillna('').astype(str).str.strip()

    is_not_screened = (
        (sanction_raw.isna() & expenditure_raw.isna())
        | ((sanction_raw <= 0) & (expenditure_raw <= 0))
        | (project_id_raw == '')
    )
    result['not_screened_flag'] = is_not_screened

    # Normalized ML component (0 to 1)
    result['ml_score_component'] = pd.to_numeric(
        result.get('normalized_ml_score', pd.Series(0.5, index=result.index)),
        errors='coerce',
    ).fillna(0.5).clip(0, 1)

    result['utilization_ratio'] = pd.to_numeric(result.get('utilization_ratio', pd.Series(np.nan, index=result.index)), errors='coerce')
    result['delay_days'] = pd.to_numeric(result.get('delay_days', pd.Series(np.nan, index=result.index)), errors='coerce')

    sanction_amount = sanction_raw.fillna(0)
    expenditure_amount = expenditure_raw.fillna(0)
    result['cost_overrun_flag'] = (expenditure_amount > sanction_amount) & (sanction_amount > 0)
    result['duplicate_flag'] = result.get('duplicate_flag', pd.Series(False, index=result.index)).fillna(False)

    # Data Quality: negative duration, negative financial numbers, cross dataset conflict
    neg_duration = result.get('negative_duration_flag', pd.Series(False, index=result.index)).fillna(False)
    neg_financial = result.get('negative_financial_flag', pd.Series(False, index=result.index)).fillna(False)
    conflict = result.get('cross_dataset_conflict', pd.Series(False, index=result.index)).fillna(False)
    result['data_quality_flag'] = neg_duration | neg_financial | conflict | result.get('data_quality_flag', pd.Series(False, index=result.index)).fillna(False)

    # Utilization score (clipped & scaled)
    utilization_score = pd.Series(0.0, index=result.index)
    if 'utilization_ratio' in result.columns:
        utilization_score = result['utilization_ratio'].fillna(0).clip(lower=0, upper=1.5)
        utilization_score = (utilization_score / 1.5).clip(lower=0, upper=1)

    # Delay score
    delay_score = pd.Series(0.0, index=result.index)
    if 'delay_days' in result.columns:
        delay_score = result['delay_days'].fillna(0).clip(lower=0)
        delay_score = (delay_score / 365).clip(lower=0, upper=1)

    # Cost overrun score
    overrun_ratio = (expenditure_amount / sanction_amount.replace(0, np.nan)).fillna(0)
    cost_overrun_score = ((overrun_ratio.sub(1).clip(lower=0) / 0.5).clip(lower=0, upper=1)).fillna(0)

    # Contextual Peer deviation score
    peer_deviation = pd.to_numeric(result.get('contextual_cost_deviation', pd.Series(np.nan, index=result.index)), errors='coerce')
    peer_deviation_score = ((peer_deviation.sub(1).abs() / 1.5).clip(lower=0, upper=1)).fillna(0)

    duplicate_score = result['duplicate_flag'].astype(float)
    data_quality_score = result['data_quality_flag'].astype(float)

    result['ml_score_component'] = result['ml_score_component'].clip(0, 1)
    result['utilization_score_component'] = utilization_score
    result['delay_score_component'] = delay_score
    result['cost_overrun_score_component'] = cost_overrun_score
    result['peer_deviation_score_component'] = peer_deviation_score
    result['duplicate_score_component'] = duplicate_score
    result['data_quality_score_component'] = data_quality_score

    # Weighted risk calculation
    risk_score = (
        RISK_CONFIG['ml_anomaly_weight'] * result['ml_score_component']
        + RISK_CONFIG['utilization_weight'] * utilization_score
        + RISK_CONFIG['delay_weight'] * delay_score
        + RISK_CONFIG['cost_overrun_weight'] * cost_overrun_score
        + RISK_CONFIG['peer_deviation_weight'] * peer_deviation_score
        + RISK_CONFIG['duplicate_weight'] * duplicate_score
        + RISK_CONFIG['data_quality_weight'] * data_quality_score
    ) * 100.0

    result['risk_score'] = risk_score.clip(lower=0, upper=100)

    # Priority tier determination
    def assign_priority(row: pd.Series) -> str:
        if bool(row.get('not_screened_flag', False)):
            return 'NOT_SCREENED'
        if bool(row.get('data_quality_flag', False)):
            return 'DATA_QUALITY_REVIEW'
        return classify_risk(row['risk_score'])

    result['risk_level'] = result.apply(assign_priority, axis=1)

    # Objective, audit-grade explanation findings
    def build_reasons(row: pd.Series) -> list[str]:
        reasons = []
        if bool(row.get('negative_duration_flag')):
            reasons.append('Completion date precedes sanction date (negative duration anomaly)')
        if bool(row.get('negative_financial_flag')):
            reasons.append('Negative financial amount recorded in registers')
        if row['ml_score_component'] > 0.7:
            reasons.append(f'Isolation Forest flagged unusual multidimensional pattern (score {row["ml_score_component"]:.2f})')
        if pd.notna(row.get('contextual_cost_deviation')) and row['contextual_cost_deviation'] >= 1.5:
            reasons.append(f'Sanction amount is {row["contextual_cost_deviation"]:.1f}x higher than peer benchmark median')
        if bool(row.get('cost_overrun_flag')):
            reasons.append(f'Expenditure exceeds sanctioned amount by ₹{max(0, row.get("expenditure", 0) - row.get("sanction_amount", 0)):,.0f}')
        if pd.notna(row.get('utilization_ratio')) and row['utilization_ratio'] > 1.1:
            reasons.append(f'Fund utilization ratio ({row["utilization_ratio"]:.1%}) exceeds statutory 100% envelope')
        if pd.notna(row.get('delay_days')) and row['delay_days'] > 30:
            reasons.append(f'Project ongoing {int(row["delay_days"])} days beyond target completion date')
        if bool(row.get('duplicate_flag')):
            reasons.append('Duplicate project identity / description cluster detected in district')
        if bool(row.get('cross_dataset_conflict')):
            reasons.append('Conflicting records found across sanctioned and expenditure workbooks')
        if not reasons:
            reasons.append('Project metrics align within monitored baseline tolerances')
        return reasons

    result['reasons'] = result.apply(build_reasons, axis=1)
    return result
