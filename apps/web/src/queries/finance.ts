import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api-client';
import type {
  CreateTransactionInput,
  TransactionQuery,
  Currency,
} from '@kaizenlife/shared';

// ─── Types (derived from the shared package — A3: no more hand mirrors) ──────

/** Row shape returned by GET /api/transactions (DB row via Drizzle). */
export interface Transaction {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amountCents: number;
  currency: Currency;
  category: string;
  account: 'cash' | 'bank';
  note: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type CreateTransaction = CreateTransactionInput;

/** List filters — param names match the API exactly (from/to, BL13). */
export type TransactionFilter = Pick<TransactionQuery, 'from' | 'to' | 'type' | 'category' | 'account'>;

export interface DailyBalancePoint {
  date: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  cumulativeNetCents: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  primaryCurrency: Currency;
  currencies: string[];
  byCurrency: Record<
    string,
    {
      incomeCents: number;
      expenseCents: number;
      transactionCount: number;
      byCategory: { category: string; amountCents: number; type: 'income' | 'expense' }[];
    }
  >;
  /** Per-currency daily series (BL11/F1: previously missing → page crashed). */
  dailyBalance: Record<string, DailyBalancePoint[]>;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  transactionCount: number;
  byCategory: { category: string; amountCents: number; type: Transaction['type'] }[];
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const financeKeys = {
  all: ['finance'] as const,
  transactions: () => [...financeKeys.all, 'transactions'] as const,
  transactionList: (filters?: TransactionFilter) =>
    [...financeKeys.transactions(), filters] as const,
  monthlySummary: (month: string) =>
    [...financeKeys.all, 'monthly', month] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List transactions with optional filters */
export function useTransactions(filters?: TransactionFilter) {
  return useQuery({
    queryKey: financeKeys.transactionList(filters),
    queryFn: ({ signal }) =>
      apiGet<Transaction[]>(
        '/api/transactions',
        filters as Record<string, string | undefined>,
        signal,
      ),
    staleTime: 60_000,
  });
}

/** Get monthly summary with category breakdown and per-currency daily balance */
export function useMonthlySummary(month: string) {
  return useQuery({
    queryKey: financeKeys.monthlySummary(month),
    queryFn: ({ signal }) =>
      apiGet<MonthlySummary>(
        `/api/finance/summary?month=${month}`,
        undefined,
        signal,
      ),
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create a new transaction (requires `account`; body field is `note`) */
export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransaction) =>
      apiPost<Transaction>('/api/transactions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
