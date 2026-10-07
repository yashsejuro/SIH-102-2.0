from __future__ import annotations

import numpy as np
import pandas as pd


def compute_peer_median(df: pd.DataFrame, keys: list[str], value_col: str = 'sanction_amount') -> pd.Series:
    peer_values = df.groupby(keys, dropna=False)[value_col].transform('median')
    return peer_values


def compute_peer_context(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result['peer_median'] = np.nan
    for keys in [
        ['state', 'project_category'],
        ['district', 'project_category'],
        ['project_category'],
    ]:
        valid = all(key in result.columns for key in keys)
        if not valid:
            continue
        group_median = result.groupby(keys, dropna=False)['sanction_amount'].transform('median')
        missing = result['peer_median'].isna() & group_median.notna()
        result.loc[missing, 'peer_median'] = group_median.loc[missing]
    result['contextual_cost_deviation'] = np.where(
        result['peer_median'].notna() & (result['peer_median'] > 0),
        result['sanction_amount'] / result['peer_median'],
        np.nan,
    )
    return result
