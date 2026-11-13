/**
 * Expense Analytics Calculations & View Renderer.
 *
 * Pure analytics functions operate on transaction arrays independently
 * of storage or DOM APIs.
 */

import { shiftMonthKey } from './storage.js';
import { getExpenseCategoryBreakdown } from './dashboard.js';
import { escapeHTML, formatCurrency, formatMonthLabel } from './transactions.js';

let incomeVsExpenseChart = null;
let distributionChart = null;

/**
 * Computes high-level savings, top category, and average monthly spending metrics.
 * @param {Array<Object>} transactions
 */
export function calculateAnalyticsMetrics(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const spendingMonths = new Set();

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      if (typeof tx.date === 'string' && tx.date.length >= 7) {
        spendingMonths.add(tx.date.slice(0, 7));
      }
    }
  }

  const round2 = (n) => Math.round(n * 100) / 100;
  const totalSavings = round2(totalIncome - totalExpenses);
  const savingsRate =
    totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 1000) / 10 : 0;

  const breakdown = getExpenseCategoryBreakdown(transactions);
  const highestCategory = breakdown.length > 0 ? breakdown[0] : null;
  const activeMonthsCount = spendingMonths.size;
  const averageMonthlyExpense =
    activeMonthsCount > 0 ? round2(totalExpenses / activeMonthsCount) : 0;

  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    totalSavings,
    savingsRate,
    highestCategory,
    averageMonthlyExpense,
    activeMonthsCount,
  };
}

/**
 * Aggregates monthly income and expense totals over the last N months.
 * @param {Array<Object>} transactions
 * @param {string} referenceMonthKey
 * @param {number} [monthsCount]
 */
export function getMonthlyIncomeVsExpense(transactions, referenceMonthKey, monthsCount = 6) {
  const monthKeys = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    monthKeys.push(shiftMonthKey(referenceMonthKey, -i));
  }

  const incomeMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  const expenseMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));

  for (const tx of transactions) {
    if (typeof tx.date !== 'string') continue;
    const key = tx.date.slice(0, 7);
    if (!(key in incomeMap)) continue;
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      incomeMap[key] += amt;
    } else if (tx.type === 'expense') {
      expenseMap[key] += amt;
    }
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    monthKeys,
    labels: monthKeys.map((k) => formatMonthLabel(k, 'short')),
    incomeSeries: monthKeys.map((k) => round2(incomeMap[k])),
    expenseSeries: monthKeys.map((k) => round2(expenseMap[k])),
  };
}

/* ==========================================================================
   Analytics View Rendering
   ========================================================================== */

function renderIncomeVsExpenseChart(transactions, monthKey) {
  const canvas = document.getElementById('chart-income-vs-expense');
  const container = canvas?.parentElement;
  const emptyEl = document.getElementById('analytics-monthly-empty');
  if (!canvas || !container || !emptyEl) return;

  const series = getMonthlyIncomeVsExpense(transactions, monthKey, 6);
  const hasData =
    series.incomeSeries.some((v) => v > 0) || series.expenseSeries.some((v) => v > 0);

  if (!hasData) {
    container.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    if (incomeVsExpenseChart) {
      incomeVsExpenseChart.destroy();
      incomeVsExpenseChart = null;
    }
    return;
  }

  container.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  if (typeof window === 'undefined' || !window.Chart) return;
  if (incomeVsExpenseChart) incomeVsExpenseChart.destroy();

  incomeVsExpenseChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeSeries,
          backgroundColor: '#16a34a',
          borderRadius: 5,
          maxBarThickness: 28,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#0f172a',
          borderRadius: 5,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11.5 },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (v) => `$${Number(v).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderDistributionChart(breakdown) {
  const canvas = document.getElementById('chart-spending-distribution');
  const container = canvas?.parentElement;
  const emptyEl = document.getElementById('analytics-dist-empty');
  if (!canvas || !container || !emptyEl) return;

  if (breakdown.length === 0) {
    container.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    if (distributionChart) {
      distributionChart.destroy();
      distributionChart = null;
    }
    return;
  }

  container.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  if (typeof window === 'undefined' || !window.Chart) return;
  if (distributionChart) distributionChart.destroy();

  distributionChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          label: 'Total Spent',
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderRadius: 5,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              return `${formatCurrency(ctx.parsed.x)} (${item.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (v) => `$${Number(v).toLocaleString()}`,
          },
        },
        y: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: '#0f172a',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' },
          },
        },
      },
    },
  });
}

function renderBreakdownTable(breakdown) {
  const container = document.getElementById('analytics-table-container');
  const tbody = document.getElementById('analytics-breakdown-body');
  const emptyEl = document.getElementById('analytics-table-empty');
  if (!container || !tbody || !emptyEl) return;

  if (breakdown.length === 0) {
    container.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    tbody.innerHTML = '';
    return;
  }

  container.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  tbody.innerHTML = breakdown
    .map(
      (item) => `
      <tr>
        <td>
          <div class="legend-left">
            <span class="legend-swatch" style="background-color: ${escapeHTML(item.color)}"></span>
            <span class="tx-title">${escapeHTML(item.category)}</span>
          </div>
        </td>
        <td class="text-right tabular-nums">${item.count}</td>
        <td class="text-right tabular-nums tx-amount">${escapeHTML(formatCurrency(item.total))}</td>
        <td class="text-right tabular-nums">${item.percentage.toFixed(1)}%</td>
        <td>
          <div class="dist-bar-track" aria-hidden="true">
            <div class="dist-bar-fill" style="width: ${Math.min(100, item.percentage)}%; background-color: ${escapeHTML(item.color)}"></div>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

/**
 * Renders the Analytics view.
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 */
export function renderAnalytics(transactions, monthKey) {
  const metrics = calculateAnalyticsMetrics(transactions);
  const breakdown = getExpenseCategoryBreakdown(transactions);

  const savingsEl = document.getElementById('analytics-savings');
  const savingsRateEl = document.getElementById('analytics-savings-rate');
  const topCatEl = document.getElementById('analytics-top-category');
  const topCatMetaEl = document.getElementById('analytics-top-category-meta');
  const avgEl = document.getElementById('analytics-avg-expense');
  const avgMetaEl = document.getElementById('analytics-avg-meta');

  if (savingsEl) {
    savingsEl.textContent = formatCurrency(metrics.totalSavings);
    savingsEl.classList.toggle('text-income', metrics.totalSavings > 0);
    savingsEl.classList.toggle('text-danger', metrics.totalSavings < 0);
  }
  if (savingsRateEl) {
    savingsRateEl.textContent =
      metrics.totalIncome > 0
        ? `${metrics.savingsRate.toFixed(1)}% savings rate across total income`
        : 'No income recorded yet';
  }

  if (topCatEl && topCatMetaEl) {
    if (metrics.highestCategory) {
      topCatEl.textContent = metrics.highestCategory.category;
      topCatMetaEl.textContent = `${formatCurrency(metrics.highestCategory.total)} (${metrics.highestCategory.percentage.toFixed(1)}% of expenses)`;
    } else {
      topCatEl.textContent = 'None';
      topCatMetaEl.textContent = 'No expenses recorded';
    }
  }

  if (avgEl) avgEl.textContent = formatCurrency(metrics.averageMonthlyExpense);
  if (avgMetaEl) {
    avgMetaEl.textContent =
      metrics.activeMonthsCount > 0
        ? `Across ${metrics.activeMonthsCount} ${metrics.activeMonthsCount === 1 ? 'month' : 'months'} with expenses`
        : 'No monthly expense history';
  }

  renderIncomeVsExpenseChart(transactions, monthKey);
  renderDistributionChart(breakdown);
  renderBreakdownTable(breakdown);
}
