"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import { Search, RotateCcw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { Scheme, NavHistory, RollingReturnMetrics } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RollingPoint {
  date: string;
  value: number;
}

interface HistogramBucket {
  range: string;
  count: number;
  isPositive: boolean;
}

// ── Rolling CAGR computation ───────────────────────────────────────────────────

function computeRollingReturns(navRows: NavHistory[], years: number): RollingPoint[] {
  if (navRows.length === 0) return [];

  const sorted = [...navRows].sort(
    (a, b) => new Date(a.nav_date).getTime() - new Date(b.nav_date).getTime()
  );

  const daysBack = years * 365;
  const dateArr = sorted.map((r) => new Date(r.nav_date).getTime());
  const navArr = sorted.map((r) => Number(r.nav));

  const results: RollingPoint[] = [];
  // Sample every ~7 days for performance
  const step = Math.max(1, Math.floor(sorted.length / 300));

  for (let i = 0; i < sorted.length; i += step) {
    const endTime = dateArr[i];
    const targetTime = endTime - daysBack * 86400000;

    // Binary search for start index
    let lo = 0, hi = i - 1, bestIdx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (dateArr[mid] <= targetTime) { bestIdx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (bestIdx < 0) continue;

    const actualDays = (endTime - dateArr[bestIdx]) / 86400000;
    if (actualDays < daysBack * 0.85) continue;

    const ratio = navArr[i] / navArr[bestIdx];
    const cagr = (Math.pow(ratio, 365 / actualDays) - 1) * 100;
    if (cagr > -99 && cagr < 1000) {
      results.push({ date: sorted[i].nav_date, value: parseFloat(cagr.toFixed(2)) });
    }
  }
  return results;
}

function buildHistogram(points: RollingPoint[]): HistogramBucket[] {
  if (points.length === 0) return [];
  const values = points.map((p) => p.value);
  const min = Math.floor(Math.min(...values) / 5) * 5;
  const max = Math.ceil(Math.max(...values) / 5) * 5;
  const buckets: HistogramBucket[] = [];
  for (let lo = min; lo < max; lo += 5) {
    const count = values.filter((v) => v >= lo && v < lo + 5).length;
    buckets.push({ range: `${lo}–${lo + 5}`, count, isPositive: lo >= 0 });
  }
  return buckets;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function RollingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">
        {new Date(label).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </p>
      <p className={`font-semibold ${val >= 0 ? "text-emerald-600" : "text-red-500"}`}>
        {val > 0 ? "+" : ""}{val?.toFixed(2)}% CAGR
      </p>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RollingReturnsPage() {
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Scheme[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);

  const [navRows, setNavRows] = useState<NavHistory[]>([]);
  const [precomputed, setPrecomputed] = useState<RollingReturnMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingPeriod, setRollingPeriod] = useState(3);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("schemes")
        .select("id, scheme_code, scheme_name, amc, category, plan_type, option_type, is_active, launch_date, created_at, updated_at")
        .eq("is_active", true)
        .ilike("scheme_name", `%${search}%`)
        .order("scheme_name")
        .limit(12);
      setSearchResults(data ?? []);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (code: number) => {
    setLoading(true);
    const [navResult, metricsResult] = await Promise.all([
      supabase.from("nav_history").select("id, scheme_code, nav_date, nav, created_at").eq("scheme_code", code).order("nav_date", { ascending: true }),
      supabase.from("rolling_return_metrics").select("*").eq("scheme_code", code),
    ]);
    setNavRows((navResult.data as NavHistory[]) ?? []);
    setPrecomputed((metricsResult.data as RollingReturnMetrics[]) ?? []);
    setLoading(false);
  }, [supabase]);

  function selectScheme(s: Scheme) {
    setSelectedScheme(s);
    setSearch(s.scheme_name);
    setShowDropdown(false);
    loadData(s.scheme_code);
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const rollingPoints = computeRollingReturns(navRows, rollingPeriod);
  const histogram = buildHistogram(rollingPoints);

  const precomp = precomputed.find((r) => r.rolling_period_years === rollingPeriod);

  // fallback stats from live data if precomputed not available
  const values = rollingPoints.map((p) => p.value);
  const statAvg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const statMin = values.length ? Math.min(...values) : null;
  const statMax = values.length ? Math.max(...values) : null;
  const statPos = values.length ? (values.filter((v) => v > 0).length / values.length) * 100 : null;
  const statMedian = values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;

  const avg = precomp?.avg_rolling_return ?? statAvg;
  const median = precomp?.median_rolling_return ?? statMedian;
  const min = precomp?.min_rolling_return ?? statMin;
  const max = precomp?.max_rolling_return ?? statMax;
  const posPct = precomp?.positive_return_pct ?? statPos;

  function fmtR(v: number | null) {
    if (v === null) return "—";
    return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
  }

  return (
    <div>
      <Topbar title="Rolling Returns" subtitle="Consistency of returns across time windows" />
      <div className="p-6 space-y-6">

        {/* ── Fund selector ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="relative flex-1 min-w-64 max-w-xl">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search fund name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {searchResults.map((s) => (
                  <button key={s.scheme_code} onClick={() => selectScheme(s)}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent transition-colors border-b border-border/50 last:border-0">
                    <p className="font-medium text-foreground">{s.scheme_name}</p>
                    <p className="text-muted-foreground mt-0.5">{s.amc} · {s.category}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rolling period selector */}
          <div className="flex gap-1">
            {[1, 3, 5, 7, 10].map((y) => (
              <button key={y} onClick={() => setRollingPeriod(y)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  rollingPeriod === y
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}>
                {y}Y
              </button>
            ))}
          </div>
        </div>

        {!selectedScheme && (
          <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg">
            <div className="text-center">
              <RotateCcw size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Search and select a fund to begin</p>
            </div>
          </div>
        )}

        {selectedScheme && loading && (
          <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
        )}

        {selectedScheme && !loading && (
          <>
            {/* ── Stats bar ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Average" value={fmtR(avg)} sub={`${rollingPeriod}Y rolling`} />
              <StatCard label="Median" value={fmtR(median)} />
              <StatCard label="Best Window" value={fmtR(max)} />
              <StatCard label="Worst Window" value={fmtR(min)} />
              <StatCard
                label="Positive Periods"
                value={posPct !== null ? `${posPct.toFixed(1)}%` : "—"}
                sub={`of ${values.length} windows`}
              />
            </div>

            {/* ── Rolling return chart ───────────────────────────────────── */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-foreground">
                  {rollingPeriod}-Year Rolling CAGR
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Each point = CAGR of the {rollingPeriod}Y window ending on that date
                </p>
              </div>
              {rollingPoints.length > 1 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={rollingPoints} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={42}
                    />
                    <Tooltip content={<RollingTooltip />} />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="4 4" />
                    <ReferenceLine y={12} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" label={{ value: "12%", position: "right", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  Insufficient NAV history for {rollingPeriod}Y rolling windows
                </div>
              )}
            </div>

            {/* ── Return distribution histogram ──────────────────────────── */}
            {histogram.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-foreground">Return Distribution</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Frequency of {rollingPeriod}Y rolling CAGR outcomes (5% buckets)
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={histogram} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      formatter={(v: any) => [`${v} periods`, "Count"]}
                      contentStyle={{ fontSize: 11, backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {histogram.map((entry, i) => (
                        <Cell key={i} fill={entry.isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/80 inline-block" />Positive returns</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-destructive/80 inline-block" />Negative returns</span>
                </div>
              </div>
            )}

            {navRows.length === 0 && (
              <div className="flex items-center justify-center h-40 border border-dashed border-border rounded-lg">
                <p className="text-xs text-muted-foreground">No NAV data found. Run the data pipeline first.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
