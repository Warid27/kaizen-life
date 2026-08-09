import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amountCents: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface CreateTransaction {
  type: TransactionType;
  amountCents: number;
  category: string;
  description: string;
  date: string;
}

export interface TransactionFilter {
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  byCategory: { category: string; amountCents: number; type: TransactionType }[];
  dailyBalance: { date: string; balanceCents: number }[];
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

/** Get monthly summary with category breakdown and daily balance */
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

/** Create a new transaction */
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
