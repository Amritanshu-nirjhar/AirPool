// Waitlist storage on SQLite (built into Node 22, no extra dependency). Pure functions over a DatabaseSync handle
// so the API route uses a file and the test uses :memory:.
// ponytail: single-file SQLite on the app server; swap for Postgres (Supabase/Neon) before serverless hosting.
import type { DatabaseSync } from "node:sqlite";
import type { Signup } from "./waitlist.ts";

export function migrate(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    area TEXT NOT NULL,
    frequency TEXT NOT NULL,
    arrival TEXT NOT NULL,
    at TEXT NOT NULL
  )`);
}

/** Insert once per email. Position = rank by signup order. */
export function addSignup(db: DatabaseSync, s: Signup, at = new Date().toISOString()): { position: number; existing: boolean } {
  const r = db.prepare("INSERT OR IGNORE INTO waitlist (email, area, frequency, arrival, at) VALUES (?, ?, ?, ?, ?)").run(s.email, s.area, s.frequency, s.arrival, at);
  const row = db.prepare("SELECT id FROM waitlist WHERE email = ?").get(s.email) as { id: number };
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE id <= ?").get(row.id) as { n: number };
  return { position: n, existing: r.changes === 0 };
}

export interface Summary {
  total: number;
  byArea: { k: string; n: number }[];
  byArrival: { k: string; n: number }[];
  byFrequency: { k: string; n: number }[];
  recent: { email: string; area: string; frequency: string; arrival: string; at: string }[];
}

export function summary(db: DatabaseSync, recent = 50): Summary {
  const group = (col: "area" | "arrival" | "frequency") =>
    db.prepare(`SELECT ${col} AS k, COUNT(*) AS n FROM waitlist GROUP BY ${col} ORDER BY n DESC`).all() as { k: string; n: number }[];
  return {
    total: (db.prepare("SELECT COUNT(*) AS n FROM waitlist").get() as { n: number }).n,
    byArea: group("area"),
    byArrival: group("arrival"),
    byFrequency: group("frequency"),
    recent: db.prepare("SELECT email, area, frequency, arrival, at FROM waitlist ORDER BY id DESC LIMIT ?").all(recent) as Summary["recent"],
  };
}

export function allRows(db: DatabaseSync) {
  return db.prepare("SELECT id, email, area, frequency, arrival, at FROM waitlist ORDER BY id").all() as Record<string, string | number>[];
}
