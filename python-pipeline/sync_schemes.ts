#!/usr/bin/env npx tsx
/**
 * ENGINE 1: SYNC SCHEMES
 * ─────────────────────────────────────────────────────────────────
 * Run: npm run mf:schemes
 *
 * Fetches all MF schemes from mfapi.in
 * Filters: removes IDCW, Dividend, Direct, Bonus, Payout
 * Upserts into Supabase `schemes` table
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MFAPI   = 'https://api.mfapi.in/mf'
const CHUNK   = 500

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Filters ────────────────────────────────────────────────────────────────────

function shouldInclude(name: string): boolean {
  const n = name.toLowerCase()
  if (n.includes('direct'))   return false
  if (n.includes('idcw'))     return false
  if (n.includes('dividend')) return false
  if (n.includes('bonus'))    return false
  if (n.includes('payout'))   return false
  return true
}

function detectPlanType(name: string): 'Regular' | 'Direct' {
  return name.toLowerCase().includes('direct') ? 'Direct' : 'Regular'
}

function detectOptionType(name: string): 'Growth' | 'IDCW' {
  const n = name.toLowerCase()
  return (n.includes('idcw') || n.includes('dividend')) ? 'IDCW' : 'Growth'
}

function extractAmc(name: string): string {
  const AMC_KEYWORDS = ['mutual fund', 'mf', 'asset management', 'amc', 'trustee', 'fund', 'schemes', 'management']
  const words = name.split(' ')
  const result: string[] = []
  for (const word of words) {
    if (AMC_KEYWORDS.some(k => word.toLowerCase().includes(k))) {
      result.push(word)
      break
    }
    result.push(word)
    if (result.length >= 3) break
  }
  return result.join(' ').trim()
}

function extractCategory(name: string): string {
  const n = name.toUpperCase()
  if (n.includes('LIQUID'))                                      return 'Liquid'
  if (n.includes('OVERNIGHT'))                                   return 'Overnight'
  if (n.includes('ULTRA SHORT'))                                 return 'Ultra Short Duration'
  if (n.includes('LOW DURATION'))                                return 'Low Duration'
  if (n.includes('SHORT DURATION') || n.includes('SHORT TERM')) return 'Short Duration'
  if (n.includes('MEDIUM DURATION'))                             return 'Medium Duration'
  if (n.includes('LONG DURATION'))                               return 'Long Duration'
  if (n.includes('GILT'))                                        return 'Gilt'
  if (n.includes('CREDIT RISK'))                                 return 'Credit Risk'
  if (n.includes('CORPORATE BOND'))                              return 'Corporate Bond'
  if (n.includes('BANKING AND PSU') || n.includes('BANKING & PSU')) return 'Banking and PSU'
  if (n.includes('DYNAMIC BOND'))                                return 'Dynamic Bond'
  if (n.includes('FLOATER'))                                     return 'Floater'
  if (n.includes('MONEY MARKET'))                                return 'Money Market'
  if (n.includes('ARBITRAGE'))                                   return 'Arbitrage'
  if (n.includes('EQUITY SAVINGS'))                              return 'Equity Savings'
  if (n.includes('BALANCED ADVANTAGE') || n.includes('DYNAMIC ASSET')) return 'Balanced Advantage'
  if (n.includes('AGGRESSIVE HYBRID'))                           return 'Aggressive Hybrid'
  if (n.includes('CONSERVATIVE HYBRID'))                         return 'Conservative Hybrid'
  if (n.includes('MULTI ASSET'))                                 return 'Multi Asset Allocation'
  if (n.includes('ELSS') || n.includes('TAX SAVER') || n.includes('TAX SAVING')) return 'ELSS'
  if (n.includes('INDEX') || n.includes('NIFTY') || n.includes('SENSEX') || n.includes('BSE')) return 'Index Fund'
  if (n.includes('ETF'))                                         return 'ETF'
  if (n.includes('FUND OF FUND') || n.includes('FOF'))          return 'Fund of Funds'
  if (n.includes('INTERNATIONAL') || n.includes('GLOBAL') || n.includes('OVERSEAS')) return 'International'
  if (n.includes('GOLD'))                                        return 'Gold'
  if (n.includes('SMALL CAP'))                                   return 'Small Cap'
  if (n.includes('MID CAP') || n.includes('MIDCAP'))            return 'Mid Cap'
  if (n.includes('LARGE CAP') || n.includes('LARGECAP'))        return 'Large Cap'
  if (n.includes('LARGE & MID') || n.includes('LARGE AND MID')) return 'Large & Mid Cap'
  if (n.includes('MULTI CAP') || n.includes('MULTICAP'))        return 'Multi Cap'
  if (n.includes('FLEXI CAP') || n.includes('FLEXICAP'))        return 'Flexi Cap'
  if (n.includes('FOCUSED'))                                     return 'Focused'
  if (n.includes('VALUE') || n.includes('CONTRA'))              return 'Value/Contra'
  if (n.includes('THEMATIC') || n.includes('SECTORAL'))         return 'Thematic/Sectoral'
  return 'Other'
}

function progressBar(current: number, total: number, width = 40): string {
  const pct    = current / total
  const filled = Math.round(width * pct)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${String(current).padStart(4)}/${total} (${Math.round(pct * 100)}%)`
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   MF Platform — ENGINE 1: SYNC SCHEMES              ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  Started : ${new Date().toLocaleString('en-IN')}\n`)

  console.log('  📡 Fetching scheme list from mfapi.in...')
  const res = await fetch(MFAPI)
  if (!res.ok) throw new Error(`mfapi failed: ${res.status}`)
  const all: { schemeCode: number; schemeName: string }[] = await res.json()
  console.log(`  Total from API : ${all.length}`)

  const filtered = all.filter(s => shouldInclude(s.schemeName))
  const removed  = all.length - filtered.length
  console.log(`  Removed        : ${removed} (Direct / IDCW / Dividend)`)
  console.log(`  Keeping        : ${filtered.length}\n`)

  const records = filtered.map(s => ({
    scheme_code:  s.schemeCode,
    scheme_name:  s.schemeName,
    amc:          extractAmc(s.schemeName),
    category:     extractCategory(s.schemeName),
    plan_type:    detectPlanType(s.schemeName),
    option_type:  detectOptionType(s.schemeName),
    is_active:    true,
  }))

  console.log('  📥 Upserting into Supabase...\n')
  let done = 0
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = records.slice(i, i + CHUNK)
    const { error } = await supabase.from('schemes').upsert(batch, { onConflict: 'scheme_code' })
    if (error) throw error
    done += batch.length
    process.stdout.write(`\r  ${progressBar(done, records.length)}`)
  }

  console.log('\n\n╔══════════════════════════════════════════════════════╗')
  console.log('║  SCHEME SYNC COMPLETE                                ║')
  console.log(`║  Upserted : ${String(records.length).padEnd(42)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('\n  ✅ Run "npm run mf:nav" next.\n')
}

main().catch(e => { console.error('\n  FATAL:', e.message); process.exit(1) })
