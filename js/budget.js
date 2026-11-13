/**
 * Monthly Budget Calculations & View Controller.
 *
 * Pure budget status evaluation is decoupled from DOM and LocalStorage
 * for clean unit testing and future REST API integration.
 */

import { saveBudgetForMonth } from './storage.js';
import {
  escapeHTML,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  sortTransactions,
} from './transactions.js';

/**
 * Returns expense transactions belonging to a given YYYY-MM month, newest first.
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 * @returns {Array<Object>}
 */
export function getMonthExpenses(transactions, monthKey) {
  const filtered = transactions.filter(
    (tx) => tx.type === 'expense' && typeof tx.date === 'string' && tx.date.startsWith(monthKey)
  );
  return sortTransactions(filtered, 'date-desc');
}

/**
 * Computes monthly budget tracking state, remaining balance, utilization %,
 * and threshold status ('unset' | 'nominal' | 'warning' | 'exceeded').
 *
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 * @param {number} budgetLimit
 */
export function calculateBudgetStatus(transactions, monthKey, budgetLimit) {
  const limit = Number(budgetLimit) > 0 ? Math.round(Number(budgetLimit) * 100) / 100 : 0;
  const monthExpenses = getMonthExpenses(transactions, monthKey);
  const spent =
    Math.round(monthExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0) * 100) / 100;

  if (limit <= 0) {
    return {
      monthKey,
      limit: 0,
      spent,
      remaining: 0,
      utilizationPct: 0,
      status: 'unset',
    };
  }

  const remaining = Math.round((limit - spent) * 100) / 100;
  const utilizationPct = Math.round((spent / limit) * 1000) / 10;

  let status = 'nominal';
  if (spent > limit) {
    status = 'exceeded';
  } else if (utilizationPct >= 80) {
    status = 'warning';
  }

  return {
    monthKey,
    limit,
    spent,
    remaining,
    utilizationPct,
    status,
  };
}

/**
 * Validates monthly budget form input.
 * @param {string|number} limitInput
 * @param {string} monthInput
 */
export function validateBudgetInput(limitInput, monthInput) {
  const limit = Number(limitInput);
  if (!monthInput || !/^\d{4}-\d{2}$/.test(monthInput)) {
    return { valid: false, error: 'Please select a valid month.' };
  }
  if (limitInput === '' || limitInput === null || limitInput === undefined) {
    return { valid: false, error: 'Please enter a monthly budget amount.' };
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return { valid: false, error: 'Monthly budget must be greater than $0.00.' };
  }
  if (limit > 100000000) {
    return { valid: false, error: 'Budget limit is too large.' };
  }
  return { valid: true, error: '' };
}

/* ==========================================================================
   Budget Management UI Controller
   ========================================================================== */

let onBudgetSavedCallback = null;

function applyAlertBanner(statusData) {
  const banner = document.getElementById('budget-alert-banner');
  const titleEl = document.getElementById('budget-alert-title');
  const msgEl = document.getElementById('budget-alert-message');
  const iconEl = document.getElementById('budget-alert-icon');
  const statusTextEl = document.getElementById('budget-status-text');
  const progressFill = document.getElementById('budget-progress-fill');
  const progressBar = document.getElementById('budget-progressbar');

  if (!banner || !titleEl || !msgEl || !statusTextEl || !progressFill || !progressBar) return;

  banner.classList.remove('is-nominal', 'is-warning', 'is-exceeded');
  statusTextEl.classList.remove('is-nominal', 'is-warning', 'is-exceeded');
  progressFill.classList.remove('is-nominal', 'is-warning', 'is-exceeded');

  const monthLabel = formatMonthLabel(statusData.monthKey);

  if (statusData.status === 'unset') {
    banner.classList.add('is-warning');
    statusTextEl.classList.add('is-warning');
    progressFill.classList.add('is-nominal');
    progressFill.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', '0');

    titleEl.textContent = 'No Budget Configured';
    msgEl.textContent = `Set a monthly spending limit for ${monthLabel} to track utilization and alerts.`;
    statusTextEl.textContent = 'Unset';
    if (iconEl) iconEl.setAttribute('data-lucide', 'info');
  } else if (statusData.status === 'exceeded') {
    const overBy = Math.abs(statusData.remaining);
    banner.classList.add('is-exceeded');
    statusTextEl.classList.add('is-exceeded');
    progressFill.classList.add('is-exceeded');
    progressFill.style.width = '100%';
    progressBar.setAttribute('aria-valuenow', String(Math.round(statusData.utilizationPct)));

    titleEl.textContent = 'Budget Exceeded Alert';
    msgEl.textContent = `You have exceeded your ${monthLabel} budget of ${formatCurrency(statusData.limit)} by ${formatCurrency(overBy)} (${statusData.utilizationPct.toFixed(1)}% used).`;
    statusTextEl.textContent = 'Exceeded';
    if (iconEl) iconEl.setAttribute('data-lucide', 'alert-octagon');
  } else if (statusData.status === 'warning') {
    banner.classList.add('is-warning');
    statusTextEl.classList.add('is-warning');
    progressFill.classList.add('is-warning');
    progressFill.style.width = `${Math.min(100, statusData.utilizationPct)}%`;
    progressBar.setAttribute('aria-valuenow', String(Math.round(statusData.utilizationPct)));

    titleEl.textContent = 'Budget Warning (80%+ Reached)';
    msgEl.textContent = `You have used ${statusData.utilizationPct.toFixed(1)}% of your ${monthLabel} budget. ${formatCurrency(statusData.remaining)} remaining.`;
    statusTextEl.textContent = 'Warning (80%+)';
    if (iconEl) iconEl.setAttribute('data-lucide', 'alert-triangle');
  } else {
    banner.classList.add('is-nominal');
    statusTextEl.classList.add('is-nominal');
    progressFill.classList.add('is-nominal');
    progressFill.style.width = `${Math.min(100, statusData.utilizationPct)}%`;
    progressBar.setAttribute('aria-valuenow', String(Math.round(statusData.utilizationPct)));

    titleEl.textContent = 'On Track';
    msgEl.textContent = `Monthly spending for ${monthLabel} is at ${statusData.utilizationPct.toFixed(1)}% of your ${formatCurrency(statusData.limit)} limit.`;
    statusTextEl.textContent = 'Nominal';
    if (iconEl) iconEl.setAttribute('data-lucide', 'check-circle-2');
  }

  if (typeof window !== 'undefined' && window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/**
 * Renders the Budget Management view for the active month.
 * @param {Array<Object>} transactions
 * @param {string} monthKey
 * @param {number} budgetLimit
 */
export function renderBudgetView(transactions, monthKey, budgetLimit) {
  const statusData = calculateBudgetStatus(transactions, monthKey, budgetLimit);
  const monthLabel = formatMonthLabel(monthKey);

  const subtitleEl = document.getElementById('budget-period-subtitle');
  const limitEl = document.getElementById('budget-limit-display');
  const spentEl = document.getElementById('budget-spent-display');
  const remainingEl = document.getElementById('budget-remaining-display');
  const utilEl = document.getElementById('budget-utilization-display');

  if (subtitleEl) subtitleEl.textContent = `Tracking expenses for ${monthLabel}`;
  if (limitEl) {
    limitEl.textContent = statusData.limit > 0 ? formatCurrency(statusData.limit) : 'Not set';
  }
  if (spentEl) spentEl.textContent = formatCurrency(statusData.spent);
  if (remainingEl) {
    if (statusData.limit <= 0) {
      remainingEl.textContent = '—';
      remainingEl.classList.remove('text-danger', 'text-income');
    } else {
      remainingEl.textContent = formatCurrency(statusData.remaining);
      remainingEl.classList.toggle('text-danger', statusData.remaining < 0);
      remainingEl.classList.toggle('text-income', statusData.remaining > 0);
    }
  }
  if (utilEl) {
    utilEl.textContent = `${statusData.utilizationPct.toFixed(1)}%`;
    utilEl.classList.toggle('text-danger', statusData.status === 'exceeded');
    utilEl.classList.toggle('text-warning', statusData.status === 'warning');
  }

  // Sync budget form inputs to active month and current limit
  const monthInput = document.getElementById('budget-month-input');
  const amountInput = document.getElementById('budget-amount-input');
  if (monthInput && monthInput.value !== monthKey) {
    monthInput.value = monthKey;
  }
  if (amountInput && document.activeElement !== amountInput) {
    amountInput.value = statusData.limit > 0 ? String(statusData.limit) : '';
  }

  applyAlertBanner(statusData);

  // Render monthly expenses table
  const expenses = getMonthExpenses(transactions, monthKey);
  const titleEl = document.getElementById('budget-month-expenses-title');
  const container = document.getElementById('budget-expenses-container');
  const tbody = document.getElementById('budget-expenses-body');
  const emptyEl = document.getElementById('budget-expenses-empty');

  if (titleEl) titleEl.textContent = `${monthLabel} Expense Activity`;
  if (!container || !tbody || !emptyEl) return;

  if (expenses.length === 0) {
    container.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    tbody.innerHTML = '';
    return;
  }

  container.classList.remove('is-hidden');
  emptyEl.classList.add('is-hidden');

  tbody.innerHTML = expenses
    .map(
      (tx) => `
      <tr>
        <td class="tx-date tabular-nums">${escapeHTML(formatDate(tx.date))}</td>
        <td>
          <div class="tx-title">${escapeHTML(tx.title)}</div>
          ${tx.description ? `<div class="tx-desc">${escapeHTML(tx.description)}</div>` : ''}
        </td>
        <td class="tx-category">${escapeHTML(tx.category)}</td>
        <td class="text-right tabular-nums tx-amount is-expense">
          -${escapeHTML(formatCurrency(tx.amount))}
        </td>
      </tr>
    `
    )
    .join('');
}

/**
 * Wires Budget Management form submission.
 */
export function initBudgetUI({ onBudgetSaved }) {
  onBudgetSavedCallback = onBudgetSaved;

  const form = document.getElementById('budget-form');
  const amountInput = document.getElementById('budget-amount-input');
  const monthInput = document.getElementById('budget-month-input');
  const errEl = document.getElementById('budget-amount-error');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (errEl) errEl.textContent = '';
    amountInput?.classList.remove('is-invalid');

    const monthVal = monthInput?.value || '';
    const amountVal = amountInput?.value || '';
    const check = validateBudgetInput(amountVal, monthVal);

    if (!check.valid) {
      if (errEl) errEl.textContent = check.error;
      amountInput?.classList.add('is-invalid');
      return;
    }

    const roundedLimit = Math.round(Number(amountVal) * 100) / 100;
    saveBudgetForMonth(monthVal, roundedLimit);
    onBudgetSavedCallback?.(monthVal, `Monthly budget for ${formatMonthLabel(monthVal)} saved.`);
  });
}
