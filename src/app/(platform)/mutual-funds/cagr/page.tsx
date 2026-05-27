"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import { Search, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Scheme } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NavRow { date: string; nav: number }
interface GrowthPoint { date: string; value: number }

// ── mfapi fetch ────────────────────────────────────────────────────────────────

async function fetchNavFromApi(schemeCode: number): Promise<NavRow[]> {
  const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`)
  if (!res.ok) throw new Error("mfapi fetch failed")
  const json = await res.json()
  if (json.status !== "SUCCESS" || !json.data?.length) return []
  return json.data
    .map((r: any) => ({
      date: (() => { const [d,m,y] = r.date.split("-"); return `${y}-${m}-${d}` })(),
      nav:  parseFloat(r.nav),
    }))
    .filter((r: NavRow) => r.nav > 0)
    .sort((a: NavRow, b: NavRow) => a.date.localeCompare(b.date))
}

// ── Math helpers ───────────────────────────────────────────────────────────────

function calcCagr(navRows: NavRow[], daysBack: number): number | null {
  if (!navRows.length) return null
  const latest = navRows[navRows.length - 1]
  const targetDate = new Date(latest.date)
  targetDate.setDate(targetDate.getDate() - daysBack)
  let best: NavRow | null = null
  for (const r of navRows) {
    if (new Date(r.date) <= targetDate) best = r
    else break
  }
  if (!best) return null
  const actualDays = (new Date(latest.date).getTime() - new Date(best.date).getTime()) / 86400000
  if (actualDays < daysBack * 0.85) return null
  return (Math.pow(latest.nav / best.nav, 365 / actualDays) - 1) * 100
}

function buildGrowthData(navRows: NavRow[], daysBack: number): GrowthPoint[] {
  if (!navRows.length) return []
  const latest  = navRows[navRows.length - 1]
  const cutoff  = new Date(latest.date)
  cutoff.setDate(cutoff.getDate() - daysBack)
  const slice   = daysBack >= 99000 ? navRows : navRows.filter(r => new Date(r.date) >= cutoff)
  if (!slice.length) return []
  const base    = slice[0].nav
  const step    = Math.max(1, Math.floor(slice.length / 120))
  return slice
    .filter((_, i) => i % step === 0 || i === slice.length - 1)
    .map(r => ({ date: r.date, value: parseFloat(((r.nav / base) * 10000).toFixed(2)) }))
}

function calcSip(navRows: NavRow[], years: number, amount: number) {
  if (!navRows.length) return null
  const monthMap: Record<string, number> = {}
  for (const r of navRows) {
    const ym = r.date.slice(0, 7)
    if (!monthMap[ym]) monthMap[ym] = r.nav
  }
  const months = Object.keys(monthMap).sort()
  if (months.length < years * 12) return null
  const window = months.slice(months.length - years * 12)
  let units = 0, invested = 0
  for (const ym of window) {
    const nav = monthMap[ym]
    if (!nav) continue
    units += amount / nav; invested += amount
  }
  const lastNav    = monthMap[months[months.length - 1]]
  const finalValue = units * lastNav
  const gain       = finalValue - invested
  const xirr       = invested > 0 ? (Math.pow(finalValue / (invested / 2), 1 / years) - 1) * 100 : null
  return { finalValue: Math.round(finalValue), invested: Math.round(invested), gain: Math.round(gain), xirr: xirr ? parseFloat(xirr.toFixed(2)) : null }
}

function fmt(v: number | null) {
  if (v === null || isNaN(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`
}
function fmtINR(v: number) {
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)}Cr`
  if (v >= 100000)   return `₹${(v/100000).toFixed(2)}L`
  return `₹${v.toLocaleString("en-IN")}`
}

const CAGR_ROWS = [
  { label: "1 Month",   days: 30   },
  { label: "3 Months",  days: 90   },
  { label: "6 Months",  days: 182  },
  { label: "1 Year",    days: 365  },
  { label: "3 Years",   days: 1095 },
  { label: "5 Years",   days: 1825 },
  { label: "7 Years",   days: 2555 },
  { label: "10 Years",  days: 3650 },
]

const PERIODS = [
  { label: "1Y",  days: 365   },
  { label: "3Y",  days: 1095  },
  { label: "5Y",  days: 1825  },
  { label: "10Y", days: 3650  },
  { label: "MAX", days: 99999 },
]

function ReturnBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${value > 0 ? "text-emerald-600" : value < 0 ? "text-red-500" : "text-muted-foreground"}`}>
      {value > 0 ? <TrendingUp size={11}/> : value < 0 ? <TrendingDown size={11}/> : <Minus size={11}/>}
      {fmt(value)}
    </span>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-medium" style={{ color: payload[0].color }}>₹{payload[0].value?.toLocaleString("en-IN")}</p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CagrAnalyticsPage() {
  const supabase = createClient()
  const [search, setSearch]           = useState("")
  const [results, setResults]         = useState<Scheme[]>([])
  const [showDrop, setShowDrop]       = useState(false)
  const [selected, setSelected]       = useState<Scheme | null>(null)
  const [navRows, setNavRows]         = useState<NavRow[]>([])
  const [loading, setLoading]         = useState(false)
  const [period, setPeriod]           = useState("3Y")
  const [sipAmount, setSipAmount]     = useState(10000)
  const [sipYears, setSipYears]       = useState(5)

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); setShowDrop(false); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("schemes").select("*").eq("is_active", true).ilike("scheme_name", `%${search}%`).order("scheme_name").limit(12)
      setResults(data ?? []); setShowDrop(true)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadNav = useCallback(async (code: number) => {
    setLoading(true); setNavRows([])
    try {
      const rows = await fetchNavFromApi(code)
      setNavRows(rows)
    } catch { setNavRows([]) }
    setLoading(false)
  }, [])

  function selectScheme(s: Scheme) {
    setSelected(s); setSearch(s.scheme_name); setShowDrop(false); loadNav(s.scheme_code)
  }

  const cagrRows   = CAGR_ROWS.map(r => ({ ...r, value: calcCagr(navRows, r.days) }))
  const periodDays = PERIODS.find(p => p.label === period)?.days ?? 1095
  const growthData = buildGrowthData(navRows, periodDays)
  const sipResult  = calcSip(navRows, sipYears, sipAmount)
  const latestNav  = navRows.length ? navRows[navRows.length - 1] : null

  return (
    <div>
      <Topbar title="CAGR Analytics" subtitle="Point-to-point return analysis" />
      <div className="p-6 space-y-6">

        {/* Search */}
        <div className="relative max-w-xl">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input type="text" placeholder="Search fund name…" value={search}
              onChange={e => setSearch(e.target.value)} onFocus={() => results.length > 0 && setShowDrop(true)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"/>
          </div>
          {showDrop && results.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {results.map(s => (
                <button key={s.scheme_code} onClick={() => selectScheme(s)}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent transition-colors border-b border-border/50 last:border-0">
                  <p className="font-medium text-foreground">{s.scheme_name}</p>
                  <p className="text-muted-foreground mt-0.5">{s.amc} · {s.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected && (
          <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg">
            <div className="text-center">
              <TrendingUp size={32} className="mx-auto text-muted-foreground/30 mb-3"/>
              <p className="text-sm text-muted-foreground">Search and select a fund to begin</p>
            </div>
          </div>
        )}

        {selected && (
          <>
            {/* Fund header */}
            <div className="flex flex-wrap items-start gap-4 bg-card border border-border rounded-lg p-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{selected.scheme_name}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[selected.amc, selected.category, selected.plan_type].filter(Boolean).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
              {latestNav && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Latest NAV</p>
                  <p className="text-lg font-semibold text-foreground">₹{Number(latestNav.nav).toFixed(4)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(latestNav.date).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</p>
                </div>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin"/> Fetching NAV history from mfapi.in…
              </div>
            )}

            {!loading && navRows.length > 0 && (
              <>
                {/* CAGR table */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-semibold text-foreground">Point-to-Point Returns</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Trailing returns as of latest NAV</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Return</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cagrRows.map(row => (
                        <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-foreground font-medium">{row.label}</td>
                          <td className="px-4 py-2.5 text-right"><ReturnBadge value={row.value}/></td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{row.days >= 365 ? "CAGR" : "Absolute"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Growth chart */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">Growth of ₹10,000</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Lumpsum investment performance</p>
                    </div>
                    <div className="flex gap-1">
                      {PERIODS.map(p => (
                        <button key={p.label} onClick={() => setPeriod(p.label)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${period === p.label ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {growthData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={growthData} margin={{ top:4, right:8, bottom:4, left:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                        <XAxis dataKey="date" tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false}
                          tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { month:"short", year:"2-digit" })} interval="preserveStartEnd"/>
                        <YAxis tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                          tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={48}/>
                        <Tooltip content={<ChartTooltip/>}/>
                        <ReferenceLine y={10000} stroke="hsl(var(--border))" strokeDasharray="4 4"/>
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} activeDot={{ r:3 }}/>
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">Insufficient data for this period</div>
                  )}
                </div>

                {/* SIP Simulator */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-4">SIP Simulator</h3>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1.5">Monthly Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                        <input type="number" value={sipAmount} min={500} step={500}
                          onChange={e => setSipAmount(Number(e.target.value))}
                          className="w-full pl-6 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"/>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1.5">Duration</label>
                      <select value={sipYears} onChange={e => setSipYears(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring">
                        {[1,3,5,7,10].map(y => <option key={y} value={y}>{y} {y===1?"Year":"Years"}</option>)}
                      </select>
                    </div>
                  </div>
                  {sipResult ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label:"Final Corpus",  value:fmtINR(sipResult.finalValue), hi:true  },
                        { label:"Total Invested", value:fmtINR(sipResult.invested),  hi:false },
                        { label:"Gain",           value:fmtINR(sipResult.gain),      hi:sipResult.gain > 0 },
                        { label:"Est. XIRR",      value:sipResult.xirr !== null ? `${sipResult.xirr.toFixed(1)}%` : "—", hi:false },
                      ].map(item => (
                        <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                          <p className="text-[11px] text-muted-foreground">{item.label}</p>
                          <p className={`text-sm font-semibold mt-1 ${item.hi ? "text-emerald-600" : "text-foreground"}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Insufficient NAV history for this SIP duration.</p>
                  )}
                </div>
              </>
            )}

            {!loading && navRows.length === 0 && selected && (
              <div className="flex items-center justify-center h-40 border border-dashed border-border rounded-lg">
                <p className="text-xs text-muted-foreground">Could not load NAV data. mfapi.in may be temporarily unavailable.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
