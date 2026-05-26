#!/usr/bin/env npx tsx
/**
 * ENGINE 2: SYNC NAV
 * ─────────────────────────────────────────────────────────────────
 * Run: npm run mf:nav          ← full history (first time, ~2-4 hrs)
 *      npm run mf:nav:today    ← only today's NAV (daily cron, ~10 min)
 *
 * Uses a `nav_sync_log` tracker to know the latest stored date per run.
 * Running twice on the same day = 0 new inserts. Completely safe.
 * Duplicate safety: upsert on (scheme_code, nav_date).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MFAPI_SCHEME = 'https://api.mfapi.in/mf'
const DELAY        = 100   // ms between requests — polite to mfapi
const CHUNK        = 1000
const TODAY_ONLY   = process.argv.includes('--today')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function parseDate(s: string): string {
  // mfapi returns DD-MM-YYYY → convert to YYYY-MM-DD
  const [d, m, y] = s.split('-')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function progressBar(current: number, total: number, width = 40): string {
  const pct    = current / total
  const filled = Math.round(width * pct)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${String(current).padStart(4)}/${total} (${Math.round(pct * 100)}%)`
}

// ── Fetch and store one scheme ─────────────────────────────────────────────────

async function syncScheme(
  code: number,
  latestInDB: string | null
): Promise<{ status: 'new' | 'no_new' | 'error'; newNavs: number }> {
  try {
    const res = await fetch(`${MFAPI_SCHEME}/${code}`)
    if (!res.ok) return { status: 'error', newNavs: 0 }

    const json = await res.json()
    if (json.status !== 'SUCCESS' || !json.data?.length)
      return { status: 'error', newNavs: 0 }

    const allRows: { scheme_code: number; nav_date: string; nav: number }[] = json.data
      .map((r: any) => ({
        scheme_code: code,
        nav_date:    parseDate(r.date),
        nav:         parseFloat(r.nav),
      }))
      .filter((r: any) => r.nav > 0)

    if (!allRows.length) return { status: 'no_new', newNavs: 0 }

    // Only insert rows newer than what we already have
    let newRows = latestInDB
      ? allRows.filter(r => r.nav_date > latestInDB)
      : allRows

    // --today mode: only today's date
    if (TODAY_ONLY) {
      const today = todayStr()
      newRows = allRows.filter(r => r.nav_date >= today)
    }

    if (!newRows.length) return { status: 'no_new', newNavs: 0 }

    let inserted = 0
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const batch = newRows.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('nav_history')
        .upsert(batch, { onConflict: 'scheme_code,nav_date', ignoreDuplicates: true } as any)
      if (!error) inserted += batch.length
    }

    return { status: 'new', newNavs: inserted }
  } catch {
    return { status: 'error', newNavs: 0 }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const mode = TODAY_ONLY ? "today's NAV only" : 'full history'
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   MF Platform — ENGINE 2: SYNC NAV                  ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  Mode    : ${mode}`)
  console.log(`  Started : ${new Date().toLocaleString('en-IN')}\n`)

  // Load all active scheme codes
  const { data: schemes, error: se } = await supabase
    .from('schemes')
    .select('scheme_code')
    .eq('is_active', true)

  if (se || !schemes?.length) {
    console.error('  No schemes in DB. Run "npm run mf:schemes" first.')
    process.exit(1)
  }

  const codes = schemes.map(s => s.scheme_code)
  console.log(`  Schemes : ${codes.length}\n`)

  // Log sync start
  const { data: log } = await supabase
    .from('nav_sync_log')
    .insert({ sync_date: todayStr(), status: 'running' })
    .select('id').single()
  const logId = log?.id

  // Load latest stored date for every scheme (to skip already-stored rows)
  // Uses the most recent nav_date already in nav_history per scheme
  console.log('  Loading latest stored dates per scheme...')
  const { data: latestRows } = await supabase
    .from('nav_history')
    .select('scheme_code, nav_date')
    .in('scheme_code', codes)
    .order('nav_date', { ascending: false })

  const latestMap: Record<number, string> = {}
  if (latestRows) {
    for (const row of latestRows) {
      if (!latestMap[row.scheme_code]) {
        latestMap[row.scheme_code] = row.nav_date
      }
    }
  }
  console.log(`  Found existing data for ${Object.keys(latestMap).length} schemes\n`)

  const startTime = Date.now()
  let synced = 0; let noNew = 0; let errors = 0; let totalNavRows = 0

  for (let i = 0; i < codes.length; i++) {
    const code     = codes[i]
    const latestDB = latestMap[code] ?? null

    const result = await syncScheme(code, latestDB)

    if (result.status === 'new')    { synced++;  totalNavRows += result.newNavs }
    else if (result.status === 'no_new') noNew++
    else errors++

    process.stdout.write(`\r  ${progressBar(i + 1, codes.length)}  +${totalNavRows.toLocaleString()} rows`)
    await sleep(DELAY)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)

  console.log('\n\n╔══════════════════════════════════════════════════════╗')
  console.log('║  NAV SYNC COMPLETE                                   ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  Schemes with new data : ${String(synced).padEnd(28)}║`)
  console.log(`║  Already up to date    : ${String(noNew).padEnd(28)}║`)
  console.log(`║  NAV rows inserted     : ${String(totalNavRows.toLocaleString()).padEnd(28)}║`)
  console.log(`║  Errors                : ${String(errors).padEnd(28)}║`)
  console.log(`║  Time elapsed          : ${String(elapsed + 's').padEnd(28)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')

  if (totalNavRows === 0) {
    console.log('\n  ℹ️  No new data. Normal if:')
    console.log('     • Already ran today (up to date)')
    console.log('     • Market holiday or weekend')
    console.log('     • NAVs not yet published by AMCs\n')
  } else {
    console.log(`\n  ✅ ${totalNavRows.toLocaleString()} rows stored.`)
    console.log('     Run "npm run mf:compute" next.\n')
  }

  // Update sync log
  if (logId) {
    await supabase.from('nav_sync_log').update({
      status:         errors > 0 ? 'completed' : 'completed',
      schemes_synced: synced,
      schemes_failed: errors,
      nav_rows_added: totalNavRows,
      completed_at:   new Date().toISOString(),
    }).eq('id', logId)
  }
}

main().catch(e => { console.error('\n  FATAL:', e.message); process.exit(1) })
