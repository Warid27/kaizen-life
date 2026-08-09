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
} from "@kaizenlife/shared";

const transactionsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ---------------------------------------------------------------------------
// GET /transactions — list transactions with optional filters
// ---------------------------------------------------------------------------
transactionsRouter.get(
  "/transactions",
  zValidator("query", TransactionQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const { from, to, type, category, account } = c.req.valid("query");

    const conditions = [
      eq(transactions.userId, USER_ID),
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
      .all();

    return c.json(rows);
  },
);

// ---------------------------------------------------------------------------
// GET /finance/summary?month=YYYY-MM — compute total income, expense, net,
// and breakdown by category
// ---------------------------------------------------------------------------
transactionsRouter.get(
  "/finance/summary",
  zValidator("query", FinanceSummarySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const { month } = c.req.valid("query");

    // Derive month range: YYYY-MM-01 → YYYY-MM-lastDay
    const [yearStr, monStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monStr, 10);
    const lastDay = new Date(year, mon, 0).getDate();
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const rows = await db
      .select({
        type: transactions.type,
        amountCents: transactions.amountCents,
        category: transactions.category,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, USER_ID),
          isNull(transactions.deletedAt),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
        ),
      )
      .all();

    let incomeCents = 0;
    let expenseCents = 0;
    const byCategory: Record<string, { incomeCents: number; expenseCents: number }> = {};

    for (const tx of rows) {
      if (tx.type === "income") {
        incomeCents += tx.amountCents;
      } else {
        expenseCents += tx.amountCents;
      }

      if (!byCategory[tx.category]) {
        byCategory[tx.category] = { incomeCents: 0, expenseCents: 0 };
      }
      if (tx.type === "income") {
        byCategory[tx.category].incomeCents += tx.amountCents;
      } else {
        byCategory[tx.category].expenseCents += tx.amountCents;
      }
    }

    return c.json({
      month,
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      transactionCount: rows.length,
      byCategory,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /transactions/:id — get single transaction
// ---------------------------------------------------------------------------
transactionsRouter.get("/transactions/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, USER_ID),
        isNull(transactions.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  return c.json(row);
});

// ---------------------------------------------------------------------------
// POST /transactions — create a new transaction
// ---------------------------------------------------------------------------
transactionsRouter.post(
  "/transactions",
  zValidator("json", CreateTransactionSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(transactions)
      .values({
        id,
        userId: USER_ID,
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
  zValidator("json", UpdateTransactionSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Verify ownership
    const existing = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, USER_ID),
          isNull(transactions.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    const updated = await db
      .update(transactions)
      .set({ ...body, updatedAt: now })
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, USER_ID),
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
  const id = c.req.param("id");
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, USER_ID),
        isNull(transactions.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  await db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(transactions.id, id), eq(transactions.userId, USER_ID)))
    .run();

  return c.json({ success: true });
});

export default transactionsRouter;
