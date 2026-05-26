#!/usr/bin/env npx tsx
/**
 * ENGINE 3: COMPUTE METRICS
 * ─────────────────────────────────────────────────────────────────
 * Run: npm run mf:compute
 *
 * Reads nav_history from Supabase for each scheme.
 * Computes all analytics using pure TypeScript math — no numpy/pandas.
 * Writes into: rolling_return_metrics, risk_metrics, sip_metrics, fund_scores
 *
 * Same math approach as the previous project's mf_engine_2_compute.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RF      = 6.5   // risk-free rate % (Indian T-bill approx)
const CHUNK   = 200

// ── Types ──────────────────────────────────────────────────────────────────────

type NavRow = { nav_date: string; nav: number }

// ── Math helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Date(Date.now() + ms) }   // dummy, unused — keeping for consistency

/** Find NAV closest to target date, within tolDays tolerance */
function navAt(data: NavRow[], target: Date, tolDays = 15): number | null {
  const t = target.getTime()
  let best: NavRow | null = null
  let minDiff = Infinity
  for (const r of data) {
    const diff = Math.abs(new Date(r.nav_date).getTime() - t)
    if (diff < minDiff) { minDiff = diff; best = r }
  }
  return minDiff <= tolDays * 86_400_000 && best ? Number(best.nav) : null
}

/** Date N years before `from` */
function ago(years: number, from: Date): Date {
  const d = new Date(from)
  d.setFullYear(d.getFullYear() - years)
  return d
}

/** Point-to-point CAGR % */
function cagr(start: number | null, end: number, years: number): number | null {
  if (!start || !end || start <= 0 || end <= 0 || years < 0.25) return null
  const v = (Math.pow(end / start, 1 / years) - 1) * 100
  return Math.abs(v) > 500 ? null : Math.round(v * 100) / 100
}

/** Annualised volatility % */
function volatility(data: NavRow[]): number | null {
  if (data.length < 30) return null
  const sorted = [...data].sort((a, b) => a.nav_date.localeCompare(b.nav_date))
  const rets: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].nav)
    const curr = Number(sorted[i].nav)
    if (prev > 0) rets.push((curr - prev) / prev)
  }
  if (rets.length < 20) return null
  const mean     = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / rets.length
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100 * 100) / 100
}

/** Max drawdown % (negative number, e.g. -34.5) */
function maxDrawdown(data: NavRow[]): number | null {
  if (data.length < 2) return null
  const sorted = [...data].sort((a, b) => a.nav_date.localeCompare(b.nav_date))
  let peak = Number(sorted[0].nav)
  let mdd  = 0
  for (const r of sorted) {
    const n = Number(r.nav)
    if (n > peak) peak = n
    const dd = (peak - n) / peak * 100
    if (dd > mdd) mdd = dd
  }
  return Math.round(-mdd * 100) / 100  // returns negative value
}

/** Downside deviation % (annualised) */
function downsideDev(data: NavRow[]): number | null {
  const sorted = [...data].sort((a, b) => a.nav_date.localeCompare(b.nav_date))
  const rets: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].nav)
    const curr = Number(sorted[i].nav)
    if (prev > 0) rets.push((curr - prev) / prev)
  }
  if (rets.length < 30) return null
  const mar = RF / 100 / 252
  const neg = rets.filter(r => r < mar).map(r => Math.pow(r - mar, 2))
  if (!neg.length) return 0
  const dd = Math.sqrt(neg.reduce((s, v) => s + v, 0) / rets.length) * Math.sqrt(252) * 100
  return Math.round(dd * 100) / 100
}

/** Ulcer Index */
function ulcerIndex(data: NavRow[]): number | null {
  const sorted = [...data].sort((a, b) => a.nav_date.localeCompare(b.nav_date))
  if (sorted.length < 10) return null
  let peak = Number(sorted[0].nav)
  const dds: number[] = []
  for (const r of sorted) {
    const n = Number(r.nav)
    if (n > peak) peak = n
    dds.push(Math.pow((peak - n) / peak * 100, 2))
  }
  return Math.round(Math.sqrt(dds.reduce((s, v) => s + v, 0) / dds.length) * 100) / 100
}

/** Rolling return stats for a given window (years) */
function rollingReturns(data: NavRow[], years: number): {
  avg: number; median: number; min: number; max: number; positivePct: number; dataPoints: number
} | null {
  if (data.length < 30) return null
  const sorted  = [...data].sort((a, b) => a.nav_date.localeCompare(b.nav_date))
  const ms      = years * 365.25 * 86_400_000
  const results: number[] = []
  // Sample ~200 points max for performance
  const step = Math.max(1, Math.floor(sorted.length / 200))

  for (let i = 0; i < sorted.length; i += step) {
    const endTarget = new Date(new Date(sorted[i].nav_date).getTime() + ms)
    const endNav    = navAt(sorted, endTarget, 20)
    if (!endNav) continue
    const r = cagr(Number(sorted[i].nav), endNav, years)
    if (r !== null) results.push(r)
  }

  if (results.length < 5) return null

  const sorted2 = [...results].sort((a, b) => a - b)
  const avg     = results.reduce((s, v) => s + v, 0) / results.length
  const median  = sorted2[Math.floor(sorted2.length / 2)]
  const positivePct = results.filter(r => r > 0).length / results.length * 100

  return {
    avg:          Math.round(avg * 100) / 100,
    median:       Math.round(median * 100) / 100,
    min:          Math.round(sorted2[0] * 100) / 100,
    max:          Math.round(sorted2[sorted2.length - 1] * 100) / 100,
    positivePct:  Math.round(positivePct * 100) / 100,
    dataPoints:   results.length,
  }
}

/** SIP XIRR approximation — ₹10,000/month for `years` years */
function sipXirr(data: NavRow[], years: number): number | null {
  const sorted    = [...data].sort((a, b) => a.nav_date.localeCompare(b.nav_date))
  if (sorted.length < 30) return null

  const latestDate = new Date(sorted[sorted.length - 1].nav_date)
  const latestNav  = Number(sorted[sorted.length - 1].nav)
  const startDate  = ago(years, latestDate)

  let units  = 0
  let months = 0
  const cursor = new Date(startDate)

  while (cursor <= latestDate) {
    const n = navAt(sorted, cursor, 15)
    if (n && n > 0) { units += 10_000 / n; months++ }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  if (months < 6 || units <= 0) return null
  return cagr(months * 10_000, units * latestNav, months / 12)
}

/** Composite fund score 0–100 */
function compositeScore(params: {
  cagr5y:       number | null
  sharpe3y:     number | null
  sortino3y:    number | null
  rolling3yPct: number | null
  maxDd:        number | null
  sip5yXirr:    number | null
}): number {
  let score = 0; let w = 0
  function add(v: number | null, weight: number, norm: (n: number) => number) {
    if (v == null) return
    score += norm(v) * weight
    w     += weight
  }
  add(params.cagr5y,       25, v => Math.min(100, Math.max(0, v / 20 * 100)))
  add(params.sharpe3y,     20, v => Math.min(100, Math.max(0, (v + 1) / 3 * 100)))
  add(params.sortino3y,    15, v => Math.min(100, Math.max(0, (v + 1) / 4 * 100)))
  add(params.rolling3yPct, 20, v => Math.min(100, Math.max(0, v)))
  add(params.maxDd,        10, v => Math.min(100, Math.max(0, (v + 50) / 50 * 100)))  // v is negative
  add(params.sip5yXirr,    10, v => Math.min(100, Math.max(0, v / 20 * 100)))
  return w > 0 ? Math.round(score / w * 100) / 100 : 0
}

function progressBar(current: number, total: number, width = 40): string {
  const pct    = current / total
  const filled = Math.round(width * pct)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${String(current).padStart(4)}/${total} (${Math.round(pct * 100)}%)`
}

// ── Upsert helpers ─────────────────────────────────────────────────────────────

async function upsertChunked(table: string, records: object[], onConflict: string) {
  for (let i = 0; i < records.length; i += CHUNK) {
    const { error } = await supabase
      .from(table)
      .upsert(records.slice(i, i + CHUNK) as any, { onConflict })
    if (error) console.error(`  Upsert error on ${table}:`, error.message)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   MF Platform — ENGINE 3: COMPUTE METRICS           ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  Started : ${new Date().toLocaleString('en-IN')}`)
  console.log('  No Python. No numpy. Pure TypeScript.\n')

  // Load all active schemes
  const { data: schemes, error: se } = await supabase
    .from('schemes')
    .select('scheme_code, category')
    .eq('is_active', true)

  if (se || !schemes?.length) {
    console.error('  No schemes in DB. Run "npm run mf:schemes" first.')
    process.exit(1)
  }

  console.log(`  Schemes to process : ${schemes.length}\n`)

  const startTime = Date.now()

  const allRolling:  object[] = []
  const allRisk:     object[] = []
  const allSip:      object[] = []
  const allScores:   Map<number, object> = new Map()

  let computed = 0; let skipped = 0; let errors = 0

  for (let i = 0; i < schemes.length; i++) {
    const { scheme_code, category } = schemes[i]

    try {
      // Load NAV history from Supabase
      const { data: navData, error: ne } = await supabase
        .from('nav_history')
        .select('nav_date, nav')
        .eq('scheme_code', scheme_code)
        .order('nav_date', { ascending: true })

      if (ne || !navData || navData.length < 30) {
        skipped++
        process.stdout.write(`\r  ${progressBar(i + 1, schemes.length)}  skipped: ${skipped}`)
        continue
      }

      const data      = navData as NavRow[]
      const latest    = data[data.length - 1]
      const latestNav = Number(latest.nav)
      const latestDt  = new Date(latest.nav_date)
      const oldest    = data[0]
      const yearsData = (latestDt.getTime() - new Date(oldest.nav_date).getTime()) / (365.25 * 86_400_000)

      const now = new Date().toISOString()

      // ── Rolling returns ──────────────────────────────────────────────────────
      const rollingPeriods = [1, 3, 5, 7, 10] as const
      for (const yrs of rollingPeriods) {
        if (yearsData < yrs * 1.1) continue
        const r = rollingReturns(data, yrs)
        if (!r) continue
        allRolling.push({
          scheme_code,
          rolling_period_years:   yrs,
          avg_rolling_return:     r.avg,
          median_rolling_return:  r.median,
          min_rolling_return:     r.min,
          max_rolling_return:     r.max,
          positive_return_pct:    r.positivePct,
          benchmark_outperform_pct: null,
          consistency_score:      r.positivePct,
          data_points:            r.dataPoints,
          computed_at:            now,
        })
      }

      // ── Risk metrics ─────────────────────────────────────────────────────────
      const riskPeriods = [1, 3, 5, 10] as const
      for (const yrs of riskPeriods) {
        if (yearsData < yrs * 0.9) continue

        const cutoff  = ago(yrs, latestDt)
        const slice   = data.filter(r => new Date(r.nav_date) >= cutoff)
        if (slice.length < 30) continue

        const vol  = volatility(slice)
        const mdd  = maxDrawdown(slice)
        const dd   = downsideDev(slice)
        const ui   = ulcerIndex(slice)
        const c    = cagr(navAt(slice, cutoff, 30), latestNav, yrs)
        const sh   = (c !== null && vol && vol > 0) ? Math.round((c - RF) / vol * 100) / 100 : null
        const so   = (c !== null && dd  && dd  > 0) ? Math.round((c - RF) / dd  * 100) / 100 : null
        const cal  = (c !== null && mdd && mdd < 0) ? Math.round(c / Math.abs(mdd) * 100) / 100 : null

        allRisk.push({
          scheme_code,
          period_years:       yrs,
          volatility:         vol,
          sharpe_ratio:       sh,
          sortino_ratio:      so,
          max_drawdown:       mdd,
          downside_deviation: dd,
          ulcer_index:        ui,
          calmar_ratio:       cal,
          computed_at:        now,
        })
      }

      // ── SIP metrics ──────────────────────────────────────────────────────────
      const sipPeriods = [1, 3, 5, 7, 10] as const
      for (const yrs of sipPeriods) {
        if (yearsData < yrs * 0.9) continue
        const xirr = sipXirr(data, yrs)
        if (xirr === null) continue
        allSip.push({
          scheme_code,
          sip_period_years:        yrs,
          avg_sip_xirr:            xirr,
          median_sip_xirr:         xirr,   // approximation — full rolling SIP too expensive without pandas
          best_sip_xirr:           null,
          worst_sip_xirr:          null,
          positive_sip_pct:        xirr > 0 ? 100 : 0,
          rolling_sip_consistency: null,
          computed_at:             now,
        })
      }

      // ── Composite score ───────────────────────────────────────────────────────
      const c5y    = cagr(navAt(data, ago(5,  latestDt), 30), latestNav, 5)
      const risk3y = allRisk.find((r: any) => r.scheme_code === scheme_code && r.period_years === 3) as any
      const roll3y = allRolling.find((r: any) => r.scheme_code === scheme_code && r.rolling_period_years === 3) as any
      const sip5y  = allSip.find((s: any) => s.scheme_code === scheme_code && s.sip_period_years === 5) as any

      const score = compositeScore({
        cagr5y:       c5y,
        sharpe3y:     risk3y?.sharpe_ratio ?? null,
        sortino3y:    risk3y?.sortino_ratio ?? null,
        rolling3yPct: roll3y?.positive_return_pct ?? null,
        maxDd:        risk3y?.max_drawdown ?? null,
        sip5yXirr:    sip5y?.avg_sip_xirr ?? null,
      })

      allScores.set(scheme_code, {
        scheme_code,
        overall_score:        score,
        rolling_return_score: roll3y ? Math.min(100, Math.max(0, (roll3y.avg_rolling_return / 20) * 100)) : null,
        risk_score:           risk3y ? Math.min(100, Math.max(0, ((risk3y.sharpe_ratio ?? 0) + 1) / 3 * 100)) : null,
        consistency_score:    roll3y?.positive_return_pct ?? null,
        sip_score:            sip5y  ? Math.min(100, Math.max(0, (sip5y.avg_sip_xirr / 20) * 100)) : null,
        drawdown_score:       risk3y ? Math.min(100, Math.max(0, ((risk3y.max_drawdown ?? 0) + 50) / 50 * 100)) : null,
        advisor_preference_boost: 0,
        rank_in_category:     null,   // filled in category pass below
        computed_at:          now,
      })

      computed++
      process.stdout.write(`\r  ${progressBar(i + 1, schemes.length)}  scored: ${score.toFixed(0).padStart(3)}`)

    } catch (e: any) {
      errors++
    }
  }

  // ── Assign category ranks ──────────────────────────────────────────────────
  console.log('\n\n  📊 Assigning category ranks...')
  const byCategory: Record<string, number[]> = {}
  for (const s of schemes) {
    const cat = s.category || 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(s.scheme_code)
  }
  for (const [, codes] of Object.entries(byCategory)) {
    const ranked = codes
      .filter(c => allScores.has(c))
      .sort((a, b) => {
        const sa = (allScores.get(a) as any).overall_score
        const sb = (allScores.get(b) as any).overall_score
        return sb - sa
      })
    ranked.forEach((code, idx) => {
      const rec = allScores.get(code) as any
      rec.rank_in_category = idx + 1
    })
  }

  // ── Upsert everything ──────────────────────────────────────────────────────
  console.log('  📥 Upserting rolling_return_metrics...')
  await upsertChunked('rolling_return_metrics', allRolling, 'scheme_code,rolling_period_years')

  console.log('  📥 Upserting risk_metrics...')
  await upsertChunked('risk_metrics', allRisk, 'scheme_code,period_years')

  console.log('  📥 Upserting sip_metrics...')
  await upsertChunked('sip_metrics', allSip, 'scheme_code,sip_period_years')

  console.log('  📥 Upserting fund_scores...')
  await upsertChunked('fund_scores', [...allScores.values()], 'scheme_code')

  const elapsed = Math.round((Date.now() - startTime) / 1000)

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║  COMPUTE COMPLETE                                    ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  Computed      : ${String(computed).padEnd(36)}║`)
  console.log(`║  Skipped       : ${String(skipped).padEnd(36)}║`)
  console.log(`║  Errors        : ${String(errors).padEnd(36)}║`)
  console.log(`║  Rolling recs  : ${String(allRolling.length).padEnd(36)}║`)
  console.log(`║  Risk recs     : ${String(allRisk.length).padEnd(36)}║`)
  console.log(`║  SIP recs      : ${String(allSip.length).padEnd(36)}║`)
  console.log(`║  Time elapsed  : ${String(elapsed + 's').padEnd(36)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('\n  ✅ All analytics ready. Run "npm run dev"\n')
}

main().catch(e => { console.error('\n  FATAL:', e.message); process.exit(1) })
