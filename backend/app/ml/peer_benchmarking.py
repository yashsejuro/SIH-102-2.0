from __future__ import annotations

import numpy as np
import pandas as pd

MINIMUM_PEER_GROUP_SIZE = 10  # N >= 10 peers excluding the record being evaluated


def leave_one_out_median(values: np.ndarray) -> np.ndarray:
    """Calculate leave-one-out median for an array of values without self-influence.

    For each record i, calculates the median of the group excluding record i itself.
    Matches np.median(np.delete(values, i)) exactly in O(n log n) time.
    """
    n = len(values)
    if n <= 1:
        return np.full(n, np.nan, dtype=float)

    sorted_idx = np.argsort(values)
    sorted_v = values[sorted_idx]
    inv_idx = np.empty(n, dtype=int)
    inv_idx[sorted_idx] = np.arange(n)

    m = n - 1  # remaining elements after removing one
    res_sorted = np.empty(n, dtype=float)

    for k in range(n):
        if m % 2 == 1:
            target = m // 2
            val = sorted_v[target if target < k else target + 1]
            res_sorted[k] = val
        else:
            t1 = m // 2 - 1
            t2 = m // 2
            v1 = sorted_v[t1 if t1 < k else t1 + 1]
            v2 = sorted_v[t2 if t2 < k else t2 + 1]
            res_sorted[k] = (v1 + v2) / 2.0

    return res_sorted[inv_idx]


def compute_peer_median(df: pd.DataFrame, keys: list[str], value_col: str = 'sanction_amount') -> pd.Series:
    """Standard transform median for quick aggregate checks."""
    return df.groupby(keys, dropna=False)[value_col].transform('median')


def compute_peer_context(
    df: pd.DataFrame,
    min_peers: int = MINIMUM_PEER_GROUP_SIZE,
    value_col: str = 'sanction_amount',
) -> pd.DataFrame:
    """Compute leave-one-out Contextual Cost Deviation using strict peer hierarchy:
    1. Constituency + Category
    2. State + Category
    3. Category

    A peer group is only valid if N_peers >= min_peers (i.e. group size >= min_peers + 1).
    This strictly avoids self-influence and data leakage.
    """
    result = df.copy()
    result['peer_median'] = np.nan
    result['peer_group_level'] = None
    result['peer_count'] = 0

    if value_col not in result.columns:
        result['contextual_cost_deviation'] = np.nan
        return result

    hierarchy = [
        (['constituency', 'project_category'], 'CONSTITUENCY_CATEGORY'),
        (['state', 'project_category'], 'STATE_CATEGORY'),
        (['project_category'], 'CATEGORY'),
    ]

    valid_mask = result[value_col].notna() & (result[value_col] > 0)

    for keys, level_name in hierarchy:
        if not all(k in result.columns for k in keys):
            continue

        missing_mask = result['peer_median'].isna() & valid_mask
        if not missing_mask.any():
            break

        sub_df = result[valid_mask]
        grouped = sub_df.groupby(keys, dropna=True)

        for _, group_indices in grouped.groups.items():
            group_indices = np.array(list(group_indices))
            group_size = len(group_indices)
            if group_size - 1 < min_peers:
                continue

            group_vals = sub_df.loc[group_indices, value_col].to_numpy(dtype=float)
            loo_medians = leave_one_out_median(group_vals)

            for idx, loo_med in zip(group_indices, loo_medians):
                if pd.isna(result.at[idx, 'peer_median']):
                    result.at[idx, 'peer_median'] = loo_med
                    result.at[idx, 'peer_group_level'] = level_name
                    result.at[idx, 'peer_count'] = group_size - 1

    result['contextual_cost_deviation'] = np.where(
        result['peer_median'].notna() & (result['peer_median'] > 0),
        result[value_col] / result['peer_median'],
        np.nan,
    )
    return result
