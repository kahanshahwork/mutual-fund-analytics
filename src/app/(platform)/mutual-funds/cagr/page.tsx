"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Scheme, NavHistory } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CagrRow {
  label: string;
  days: number;
  value: number | null;
}

interface GrowthPoint {
  date: string;
  value: number;
}

interface SipResult {
  finalValue: number;
  totalInvested: number;
  gain: number;
  xirr: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcCagr(navRows: NavHistory[], daysBack: number): number | null {
  if (navRows.length === 0) return null;
  const sorted = [...navRows].sort(
    (a, b) => new Date(a.nav_date).getTime() - new Date(b.nav_date).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const targetDate = new Date(latest.nav_date);
  targetDate.setDate(targetDate.getDate() - daysBack);

  // Find closest record on or before targetDate
  let best: NavHistory | null = null;
  for (const row of sorted) {
    const d = new Date(row.nav_date);
    if (d <= targetDate) best = row;
    else break;
  }
  if (!best) return null;

  const actualDays =
    (new Date(latest.nav_date).getTime() - new Date(best.nav_date).getTime()) /
    86400000;
  if (actualDays < daysBack * 0.85) return null;

  const ratio = latest.nav / best.nav;
  return (Math.pow(ratio, 365 / actualDays) - 1) * 100;
}

function buildGrowthData(navRows: NavHistory[], daysBack: number): GrowthPoint[] {
  if (navRows.length === 0) return [];
  const sorted = [...navRows].sort(
    (a, b) => new Date(a.nav_date).getTime() - new Date(b.nav_date).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const cutoff = new Date(latest.nav_date);
  cutoff.setDate(cutoff.getDate() - daysBack);

  const slice = sorted.filter((r) => new Date(r.nav_date) >= cutoff);
  if (slice.length === 0) return [];

  const base = slice[0].nav;
  // Sample ~100 points max for performance
  const step = Math.max(1, Math.floor(slice.length / 120));
  const sampled = slice.filter((_, i) => i % step === 0 || i === slice.length - 1);

  return sampled.map((r) => ({
    date: r.nav_date,
    value: parseFloat(((r.nav / base) * 10000).toFixed(2)),
  }));
}

function calcSip(navRows: NavHistory[], years: number, monthlyAmount: number): SipResult | null {
  if (navRows.length === 0) return null;
  const sorted = [...navRows].sort(
    (a, b) => new Date(a.nav_date).getTime() - new Date(b.nav_date).getTime()
  );

  // Build monthly NAV map
  const monthMap: Record<string, number> = {};
  for (const row of sorted) {
    const ym = row.nav_date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[ym]) monthMap[ym] = row.nav;
  }

  const months = Object.keys(monthMap).sort();
  if (months.length < years * 12) return null;

  const startIdx = months.length - years * 12;
  const window = months.slice(startIdx);

  let units = 0;
  let totalInvested = 0;

  for (const ym of window) {
    const nav = monthMap[ym];
    if (!nav) continue;
    units += monthlyAmount / nav;
    totalInvested += monthlyAmount;
  }

  const lastNav = monthMap[months[months.length - 1]];
  const finalValue = units * lastNav;
  const gain = finalValue - totalInvested;

  // Simple XIRR approximation
  const n = years;
  const xirr =
    totalInvested > 0
      ? (Math.pow(finalValue / (totalInvested / 2), 1 / n) - 1) * 100
      : null;

  return {
    finalValue: Math.round(finalValue),
    totalInvested: Math.round(totalInvested),
    gain: Math.round(gain),
    xirr: xirr !== null ? parseFloat(xirr.toFixed(2)) : null,
  };
}

function fmt(val: number | null, decimals = 2): string {
  if (val === null || isNaN(val)) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(decimals)}%`;
}

function fmtINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

const PERIOD_OPTIONS = [
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
  { label: "5Y", days: 1825 },
  { label: "10Y", days: 3650 },
  { label: "MAX", days: 99999 },
];

const CAGR_ROWS: CagrRow[] = [
  { label: "1 Month", days: 30, value: null },
  { label: "3 Months", days: 90, value: null },
  { label: "6 Months", days: 182, value: null },
  { label: "1 Year", days: 365, value: null },
  { label: "3 Years", days: 1095, value: null },
  { label: "5 Years", days: 1825, value: null },
  { label: "7 Years", days: 2555, value: null },
  { label: "10 Years", days: 3650, value: null },
];

// ── Custom chart tooltip ───────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          ₹{p.value?.toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

// ── Return badge ───────────────────────────────────────────────────────────────

function ReturnBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPos
          ? "text-emerald-600"
          : isNeg
          ? "text-red-500"
          : "text-muted-foreground"
      }`}
    >
      {isPos ? <TrendingUp size={11} /> : isNeg ? <TrendingDown size={11} /> : <Minus size={11} />}
      {fmt(value)}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CagrAnalyticsPage() {
  const supabase = createClient();

  // Fund search
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Scheme[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);

  // NAV data
  const [navRows, setNavRows] = useState<NavHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // Chart period
  const [activePeriod, setActivePeriod] = useState("3Y");

  // SIP simulator
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipYears, setSipYears] = useState(5);

  // ── Search debounce ────────────────────────────────────────────────────────

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
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

  // ── Load NAV history ───────────────────────────────────────────────────────

  const loadNav = useCallback(async (code: number) => {
    setLoading(true);
    const { data } = await supabase
      .from("nav_history")
      .select("id, scheme_code, nav_date, nav, created_at")
      .eq("scheme_code", code)
      .order("nav_date", { ascending: true });
    setNavRows((data as NavHistory[]) ?? []);
    setLoading(false);
  }, [supabase]);

  function selectScheme(scheme: Scheme) {
    setSelectedScheme(scheme);
    setSearch(scheme.scheme_name);
    setShowDropdown(false);
    loadNav(scheme.scheme_code);
  }

  // ── Computed values ────────────────────────────────────────────────────────

  const cagrRows = CAGR_ROWS.map((r) => ({
    ...r,
    value: calcCagr(navRows, r.days),
  }));

  const periodDays =
    PERIOD_OPTIONS.find((p) => p.label === activePeriod)?.days ?? 1095;
  const growthData = buildGrowthData(navRows, periodDays);
  const sipResult = calcSip(navRows, sipYears, sipAmount);

  const latestNav = navRows.length > 0 ? navRows[navRows.length - 1] : null;

  return (
    <div>
      <Topbar title="CAGR Analytics" subtitle="Point-to-point return analysis" />

      <div className="p-6 space-y-6">

        {/* ── Fund selector ───────────────────────────────────────────────── */}
        <div className="relative max-w-xl">
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
                <button
                  key={s.scheme_code}
                  onClick={() => selectScheme(s)}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                >
                  <p className="font-medium text-foreground leading-snug">{s.scheme_name}</p>
                  <p className="text-muted-foreground mt-0.5">{s.amc} · {s.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!selectedScheme && (
          <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg">
            <div className="text-center">
              <TrendingUp size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Search and select a fund to begin</p>
            </div>
          </div>
        )}

        {/* ── Fund header ─────────────────────────────────────────────────── */}
        {selectedScheme && (
          <>
            <div className="flex flex-wrap items-start gap-4 bg-card border border-border rounded-lg p-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground leading-snug">
                  {selectedScheme.scheme_name}
                </h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[selectedScheme.amc, selectedScheme.category, selectedScheme.plan_type].filter(Boolean).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {latestNav && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Latest NAV</p>
                  <p className="text-lg font-semibold text-foreground">₹{Number(latestNav.nav).toFixed(4)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(latestNav.nav_date).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            {loading && (
              <div className="text-xs text-muted-foreground animate-pulse">Loading NAV data…</div>
            )}

            {!loading && navRows.length > 0 && (
              <>
                {/* ── CAGR table ───────────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-semibold text-foreground">Point-to-Point Returns</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Trailing returns as of latest NAV date</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Return</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cagrRows.map((row) => (
                          <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-foreground font-medium">{row.label}</td>
                            <td className="px-4 py-2.5 text-right">
                              <ReturnBadge value={row.value} />
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                              {row.days >= 365 ? "CAGR" : "Absolute"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Growth chart ─────────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">Growth of ₹10,000</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Lumpsum investment performance</p>
                    </div>
                    <div className="flex gap-1">
                      {PERIOD_OPTIONS.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => setActivePeriod(p.label)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            activePeriod === p.label
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {growthData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={growthData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                          }}
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          width={48}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={10000} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                      Insufficient data for this period
                    </div>
                  )}
                </div>

                {/* ── SIP Simulator ────────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-4">SIP Simulator</h3>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1.5">
                        Monthly SIP Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                        <input
                          type="number"
                          value={sipAmount}
                          min={500}
                          step={500}
                          onChange={(e) => setSipAmount(Number(e.target.value))}
                          className="w-full pl-6 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1.5">
                        Duration
                      </label>
                      <select
                        value={sipYears}
                        onChange={(e) => setSipYears(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {[1, 3, 5, 7, 10].map((y) => (
                          <option key={y} value={y}>{y} {y === 1 ? "Year" : "Years"}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {sipResult ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Final Corpus", value: fmtINR(sipResult.finalValue), highlight: true },
                        { label: "Total Invested", value: fmtINR(sipResult.totalInvested), highlight: false },
                        { label: "Gain", value: fmtINR(sipResult.gain), highlight: sipResult.gain > 0 },
                        { label: "Est. XIRR", value: sipResult.xirr !== null ? `${sipResult.xirr.toFixed(1)}%` : "—", highlight: false },
                      ].map((item) => (
                        <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                          <p className="text-[11px] text-muted-foreground">{item.label}</p>
                          <p className={`text-sm font-semibold mt-1 ${item.highlight ? "text-emerald-600" : "text-foreground"}`}>
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Insufficient NAV history for this SIP duration.</p>
                  )}
                </div>
              </>
            )}

            {!loading && navRows.length === 0 && selectedScheme && (
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
