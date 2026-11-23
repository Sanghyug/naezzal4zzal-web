import { initialState } from "./domain.ts";
import type { State } from "./domain.ts";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export interface Store {
  tx<T>(fn: (s: State) => T): Promise<T>;
}
// One locked launch state per environment serializes gifts, cross-account invites,
// credit reservations and refund races. External network calls never hold this lock.
// Intended for the initial 100-account release; migrate projections before scaling.
export async function sqliteStore(file: string): Promise<Store> {
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS launch_state (id INTEGER PRIMARY KEY, body TEXT NOT NULL);",
  );
  db.prepare("INSERT OR IGNORE INTO launch_state VALUES (1,?)").run(
    JSON.stringify(initialState()),
  );
  return {
    async tx(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = db
          .prepare("SELECT body FROM launch_state WHERE id=1")
          .get() as { body: string };
        const s = JSON.parse(row.body) as State;
        const value = fn(s);
        assertState(s);
        db.prepare("UPDATE launch_state SET body=? WHERE id=1").run(
          JSON.stringify(s),
        );
        db.exec("COMMIT");
        return value;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
export async function postgresStore(
  url: string,
  namespace: string,
): Promise<Store> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  return {
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(
          "INSERT INTO public.launch_state(namespace,body) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [namespace, initialState()],
        );
        const { rows } = await c.query(
          "SELECT body FROM public.launch_state WHERE namespace=$1 FOR UPDATE",
          [namespace],
        );
        const s = rows[0].body as State;
        const before = s.entries.length;
        const result = fn(s);
        assertState(s);
        await c.query(
          "UPDATE public.launch_state SET body=$2, updated_at=now() WHERE namespace=$1",
          [namespace, s],
        );
        for (const e of s.entries.slice(before))
          await c.query(
            "INSERT INTO public.launch_audit(namespace,event_id,user_id,kind,cause,event) VALUES ($1,$2,$3,$4,$5,$6)",
            [namespace, e.id, e.user, e.kind, e.cause, e],
          );
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
}
export function assertState(s: State) {
  for (const l of Object.values(s.lots))
    if (
      !Number.isSafeInteger(l.remaining) ||
      !Number.isSafeInteger(l.reserved) ||
      l.remaining < 0 ||
      l.reserved < 0 ||
      l.reserved > l.remaining
    )
      throw new Error("Invalid credit ledger");
}
