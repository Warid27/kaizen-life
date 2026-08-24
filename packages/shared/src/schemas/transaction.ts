import { z } from "zod";

// ─── Currencies ──────────────────────────────────────────────────────────────
export const CURRENCIES = ["idr", "usd", "eur", "sgd", "myr", "jpy"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "idr";

// ─── Create Transaction ─────────────────────────────────────────────────────
export const CreateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  type: z.enum(["income", "expense"]),
  amountCents: z.number().int().min(0, "Amount must be non-negative"),
  currency: z.enum(CURRENCIES).default(DEFAULT_CURRENCY),
  category: z.string().min(1, "Category is required"),
  account: z.enum(["cash", "bank"]),
  note: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

// ─── Update Transaction ─────────────────────────────────────────────────────
export const UpdateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  type: z.enum(["income", "expense"]).optional(),
  amountCents: z.number().int().min(0, "Amount must be non-negative").optional(),
  currency: z.enum(CURRENCIES).optional(),
  category: z.string().min(1).optional(),
  account: z.enum(["cash", "bank"]).optional(),
  note: z.string().optional(),
});

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

// ─── Transaction Query (list filter) ────────────────────────────────────────
export const TransactionQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().optional(),
  account: z.enum(["cash", "bank"]).optional(),
  // Server-side pagination cap (P2): lists used to return the entire table.
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

// ─── Finance Summary Query ──────────────────────────────────────────────────
export const FinanceSummarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
});

export type FinanceSummaryQuery = z.infer<typeof FinanceSummarySchema>;
