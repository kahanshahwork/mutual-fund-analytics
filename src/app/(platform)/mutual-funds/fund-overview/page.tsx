"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import {
  Search,
  Star,
  GitCompare,
  Download,
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  ChevronDown,
} from "lucide-react";
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
import type { Scheme, RiskMetrics, FundScore } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavPoint {
  date: string;
  nav: number;
  label: string;
}

interface CagrPoint {
  period: string;
  value: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_FILTERS = [
  { label: "1Y", years: 1 },
  { label: "3Y", years: 3 },
  { label: "5Y", years: 5 },
  { label: "10Y", years: 10 },
  { label: "MAX", years: 0 },
] as const;

const TABS = ["Overview", "Risk", "Drawdown"] as const;
type Tab = (typeof TABS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCAGR(
  navData: NavPoint[],
  years: number
): number | null {
  if (!navData || navData.length < 2) return null;
  const sorted = [...navData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const endNav = sorted[sorted.length - 1].nav;
  const cutoff = new Date(sorted[sorted.length - 1].date);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const startPoint = sorted.find((p) => new Date(p.date) >= cutoff);
  if (!startPoint) return null;
  const startNav = startPoint.nav;
  const actualYears =
    (new Date(sorted[sorted.length - 1].date).getTime() -
      new Date(startPoint.date).getTime()) /
    (365.25 * 24 * 3600 * 1000);
  if (actualYears < 0.5) return null;
  return (Math.pow(endNav / startNav, 1 / actualYears) - 1) * 100;
}

function filterNavByYears(navData: NavPoint[], years: number): NavPoint[] {
  if (years === 0) return navData;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return navData.filter((p) => new Date(p.date) >= cutoff);
}

function computeDrawdownSeries(navData: NavPoint[]): NavPoint[] {
  if (!navData.length) return [];
  let peak = navData[0].nav;
  return navData.map((p) => {
    if (p.nav > peak) peak = p.nav;
    const dd = peak > 0 ? ((p.nav - peak) / peak) * 100 : 0;
    return { ...p, nav: Math.min(0, dd) };
  });
}

function formatCAGR(val: number | null): string {
  if (val === null) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function formatNav(val: number): string {
  return `₹${val.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  positive,
  sub,
}: {
  label: string;
  value: string;
  positive?: boolean;
  sub?: string;
}) {
  const isNeutral = positive === undefined;
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p
        className={`text-lg font-medium ${
          isNeutral
            ? "text-foreground"
            : positive
            ? "text-green-600"
            : "text-red-600"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  prefix = "₹",
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string }>;
  label?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md shadow-md px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-medium text-foreground">
        {prefix}
        {typeof payload[0].value === "number"
          ? payload[0].value.toFixed(2)
          : payload[0].value}
        {suffix}
      </p>
    </div>
  );
}

// ─── Fund search ──────────────────────────────────────────────────────────────

function FundSearch({
  onSelect,
}: {
  onSelect: (scheme: Scheme) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Scheme[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("schemes")
        .select("*")
        .eq("is_active", true)
        .eq("option_type", "Growth")
        .eq("plan_type", "Regular")
        .ilike("scheme_name", `%${query}%`)
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative w-80">
      <Search
        size={13}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search fund name..."
        className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s);
                setQuery(s.scheme_name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors border-b border-border last:border-0"
            >
              <p className="text-foreground truncate">{s.scheme_name}</p>
              <p className="text-muted-foreground mt-0.5">
                {s.amc} · {s.category}
              </p>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg z-50 px-3 py-3 text-xs text-muted-foreground">
          No funds found
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FundOverviewPage() {
  const supabase = createClient();

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [navData, setNavData] = useState<NavPoint[]>([]);
  const [filteredNav, setFilteredNav] = useState<NavPoint[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [fundScore, setFundScore] = useState<FundScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<number>(3); // 3Y default
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [isPreferred, setIsPreferred] = useState(false);

  // Computed CAGR metrics
  const cagrPoints: CagrPoint[] = [
    { period: "1Y", value: computeCAGR(navData, 1) },
    { period: "3Y", value: computeCAGR(navData, 3) },
    { period: "5Y", value: computeCAGR(navData, 5) },
    { period: "10Y", value: computeCAGR(navData, 10) },
  ];

  const latestNav = navData[navData.length - 1] ?? null;

  // Load fund data
  const loadFundData = useCallback(
    async (s: Scheme) => {
      setLoading(true);
      setNavData([]);
      setRiskMetrics(null);
      setFundScore(null);

      // Fetch NAV history
      const { data: navRows } = await supabase
        .from("nav_history")
        .select("nav_date, nav")
        .eq("scheme_code", s.scheme_code)
        .order("nav_date", { ascending: true });

      if (navRows) {
        const pts: NavPoint[] = navRows.map((r) => ({
          date: r.nav_date,
          nav: Number(r.nav),
          label: formatDate(r.nav_date),
        }));
        setNavData(pts);
        setFilteredNav(filterNavByYears(pts, 3));
      }

      // Fetch risk metrics (3Y period)
      const { data: risk } = await supabase
        .from("risk_metrics")
        .select("*")
        .eq("scheme_code", s.scheme_code)
        .eq("period_years", 3)
        .single();
      setRiskMetrics(risk ?? null);

      // Fetch fund score
      const { data: score } = await supabase
        .from("fund_scores")
        .select("*")
        .eq("scheme_code", s.scheme_code)
        .single();
      setFundScore(score ?? null);

      setLoading(false);
    },
    [supabase]
  );

  // Update filtered nav when time filter changes
  useEffect(() => {
    if (navData.length) {
      setFilteredNav(filterNavByYears(navData, timeFilter));
    }
  }, [timeFilter, navData]);

  const handleSchemeSelect = (s: Scheme) => {
    setScheme(s);
    loadFundData(s);
  };

  // Subsample chart data for performance (max 500 points)
  const chartData = (() => {
    if (filteredNav.length <= 500) return filteredNav;
    const step = Math.ceil(filteredNav.length / 500);
    return filteredNav.filter((_, i) => i % step === 0);
  })();

  const drawdownData = (() => {
    const dd = computeDrawdownSeries(filteredNav);
    if (dd.length <= 500) return dd;
    const step = Math.ceil(dd.length / 500);
    return dd.filter((_, i) => i % step === 0);
  })();

  const maxDrawdown = riskMetrics?.max_drawdown
    ? (riskMetrics.max_drawdown * 100).toFixed(2) + "%"
    : navData.length
    ? Math.min(...drawdownData.map((d) => d.nav)).toFixed(2) + "%"
    : "—";

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Fund Overview"
        subtitle="Single-fund intelligence page"
        actions={
          scheme ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPreferred((p) => !p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md transition-colors ${
                  isPreferred
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Star
                  size={12}
                  className={isPreferred ? "fill-amber-500 text-amber-500" : ""}
                />
                {isPreferred ? "Preferred" : "Add to Preferred"}
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors">
                <GitCompare size={12} /> Compare
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors">
                <Download size={12} /> Export
              </button>
            </div>
          ) : null
        }
      />

      <div className="p-6 space-y-5 flex-1 overflow-y-auto">
        {/* Fund Selector */}
        <div className="flex items-center gap-4">
          <FundSearch onSelect={handleSchemeSelect} />
          {!scheme && (
            <p className="text-xs text-muted-foreground">
              Search and select a fund to view its analytics
            </p>
          )}
        </div>

        {/* Empty state */}
        {!scheme && (
          <div className="flex items-center justify-center h-72 border border-dashed border-border rounded-lg">
            <div className="text-center">
              <Activity
                size={32}
                className="text-muted-foreground/40 mx-auto mb-3"
              />
              <p className="text-sm text-muted-foreground">
                Select a fund to view analytics
              </p>
            </div>
          </div>
        )}

        {scheme && (
          <>
            {/* Fund Header */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-medium text-foreground leading-snug">
                    {scheme.scheme_name}
                  </h2>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {scheme.amc}
                    </span>
                    {scheme.category && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                        {scheme.category}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                      {scheme.plan_type} · {scheme.option_type}
                    </span>
                    {fundScore?.rank_in_category && (
                      <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                        Rank #{fundScore.rank_in_category} in category
                      </span>
                    )}
                  </div>
                </div>
                {latestNav && (
                  <div className="text-right flex-shrink-0 ml-6">
                    <p className="text-2xl font-medium text-foreground">
                      {formatNav(latestNav.nav)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      NAV as on {formatDate(latestNav.date)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Snapshot Metrics */}
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-muted rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {cagrPoints.map((pt) => (
                  <MetricCard
                    key={pt.period}
                    label={`${pt.period} CAGR`}
                    value={formatCAGR(pt.value)}
                    positive={
                      pt.value !== null ? pt.value >= 0 : undefined
                    }
                  />
                ))}
                <MetricCard
                  label="Sharpe Ratio (3Y)"
                  value={
                    riskMetrics?.sharpe_ratio !== null &&
                    riskMetrics?.sharpe_ratio !== undefined
                      ? riskMetrics.sharpe_ratio.toFixed(2)
                      : "—"
                  }
                  positive={
                    riskMetrics?.sharpe_ratio !== null &&
                    riskMetrics?.sharpe_ratio !== undefined
                      ? riskMetrics.sharpe_ratio > 0
                      : undefined
                  }
                  sub="Risk-adjusted return"
                />
                <MetricCard
                  label="Max Drawdown"
                  value={maxDrawdown}
                  positive={false}
                  sub="Peak-to-trough decline"
                />
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-1">
              {TIME_FILTERS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setTimeFilter(f.years)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    timeFilter === f.years
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tab: Overview — NAV Growth Chart */}
            {activeTab === "Overview" && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      NAV Growth
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {filteredNav.length > 0
                        ? `${formatDate(filteredNav[0].date)} → ${formatDate(
                            filteredNav[filteredNav.length - 1].date
                          )}`
                        : "No data"}
                    </p>
                  </div>
                  {filteredNav.length > 1 && (() => {
                    const pct = ((filteredNav[filteredNav.length - 1].nav - filteredNav[0].nav) / filteredNav[0].nav) * 100;
                    return (
                      <div className={`flex items-center gap-1 text-sm font-medium ${pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {pct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% in period
                      </div>
                    );
                  })()}
                </div>

                {loading ? (
                  <div className="h-64 bg-muted rounded-lg animate-pulse" />
                ) : chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 5, bottom: 5, left: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString("en-IN", {
                            month: "short",
                            year: "2-digit",
                          })
                        }
                        interval="preserveStartEnd"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => `₹${v.toFixed(0)}`}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                      />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="nav"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    No NAV data. Run the Python pipeline to load data.
                  </div>
                )}
              </div>
            )}

            {/* Tab: Risk */}
            {activeTab === "Risk" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <MetricCard
                    label="Volatility (3Y)"
                    value={
                      riskMetrics?.volatility !== null &&
                      riskMetrics?.volatility !== undefined
                        ? (riskMetrics.volatility * 100).toFixed(2) + "%"
                        : "—"
                    }
                    sub="Annualised std deviation"
                  />
                  <MetricCard
                    label="Sharpe Ratio (3Y)"
                    value={
                      riskMetrics?.sharpe_ratio !== null &&
                      riskMetrics?.sharpe_ratio !== undefined
                        ? riskMetrics.sharpe_ratio.toFixed(2)
                        : "—"
                    }
                    positive={
                      riskMetrics?.sharpe_ratio !== null &&
                      riskMetrics?.sharpe_ratio !== undefined
                        ? riskMetrics.sharpe_ratio > 0
                        : undefined
                    }
                    sub="Return per unit of risk"
                  />
                  <MetricCard
                    label="Sortino Ratio (3Y)"
                    value={
                      riskMetrics?.sortino_ratio !== null &&
                      riskMetrics?.sortino_ratio !== undefined
                        ? riskMetrics.sortino_ratio.toFixed(2)
                        : "—"
                    }
                    positive={
                      riskMetrics?.sortino_ratio !== null &&
                      riskMetrics?.sortino_ratio !== undefined
                        ? riskMetrics.sortino_ratio > 0
                        : undefined
                    }
                    sub="Downside-adjusted return"
                  />
                  <MetricCard
                    label="Downside Deviation (3Y)"
                    value={
                      riskMetrics?.downside_deviation !== null &&
                      riskMetrics?.downside_deviation !== undefined
                        ? (riskMetrics.downside_deviation * 100).toFixed(2) + "%"
                        : "—"
                    }
                    sub="Below-target volatility"
                  />
                  <MetricCard
                    label="Ulcer Index (3Y)"
                    value={
                      riskMetrics?.ulcer_index !== null &&
                      riskMetrics?.ulcer_index !== undefined
                        ? riskMetrics.ulcer_index.toFixed(2)
                        : "—"
                    }
                    sub="Drawdown depth & duration"
                  />
                  <MetricCard
                    label="Calmar Ratio (3Y)"
                    value={
                      riskMetrics?.calmar_ratio !== null &&
                      riskMetrics?.calmar_ratio !== undefined
                        ? riskMetrics.calmar_ratio.toFixed(2)
                        : "—"
                    }
                    positive={
                      riskMetrics?.calmar_ratio !== null &&
                      riskMetrics?.calmar_ratio !== undefined
                        ? riskMetrics.calmar_ratio > 0
                        : undefined
                    }
                    sub="Return / Max drawdown"
                  />
                </div>

                {!riskMetrics && !loading && (
                  <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground text-center">
                    Risk metrics not yet computed. Run{" "}
                    <code className="font-mono">compute_metrics.py</code> after
                    loading NAV data.
                  </div>
                )}
              </div>
            )}

            {/* Tab: Drawdown */}
            {activeTab === "Drawdown" && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="mb-5">
                  <h3 className="text-sm font-medium text-foreground">
                    Underwater Drawdown Chart
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Percentage decline from rolling peak NAV
                  </p>
                </div>

                {loading ? (
                  <div className="h-64 bg-muted rounded-lg animate-pulse" />
                ) : drawdownData.length > 1 ? (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart
                        data={drawdownData}
                        margin={{ top: 5, right: 5, bottom: 5, left: 10 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString("en-IN", {
                              month: "short",
                              year: "2-digit",
                            })
                          }
                          interval="preserveStartEnd"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) => `${v.toFixed(0)}%`}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          domain={["auto", 0]}
                        />
                        <Tooltip
                          content={<ChartTooltipContent prefix="" suffix="%" />}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--border))" />
                        <Line
                          type="monotone"
                          dataKey="nav"
                          stroke="hsl(var(--destructive))"
                          strokeWidth={1.5}
                          dot={false}
                          fill="hsl(var(--destructive) / 0.1)"
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                      <MetricCard
                        label="Max Drawdown"
                        value={
                          Math.min(...drawdownData.map((d) => d.nav)).toFixed(
                            2
                          ) + "%"
                        }
                        positive={false}
                        sub="Worst peak-to-trough"
                      />
                      <MetricCard
                        label="Current Drawdown"
                        value={
                          (drawdownData[drawdownData.length - 1]?.nav ?? 0).toFixed(2) + "%"
                        }
                        positive={
                          (drawdownData[drawdownData.length - 1]?.nav ?? 0) >= 0
                        }
                        sub="From recent peak"
                      />
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    No NAV data available.
                  </div>
                )}
              </div>
            )}

            {/* Fund Score section (if available) */}
            {fundScore && (
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Internal Fund Score
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { label: "Overall", value: fundScore.overall_score },
                    {
                      label: "Rolling Returns",
                      value: fundScore.rolling_return_score,
                    },
                    { label: "Risk", value: fundScore.risk_score },
                    {
                      label: "Consistency",
                      value: fundScore.consistency_score,
                    },
                    { label: "SIP Quality", value: fundScore.sip_score },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="bg-muted/50 rounded-lg p-3 text-center"
                    >
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {s.label}
                      </p>
                      <p className="text-xl font-medium text-foreground">
                        {s.value !== null ? s.value?.toFixed(1) : "—"}
                      </p>
                      {s.value !== null && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(100, (s.value / 100) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
