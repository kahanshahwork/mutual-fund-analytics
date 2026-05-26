"""
compute_metrics.py
------------------
Computes and stores all precomputed analytics into Supabase.

Run AFTER sync_schemes.py and sync_nav.py

Computes:
  - rolling_return_metrics  (1Y, 3Y, 5Y, 7Y, 10Y)
  - risk_metrics            (1Y, 3Y, 5Y, 10Y)
  - sip_metrics             (1Y, 3Y, 5Y, 7Y, 10Y)
  - fund_scores             (composite score + category rank)

Usage:
  python compute_metrics.py              # All schemes
  python compute_metrics.py --limit 100  # First N schemes (for testing)
"""

import os
import sys
import math
import datetime
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

ROLLING_PERIODS = [1, 3, 5, 7, 10]   # years
RISK_PERIODS    = [1, 3, 5, 10]        # years
SIP_PERIODS     = [1, 3, 5, 7, 10]    # years
TRADING_DAYS    = 252
CHUNK           = 200


# ── Limit arg ──────────────────────────────────────────────────────────────────

def get_limit() -> int | None:
    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--limit" and i + 1 < len(sys.argv) - 1:
            try:
                return int(sys.argv[i + 2])
            except ValueError:
                pass
    return None


# ── Data loading ───────────────────────────────────────────────────────────────

def load_all_schemes() -> list[dict]:
    result = (
        supabase.table("schemes")
        .select("scheme_code, category")
        .eq("is_active", True)
        .execute()
    )
    return result.data


def load_nav_for_scheme(scheme_code: int) -> pd.DataFrame:
    """Returns DataFrame with nav_date (datetime) and nav (float), sorted ascending."""
    result = (
        supabase.table("nav_history")
        .select("nav_date, nav")
        .eq("scheme_code", scheme_code)
        .order("nav_date", desc=False)
        .execute()
    )
    if not result.data:
        return pd.DataFrame()
    df = pd.DataFrame(result.data)
    df["nav_date"] = pd.to_datetime(df["nav_date"])
    df["nav"] = df["nav"].astype(float)
    df = df.sort_values("nav_date").reset_index(drop=True)
    return df


# ── Rolling return helpers ─────────────────────────────────────────────────────

def compute_rolling_returns(df: pd.DataFrame, years: int) -> pd.Series:
    """
    Returns a Series of CAGR values for every rolling window of `years` years.
    Uses calendar-based lookback: for each date, find NAV approx `years*365` days ago.
    """
    days_back = years * 365
    results = []
    nav_arr = df["nav"].values
    date_arr = df["nav_date"].values  # numpy datetime64

    for i in range(len(df)):
        target_date = date_arr[i] - np.timedelta64(days_back, "D")
        # Find the closest date <= target_date
        idx = np.searchsorted(date_arr, target_date, side="right") - 1
        if idx < 0:
            continue
        start_nav = nav_arr[idx]
        end_nav = nav_arr[i]
        if start_nav <= 0 or end_nav <= 0:
            continue
        actual_days = (date_arr[i] - date_arr[idx]) / np.timedelta64(1, "D")
        if actual_days < days_back * 0.85:  # skip if not enough history
            continue
        cagr = (end_nav / start_nav) ** (365.0 / actual_days) - 1
        # Cap extreme values (data errors)
        if -0.99 < cagr < 10.0:
            results.append(cagr * 100)  # store as percentage

    return pd.Series(results)


def build_rolling_record(scheme_code: int, df: pd.DataFrame, years: int) -> dict | None:
    series = compute_rolling_returns(df, years)
    if len(series) < 10:
        return None
    positive_pct = (series > 0).sum() / len(series) * 100
    return {
        "scheme_code": scheme_code,
        "rolling_period_years": years,
        "avg_rolling_return": round(float(series.mean()), 4),
        "median_rolling_return": round(float(series.median()), 4),
        "min_rolling_return": round(float(series.min()), 4),
        "max_rolling_return": round(float(series.max()), 4),
        "positive_return_pct": round(float(positive_pct), 2),
        "benchmark_outperform_pct": None,   # requires benchmark NAV — future
        "consistency_score": round(float(positive_pct), 2),
        "data_points": int(len(series)),
        "computed_at": datetime.datetime.utcnow().isoformat(),
    }


# ── Risk metric helpers ────────────────────────────────────────────────────────

def compute_risk_metrics(df: pd.DataFrame, years: int) -> dict | None:
    """Compute risk stats for trailing `years` years."""
    cutoff = df["nav_date"].max() - pd.DateOffset(years=years)
    sub = df[df["nav_date"] >= cutoff].copy()
    if len(sub) < 30:
        return None

    sub["ret"] = sub["nav"].pct_change()
    sub = sub.dropna(subset=["ret"])
    if len(sub) < 20:
        return None

    daily_returns = sub["ret"].values
    ann_factor = TRADING_DAYS

    # Volatility (annualised std)
    volatility = float(np.std(daily_returns, ddof=1) * math.sqrt(ann_factor) * 100)

    # CAGR for Sharpe/Sortino numerator
    start_nav = sub["nav"].iloc[0]
    end_nav   = sub["nav"].iloc[-1]
    n_days    = (sub["nav_date"].iloc[-1] - sub["nav_date"].iloc[0]).days
    if n_days < 1 or start_nav <= 0:
        return None
    cagr = ((end_nav / start_nav) ** (365.0 / n_days) - 1) * 100  # %
    risk_free = 6.5  # Indian risk-free rate ~6.5%

    # Sharpe
    sharpe = (cagr - risk_free) / volatility if volatility > 0 else None

    # Sortino — downside deviation
    downside = daily_returns[daily_returns < 0]
    if len(downside) > 0:
        downside_dev = float(np.std(downside, ddof=1) * math.sqrt(ann_factor) * 100)
        sortino = (cagr - risk_free) / downside_dev if downside_dev > 0 else None
    else:
        downside_dev = 0.0
        sortino = None

    # Max drawdown
    nav_series = sub["nav"].values
    peak = np.maximum.accumulate(nav_series)
    drawdown = (nav_series - peak) / peak
    max_dd = float(drawdown.min() * 100)

    # Ulcer Index
    ulcer = float(math.sqrt(np.mean(drawdown ** 2)) * 100)

    # Calmar ratio
    calmar = (cagr / abs(max_dd)) if max_dd < 0 else None

    return {
        "volatility": round(volatility, 4),
        "sharpe_ratio": round(sharpe, 4) if sharpe is not None else None,
        "sortino_ratio": round(sortino, 4) if sortino is not None else None,
        "max_drawdown": round(max_dd, 4),
        "downside_deviation": round(downside_dev, 4),
        "ulcer_index": round(ulcer, 4),
        "calmar_ratio": round(calmar, 4) if calmar is not None else None,
    }


def build_risk_records(scheme_code: int, df: pd.DataFrame) -> list[dict]:
    records = []
    for years in RISK_PERIODS:
        metrics = compute_risk_metrics(df, years)
        if metrics is None:
            continue
        records.append({
            "scheme_code": scheme_code,
            "period_years": years,
            "computed_at": datetime.datetime.utcnow().isoformat(),
            **metrics,
        })
    return records


# ── SIP metric helpers ─────────────────────────────────────────────────────────

def xirr_approx(cashflows: list[tuple[datetime.date, float]]) -> float | None:
    """
    Approximate XIRR using Newton-Raphson.
    cashflows: list of (date, amount) — negative for investments, positive for final value.
    """
    if not cashflows:
        return None

    dates = [cf[0] for cf in cashflows]
    amounts = [cf[1] for cf in cashflows]
    t0 = dates[0]
    days = [(d - t0).days / 365.0 for d in dates]

    def npv(rate: float) -> float:
        return sum(a / (1 + rate) ** t for a, t in zip(amounts, days))

    def dnpv(rate: float) -> float:
        return sum(-t * a / (1 + rate) ** (t + 1) for a, t in zip(amounts, days))

    rate = 0.10  # initial guess
    for _ in range(100):
        f = npv(rate)
        df_ = dnpv(rate)
        if abs(df_) < 1e-12:
            break
        new_rate = rate - f / df_
        if abs(new_rate - rate) < 1e-6:
            rate = new_rate
            break
        rate = new_rate
        if rate < -0.999:
            return None

    if -0.99 < rate < 10.0:
        return rate * 100  # return as %
    return None


def compute_rolling_sip(df: pd.DataFrame, years: int, sip_amount: float = 1000.0) -> list[float]:
    """
    Simulates monthly SIP for every possible start date (rolling windows).
    Returns list of XIRRs.
    """
    if len(df) < 30:
        return []

    df = df.set_index("nav_date")
    nav_monthly = df["nav"].resample("MS").first().dropna()

    if len(nav_monthly) < years * 12 + 1:
        return []

    xirrs = []
    window = years * 12

    for start_i in range(len(nav_monthly) - window):
        window_nav = nav_monthly.iloc[start_i: start_i + window + 1]
        dates = window_nav.index.to_pydatetime()
        navs = window_nav.values

        cashflows = []
        units = 0.0
        for i in range(window):
            units += sip_amount / navs[i]
            cashflows.append((dates[i].date(), -sip_amount))

        final_value = units * navs[-1]
        cashflows.append((dates[-1].date(), final_value))

        xirr = xirr_approx(cashflows)
        if xirr is not None:
            xirrs.append(xirr)

    return xirrs


def build_sip_records(scheme_code: int, df: pd.DataFrame) -> list[dict]:
    records = []
    for years in SIP_PERIODS:
        xirrs = compute_rolling_sip(df, years)
        if len(xirrs) < 5:
            continue
        series = pd.Series(xirrs)
        records.append({
            "scheme_code": scheme_code,
            "sip_period_years": years,
            "avg_sip_xirr": round(float(series.mean()), 4),
            "median_sip_xirr": round(float(series.median()), 4),
            "best_sip_xirr": round(float(series.max()), 4),
            "worst_sip_xirr": round(float(series.min()), 4),
            "positive_sip_pct": round(float((series > 0).sum() / len(series) * 100), 2),
            "rolling_sip_consistency": round(float((series > 8).sum() / len(series) * 100), 2),
            "computed_at": datetime.datetime.utcnow().isoformat(),
        })
    return records


# ── Scoring ────────────────────────────────────────────────────────────────────

def normalise(value: float | None, low: float, high: float) -> float:
    """Normalise value to 0–100 range."""
    if value is None:
        return 50.0
    if high == low:
        return 50.0
    return max(0.0, min(100.0, (value - low) / (high - low) * 100))


def compute_fund_score(
    scheme_code: int,
    rolling_records: list[dict],
    risk_records: list[dict],
    sip_records: list[dict],
) -> dict | None:
    """Compute a composite score 0–100."""

    # Rolling return score — use 3Y avg rolling (most informative)
    r3y = next((r for r in rolling_records if r["rolling_period_years"] == 3), None)
    r5y = next((r for r in rolling_records if r["rolling_period_years"] == 5), None)
    rolling_score = None
    if r3y and r5y:
        avg_rolling = (r3y["avg_rolling_return"] + r5y["avg_rolling_return"]) / 2
        rolling_score = normalise(avg_rolling, -5, 25)

    # Risk score — based on Sharpe (3Y)
    risk3y = next((r for r in risk_records if r["period_years"] == 3), None)
    risk_score = None
    if risk3y and risk3y.get("sharpe_ratio") is not None:
        risk_score = normalise(risk3y["sharpe_ratio"], -1, 3)

    # Consistency score — positive rolling return %
    consistency_score = None
    if r3y and r3y["positive_return_pct"] is not None:
        consistency_score = normalise(r3y["positive_return_pct"], 30, 100)

    # SIP score — 3Y avg SIP XIRR
    sip3y = next((s for s in sip_records if s["sip_period_years"] == 3), None)
    sip_score = None
    if sip3y and sip3y["avg_sip_xirr"] is not None:
        sip_score = normalise(sip3y["avg_sip_xirr"], -5, 25)

    # Drawdown score — penalise high max_drawdown
    drawdown_score = None
    if risk3y and risk3y.get("max_drawdown") is not None:
        # max_drawdown is negative (e.g. -30 means 30% drawdown)
        dd = risk3y["max_drawdown"]  # already in %
        drawdown_score = normalise(-dd, 0, 60)  # 0% drawdown = 100, 60% = 0

    # Weights
    weights = {
        "rolling": 0.30,
        "risk": 0.20,
        "consistency": 0.20,
        "sip": 0.15,
        "drawdown": 0.15,
    }
    scores = {
        "rolling": rolling_score,
        "risk": risk_score,
        "consistency": consistency_score,
        "sip": sip_score,
        "drawdown": drawdown_score,
    }

    total_weight = sum(w for k, w in weights.items() if scores[k] is not None)
    if total_weight == 0:
        return None

    overall = sum(
        scores[k] * weights[k] for k in weights if scores[k] is not None
    ) / total_weight

    return {
        "scheme_code": scheme_code,
        "overall_score": round(overall, 2),
        "rolling_return_score": round(rolling_score, 2) if rolling_score is not None else None,
        "risk_score": round(risk_score, 2) if risk_score is not None else None,
        "consistency_score": round(consistency_score, 2) if consistency_score is not None else None,
        "sip_score": round(sip_score, 2) if sip_score is not None else None,
        "drawdown_score": round(drawdown_score, 2) if drawdown_score is not None else None,
        "advisor_preference_boost": 0,
        "rank_in_category": None,  # filled in category ranking pass
        "computed_at": datetime.datetime.utcnow().isoformat(),
    }


# ── Category ranking pass ──────────────────────────────────────────────────────

def assign_category_ranks(scores_by_scheme: dict[int, dict], schemes: list[dict]):
    """Sort schemes within each category and assign rank_in_category."""
    category_map: dict[str, list[int]] = {}
    for s in schemes:
        cat = s.get("category") or "Other"
        category_map.setdefault(cat, []).append(s["scheme_code"])

    for cat, codes in category_map.items():
        cat_scores = [
            (code, scores_by_scheme[code]["overall_score"])
            for code in codes
            if code in scores_by_scheme and scores_by_scheme[code]["overall_score"] is not None
        ]
        cat_scores.sort(key=lambda x: x[1], reverse=True)
        for rank, (code, _) in enumerate(cat_scores, start=1):
            scores_by_scheme[code]["rank_in_category"] = rank


# ── Upsert helpers ─────────────────────────────────────────────────────────────

def upsert_in_chunks(table: str, records: list[dict], on_conflict: str):
    for i in range(0, len(records), CHUNK):
        chunk = records[i: i + CHUNK]
        supabase.table(table).upsert(chunk, on_conflict=on_conflict).execute()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    limit = get_limit()
    print(f"\n=== MF Platform — Compute Metrics ===\n")
    if limit:
        print(f"⚠️  Running in test mode: first {limit} schemes only\n")

    schemes = load_all_schemes()
    if limit:
        schemes = schemes[:limit]

    print(f"📋 Processing {len(schemes)} schemes...\n")

    all_rolling: list[dict] = []
    all_risk:    list[dict] = []
    all_sip:     list[dict] = []
    all_scores:  dict[int, dict] = {}

    failed = 0

    for scheme in tqdm(schemes, desc="Computing"):
        code = scheme["scheme_code"]
        try:
            df = load_nav_for_scheme(code)
            if df.empty or len(df) < 30:
                failed += 1
                continue

            # Rolling returns
            rolling_records = []
            for years in ROLLING_PERIODS:
                rec = build_rolling_record(code, df, years)
                if rec:
                    rolling_records.append(rec)
            all_rolling.extend(rolling_records)

            # Risk metrics
            risk_records = build_risk_records(code, df)
            all_risk.extend(risk_records)

            # SIP metrics
            sip_records = build_sip_records(code, df)
            all_sip.extend(sip_records)

            # Fund score
            score = compute_fund_score(code, rolling_records, risk_records, sip_records)
            if score:
                all_scores[code] = score

        except Exception as e:
            failed += 1
            # continue silently — don't abort the whole run for one bad scheme

    # Assign category ranks before upserting scores
    print("\n📊 Assigning category ranks...")
    assign_category_ranks(all_scores, schemes)

    # Upsert everything
    print("📥 Upserting rolling return metrics...")
    upsert_in_chunks("rolling_return_metrics", all_rolling, "scheme_code,rolling_period_years")

    print("📥 Upserting risk metrics...")
    upsert_in_chunks("risk_metrics", all_risk, "scheme_code,period_years")

    print("📥 Upserting SIP metrics...")
    upsert_in_chunks("sip_metrics", all_sip, "scheme_code,sip_period_years")

    print("📥 Upserting fund scores...")
    upsert_in_chunks("fund_scores", list(all_scores.values()), "scheme_code")

    print(f"\n✅ Compute complete")
    print(f"   Rolling records : {len(all_rolling)}")
    print(f"   Risk records    : {len(all_risk)}")
    print(f"   SIP records     : {len(all_sip)}")
    print(f"   Funds scored    : {len(all_scores)}")
    print(f"   Schemes failed  : {failed}")
    print(f"\n🎉 All analytics are ready. Start the Next.js app: npm run dev\n")


if __name__ == "__main__":
    main()
