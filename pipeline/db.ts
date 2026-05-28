/**
 * pipeline/db.ts
 * SQLite via sql.js — pure JavaScript, no compiler needed.
 * Single nav.db file stored locally, never goes to Supabase.
 */

import initSqlJs from 'sql.js'
import * as fs from 'fs'
import * as path from 'path'

const DB_PATH = path.resolve(process.cwd(), 'pipeline', 'data', 'nav.db')

export type NavRow = { scheme_code: number; nav_date: string; nav: number }

export async function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  const SQL = await initSqlJs()
  const db  = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database()

  db.run(`
    CREATE TABLE IF NOT EXISTS nav_history (
      scheme_code  INTEGER NOT NULL,
      nav_date     TEXT    NOT NULL,
      nav          REAL    NOT NULL,
      PRIMARY KEY (scheme_code, nav_date)
    );
    CREATE INDEX IF NOT EXISTS idx_scheme ON nav_history(scheme_code);
    CREATE INDEX IF NOT EXISTS idx_date   ON nav_history(nav_date);
  `)

  return db
}

export function saveDb(db: any) {
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

export function getNav(db: any, code: number): NavRow[] {
  const stmt = db.prepare(
    `SELECT scheme_code, nav_date, nav FROM nav_history
     WHERE scheme_code = ? ORDER BY nav_date ASC`
  )
  stmt.bind([code])
  const rows: NavRow[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as any
    rows.push({ scheme_code: r.scheme_code, nav_date: r.nav_date, nav: r.nav })
  }
  stmt.free()
  return rows
}

export function getLatestDates(db: any): Record<number, string> {
  const map: Record<number, string> = {}
  const stmt = db.prepare(
    `SELECT scheme_code, MAX(nav_date) as latest FROM nav_history GROUP BY scheme_code`
  )
  while (stmt.step()) {
    const r = stmt.getAsObject() as any
    map[r.scheme_code] = r.latest
  }
  stmt.free()
  return map
}

export function getAllCodes(db: any): number[] {
  const stmt = db.prepare(
    `SELECT DISTINCT scheme_code FROM nav_history ORDER BY scheme_code`
  )
  const codes: number[] = []
  while (stmt.step()) codes.push((stmt.getAsObject() as any).scheme_code)
  stmt.free()
  return codes
}

export function insertRows(db: any, rows: NavRow[]) {
  db.run('BEGIN')
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO nav_history (scheme_code, nav_date, nav) VALUES (?,?,?)`
  )
  for (const r of rows) stmt.run([r.scheme_code, r.nav_date, r.nav])
  stmt.free()
  db.run('COMMIT')
}
