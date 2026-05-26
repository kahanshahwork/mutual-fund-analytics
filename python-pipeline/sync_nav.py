"""
sync_nav.py
-----------
Fetches full NAV history for all schemes stored in Supabase
from mfapi.in and inserts into nav_history table.

Run AFTER sync_schemes.py

First run: fetches complete history (can take 2-4 hours for all funds)
Daily run: fetches only latest NAV (fast, ~10-15 mins)

Usage:
  python sync_nav.py              # Full history for all schemes
  python sync_nav.py --today      # Only today's NAV (for daily cron)
"""

import os
import sys
import time
import datetime
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MFAPI_SCHEME_URL = "https://api.mfapi.in/mf/{scheme_code}"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TODAY_ONLY = "--today" in sys.argv


def get_all_scheme_codes() -> list[int]:
    """Fetch all active scheme codes from our DB."""
    print("📋 Loading scheme codes from Supabase...")
    result = (
        supabase.table("schemes")
        .select("scheme_code")
        .eq("is_active", True)
        .execute()
    )
    codes = [r["scheme_code"] for r in result.data]
    print(f"   Found {len(codes)} active schemes")
    return codes


def fetch_nav_for_scheme(scheme_code: int) -> list[dict]:
    """Fetch NAV history from mfapi for one scheme."""
    url = MFAPI_SCHEME_URL.format(scheme_code=scheme_code)
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            return []
        data = resp.json()
        nav_data = data.get("data", [])

        records = []
        for row in nav_data:
            try:
                nav_val = float(row["nav"])
                if nav_val <= 0:
                    continue
                # Parse date: DD-MM-YYYY → YYYY-MM-DD
                d = datetime.datetime.strptime(row["date"], "%d-%m-%Y").date()
                if TODAY_ONLY and d < datetime.date.today():
                    continue
                records.append({
                    "scheme_code": scheme_code,
                    "nav_date": str(d),
                    "nav": nav_val,
                })
            except (ValueError, KeyError):
                continue
        return records
    except Exception:
        return []


def upsert_nav_records(records: list[dict]):
    """Batch upsert NAV records in chunks of 1000."""
    if not records:
        return
    CHUNK = 1000
    for i in range(0, len(records), CHUNK):
        chunk = records[i : i + CHUNK]
        supabase.table("nav_history").upsert(
            chunk,
            on_conflict="scheme_code,nav_date"
        ).execute()


def log_sync_start() -> int:
    """Insert a sync log row and return its ID."""
    result = supabase.table("nav_sync_log").insert({
        "sync_date": str(datetime.date.today()),
        "status": "running",
    }).execute()
    return result.data[0]["id"]


def log_sync_complete(log_id: int, synced: int, failed: int, nav_added: int):
    supabase.table("nav_sync_log").update({
        "status": "completed",
        "schemes_synced": synced,
        "schemes_failed": failed,
        "nav_rows_added": nav_added,
        "completed_at": datetime.datetime.utcnow().isoformat(),
    }).eq("id", log_id).execute()


def log_sync_failed(log_id: int, error: str):
    supabase.table("nav_sync_log").update({
        "status": "failed",
        "error_details": error,
        "completed_at": datetime.datetime.utcnow().isoformat(),
    }).eq("id", log_id).execute()


def main():
    mode = "today's NAV only" if TODAY_ONLY else "full NAV history"
    print(f"\n=== MF Platform — NAV Sync ({mode}) ===\n")

    codes = get_all_scheme_codes()
    log_id = log_sync_start()

    synced = 0
    failed = 0
    total_nav_rows = 0

    print(f"\n📡 Fetching NAV data for {len(codes)} schemes...\n")

    for code in tqdm(codes, desc="Syncing NAV"):
        records = fetch_nav_for_scheme(code)
        if records:
            upsert_nav_records(records)
            synced += 1
            total_nav_rows += len(records)
        else:
            failed += 1

        # Rate limiting — be polite to mfapi
        time.sleep(0.05)

    log_sync_complete(log_id, synced, failed, total_nav_rows)

    print(f"\n✅ NAV sync complete")
    print(f"   Schemes synced: {synced}")
    print(f"   Schemes failed: {failed}")
    print(f"   NAV rows added: {total_nav_rows:,}")
    print(f"\n🎉 Database is ready. Start the Next.js app: npm run dev\n")


if __name__ == "__main__":
    main()
