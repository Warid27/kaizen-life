import { useState, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useTransactions,
  useMonthlySummary,
  useCreateTransaction,
  type TransactionFilter,
  type Transaction,
} from '@/queries/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCents,
  formatCentsCompact,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '@/lib/currency';
import type { Currency } from '@kaizenlife/shared';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TransactionType = Transaction['type'];
type AccountKind = Transaction['account'];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Housing',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health',
  'Education',
  'Subscriptions',
  'Other',
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Side Project',
  'Gift',
  'Other',
];

// ─── Default export ───────────────────────────────────────────────────────────

export default function FinanceApp() {
  return (
    <QueryProvider>
      <FinanceContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function FinanceContent() {
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formError, setFormError] = useState<string | null>(null);
  const month = currentMonth();

  // BL13/F4: filters now map to the API's real `from`/`to` params.
  const filters: TransactionFilter = useMemo(() => {
    const f: TransactionFilter = {};
    if (filterType) f.type = filterType;
    if (from) f.from = from;
    if (to) f.to = to;
    return f;
  }, [filterType, from, to]);

  const {
    data: transactions,
    isPending: txPending,
    error: txError,
    refetch: txRefetch,
  } = useTransactions(filters);
  const {
    data: summary,
    isPending: summaryPending,
    error: summaryError,
    refetch: summaryRefetch,
  } = useMonthlySummary(month);
  const createMut = useCreateTransaction();

  // Currency shown in charts: first key present in dailyBalance, else 'idr'.
  const [selectedCcy, setSelectedCcy] = useState<string>('');
  const dailyByCcy = useMemo(
    () => summary?.dailyBalance ?? {},
    [summary],
  );
  const availableCcys = useMemo(
    () => Object.keys(dailyByCcy),
    [dailyByCcy],
  );
  const effectiveCcy = availableCcys.includes(selectedCcy)
    ? selectedCcy
    : (availableCcys[0] ?? DEFAULT_CURRENCY);

  const openAddForm = (type: TransactionType) => {
    setFormType(type);
    setFormError(null);
    setFormOpen(true);
  };

  const handleCreate = (data: {
    amountCents: number;
    currency: Currency;
    category: string;
    account: AccountKind;
    note: string;
    date: string;
  }) => {
    setFormError(null);
    createMut.mutate(
      {
        date: data.date,
        type: formType,
        amountCents: data.amountCents,
        currency: data.currency,
        category: data.category,
        account: data.account,
        note: data.note,
      },
      {
        onSuccess: () => {
          setFormOpen(false);
          toast.success(formType === 'income' ? 'Income added' : 'Expense added');
        },
        onError: (err) => {
          setFormError(
            err instanceof Error && err.message
              ? err.message
              : 'Failed to save transaction. Please try again.',
          );
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Track your income and expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openAddForm('income')} size="sm" variant="outline">
            <ArrowUpRight className="mr-1.5 h-4 w-4 text-emerald-600" />
            +Income
          </Button>
          <Button onClick={() => openAddForm('expense')} size="sm">
            <ArrowDownRight className="mr-1.5 h-4 w-4" />
            +Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summaryError ? (
        <ErrorCard message={summaryError.message} onRetry={() => summaryRefetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Income"
            value={formatCents(summary?.incomeCents ?? 0, summary?.primaryCurrency)}
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            trend="up"
          />
          <SummaryCard
            label="Expenses"
            value={formatCents(summary?.expenseCents ?? 0, summary?.primaryCurrency)}
            icon={<TrendingDown className="h-4 w-4 text-destructive" />}
            trend="down"
          />
          <SummaryCard
            label="Net"
            value={formatCents(summary?.netCents ?? 0, summary?.primaryCurrency)}
            icon={<DollarSign className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
            trend={(summary?.netCents ?? 0) >= 0 ? 'up' : 'down'}
            tone="neutral"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
                className="w-32"
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
            {(filterType || from || to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterType('');
                  setFrom('');
                  setTo('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {summaryPending ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="h-[220px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summaryError ? null : (
        <>
          {availableCcys.length > 1 && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Currency</span>
              <Select
                value={effectiveCcy}
                onChange={(e) => setSelectedCcy(e.target.value)}
                className="w-28"
              >
                {availableCcys.map((ccy) => (
                  <option key={ccy} value={ccy}>
                    {ccy.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBarChart
              data={summary?.byCurrency?.[effectiveCcy]?.byCategory ?? []}
              currency={effectiveCcy as Currency}
            />
            <BalanceLineChart
              data={dailyByCcy[effectiveCcy] ?? []}
              currency={effectiveCcy as Currency}
            />
          </div>
        </>
      )}

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Transactions
            {!txPending && !txError && transactions && (
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {transactions.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : txError ? (
            <ErrorCard message={txError.message} onRetry={() => txRefetch()} />
          ) : !transactions || transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet. Add your first transaction above.
            </p>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Add Dialog */}
      <TransactionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormError(null);
        }}
        type={formType}
        onSave={handleCreate}
        isSaving={createMut.isPending}
        error={formError}
      />
    </div>
  );
}

// ─── Error card (F2: honest errors with retry, never demo fallbacks) ─────────

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="h-5 w-5 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  trend,
  tone = 'auto',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend: 'up' | 'down';
  /** Explicit icon tint; defaults to the trend direction. */
  tone?: 'up' | 'down' | 'neutral' | 'auto';
}) {
  const effectiveTone = tone === 'auto' ? trend : tone;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            effectiveTone === 'up'
              ? 'bg-emerald-100 dark:bg-emerald-950'
              : effectiveTone === 'down'
                ? 'bg-red-100 dark:bg-red-950'
                : 'bg-sky-100 dark:bg-sky-950',
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ transaction: tx }: { transaction: Transaction }) {
  const isIncome = tx.type === 'income';
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isIncome
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
        )}
      >
        {isIncome ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {tx.note || tx.category}
        </p>
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {tx.category} &middot; {tx.date}
          <span className="rounded bg-muted px-1 py-0.5 font-medium uppercase">
            {tx.account}
          </span>
        </p>
      </div>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          isIncome ? 'text-emerald-600' : 'text-foreground',
        )}
      >
        {isIncome ? '+' : '-'}{formatCents(tx.amountCents, tx.currency)}
        <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
          {tx.currency}
        </span>
      </span>
    </div>
  );
}

// ─── Category Bar Chart ───────────────────────────────────────────────────────

function CategoryBarChart({
  data,
  currency,
}: {
  data: { category: string; amountCents: number; type: string }[];
  currency: Currency;
}) {
  const expenseData = data.filter((d) => d.type === 'expense');
  const incomeData = data.filter((d) => d.type === 'income');
  const hasData = data.length > 0;

  const chartData = {
    labels: [...expenseData.map((d) => d.category), ...incomeData.map((d) => d.category)],
    datasets: [
      {
        label: 'Expense',
        data: [...expenseData.map((d) => d.amountCents / 100), ...incomeData.map(() => 0)],
        backgroundColor: 'hsl(0, 84%, 60%)',
        borderRadius: 4,
      },
      {
        label: 'Income',
        data: [...expenseData.map(() => 0), ...incomeData.map((d) => d.amountCents / 100)],
        backgroundColor: 'hsl(160, 84%, 39%)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${formatCents(Math.round(ctx.parsed.y * 100), currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: 'hsl(215.4, 16.3%, 46.9%)',
          maxRotation: 45,
        },
      },
      y: {
        grid: { color: 'hsl(214.3, 31.8%, 91.4%)' },
        ticks: {
          font: { size: 10 },
          color: 'hsl(215.4, 16.3%, 46.9%)',
          callback: (v: any) => formatCentsCompact(Math.round(v * 100), currency),
        },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          By Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div style={{ height: 220 }}>
            <Bar data={chartData} options={options} />
          </div>
        ) : (
          <EmptyChart label="No transactions for this currency this month yet." />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Balance Line Chart ───────────────────────────────────────────────────────

function BalanceLineChart({
  data,
  currency,
}: {
  data: { date: string; cumulativeNetCents: number }[];
  currency: Currency;
}) {
  const chartData = {
    labels: data.map((d) => d.date.split('-')[2]),
    datasets: [
      {
        label: 'Cumulative net',
        data: data.map((d) => d.cumulativeNetCents / 100),
        borderColor: 'hsl(222.2, 47.4%, 11.2%)',
        backgroundColor: 'hsla(222.2, 47.4%, 11.2%, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `Balance: ${formatCents(Math.round(ctx.parsed.y * 100), currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: 'hsl(215.4, 16.3%, 46.9%)',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: { color: 'hsl(214.3, 31.8%, 91.4%)' },
        ticks: {
          font: { size: 10 },
          color: 'hsl(215.4, 16.3%, 46.9%)',
          callback: (v: any) => formatCentsCompact(Math.round(v * 100), currency),
        },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          Balance Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div style={{ height: 220 }}>
            <Line data={chartData} options={options} />
          </div>
        ) : (
          <EmptyChart label="No balance data for this currency this month yet." />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Empty chart placeholder ──────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border">
      <p className="px-4 text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Transaction Form Dialog ──────────────────────────────────────────────────

function TransactionFormDialog({
  open,
  onOpenChange,
  type,
  onSave,
  isSaving,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TransactionType;
  onSave: (data: {
    amountCents: number;
    currency: Currency;
    category: string;
    account: AccountKind;
    note: string;
    date: string;
  }) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState<AccountKind>('cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setAmount('');
      setCurrency(DEFAULT_CURRENCY);
      setCategory(categories[0]);
      setAccount('cash');
      setNote('');
      setDate(todayStr());
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    onSave({
      amountCents: Math.round(parsed * 100),
      currency,
      category,
      account,
      note: note.trim(),
      date,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>
            {type === 'income' ? 'Add Income' : 'Add Expense'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Amount</Label>
            <div className="flex gap-2">
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              <Select
                id="tx-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-44 shrink-0"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-category">Category</Label>
              <Select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-account">Account</Label>
              <Select
                id="tx-account"
                value={account}
                onChange={(e) => setAccount(e.target.value as AccountKind)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-note">Note</Label>
            <Input
              id="tx-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was this for?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !amount}>
              {isSaving ? 'Saving...' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
