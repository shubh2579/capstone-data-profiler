from fastapi import APIRouter
from agent.pipeline.clean_node import clean_node
from agent.pipeline.anomaly_node import anomaly_node
from api.utils import df_to_records

router = APIRouter()

@router.post("/anomaly")
def run_anomaly():
    clean_result = clean_node({})
    clean_df = clean_result.get("clean_df")

    if clean_df is None or clean_df.empty:
        return {"success": False, "error": "Failed to load data"}

    result = anomaly_node({"clean_df": clean_df})
    anomaly_df = result.get("anomaly_df")
    summary    = result.get("anomaly_summary", {})

    if "error" in summary:
        return {"success": False, "error": summary["error"]}

    flagged = anomaly_df[anomaly_df["IS_ANOMALY"]] if "IS_ANOMALY" in anomaly_df.columns else \
              anomaly_df[anomaly_df["is_anomaly"]]

    display_cols = ["BOOKING_ID", "DATE", "VEHICLE_TYPE", "BOOKING_VALUE",
                    "RIDE_DISTANCE", "DRIVER_RATINGS", "CUSTOMER_RATING",
                    "anomaly_score", "reason"]
    display_cols = [c for c in display_cols if c in flagged.columns]

    # Scatter data — sample 3000 for performance, drop rows missing coordinates
    scatter_cols = [c for c in ["RIDE_DISTANCE", "BOOKING_VALUE", "is_anomaly", "reason"] if c in anomaly_df.columns]
    scatter_sample = anomaly_df[scatter_cols].dropna(
        subset=[c for c in ["RIDE_DISTANCE", "BOOKING_VALUE"] if c in scatter_cols]
    ).sample(min(3000, len(anomaly_df)), random_state=42)

    return {
        "success": True,
        "summary": summary,
        "flagged_rows": df_to_records(flagged[display_cols], limit=500),
        "scatter_data": df_to_records(scatter_sample.rename(columns={"is_anomaly": "anomaly"})),
    }
