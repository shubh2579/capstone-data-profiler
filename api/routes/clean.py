from fastapi import APIRouter
from agent.pipeline.clean_node import clean_node
from api.utils import df_to_records

router = APIRouter()

@router.post("/clean")
def run_clean():
    result = clean_node({})
    clean_df = result.get("clean_df")
    raw_df   = result.get("raw_df")

    null_summary = []
    if clean_df is not None and not clean_df.empty:
        for col, count in clean_df.isnull().sum().items():
            if count > 0:
                null_summary.append({"column": col, "null_count": int(count)})

    return {
        "success": True,
        "rows_before": len(raw_df) if raw_df is not None else 0,
        "rows_after":  len(clean_df) if clean_df is not None else 0,
        "rows_removed": (len(raw_df) - len(clean_df)) if (raw_df is not None and clean_df is not None) else 0,
        "cleaning_log": result.get("cleaning_log", []),
        "null_summary": null_summary,
        "preview": df_to_records(clean_df, limit=50),
    }
