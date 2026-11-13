/**
 * Dashboard Financial Calculations & View Renderer.
 *
 * Pure calculation functions are decoupled from DOM and storage
 * for testability and future backend integration.
 */

import { shiftMonthKey } from './storage.js';
import {
  CATEGORY_COLORS,
  escapeHTML,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  sortTransactions,
} from './transactions.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;

/**
 * Computes core dashboard financial totals dynamically.
 * Total Balance = Total Income - Total Expenses.
 *
 * @param {Array<Object>} transactions
 * @param {string} monthKey YYYY-MM
 * @returns {{ totalIncome: number, totalExpenses: number, totalBalance: number, monthlySpending: number, monthIncome: number }}
 */
export function calculateDashboardSummary(transactions, monthKey) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlySpending = 0;
  let monthIncome = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    const txMonth = typeof tx.date === 'string' ? tx.date.slice(0, 7) : '';

    if (tx.type === 'income') {
      totalIncome += amt;
      if (txMonth === monthKey) {
        monthIncome += amt;
      }
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      if (txMonth === monthKey) {
        monthlySpending += amt;
      }
    }
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    totalBalance: round2(totalIncome - totalExpenses),
    monthlySpending: round2(monthlySpending),
    monthIncome: round2(monthIncome),
  };
}

/**
 * Returns the most recent transactions sorted newest-first.
 * @param {Array<Object>} transactions
 * @param {number} [limit]
 * @returns {Array<Object>}
 */
export function getRecentTransactions(transactions, limit = 6) {
  return sortTransactions(transactions, 'date-desc').slice(0, limit);
}

/**
 * Aggregates expense totals across the last N months ending at referenceMonthKey.
 * @param {Array<Object>} transactions
 * @param {string} referenceMonthKey
 * @param {number} [monthsCount]
 * @returns {{ monthKeys: string[], labels: string[], values: number[] }}
 */
export function getMonthlySpendingSeries(transactions, referenceMonthKey, monthsCount = 6) {
  const monthKeys = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    monthKeys.push(shiftMonthKey(referenceMonthKey, -i));
  }

  const totalsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  for (const tx of transactions) {
    if (tx.type !== 'expense' || typeof tx.date !== 'string') continue;
    const key = tx.date.slice(0, 7);
    if (key in totalsByMonth) {
      totalsByMonth[key] += Number(tx.amount) || 0;
    }
  }

  return {
    monthKeys,
    labels: monthKeys.map((k) => formatMonthLabel(k, 'short')),
    values: monthKeys.map((k) => Math.round(totalsByMonth[k] * 100) / 100),
  };
}

/**
 * Breaks down all expenses by category sorted from highest to lowest.
 * @param {Array<Object>} transactions
 * @returns {Array<{ category: string, total: number, percentage: number, count: number, color: string }>}
 */
export function getExpenseCategoryBreakdown(transactions) {
  const map = new Map();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const amt = Number(tx.amount) || 0;
    const cat = tx.category || 'Other';
    grandTotal += amt;

    const existing = map.get(cat) || { total: 0, count: 0 };
    existing.total += amt;
    existing.count += 1;
    map.set(cat, existing);
  }

  const result = Array.from(map.entries()).map(([category, info]) => ({
    category,
    total: Math.round(info.total * 100) / 100,
    count: info.count,
    percentage: grandTotal > 0 ? Math.round((info.total / grandTotal) * 1000) / 10 : 0,
    color: CATEGORY_COLORS[category] || '#64748b',
  }));

  result.sort((a, b) => b.total - a.total);
  return result;
}

/* ==========================================================================
   Dashboard DOM & Chart Rendering
   ========================================================================== */

function renderMonthlySpendingChart(transactions, monthKey) {
  const canvas = document.getElementById('chart-monthly-spending');
  const container = canvas?.parentElement;
  const emptyEl = document.getElementById('chart-monthly-empty');
  if (!canvas || !container || !emptyEl) return;

  const series = getMonthlySpendingSeries(transactions, monthKey, 6);
  const hasAnyExpense = series.values.some((v) => v > 0);

  if (!hasAnyExpense) {
    container.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    if (monthlyChartInstance) {
      monthlyChartInstance.destroy();
      monthlyChartInstance = null;
    }
    return;
  }

  container.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  if (typeof window === 'undefined' || !window.Chart) return;

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  monthlyChartInstance = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Monthly Expenses',
          data: series.values,
          backgroundColor: series.monthKeys.map((k) =>
            k === monthKey ? '#0f172a' : '#cbd5e1'
          ),
          borderRadius: 6,
          maxBarThickness: 38,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Spent: ${formatCurrency(ctx.parsed.y)}`,
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
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownChart(transactions) {
  const canvas = document.getElementById('chart-category-breakdown');
  const container = canvas?.parentElement;
  const layoutEl = container?.parentElement;
  const listEl = document.getElementById('dashboard-category-list');
  const emptyEl = document.getElementById('chart-category-empty');
  if (!canvas || !container || !layoutEl || !listEl || !emptyEl) return;

  const breakdown = getExpenseCategoryBreakdown(transactions);

  if (breakdown.length === 0) {
    layoutEl.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
      categoryChartInstance = null;
    }
    listEl.innerHTML = '';
    return;
  }

  layoutEl.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  listEl.innerHTML = breakdown
    .slice(0, 5)
    .map(
      (item) => `
      <li class="category-legend-item">
        <span class="legend-left">
          <span class="legend-swatch" style="background-color: ${escapeHTML(item.color)}"></span>
          <span class="legend-name">${escapeHTML(item.category)}</span>
        </span>
        <span class="legend-right">
          <span class="legend-amount tabular-nums">${escapeHTML(formatCurrency(item.total))}</span>
          <span class="legend-pct tabular-nums">${item.percentage.toFixed(1)}%</span>
        </span>
      </li>
    `
    )
    .join('');

  if (typeof window === 'undefined' || !window.Chart) return;

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  categoryChartInstance = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderRecentTransactionsTable(transactions) {
  const container = document.getElementById('recent-transactions-container');
  const tbody = document.getElementById('recent-transactions-body');
  const emptyEl = document.getElementById('recent-transactions-empty');
  if (!container || !tbody || !emptyEl) return;

  const recent = getRecentTransactions(transactions, 6);

  if (recent.length === 0) {
    container.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    tbody.innerHTML = '';
    return;
  }

  container.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  tbody.innerHTML = recent
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const prefix = isIncome ? '+' : '-';
      return `
        <tr>
          <td class="tx-date tabular-nums">${escapeHTML(formatDate(tx.date))}</td>
          <td>
            <div class="tx-title">${escapeHTML(tx.title)}</div>
          </td>
          <td class="tx-category">${escapeHTML(tx.category)}</td>
          <td>
            <span class="tx-type ${isIncome ? 'is-income' : 'is-expense'}">${
              isIncome ? 'Income' : 'Expense'
            }</span>
          </td>
          <td class="text-right tabular-nums tx-amount ${isIncome ? 'is-income' : 'is-expense'}">
            ${prefix}${escapeHTML(formatCurrency(tx.amount))}
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Renders the complete Dashboard view.
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 */
export function renderDashboard(transactions, monthKey) {
  const summary = calculateDashboardSummary(transactions, monthKey);

  const balanceEl = document.getElementById('kpi-balance');
  const incomeEl = document.getElementById('kpi-income');
  const expensesEl = document.getElementById('kpi-expenses');
  const monthlyEl = document.getElementById('kpi-monthly');
  const monthlySubEl = document.getElementById('kpi-monthly-sub');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(summary.totalBalance);
    balanceEl.classList.toggle('text-danger', summary.totalBalance < 0);
  }
  if (incomeEl) incomeEl.textContent = formatCurrency(summary.totalIncome);
  if (expensesEl) expensesEl.textContent = formatCurrency(summary.totalExpenses);
  if (monthlyEl) monthlyEl.textContent = formatCurrency(summary.monthlySpending);
  if (monthlySubEl) monthlySubEl.textContent = `${formatMonthLabel(monthKey)} expenses`;

  renderMonthlySpendingChart(transactions, monthKey);
  renderCategoryBreakdownChart(transactions);
  renderRecentTransactionsTable(transactions);
}
