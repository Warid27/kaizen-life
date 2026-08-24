import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import { transactions } from "../db/schema";
import { eq, and, isNull, gte, lte, asc } from "drizzle-orm";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  TransactionQuerySchema,
  FinanceSummarySchema,
  DEFAULT_CURRENCY,
} from "@kaizenlife/shared";
import { apiError, notFound, validationHook } from "../lib/api";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const transactionsRouter = new Hono<RouteEnv>();

const DEFAULT_LIST_LIMIT = 200;

// ---------------------------------------------------------------------------
// GET /transactions — list transactions with optional filters + limit
// ---------------------------------------------------------------------------
transactionsRouter.get(
  "/transactions",
  zValidator("query", TransactionQuerySchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const { from, to, type, category, account, limit } = c.req.valid("query");

    const conditions = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ];
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));
    if (type) conditions.push(eq(transactions.type, type));
    if (category) conditions.push(eq(transactions.category, category));
    if (account) conditions.push(eq(transactions.account, account));

    const rows = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(asc(transactions.date))
      .limit(limit ?? DEFAULT_LIST_LIMIT)
      .all();

    return c.json(rows);
  },
);

// ---------------------------------------------------------------------------
// GET /finance/summary?month=YYYY-MM — compute total income, expense, net,
// breakdown by category, and per-currency daily balance series
// ---------------------------------------------------------------------------
transactionsRouter.get(
  "/finance/summary",
  zValidator("query", FinanceSummarySchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const { month } = c.req.valid("query");

    // Derive month range: YYYY-MM-01 → YYYY-MM-lastDay
    const [yearStr = "", monStr = ""] = month.split("-");
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monStr, 10);
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const rows = await db
      .select({
        date: transactions.date,
        type: transactions.type,
        amountCents: transactions.amountCents,
        currency: transactions.currency,
        category: transactions.category,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
        ),
      )
      .orderBy(asc(transactions.date))
      .all();

    // Aggregate per currency — mixing amounts across currencies is meaningless.
    type CurrencyBucket = {
      incomeCents: number;
      expenseCents: number;
      transactionCount: number;
      byCategory: { category: string; amountCents: number; type: "income" | "expense" }[];
    };
    const byCurrency: Record<string, CurrencyBucket> = {};

    // Daily balance series per currency: income/expense/net per day plus a
    // running net across the month (starts at 0 at the month boundary).
    type DayEntry = {
      date: string;
      incomeCents: number;
      expenseCents: number;
      netCents: number;
      cumulativeNetCents: number;
    };
    type DailyBucket = { days: Map<string, DayEntry>; running: number };
    const dailyByCurrency: Record<string, DailyBucket> = {};

    for (const tx of rows) {
      const bucket =
        byCurrency[tx.currency] ??
        (byCurrency[tx.currency] = {
          incomeCents: 0,
          expenseCents: 0,
          transactionCount: 0,
          byCategory: [],
        });
      bucket.transactionCount += 1;

      if (tx.type === "income") {
        bucket.incomeCents += tx.amountCents;
      } else {
        bucket.expenseCents += tx.amountCents;
      }
      bucket.byCategory.push({
        category: tx.category,
        amountCents: tx.amountCents,
        type: tx.type,
      });

      const daily =
        dailyByCurrency[tx.currency] ??
        (dailyByCurrency[tx.currency] = { days: new Map<string, DayEntry>(), running: 0 });
      let day = daily.days.get(tx.date);
      if (!day) {
        day = {
          date: tx.date,
          incomeCents: 0,
          expenseCents: 0,
          netCents: 0,
          cumulativeNetCents: 0,
        };
        daily.days.set(tx.date, day);
      }
      if (tx.type === "income") day.incomeCents += tx.amountCents;
      else day.expenseCents += tx.amountCents;
      day.netCents = day.incomeCents - day.expenseCents;
    }

    // Fold running totals after all rows are aggregated.
    const dailyBalance: Record<string, DayEntry[]> = {};
    for (const [currency, daily] of Object.entries(dailyByCurrency)) {
      const days = [...daily.days.values()].sort((a, b) => a.date.localeCompare(b.date));
      let running = 0;
      for (const day of days) {
        running += day.netCents;
        day.cumulativeNetCents = running;
      }
      dailyBalance[currency] = days;
    }

    // Flat fields mirror the primary currency for backwards compatibility.
    const primary = byCurrency[DEFAULT_CURRENCY] ?? Object.values(byCurrency)[0] ?? {
      incomeCents: 0,
      expenseCents: 0,
      transactionCount: 0,
      byCategory: [],
    };

    return c.json({
      month,
      primaryCurrency: DEFAULT_CURRENCY,
      currencies: Object.keys(byCurrency),
      byCurrency,
      dailyBalance,
      incomeCents: primary.incomeCents,
      expenseCents: primary.expenseCents,
      netCents: primary.incomeCents - primary.expenseCents,
      transactionCount: primary.transactionCount,
      byCategory: primary.byCategory,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /transactions/:id — get single transaction
// ---------------------------------------------------------------------------
transactionsRouter.get("/transactions/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return notFound(c, "Transaction");
  }

  return c.json(row);
});

// ---------------------------------------------------------------------------
// POST /transactions — create a new transaction
// ---------------------------------------------------------------------------
transactionsRouter.post(
  "/transactions",
  zValidator("json", CreateTransactionSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(transactions)
      .values({
        id,
        userId,
        ...body,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /transactions/:id — update a transaction
// ---------------------------------------------------------------------------
transactionsRouter.patch(
  "/transactions/:id",
  zValidator("json", UpdateTransactionSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Verify ownership
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Transaction");
    }

    // Guards kept in the write itself (B5): never filter by id alone.
    const updated = await db
      .update(transactions)
      .set({ ...body, updatedAt: now })
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .returning()
      .get();

    return c.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /transactions/:id — soft delete a transaction
// ---------------------------------------------------------------------------
transactionsRouter.delete("/transactions/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .returning({ id: transactions.id })
    .run();

  if (!result.success || result.meta.changes === 0) {
    return apiError(c, 404, "NOT_FOUND", "Transaction not found");
  }

  return c.json({ success: true });
});

export default transactionsRouter;
