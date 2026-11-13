import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * Keeps the mock repositories' data across server restarts by saving each one
 * as a JSON snapshot in a SQLite file (default `data/acuris.db`).
 *
 * This is a stand-in until the real backend exists: the repository interfaces
 * do not change, so a real database simply replaces the mocks that call this.
 *
 * - Needs a disk that persists (your own server, a dedicated or self-hosted
 *   install). On read-only or serverless hosting it quietly falls back to memory.
 * - Off while testing, so tests never touch the file. Turn it on or off with
 *   ACURIS_PERSIST=on|off, and move the file with ACURIS_DATA_DIR.
 * - node:sqlite is loaded lazily with process.getBuiltinModule so neither the
 *   bundler nor the test runner has to resolve it.
 */

type Db = DatabaseSync;
const g = globalThis as unknown as { __acurisDb?: { path: string; db: Db | null } };

const enabled = () => process.env.ACURIS_PERSIST === "on" || (process.env.ACURIS_PERSIST !== "off" && process.env.NODE_ENV !== "test");
const filePath = () => resolve(process.env.ACURIS_DATA_DIR ?? "data", "acuris.db");

let warned = false;
function giveUp(error: unknown): null {
  if (!warned) {
    warned = true;
    console.warn(`[acuris] Could not use the data file; data stays in memory only. ${error instanceof Error ? error.message : String(error)}`);
  }
  return null;
}

function open(): Db | null {
  if (!enabled()) return null;
  const path = filePath();
  // A different file (another test, a moved data dir) means a fresh connection.
  if (g.__acurisDb && g.__acurisDb.path === path) return g.__acurisDb.db;
  g.__acurisDb?.db?.close();
  try {
    const sqlite = process.getBuiltinModule("node:sqlite");
    if (!sqlite) throw new Error("This Node.js version has no node:sqlite (use Node 22.5 or newer).");
    mkdirSync(dirname(path), { recursive: true });
    const db = new sqlite.DatabaseSync(path);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL)");
    g.__acurisDb = { path, db };
    return db;
  } catch (e) {
    g.__acurisDb = { path, db: null };
    return giveUp(e);
  }
}

/** The saved value for `key`, or undefined when nothing was saved (or persistence is off). */
export function loadSnapshot<T>(key: string): T | undefined {
  const db = open();
  if (!db) return undefined;
  try {
    const row = db.prepare("SELECT json FROM snapshots WHERE key = ?").get(key) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as T) : undefined;
  } catch (e) {
    giveUp(e);
    return undefined;
  }
}

/** Saves `value` under `key`. Never throws: a failed save must not break the action that caused it. */
export function saveSnapshot(key: string, value: unknown): void {
  const db = open();
  if (!db) return;
  try {
    db.prepare("INSERT INTO snapshots (key, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at").run(
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  } catch (e) {
    giveUp(e);
  }
}
