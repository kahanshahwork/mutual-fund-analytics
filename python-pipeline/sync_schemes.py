"""
sync_schemes.py
---------------
Fetches all mutual fund schemes from mfapi.in
Filters: removes IDCW/Dividend and Direct schemes
Inserts/updates into Supabase schemes table

Run: python sync_schemes.py
"""

import os
import re
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MFAPI_ALL_URL = "https://api.mfapi.in/mf"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Filter helpers ──────────────────────────────────────────────────────────

IDCW_PATTERNS = re.compile(
    r'\b(idcw|dividend|div|income distribution|income dist\.?)\b',
    re.IGNORECASE
)
DIRECT_PATTERNS = re.compile(r'\b(direct)\b', re.IGNORECASE)

AMC_KEYWORDS = [
    "Mutual Fund", "MF", "Asset Management", "AMC",
    "Trustee", "Fund", "Schemes", "Management"
]


def is_idcw(name: str) -> bool:
    return bool(IDCW_PATTERNS.search(name))


def is_direct(name: str) -> bool:
    return bool(DIRECT_PATTERNS.search(name))


def detect_plan_type(name: str) -> str:
    if DIRECT_PATTERNS.search(name):
        return "Direct"
    return "Regular"


def detect_option_type(name: str) -> str:
    if IDCW_PATTERNS.search(name):
        return "IDCW"
    return "Growth"


def extract_amc(scheme_name: str) -> str:
    """Extract AMC name from scheme name (first 2-3 words before fund-type words)."""
    words = scheme_name.split()
    amc_words = []
    for word in words:
        if any(kw.lower() in word.lower() for kw in AMC_KEYWORDS):
            amc_words.append(word)
            break
        amc_words.append(word)
        if len(amc_words) >= 3:
            break
    return " ".join(amc_words).strip()


def extract_category(scheme_name: str) -> str:
    """
    Basic category extraction from scheme name.
    This will be improved once we fetch detailed scheme info.
    """
    name_upper = scheme_name.upper()

    if "LIQUID" in name_upper:
        return "Liquid"
    elif "OVERNIGHT" in name_upper:
        return "Overnight"
    elif "ULTRA SHORT" in name_upper:
        return "Ultra Short Duration"
    elif "LOW DURATION" in name_upper:
        return "Low Duration"
    elif "SHORT DURATION" in name_upper or "SHORT TERM" in name_upper:
        return "Short Duration"
    elif "MEDIUM DURATION" in name_upper:
        return "Medium Duration"
    elif "LONG DURATION" in name_upper:
        return "Long Duration"
    elif "GILT" in name_upper:
        return "Gilt"
    elif "CREDIT RISK" in name_upper:
        return "Credit Risk"
    elif "CORPORATE BOND" in name_upper:
        return "Corporate Bond"
    elif "BANKING AND PSU" in name_upper or "BANKING & PSU" in name_upper:
        return "Banking and PSU"
    elif "DYNAMIC BOND" in name_upper:
        return "Dynamic Bond"
    elif "FLOATER" in name_upper:
        return "Floater"
    elif "MONEY MARKET" in name_upper:
        return "Money Market"
    elif "ARBITRAGE" in name_upper:
        return "Arbitrage"
    elif "EQUITY SAVINGS" in name_upper:
        return "Equity Savings"
    elif "BALANCED ADVANTAGE" in name_upper or "DYNAMIC ASSET" in name_upper:
        return "Balanced Advantage"
    elif "AGGRESSIVE HYBRID" in name_upper:
        return "Aggressive Hybrid"
    elif "CONSERVATIVE HYBRID" in name_upper:
        return "Conservative Hybrid"
    elif "MULTI ASSET" in name_upper:
        return "Multi Asset Allocation"
    elif "HYBRID" in name_upper:
        return "Hybrid"
    elif "ELSS" in name_upper or "TAX SAVER" in name_upper or "TAX SAVING" in name_upper:
        return "ELSS"
    elif "INDEX" in name_upper or "NIFTY" in name_upper or "SENSEX" in name_upper or "BSE" in name_upper:
        return "Index Fund"
    elif "ETF" in name_upper:
        return "ETF"
    elif "FUND OF FUND" in name_upper or "FOF" in name_upper:
        return "Fund of Funds"
    elif "INTERNATIONAL" in name_upper or "GLOBAL" in name_upper or "OVERSEAS" in name_upper:
        return "International"
    elif "GOLD" in name_upper:
        return "Gold"
    elif "SMALL CAP" in name_upper:
        return "Small Cap"
    elif "MID CAP" in name_upper or "MIDCAP" in name_upper:
        return "Mid Cap"
    elif "LARGE CAP" in name_upper or "LARGECAP" in name_upper:
        return "Large Cap"
    elif "LARGE & MID" in name_upper or "LARGE AND MID" in name_upper:
        return "Large & Mid Cap"
    elif "MULTI CAP" in name_upper or "MULTICAP" in name_upper:
        return "Multi Cap"
    elif "FLEXI CAP" in name_upper or "FLEXICAP" in name_upper or "FLEXI-CAP" in name_upper:
        return "Flexi Cap"
    elif "FOCUSED" in name_upper:
        return "Focused"
    elif "VALUE" in name_upper or "CONTRA" in name_upper:
        return "Value/Contra"
    elif "THEMATIC" in name_upper or "THEME" in name_upper:
        return "Thematic"
    elif "SECTORAL" in name_upper or "SECTOR" in name_upper:
        return "Sectoral"
    elif "DIVIDEND YIELD" in name_upper:
        return "Dividend Yield"
    else:
        return "Other"


# ── Main sync ───────────────────────────────────────────────────────────────

def fetch_all_schemes():
    print("📡 Fetching all schemes from mfapi.in...")
    resp = requests.get(MFAPI_ALL_URL, timeout=30)
    resp.raise_for_status()
    all_schemes = resp.json()
    print(f"   Total schemes from API: {len(all_schemes)}")
    return all_schemes


def filter_schemes(all_schemes: list) -> list:
    kept = []
    removed_idcw = 0
    removed_direct = 0

    for s in all_schemes:
        name = s.get("schemeName", "")
        if is_idcw(name):
            removed_idcw += 1
            continue
        if is_direct(name):
            removed_direct += 1
            continue
        kept.append(s)

    print(f"   Removed IDCW/Dividend: {removed_idcw}")
    print(f"   Removed Direct: {removed_direct}")
    print(f"   ✅ Keeping: {len(kept)} schemes")
    return kept


def build_records(schemes: list) -> list:
    records = []
    for s in schemes:
        name = s.get("schemeName", "")
        records.append({
            "scheme_code": int(s["schemeCode"]),
            "scheme_name": name,
            "amc": extract_amc(name),
            "category": extract_category(name),
            "plan_type": detect_plan_type(name),
            "option_type": detect_option_type(name),
            "is_active": True,
        })
    return records


def upsert_schemes(records: list):
    """Batch upsert into Supabase in chunks of 500."""
    CHUNK = 500
    total = len(records)
    print(f"\n📥 Upserting {total} schemes into Supabase...")

    for i in tqdm(range(0, total, CHUNK), desc="Upserting"):
        chunk = records[i : i + CHUNK]
        supabase.table("schemes").upsert(
            chunk,
            on_conflict="scheme_code"
        ).execute()

    print(f"✅ Done. {total} schemes upserted.")


def main():
    print("\n=== MF Platform — Scheme Sync ===\n")
    all_schemes = fetch_all_schemes()
    filtered = filter_schemes(all_schemes)
    records = build_records(filtered)
    upsert_schemes(records)
    print("\n🎉 Scheme sync complete. Run sync_nav.py next.\n")


if __name__ == "__main__":
    main()
