import { useState, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useTransactions,
  useMonthlySummary,
  useCreateTransaction,
  type TransactionType,
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
import {
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

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

// ─── Demo data (used when API is unavailable) ─────────────────────────────────

function generateDemoTransactions(): Transaction[] {
  const now = new Date();
  const txs: Transaction[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // 2-3 expenses per day
    const expCount = 1 + (i % 3);
    for (let j = 0; j < expCount; j++) {
      txs.push({
        id: `exp-${i}-${j}`,
        type: 'expense',
        amountCents: [850, 1200, 2500, 4500, 680, 1500, 3200][(i + j) % 7] * 100,
        category: EXPENSE_CATEGORIES[(i + j) % EXPENSE_CATEGORIES.length],
        description: ['Lunch', 'Groceries', 'Uber', 'Electric bill', 'Netflix', 'Coffee', 'Gym'][(i + j) % 7],
        date,
        createdAt: date,
      });
    }

    // Income on 1st and 15th
    if (d.getDate() === 1 || d.getDate() === 15) {
      txs.push({
        id: `inc-${i}`,
        type: 'income',
        amountCents: 3500000,
        category: 'Salary',
        description: 'Monthly salary',
        date,
        createdAt: date,
      });
    }
  }
  return txs;
}

function generateDemoSummary(month: string) {
  const daysInMonth = new Date(
    parseInt(month.split('-')[0]),
    parseInt(month.split('-')[1]),
    0,
  ).getDate();

  const byCategory = EXPENSE_CATEGORIES.slice(0, 6).map((cat, i) => ({
    category: cat,
    amountCents: [45000, 28000, 120000, 15000, 12000, 22000][i],
    type: 'expense' as const,
  }));

  byCategory.push({
    category: 'Salary',
    amountCents: 7000000,
    type: 'income' as const,
  });

  const dailyBalance: { date: string; balanceCents: number }[] = [];
  let running = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    if (d === 1 || d === 15) running += 3500000;
    running -= [4500, 2800, 12000, 1500, 1200, 2200][(d - 1) % 6] * 100;
    dailyBalance.push({ date: dateStr, balanceCents: running });
  }

  return {
    month,
    incomeCents: 7000000,
    expenseCents: 2420000,
    netCents: 4580000,
    byCategory,
    dailyBalance,
  };
}

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>('expense');
  const month = currentMonth();

  const filters: TransactionFilter = {};
  if (filterType) filters.type = filterType;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const { data: transactions, isLoading: txLoading } = useTransactions(filters);
  const { data: summary, isLoading: summaryLoading } = useMonthlySummary(month);
  const createMut = useCreateTransaction();

  // Use demo data when API unavailable
  const txList = transactions ?? generateDemoTransactions();
  const summaryData = summary ?? generateDemoSummary(month);

  const totalIncome = summaryData.incomeCents;
  const totalExpense = summaryData.expenseCents;
  const net = summaryData.netCents;

  const openAddForm = (type: TransactionType) => {
    setFormType(type);
    setFormOpen(true);
  };

  const handleCreate = (data: {
    amountCents: number;
    category: string;
    description: string;
    date: string;
  }) => {
    createMut.mutate(
      { ...data, type: formType },
      { onSuccess: () => setFormOpen(false) },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Income"
          value={formatCents(totalIncome)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          trend="up"
        />
        <SummaryCard
          label="Expenses"
          value={formatCents(totalExpense)}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          trend="down"
        />
        <SummaryCard
          label="Net"
          value={formatCents(net)}
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          trend={net >= 0 ? 'up' : 'down'}
        />
      </div>

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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            {(filterType || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterType('');
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBarChart data={summaryData.byCategory} />
        <BalanceLineChart data={summaryData.dailyBalance} />
      </div>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Transactions
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {txList.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : txList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions found. Add your first transaction above.
            </p>
          ) : (
            <div className="space-y-1">
              {txList.slice(0, 50).map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Add Dialog */}
      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        type={formType}
        onSave={handleCreate}
        isSaving={createMut.isPending}
      />
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend: 'up' | 'down';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            trend === 'up' ? 'bg-emerald-50' : 'bg-red-50',
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
          isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
        )}
      >
        {isIncome ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
        <p className="text-[10px] text-muted-foreground">
          {tx.category} &middot; {tx.date}
        </p>
      </div>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          isIncome ? 'text-emerald-600' : 'text-foreground',
        )}
      >
        {isIncome ? '+' : '-'}{formatCents(tx.amountCents)}
      </span>
    </div>
  );
}

// ─── Category Bar Chart ───────────────────────────────────────────────────────

function CategoryBarChart({
  data,
}: {
  data: { category: string; amountCents: number; type: string }[];
}) {
  const expenseData = data.filter((d) => d.type === 'expense');
  const incomeData = data.filter((d) => d.type === 'income');

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
          label: (ctx: any) => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`,
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
          callback: (v: any) => `$${v}`,
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
        <div style={{ height: 220 }}>
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Balance Line Chart ───────────────────────────────────────────────────────

function BalanceLineChart({
  data,
}: {
  data: { date: string; balanceCents: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.date.split('-')[2]),
    datasets: [
      {
        label: 'Balance',
        data: data.map((d) => d.balanceCents / 100),
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
          label: (ctx: any) => `Balance: $${ctx.parsed.y.toFixed(2)}`,
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
          callback: (v: any) => `$${v}`,
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
        <div style={{ height: 220 }}>
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Transaction Form Dialog ──────────────────────────────────────────────────

function TransactionFormDialog({
  open,
  onOpenChange,
  type,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TransactionType;
  onSave: (data: {
    amountCents: number;
    category: string;
    description: string;
    date: string;
  }) => void;
  isSaving: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayStr());

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setAmount('');
      setCategory(categories[0]);
      setDescription('');
      setDate(todayStr());
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0 || !description.trim()) return;
    onSave({
      amountCents: Math.round(parsed * 100),
      category,
      description: description.trim(),
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
            <Label htmlFor="tx-amount">Amount ($)</Label>
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
          </div>
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
            <Label htmlFor="tx-desc">Description</Label>
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !amount || !description.trim()}>
              {isSaving ? 'Saving...' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
