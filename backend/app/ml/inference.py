from __future__ import annotations

from pathlib import Path
import joblib
import numpy as np
import pandas as pd

from app.config import settings

MODEL_PATH = Path(settings.model_dir) / 'mplads_isolation_forest.joblib'
MINIMUM_APPROVED_TRAINING_ROWS = 100
REQUIRED_METADATA = {'source_files', 'training_rows', 'model_version', 'feature_columns', 'trained_at', 'score_calibration'}


def _default_model_metadata() -> dict:
    return {
        'feature_columns': [
            'log_sanction_amount',
            'utilization_ratio',
            'log_contextual_cost_deviation',
            'elapsed_days_as_of',
        ],
        'medians': {
            'log_sanction_amount': 0.0,
            'utilization_ratio': 0.0,
            'log_contextual_cost_deviation': 0.0,
            'elapsed_days_as_of': 0.0,
        },
        'contamination': 0.05,
        'random_state': 42,
        # These bounds are learned from the baseline training population.  They
        # deliberately do not depend on the rows in a later upload.
        'score_calibration': {'low': -0.15, 'high': 0.15},
        'model_version': 'unversioned-legacy-artifact',
    }


def save_model(model, metadata: dict | None = None):
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        'model': model,
        'metadata': metadata or _default_model_metadata(),
    }
    joblib.dump(payload, MODEL_PATH)
    return str(MODEL_PATH)


def load_model() -> dict:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f'Model artifact not found at {MODEL_PATH}')
    return joblib.load(MODEL_PATH)


def model_availability() -> dict:
    """Return a safe diagnostic without exposing model contents."""
    try:
        artifact = load_model()
        metadata = artifact.get('metadata', {}) if isinstance(artifact, dict) else {}
        if not isinstance(artifact, dict) or 'model' not in artifact:
            raise ValueError('artifact does not contain a model payload')
        expected = _default_model_metadata()['feature_columns']
        if metadata.get('feature_columns') != expected:
            raise ValueError('artifact feature schema is incompatible')
        missing = sorted(REQUIRED_METADATA - set(metadata))
        if missing:
            raise ValueError(f'artifact metadata is incomplete: {", ".join(missing)}')
        if int(metadata['training_rows']) < MINIMUM_APPROVED_TRAINING_ROWS:
            raise ValueError(f'artifact training population is too small (minimum {MINIMUM_APPROVED_TRAINING_ROWS})')
        return {'available': True, 'model_version': metadata.get('model_version', 'legacy'), 'training_rows': metadata.get('training_rows')}
    except (FileNotFoundError, ValueError, KeyError, TypeError, OSError) as exc:
        return {'available': False, 'diagnostic': str(exc)}


def prepare_model_features(df: pd.DataFrame) -> pd.DataFrame:
    features = df.copy()
    if 'sanction_amount' in features.columns:
        features['log_sanction_amount'] = np.log1p(features['sanction_amount'].clip(lower=0))
    else:
        features['log_sanction_amount'] = np.nan
    if 'utilization_ratio' in features.columns:
        features['utilization_ratio'] = pd.to_numeric(features['utilization_ratio'], errors='coerce')
    else:
        features['utilization_ratio'] = np.nan
    if 'contextual_cost_deviation' in features.columns:
        features['log_contextual_cost_deviation'] = np.log1p(features['contextual_cost_deviation'].clip(lower=0.0001))
    else:
        features['log_contextual_cost_deviation'] = np.nan
    if 'elapsed_days_as_of' in features.columns:
        features['elapsed_days_as_of'] = pd.to_numeric(features['elapsed_days_as_of'], errors='coerce')
    else:
        features['elapsed_days_as_of'] = np.nan
    feature_cols = [
        'log_sanction_amount',
        'utilization_ratio',
        'log_contextual_cost_deviation',
        'elapsed_days_as_of',
    ]
    for col in feature_cols:
        if col not in features.columns:
            features[col] = np.nan
    return features[feature_cols]


def infer_from_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    artifact = load_model()
    model = artifact['model']
    metadata = artifact.get('metadata', _default_model_metadata())
    feature_matrix = prepare_model_features(df)
    expected_columns = metadata.get('feature_columns', list(feature_matrix.columns))
    if expected_columns != list(feature_matrix.columns):
        raise ValueError(f'Model feature order mismatch: expected {expected_columns}, got {list(feature_matrix.columns)}')
    medians = pd.Series(metadata.get('medians', {}))
    for col in feature_matrix.columns:
        fill_value = medians.get(col, 0.0)
        feature_matrix[col] = feature_matrix[col].fillna(float(fill_value) if pd.notna(fill_value) else 0.0)
    feature_matrix = feature_matrix.fillna(0.0)
    scores = -model.decision_function(feature_matrix)
    predictions = model.predict(feature_matrix)
    calibration = metadata.get('score_calibration', {})
    lower = float(calibration.get('low', np.nan))
    upper = float(calibration.get('high', np.nan))
    if not np.isfinite(lower) or not np.isfinite(upper) or upper <= lower:
        # Existing artifacts predate calibration metadata.  Use fixed, documented
        # Isolation Forest decision-score bounds rather than recalibrating to the
        # current upload, which would make cross-run comparisons impossible.
        lower, upper = -0.15, 0.15
    denominator = max(upper - lower, np.finfo(float).eps)
    output = df.copy()
    output['ml_anomaly_flag'] = (predictions == -1).astype(int)
    output['ml_anomaly_score'] = scores
    output['normalized_ml_score'] = np.clip((scores - lower) / denominator, 0.0, 1.0)
    output['model_version'] = metadata.get('model_version', 'unversioned-legacy-artifact')
    return output
