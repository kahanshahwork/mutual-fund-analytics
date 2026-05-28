#!/usr/bin/env npx tsx
/**
 * pipeline/compute_metrics.ts
 * Reads nav.db → computes all metrics → overwrites Supabase precomputed tables
 *
 * Standards: RF=7%, √252, simple returns, skip |daily return| > 10%
 */

import { openDb, getNav, getAllCodes } from './db'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RF    = 7.0
const CHUNK = 200

type NavRow = { scheme_code: number; nav_date: string; nav: number }

// ── Daily returns — cleaned ────────────────────────────────────────────────────

function dailyReturns(data: NavRow[]): number[] {
  const rets: number[] = []
  for (let i = 1; i < data.length; i++) {
    const prev = data[i-1].nav, curr = data[i].nav
    if (prev <= 0 || curr <= 0) continue
    const r = (curr - prev) / prev
    if (Math.abs(r) <= 0.10) rets.push(r)   // skip data errors
  }
  return rets
}

// ── Math ───────────────────────────────────────────────────────────────────────

function navAt(data: NavRow[], target: Date, tolDays = 20): number | null {
  const t = target.getTime()
  let best: NavRow | null = null, minDiff = Infinity
  for (const r of data) {
    const diff = Math.abs(new Date(r.nav_date).getTime() - t)
    if (diff < minDiff) { minDiff = diff; best = r }
  }
  return minDiff <= tolDays * 86_400_000 && best ? best.nav : null
}

function ago(years: number, from: Date): Date {
  const d = new Date(from); d.setFullYear(d.getFullYear() - years); return d
}

function cagr(start: number | null, end: number, years: number): number | null {
  if (!start || start <= 0 || end <= 0 || years < 0.25) return null
  const v = (Math.pow(end / start, 1 / years) - 1) * 100
  return isFinite(v) && Math.abs(v) < 200 ? Math.round(v * 100) / 100 : null
}

function volatility(rets: number[]): number | null {
  if (rets.length < 20) return null
  const mean = rets.reduce((s,r) => s+r, 0) / rets.length
  const vari = rets.reduce((s,r) => s + Math.pow(r-mean, 2), 0) / rets.length
  const vol  = Math.sqrt(vari) * Math.sqrt(252) * 100
  return isFinite(vol) ? Math.round(vol * 100) / 100 : null
}

function downsideDev(rets: number[]): number | null {
  if (rets.length < 20) return null
  const mar      = RF / 100 / 252
  const downside = rets.filter(r => r < mar)
  if (!downside.length) return 0
  const vari = downside.reduce((s,r) => s + Math.pow(r - mar, 2), 0) / rets.length
  const dd   = Math.sqrt(vari) * Math.sqrt(252) * 100
  return isFinite(dd) ? Math.round(dd * 100) / 100 : null
}

function maxDrawdown(data: NavRow[]): number | null {
  let peak = data[0].nav, mdd = 0
  for (const r of data) {
    if (r.nav > peak) peak = r.nav
    if (peak > 0) { const dd = (peak - r.nav) / peak * 100; if (dd > mdd) mdd = dd }
  }
  const result = -Math.round(mdd * 100) / 100
  return isFinite(result) ? result : null
}

function ulcerIndex(data: NavRow[]): number | null {
  if (data.length < 10) return null
  let peak = data[0].nav
  const dds: number[] = []
  for (const r of data) {
    if (r.nav > peak) peak = r.nav
    if (peak > 0) dds.push(Math.pow((peak - r.nav) / peak * 100, 2))
  }
  const ui = Math.sqrt(dds.reduce((s,v) => s+v, 0) / dds.length)
  return isFinite(ui) ? Math.round(ui * 100) / 100 : null
}

function rollingReturns(data: NavRow[], years: number) {
  if (data.length < 30) return null
  const ms   = years * 365.25 * 86_400_000
  const step = Math.max(1, Math.floor(data.length / 200))
  const results: number[] = []
  for (let i = 0; i < data.length; i += step) {
    const startNav  = data[i].nav
    if (startNav <= 0) continue
    const endTarget = new Date(new Date(data[i].nav_date).getTime() + ms)
    const endNav    = navAt(data, endTarget, 20)
    if (!endNav) continue
    const actualYrs = (endTarget.getTime() - new Date(data[i].nav_date).getTime()) / (365.25 * 86_400_000)
    if (actualYrs < years * 0.85) continue
    const r = cagr(startNav, endNav, actualYrs)
    if (r !== null) results.push(r)
  }
  if (results.length < 5) return null
  const s   = [...results].sort((a,b) => a-b)
  const avg = results.reduce((a,v) => a+v, 0) / results.length
  return {
    avg:        Math.round(avg * 100) / 100,
    median:     Math.round(s[Math.floor(s.length/2)] * 100) / 100,
    min:        Math.round(s[0] * 100) / 100,
    max:        Math.round(s[s.length-1] * 100) / 100,
    positivePct: Math.round(results.filter(r => r > 0).length / results.length * 100 * 100) / 100,
    dataPoints: results.length,
  }
}

function sipXirr(data: NavRow[], years: number): number | null {
  if (data.length < 30) return null
  const latestDate = new Date(data[data.length-1].nav_date)
  const latestNav  = data[data.length-1].nav
  const startDate  = ago(years, latestDate)
  let units = 0, months = 0
  const cursor = new Date(startDate)
  while (cursor <= latestDate) {
    const n = navAt(data, cursor, 15)
    if (n && n > 0) { units += 10_000 / n; months++ }
    cursor.setMonth(cursor.getMonth() + 1)
  }
  if (months < 6 || units <= 0) return null
  return cagr(months * 10_000, units * latestNav, months / 12)
}

function compositeScore(p: {
  cagr5y: number|null; sharpe3y: number|null; sortino3y: number|null
  rolling3yPct: number|null; maxDd: number|null; sip5y: number|null
}): number {
  let score = 0, w = 0
  const add = (v: number|null, weight: number, norm: (n:number)=>number) => {
    if (v == null) return
    score += Math.min(100, Math.max(0, norm(v))) * weight; w += weight
  }
  add(p.cagr5y,       25, v => v / 20 * 100)
  add(p.sharpe3y,     20, v => (v + 1) / 3 * 100)
  add(p.sortino3y,    15, v => (v + 1) / 4 * 100)
  add(p.rolling3yPct, 20, v => v)
  add(p.maxDd,        10, v => (v + 50) / 50 * 100)
  add(p.sip5y,        10, v => v / 20 * 100)
  return w > 0 ? Math.round(score / w * 100) / 100 : 0
}

function progressBar(cur: number, total: number, w = 40): string {
  const pct = cur / total, filled = Math.round(w * pct)
  return `[${'█'.repeat(filled)}${'░'.repeat(w - filled)}] ${String(cur).padStart(4)}/${total} (${Math.round(pct*100)}%)`
}

async function upsertChunked(table: string, records: object[], onConflict: string) {
  for (let i = 0; i < records.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(records.slice(i, i+CHUNK) as any, { onConflict })
    if (error) console.error(`\n  ⚠️  ${table}: ${error.message}`)
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   MF Platform — COMPUTE METRICS                     ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log('║   RF=7%  |  √252  |  Simple returns  |  Skip >10%  ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  Started : ${new Date().toLocaleString('en-IN')}\n`)

  const db    = await openDb()
  const codes = getAllCodes(db)
  console.log(`  Schemes in nav.db : ${codes.length}\n`)

  // Load category map from Supabase
  const categoryMap: Record<number, string> = {}
  for (let i = 0; i < codes.length; i += 1000) {
    const { data } = await supabase.from('schemes').select('scheme_code, category').in('scheme_code', codes.slice(i, i+1000))
    if (data) for (const s of data) categoryMap[s.scheme_code] = s.category ?? 'Other'
  }

  const startTime  = Date.now()
  const allRolling: object[] = [], allRisk: object[] = [], allSip: object[] = []
  const allScores  = new Map<number, any>()
  let computed = 0, skipped = 0, errors = 0

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    try {
      const data = getNav(db, code)
      if (data.length < 60) { skipped++; process.stdout.write(`\r  ${progressBar(i+1, codes.length)}  skipped:${skipped}`); continue }

      const latest    = data[data.length-1]
      const latestNav = latest.nav
      const latestDt  = new Date(latest.nav_date)
      const yearsData = (latestDt.getTime() - new Date(data[0].nav_date).getTime()) / (365.25 * 86_400_000)
      const now       = new Date().toISOString()
      const rets      = dailyReturns(data)

      // Rolling returns
      const rollingRecs: any[] = []
      for (const yrs of [1, 3, 5, 7, 10] as const) {
        if (yearsData < yrs + 0.5) continue
        const r = rollingReturns(data, yrs)
        if (!r) continue
        const rec = { scheme_code:code, rolling_period_years:yrs, avg_rolling_return:r.avg,
          median_rolling_return:r.median, min_rolling_return:r.min, max_rolling_return:r.max,
          positive_return_pct:r.positivePct, benchmark_outperform_pct:null,
          consistency_score:r.positivePct, data_points:r.dataPoints, computed_at:now }
        allRolling.push(rec); rollingRecs.push(rec)
      }

      // Risk metrics
      const riskRecs: any[] = []
      for (const yrs of [1, 3, 5, 10] as const) {
        if (yearsData < yrs * 0.9) continue
        const cutoff    = ago(yrs, latestDt)
        const slice     = data.filter(r => new Date(r.nav_date) >= cutoff)
        if (slice.length < 30) continue
        const sliceRets = dailyReturns(slice)
        const vol  = volatility(sliceRets)
        const mdd  = maxDrawdown(slice)
        const dd   = downsideDev(sliceRets)
        const ui   = ulcerIndex(slice)
        const c    = cagr(navAt(slice, cutoff, 30), latestNav, yrs)
        const sh   = (c !== null && vol && vol > 0) ? Math.round((c - RF) / vol * 100) / 100 : null
        const so   = (c !== null && dd  && dd  > 0) ? Math.round((c - RF) / dd  * 100) / 100 : null
        const cal  = (c !== null && mdd && mdd < 0) ? Math.round(c / Math.abs(mdd) * 100) / 100 : null
        const rec = { scheme_code:code, period_years:yrs, volatility:vol, sharpe_ratio:sh,
          sortino_ratio:so, max_drawdown:mdd, downside_deviation:dd, ulcer_index:ui,
          calmar_ratio:cal, computed_at:now }
        allRisk.push(rec); riskRecs.push(rec)
      }

      // SIP metrics
      const sipRecs: any[] = []
      for (const yrs of [1, 3, 5, 7, 10] as const) {
        if (yearsData < yrs * 0.9) continue
        const xirr = sipXirr(data, yrs)
        if (xirr === null) continue
        const rec = { scheme_code:code, sip_period_years:yrs, avg_sip_xirr:xirr,
          median_sip_xirr:xirr, best_sip_xirr:null, worst_sip_xirr:null,
          positive_sip_pct:xirr > 0 ? 100 : 0, rolling_sip_consistency:null, computed_at:now }
        allSip.push(rec); sipRecs.push(rec)
      }

      // Composite score
      const c5y    = cagr(navAt(data, ago(5, latestDt), 30), latestNav, 5)
      const risk3y = riskRecs.find(r => r.period_years === 3)
      const roll3y = rollingRecs.find(r => r.rolling_period_years === 3)
      const sip5y  = sipRecs.find(s => s.sip_period_years === 5)
      const score  = compositeScore({
        cagr5y:p.cagr5y, sharpe3y:risk3y?.sharpe_ratio??null,
        sortino3y:risk3y?.sortino_ratio??null,
        rolling3yPct:roll3y?.positive_return_pct??null,
        maxDd:risk3y?.max_drawdown??null, sip5y:sip5y?.avg_sip_xirr??null,
      } as any)

      allScores.set(code, {
        scheme_code:code, overall_score:score,
        rolling_return_score: roll3y ? Math.min(100,Math.max(0,roll3y.avg_rolling_return/20*100)) : null,
        risk_score:           risk3y ? Math.min(100,Math.max(0,((risk3y.sharpe_ratio??0)+1)/3*100)) : null,
        consistency_score:    roll3y?.positive_return_pct ?? null,
        sip_score:            sip5y  ? Math.min(100,Math.max(0,sip5y.avg_sip_xirr/20*100)) : null,
        drawdown_score:       risk3y ? Math.min(100,Math.max(0,((risk3y.max_drawdown??0)+50)/50*100)) : null,
        advisor_preference_boost:0, rank_in_category:null, computed_at:now,
      })

      computed++
      process.stdout.write(`\r  ${progressBar(i+1, codes.length)}  score:${score.toFixed(0).padStart(3)}`)
    } catch { errors++ }
  }

  db.close()

  // Category ranks
  console.log('\n\n  📊 Assigning category ranks...')
  const byCategory: Record<string, number[]> = {}
  for (const [code] of allScores) {
    const cat = categoryMap[code] ?? 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(code)
  }
  for (const cats of Object.values(byCategory)) {
    cats.sort((a,b) => (allScores.get(b)?.overall_score??0) - (allScores.get(a)?.overall_score??0))
        .forEach((code,idx) => { if (allScores.has(code)) allScores.get(code).rank_in_category = idx+1 })
  }

  console.log('  📥 Upserting to Supabase...')
  await upsertChunked('rolling_return_metrics', allRolling, 'scheme_code,rolling_period_years')
  await upsertChunked('risk_metrics',            allRisk,    'scheme_code,period_years')
  await upsertChunked('sip_metrics',             allSip,     'scheme_code,sip_period_years')
  await upsertChunked('fund_scores',             [...allScores.values()], 'scheme_code')

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║  COMPUTE COMPLETE                                    ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  Computed     : ${String(computed).padEnd(37)}║`)
  console.log(`║  Skipped      : ${String(skipped).padEnd(37)}║`)
  console.log(`║  Rolling recs : ${String(allRolling.length).padEnd(37)}║`)
  console.log(`║  Risk recs    : ${String(allRisk.length).padEnd(37)}║`)
  console.log(`║  SIP recs     : ${String(allSip.length).padEnd(37)}║`)
  console.log(`║  Time elapsed : ${String(elapsed+'s').padEnd(37)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('\n  ✅ All analytics ready. Run "npm run dev"\n')
}

main().catch(e => { console.error('\n  FATAL:', e.message); process.exit(1) })
