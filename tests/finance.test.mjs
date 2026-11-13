import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateTransactionInput,
  createTransactionRecord,
  filterTransactions,
  sortTransactions,
} from '../js/transactions.js';
import {
  calculateDashboardSummary,
  getRecentTransactions,
  getMonthlySpendingSeries,
  getExpenseCategoryBreakdown,
} from '../js/dashboard.js';
import {
  calculateAnalyticsMetrics,
  getMonthlyIncomeVsExpense,
} from '../js/analytics.js';
import {
  calculateBudgetStatus,
  validateBudgetInput,
} from '../js/budget.js';

const SAMPLE_TX = [
  { id: '1', title: 'Salary', amount: 5000, category: 'Salary', type: 'income', date: '2026-11-01', description: 'Monthly pay' },
  { id: '2', title: 'Rent', amount: 1500, category: 'Housing', type: 'expense', date: '2026-11-03', description: 'Apartment lease' },
  { id: '3', title: 'Groceries', amount: 500, category: 'Food', type: 'expense', date: '2026-11-08', description: 'Supermarket' },
  { id: '4', title: 'Freelance', amount: 1000, category: 'Freelance', type: 'income', date: '2026-10-15', description: 'Logo design' },
  { id: '5', title: 'Internet', amount: 100, category: 'Utilities', type: 'expense', date: '2026-10-20', description: 'Fiber' },
];

test('validateTransactionInput rejects missing or invalid fields', () => {
  const bad = validateTransactionInput({
    title: '   ',
    amount: -50,
    type: 'expense',
    category: '',
    date: '2026-02-30',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.title);
  assert.ok(bad.errors.amount);
  assert.ok(bad.errors.category);
  assert.ok(bad.errors.date);
});

test('validateTransactionInput accepts valid input and createTransactionRecord normalizes schema', () => {
  const input = {
    title: '  Grocery Shopping ',
    amount: '1200.456',
    category: 'Food',
    type: 'expense',
    date: '2026-11-13',
    description: ' Weekly groceries ',
  };
  const check = validateTransactionInput(input);
  assert.equal(check.valid, true);

  const record = createTransactionRecord(input, 'tx_custom_1');
  assert.deepEqual(record, {
    id: 'tx_custom_1',
    title: 'Grocery Shopping',
    amount: 1200.46,
    category: 'Food',
    type: 'expense',
    date: '2026-11-13',
    description: 'Weekly groceries',
  });
});

test('filterTransactions and sortTransactions handle search, category, type, and date ordering', () => {
  const expenses = filterTransactions(SAMPLE_TX, { type: 'expense' });
  assert.equal(expenses.length, 3);

  const food = filterTransactions(SAMPLE_TX, { category: 'Food' });
  assert.equal(food.length, 1);
  assert.equal(food[0].title, 'Groceries');

  const searched = filterTransactions(SAMPLE_TX, { search: 'logo' });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, '4');

  const newest = sortTransactions(SAMPLE_TX, 'date-desc');
  assert.equal(newest[0].date, '2026-11-08');

  const oldest = sortTransactions(SAMPLE_TX, 'date-asc');
  assert.equal(oldest[0].date, '2026-10-15');
});

test('calculateDashboardSummary computes dynamic Total Balance = Total Income - Total Expenses', () => {
  const summary = calculateDashboardSummary(SAMPLE_TX, '2026-11');
  assert.equal(summary.totalIncome, 6000);
  assert.equal(summary.totalExpenses, 2100);
  assert.equal(summary.totalBalance, 3900);
  assert.equal(summary.monthlySpending, 2000);
  assert.equal(summary.monthIncome, 5000);

  const recent = getRecentTransactions(SAMPLE_TX, 2);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].id, '3');
});

test('getMonthlySpendingSeries and getExpenseCategoryBreakdown aggregate accurately', () => {
  const series = getMonthlySpendingSeries(SAMPLE_TX, '2026-11', 2);
  assert.deepEqual(series.monthKeys, ['2026-10', '2026-11']);
  assert.deepEqual(series.values, [100, 2000]);

  const breakdown = getExpenseCategoryBreakdown(SAMPLE_TX);
  assert.equal(breakdown[0].category, 'Housing');
  assert.equal(breakdown[0].total, 1500);
  assert.equal(breakdown[1].category, 'Food');
  assert.equal(breakdown[1].total, 500);
});

test('calculateAnalyticsMetrics computes total savings, savings rate, and highest category', () => {
  const metrics = calculateAnalyticsMetrics(SAMPLE_TX);
  assert.equal(metrics.totalSavings, 3900);
  assert.equal(metrics.savingsRate, 65);
  assert.equal(metrics.highestCategory.category, 'Housing');
  assert.equal(metrics.activeMonthsCount, 2);
  assert.equal(metrics.averageMonthlyExpense, 1050);

  const cmp = getMonthlyIncomeVsExpense(SAMPLE_TX, '2026-11', 2);
  assert.deepEqual(cmp.incomeSeries, [1000, 5000]);
  assert.deepEqual(cmp.expenseSeries, [100, 2000]);
});

test('calculateBudgetStatus handles nominal, 80% warning, and exceeded states', () => {
  // Nov spending is 2000
  const nominal = calculateBudgetStatus(SAMPLE_TX, '2026-11', 3000);
  assert.equal(nominal.status, 'nominal');
  assert.equal(nominal.remaining, 1000);
  assert.equal(nominal.utilizationPct, 66.7);

  const warning = calculateBudgetStatus(SAMPLE_TX, '2026-11', 2500);
  assert.equal(warning.status, 'warning');
  assert.equal(warning.utilizationPct, 80);
  assert.equal(warning.remaining, 500);

  const exceeded = calculateBudgetStatus(SAMPLE_TX, '2026-11', 1800);
  assert.equal(exceeded.status, 'exceeded');
  assert.equal(exceeded.remaining, -200);
  assert.equal(exceeded.utilizationPct, 111.1);

  assert.equal(validateBudgetInput(0, '2026-11').valid, false);
  assert.equal(validateBudgetInput(2500, '2026-11').valid, true);
});
