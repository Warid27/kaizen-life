import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Bindings, AppDb } from "../db/client";
import transactionsRouter from "./transactions";

const DDL = [
  `CREATE TABLE transactions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    date text NOT NULL,
    type text NOT NULL,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'idr' NOT NULL,
    category text NOT NULL,
    account text NOT NULL,
    note text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
];

function createTestApp(): { app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  for (const ddl of DDL) sqlite.exec(ddl);
  const db = drizzle(sqlite) as unknown as AppDb;
  const app = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("userId", "u1");
    await next();
  });
  app.route("/", transactionsRouter);
  return { app, sqlite };
}

const VALID_INCOME = {
  date: "2026-08-20",
  type: "income",
  amountCents: 150_000,
  currency: "idr",
  category: "Salary",
  account: "bank",
  note: "aug salary",
};

describe("POST /transactions", () => {
  let app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ app, sqlite } = createTestApp());
  });

  it("returns a unified VALIDATION_ERROR envelope when account is missing", async () => {
    const { account: _account, ...missingAccount } = VALID_INCOME;

    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(missingAccount),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(typeof json.error.message).toBe("string");

    const count = sqlite.prepare("SELECT COUNT(*) AS n FROM transactions").get() as { n: number };
    expect(count.n).toBe(0);
  });

  it("creates an income transaction and echoes the row", async () => {
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_INCOME),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      id: string;
      userId: string;
      account: string;
      note: string | null;
      amountCents: number;
      currency: string;
      type: string;
    };
    expect(json.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.userId).toBe("u1");
    expect(json.account).toBe("bank");
    expect(json.note).toBe("aug salary");
    expect(json.amountCents).toBe(150_000);
    expect(json.currency).toBe("idr");
    expect(json.type).toBe("income");

    const rows = sqlite.prepare("SELECT * FROM transactions").all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.account).toBe("bank");
  });
});

describe("GET /finance/summary", () => {
  let app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("includes per-currency dailyBalance with cumulative net", async () => {
    await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_INCOME),
    });
    await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...VALID_INCOME,
        type: "expense",
        category: "Food",
        amountCents: 50_000,
        date: "2026-08-21",
      }),
    });

    const res = await app.request("/finance/summary?month=2026-08");
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      month: string;
      dailyBalance: Record<string, Array<{ date: string; incomeCents: number; expenseCents: number; netCents: number; cumulativeNetCents: number }>>;
      incomeCents: number;
      expenseCents: number;
      netCents: number;
    };

    expect(json.month).toBe("2026-08");
    expect(json.incomeCents).toBe(150_000);
    expect(json.expenseCents).toBe(50_000);
    expect(json.netCents).toBe(100_000);

    expect(json.dailyBalance).toBeDefined();
    expect(typeof json.dailyBalance).toBe("object");

    const idrDays = json.dailyBalance.idr ?? [];
    expect(idrDays.length).toBeGreaterThan(0);
    expect(idrDays[idrDays.length - 1]?.cumulativeNetCents).toBe(100_000);
    expect(idrDays[0]?.incomeCents).toBe(150_000);
  });
});
