"""CSV export helpers."""
from __future__ import annotations

import csv
import io


def csv_safe(value) -> str:
    """Neutralise spreadsheet formula injection (cells starting with = + - @)."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def rows_to_csv(rows: list) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "date", "customer", "description", "amount", "currency", "status", "demo_data"])
    for r in rows:
        w.writerow([r["id"], r["created_at"].strftime("%Y-%m-%d %H:%M"), csv_safe(r["customer_name"]), csv_safe(r.get("description", "")),
                    f"{r['amount']:.2f}", r["currency"], r["status"], "yes" if r.get("is_demo") else "no"])
    return buf.getvalue()
