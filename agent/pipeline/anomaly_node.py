from typing import Any
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

from agent.pipeline.state import PipelineState

NUMERIC_FEATURES = ["BOOKING_VALUE", "RIDE_DISTANCE", "AVG_VTAT", "AVG_CTAT", "DRIVER_RATINGS", "CUSTOMER_RATING"]


def _iqr_reason(row: pd.Series, feature_stats: dict[str, dict]) -> str:
    """Return a human-readable reason for why this row was flagged."""
    reasons = []
    for col, stats in feature_stats.items():
        val = row.get(col)
        if pd.isna(val):
            continue
        z = abs((val - stats["mean"]) / stats["std"]) if stats["std"] > 0 else 0
        if z > 2.5:
            direction = "above" if val > stats["mean"] else "below"
            reasons.append(f"{col} {z:.1f}σ {direction} mean ({val:.2f})")
    return "; ".join(reasons) if reasons else "multivariate anomaly"


def anomaly_node(state: PipelineState) -> dict[str, Any]:
    """LangGraph node: runs IsolationForest on the cleaned DataFrame."""
    clean_df: pd.DataFrame = state.get("clean_df", pd.DataFrame())

    if clean_df.empty:
        return {
            "anomaly_df": pd.DataFrame(),
            "anomaly_summary": {"error": "No cleaned data available — run Clean & Transform first"},
        }

    available = [c for c in NUMERIC_FEATURES if c in clean_df.columns]
    feature_df = clean_df[available].copy()

    # Drop columns that are entirely NaN (can't compute median or fit model)
    feature_df = feature_df.dropna(axis=1, how="all")
    available = list(feature_df.columns)

    if not available:
        return {
            "anomaly_df": pd.DataFrame(),
            "anomaly_summary": {"error": "No numeric feature columns with data available"},
        }

    # Fill NaNs with per-column median; fall back to 0 for any all-NaN column
    # (pandas 3.x + numpy 2.x: fillna(Series-with-NaN) raises 'at least one array or dtype required')
    fill_values = {
        col: (med if not pd.isna(med := feature_df[col].median()) else 0.0)
        for col in available
    }
    feature_df = feature_df.fillna(fill_values)

    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    preds = model.fit_predict(feature_df)       # -1 = anomaly, 1 = normal
    scores = model.decision_function(feature_df)  # lower = more anomalous

    # Precompute stats for IQR explainer
    feature_stats = {
        col: {"mean": feature_df[col].mean(), "std": feature_df[col].std()}
        for col in available
    }

    result_df = clean_df.copy()
    result_df["is_anomaly"] = preds == -1
    result_df["anomaly_score"] = scores
    result_df["reason"] = result_df.apply(
        lambda row: _iqr_reason(row, feature_stats) if row["is_anomaly"] else "",
        axis=1,
    )

    anomaly_count = int(result_df["is_anomaly"].sum())
    total = len(result_df)

    summary = {
        "total_rows": total,
        "anomaly_count": anomaly_count,
        "anomaly_pct": round(anomaly_count / total * 100, 2) if total else 0,
        "features_used": available,
    }

    return {"anomaly_df": result_df, "anomaly_summary": summary}
