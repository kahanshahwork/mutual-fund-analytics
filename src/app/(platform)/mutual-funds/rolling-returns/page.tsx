"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/Topbar";
import { Search, RotateCcw, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import type { Scheme } from "@/types";

interface NavRow  { date: string; nav: number }
interface RollingPoint { date: string; value: number }
interface HistoBucket { range: string; count: number; isPositive: boolean }

// ── mfapi fetch ────────────────────────────────────────────────────────────────

async function fetchNavFromApi(code: number): Promise<NavRow[]> {
  const res = await fetch(`https://api.mfapi.in/mf/${code}`)
  if (!res.ok) throw new Error("fetch failed")
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

// ── Math ───────────────────────────────────────────────────────────────────────

function computeRolling(navRows: NavRow[], years: number): RollingPoint[] {
  if (navRows.length === 0) return []
  const ms   = years * 365.25 * 86_400_000
  const step = Math.max(1, Math.floor(navRows.length / 300))
  const results: RollingPoint[] = []

  for (let i = 0; i < navRows.length; i += step) {
    const endTime    = new Date(navRows[i].date).getTime()
    const targetTime = endTime + ms
    // find nav closest to targetTime
    let best: NavRow | null = null, minDiff = Infinity
    for (const r of navRows) {
      const diff = Math.abs(new Date(r.date).getTime() - targetTime)
      if (diff < minDiff) { minDiff = diff; best = r }
    }
    if (!best || minDiff > 25 * 86_400_000) continue
    const actualYears = (new Date(best.date).getTime() - endTime) / (365.25 * 86_400_000)
    if (actualYears < years * 0.85) continue
    const cagr = (Math.pow(best.nav / navRows[i].nav, 1 / actualYears) - 1) * 100
    if (cagr > -99 && cagr < 1000) results.push({ date: navRows[i].date, value: parseFloat(cagr.toFixed(2)) })
  }
  return results
}

function buildHistogram(points: RollingPoint[]): HistoBucket[] {
  if (!points.length) return []
  const vals = points.map(p => p.value)
  const min  = Math.floor(Math.min(...vals) / 5) * 5
  const max  = Math.ceil(Math.max(...vals) / 5) * 5
  const buckets: HistoBucket[] = []
  for (let lo = min; lo < max; lo += 5)
    buckets.push({ range:`${lo}–${lo+5}`, count: vals.filter(v => v>=lo && v<lo+5).length, isPositive: lo >= 0 })
  return buckets
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function RollingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">{new Date(label).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</p>
      <p className={`font-semibold ${val >= 0 ? "text-emerald-600" : "text-red-500"}`}>{val > 0 ? "+" : ""}{val?.toFixed(2)}% CAGR</p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RollingReturnsPage() {
  const supabase = createClient()
  const [search, setSearch]     = useState("")
  const [results, setResults]   = useState<Scheme[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [selected, setSelected] = useState<Scheme | null>(null)
  const [navRows, setNavRows]   = useState<NavRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [yrs, setYrs]           = useState(3)

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
    try { setNavRows(await fetchNavFromApi(code)) }
    catch { setNavRows([]) }
    setLoading(false)
  }, [])

  function selectScheme(s: Scheme) {
    setSelected(s); setSearch(s.scheme_name); setShowDrop(false); loadNav(s.scheme_code)
  }

  const rollingPts  = computeRolling(navRows, yrs)
  const histogram   = buildHistogram(rollingPts)
  const vals        = rollingPts.map(p => p.value)
  const avg         = vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : null
  const sorted2     = [...vals].sort((a,b) => a-b)
  const median      = sorted2.length ? sorted2[Math.floor(sorted2.length/2)] : null
  const min         = sorted2.length ? sorted2[0] : null
  const max         = sorted2.length ? sorted2[sorted2.length-1] : null
  const posPct      = vals.length ? vals.filter(v=>v>0).length/vals.length*100 : null
  const fmtR = (v: number | null) => v === null ? "—" : `${v>0?"+":""}${v.toFixed(2)}%`

  return (
    <div>
      <Topbar title="Rolling Returns" subtitle="Consistency of returns across time windows"/>
      <div className="p-6 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="relative flex-1 min-w-64 max-w-xl">
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
          <div className="flex gap-1">
            {[1,3,5,7,10].map(y => (
              <button key={y} onClick={() => setYrs(y)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${yrs===y ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {y}Y
              </button>
            ))}
          </div>
        </div>

        {!selected && (
          <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg">
            <div className="text-center">
              <RotateCcw size={32} className="mx-auto text-muted-foreground/30 mb-3"/>
              <p className="text-sm text-muted-foreground">Search and select a fund to begin</p>
            </div>
          </div>
        )}

        {selected && loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin"/> Fetching NAV history from mfapi.in…
          </div>
        )}

        {selected && !loading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Average"          value={fmtR(avg)}    sub={`${yrs}Y rolling`}/>
              <StatCard label="Median"           value={fmtR(median)}/>
              <StatCard label="Best Window"      value={fmtR(max)}/>
              <StatCard label="Worst Window"     value={fmtR(min)}/>
              <StatCard label="Positive Periods" value={posPct !== null ? `${posPct.toFixed(1)}%` : "—"} sub={`of ${vals.length} windows`}/>
            </div>

            {/* Rolling chart */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-foreground">{yrs}-Year Rolling CAGR</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Each point = CAGR of the {yrs}Y window starting on that date</p>
              </div>
              {rollingPts.length > 1 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={rollingPts} margin={{ top:4, right:8, bottom:4, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false}
                      tickFormatter={v => new Date(v).toLocaleDateString("en-IN", { month:"short", year:"2-digit" })} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                      tickFormatter={v => `${v}%`} width={42}/>
                    <Tooltip content={<RollingTooltip/>}/>
                    <ReferenceLine y={0}  stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="4 4"/>
                    <ReferenceLine y={12} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3"/>
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} activeDot={{ r:3 }}/>
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  {navRows.length === 0 ? "Could not load NAV data. mfapi.in may be temporarily unavailable." : `Insufficient NAV history for ${yrs}Y rolling windows`}
                </div>
              )}
            </div>

            {/* Histogram */}
            {histogram.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-foreground">Return Distribution</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Frequency of {yrs}Y rolling CAGR outcomes (5% buckets)</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={histogram} margin={{ top:4, right:8, bottom:4, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                    <XAxis dataKey="range" tick={{ fontSize:9, fill:"hsl(var(--muted-foreground))" }} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={32}/>
                    <Tooltip formatter={(v: any) => [`${v} periods`, "Count"]}
                      contentStyle={{ fontSize:11, backgroundColor:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:6 }}/>
                    <Bar dataKey="count" radius={[3,3,0,0]}>
                      {histogram.map((e,i) => <Cell key={i} fill={e.isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} fillOpacity={0.8}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/80 inline-block"/>Positive</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-destructive/80 inline-block"/>Negative</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
