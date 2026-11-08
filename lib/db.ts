// One SQLite connection per server process, created on first use at data/airpool.db (gitignored).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./waitlist-store";

let db: DatabaseSync | null = null;
export function getDb() {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, "airpool.db"));
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}
