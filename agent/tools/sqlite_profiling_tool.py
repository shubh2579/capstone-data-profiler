"""Custom data profiling tool — replaces ydata-profiling (unsupported on Python 3.14+).

Generates:
  • A self-contained HTML report with per-column stats and null heatmap
  • A JSON report with all statistics
  • A summary dict that the profile page consumes directly
"""
import json
import logging
import math
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

# ── HTML template ──────────────────────────────────────────────────────────────

_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Data Profile: {title}</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; }}
  h1 {{ font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; }}
  .subtitle {{ color: #64748b; margin-bottom: 24px; }}
  .cards {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }}
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 24px; min-width: 150px; }}
  .card .value {{ font-size: 1.8rem; font-weight: 700; color: #0f172a; }}
  .card .label {{ font-size: 0.78rem; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }}
  table {{ border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px;
           overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 28px; font-size: 0.85rem; }}
  th {{ background: #f1f5f9; padding: 10px 14px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }}
  td {{ padding: 9px 14px; border-bottom: 1px solid #f1f5f9; }}
  tr:last-child td {{ border-bottom: none; }}
  .null-bar {{ background: #fee2e2; border-radius: 3px; display: inline-block; height: 10px; }}
  .null-pct {{ color: #dc2626; font-weight: 600; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }}
  .badge-num  {{ background: #dbeafe; color: #1d4ed8; }}
  .badge-cat  {{ background: #dcfce7; color: #15803d; }}
  .badge-date {{ background: #fef9c3; color: #a16207; }}
  h2 {{ font-size: 1.1rem; font-weight: 700; margin: 24px 0 10px; }}
  .footer {{ color: #94a3b8; font-size: 0.78rem; margin-top: 24px; }}
</style>
</head>
<body>
<h1>Data Profile: {title}</h1>
<div class="subtitle">Generated {timestamp} &mdash; {row_count:,} rows &times; {col_count} columns</div>

<div class="cards">
  <div class="card"><div class="value">{row_count:,}</div><div class="label">Rows</div></div>
  <div class="card"><div class="value">{col_count}</div><div class="label">Columns</div></div>
  <div class="card"><div class="value">{dup_count:,}</div><div class="label">Duplicate rows</div></div>
  <div class="card"><div class="value">{missing_pct:.1f}%</div><div class="label">Missing cells</div></div>
  <div class="card"><div class="value">{num_cols}</div><div class="label">Numeric cols</div></div>
  <div class="card"><div class="value">{cat_cols}</div><div class="label">Categorical cols</div></div>
</div>

<h2>Column Summary</h2>
<table>
<thead><tr>
  <th>#</th><th>Column</th><th>Type</th><th>Non-null</th><th>Null %</th>
  <th>Unique</th><th>Min / Top value</th><th>Max / 2nd value</th>
</tr></thead>
<tbody>
{col_rows}
</tbody>
</table>

<h2>Numeric Column Statistics</h2>
<table>
<thead><tr>
  <th>Column</th><th>Mean</th><th>Std</th><th>Min</th><th>25%</th>
  <th>Median</th><th>75%</th><th>Max</th><th>Zeros</th>
</tr></thead>
<tbody>
{num_rows}
</tbody>
</table>

<div class="footer">Capstone Project &mdash; Data Quality Engine</div>
</body>
</html>"""


def _fmt(v: Any) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "—"
    if isinstance(v, float):
        return f"{v:,.4f}" if abs(v) < 1 else f"{v:,.2f}"
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)[:40]


def _col_type_badge(dtype) -> str:
    s = str(dtype)
    if "int" in s or "float" in s:
        return '<span class="badge badge-num">numeric</span>'
    if "datetime" in s:
        return '<span class="badge badge-date">datetime</span>'
    return '<span class="badge badge-cat">text</span>'


# ── Core profiler ──────────────────────────────────────────────────────────────

class DataProfiler:
    """Compute per-column stats from a DataFrame."""

    def __init__(self, df: pd.DataFrame, title: str):
        self.df = df
        self.title = title
        self.n_rows = len(df)
        self.n_cols = len(df.columns)

    def compute(self) -> dict[str, Any]:
        df = self.df
        n = self.n_rows

        dup_count = int(df.duplicated().sum())
        total_cells = n * self.n_cols
        total_missing = int(df.isnull().sum().sum())
        p_missing = total_missing / total_cells if total_cells else 0

        columns_stats = []
        for col in df.columns:
            s = df[col]
            null_count = int(s.isnull().sum())
            non_null = n - null_count
            null_pct = null_count / n if n else 0
            unique = int(s.nunique(dropna=True))

            dtype = str(s.dtype)
            is_numeric = pd.api.types.is_numeric_dtype(s)
            top_vals = s.dropna().value_counts().head(2).to_dict()
            top_list = list(top_vals.keys())

            stat = {
                "column": col,
                "dtype": dtype,
                "non_null": non_null,
                "null_count": null_count,
                "null_pct": round(null_pct * 100, 2),
                "unique": unique,
                "top_value": str(top_list[0]) if len(top_list) > 0 else None,
                "second_value": str(top_list[1]) if len(top_list) > 1 else None,
            }

            if is_numeric:
                s_num = s.dropna()
                stat.update({
                    "mean": float(s_num.mean()) if len(s_num) else None,
                    "std": float(s_num.std()) if len(s_num) else None,
                    "min": float(s_num.min()) if len(s_num) else None,
                    "p25": float(s_num.quantile(0.25)) if len(s_num) else None,
                    "median": float(s_num.median()) if len(s_num) else None,
                    "p75": float(s_num.quantile(0.75)) if len(s_num) else None,
                    "max": float(s_num.max()) if len(s_num) else None,
                    "zeros": int((s_num == 0).sum()),
                })

            columns_stats.append(stat)

        num_numeric = sum(1 for s in columns_stats if "mean" in s)
        num_cat = self.n_cols - num_numeric

        return {
            "title": self.title,
            "row_count": n,
            "column_count": self.n_cols,
            "duplicate_rows": dup_count,
            "total_missing_cells": total_missing,
            "pct_missing_cells": round(p_missing * 100, 2),
            "numeric_columns": num_numeric,
            "categorical_columns": num_cat,
            "columns": columns_stats,
        }

    def to_html(self, stats: dict) -> str:
        col_rows_html = []
        for i, c in enumerate(stats["columns"], 1):
            bar_width = int(c["null_pct"] * 1.2)
            null_str = f'<span class="null-pct">{c["null_pct"]:.1f}%</span> <span class="null-bar" style="width:{bar_width}px"></span>'
            col_rows_html.append(
                f'<tr><td>{i}</td><td><b>{c["column"]}</b></td>'
                f'<td>{_col_type_badge(c["dtype"])}</td>'
                f'<td>{c["non_null"]:,}</td>'
                f'<td>{null_str}</td>'
                f'<td>{c["unique"]:,}</td>'
                f'<td>{_fmt(c.get("top_value"))}</td>'
                f'<td>{_fmt(c.get("second_value"))}</td></tr>'
            )

        num_rows_html = []
        for c in stats["columns"]:
            if "mean" not in c:
                continue
            num_rows_html.append(
                f'<tr><td><b>{c["column"]}</b></td>'
                f'<td>{_fmt(c.get("mean"))}</td><td>{_fmt(c.get("std"))}</td>'
                f'<td>{_fmt(c.get("min"))}</td><td>{_fmt(c.get("p25"))}</td>'
                f'<td>{_fmt(c.get("median"))}</td><td>{_fmt(c.get("p75"))}</td>'
                f'<td>{_fmt(c.get("max"))}</td><td>{_fmt(c.get("zeros"))}</td></tr>'
            )

        return _HTML_TEMPLATE.format(
            title=stats["title"],
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            row_count=stats["row_count"],
            col_count=stats["column_count"],
            dup_count=stats["duplicate_rows"],
            missing_pct=stats["pct_missing_cells"],
            num_cols=stats["numeric_columns"],
            cat_cols=stats["categorical_columns"],
            col_rows="\n".join(col_rows_html),
            num_rows="\n".join(num_rows_html) or "<tr><td colspan='9'>No numeric columns</td></tr>",
        )


# ── Tool class (same public API as old SQLiteDataProfilingTool) ────────────────

class SQLiteDataProfilingTool:
    """Profiles data from any query engine and writes HTML/JSON reports."""

    def __init__(self, db_path: str | None = None, reports_dir: str = "ge_reports"):
        self.reports_dir = Path(reports_dir)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self._db_path = db_path

    def _get_engine(self):
        from app.services.db_init import get_query_engine  # noqa: PLC0415
        return get_query_engine()

    def profile_data(
        self,
        query: str,
        table_name: str,
        goal: str = "",
        generate_html: bool = True,
        generate_json: bool = True,
        minimal_mode: bool = False,
    ) -> dict[str, Any]:
        engine = self._get_engine()
        result = engine.execute_query(query, goal, "dataframe")
        if not result["success"]:
            return {"success": False, "error": result["error"]}

        df: pd.DataFrame = result["data_frame"]
        if df.empty:
            return {"success": False, "error": "Query returned no rows"}

        logger.info("Profiling %d rows × %d columns for '%s'", len(df), len(df.columns), table_name)

        profiler = DataProfiler(df, table_name)
        stats = profiler.compute()

        report_paths: dict[str, str] = {}
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")

        if generate_html:
            html_path = self.reports_dir / f"{table_name}_profile_{ts}.html"
            html_path.write_text(profiler.to_html(stats), encoding="utf-8")
            report_paths["html"] = str(html_path)
            logger.info("HTML report saved: %s", html_path)

        if generate_json:
            json_path = self.reports_dir / f"{table_name}_profile_{ts}.json"
            json_path.write_text(json.dumps(stats, indent=2, default=str), encoding="utf-8")
            report_paths["json"] = str(json_path)
            logger.info("JSON report saved: %s", json_path)

        # Summary keys expected by the Streamlit profile page
        summary = {
            "n_variables": stats["column_count"],
            "n_observations": stats["row_count"],
            "n_missing_cells": stats["total_missing_cells"],
            "p_missing_cells": stats["pct_missing_cells"] / 100,
            "n_duplicate_rows": stats["duplicate_rows"],
        }

        return {
            "success": True,
            "query": query,
            "goal": goal,
            "table_name": table_name,
            "row_count": stats["row_count"],
            "column_count": stats["column_count"],
            "columns": stats["columns"],
            "summary": summary,
            "full_stats": stats,
            "report_paths": report_paths,
            "timestamp": datetime.now().isoformat(),
        }

    def test_connection(self) -> dict[str, Any]:
        return self._get_engine().test_connection()
