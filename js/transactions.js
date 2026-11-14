/**
 * Transaction Domain Logic & Transaction History UI Controller.
 *
 * Pure validation, formatting, filtering, and sorting functions are kept
 * independent of storage and DOM APIs so they can be unit-tested cleanly
 * and reused across any backend integration.
 */

import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTodayISO,
} from './storage.js';

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Bonus',
  'Other Income',
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const CATEGORY_COLORS = {
  Food: '#1d4ed8',
  Housing: '#0f172a',
  Transportation: '#0284c7',
  Utilities: '#0d9488',
  Healthcare: '#dc2626',
  Entertainment: '#d97706',
  Shopping: '#4f46e5',
  Education: '#059669',
  Other: '#64748b',
  Salary: '#15803d',
  Freelance: '#16a34a',
  Investments: '#047857',
  Bonus: '#22c55e',
  'Other Income': '#65a30d',
};

/**
 * Generates a unique transaction identifier.
 * @returns {string}
 */
export function generateTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Formats numeric amount as USD currency with 2 decimal places.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const absFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  return num < 0 ? `-${absFormatted}` : absFormatted;
}

/**
 * Formats an ISO YYYY-MM-DD date string for clean display (e.g. Nov 13, 2026).
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate || '';
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Formats a YYYY-MM month key into readable Month Year (e.g. November 2026).
 * @param {string} monthKey
 * @param {'long' | 'short'} [monthStyle]
 * @returns {string}
 */
export function formatMonthLabel(monthKey, monthStyle = 'long') {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey || '';
  }
  const [y, m] = monthKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: monthStyle,
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Validates raw transaction form input.
 * @param {Object} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTransactionInput(input) {
  const errors = {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const amount = Number(input.amount);
  const type = input.type;
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const date = typeof input.date === 'string' ? input.date.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (input.amount === '' || input.amount === null || input.amount === undefined) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than $0.00.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount cannot exceed $100,000,000.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Transaction type must be income or expense.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  } else {
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (
      parsed.getFullYear() !== y ||
      parsed.getMonth() !== m - 1 ||
      parsed.getDate() !== d
    ) {
      errors.date = 'Please enter a valid calendar date.';
    }
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Normalizes validated input into the canonical transaction schema.
 * @param {Object} input
 * @param {string} [existingId]
 * @returns {Object}
 */
export function createTransactionRecord(input, existingId) {
  return {
    id: existingId || generateTransactionId(),
    title: String(input.title).trim(),
    amount: Math.round(Number(input.amount) * 100) / 100,
    category: String(input.category).trim(),
    type: input.type === 'income' ? 'income' : 'expense',
    date: String(input.date).trim(),
    description: typeof input.description === 'string' ? input.description.trim() : '',
  };
}

/**
 * Filters transactions by search query, category, and type.
 * @param {Array<Object>} transactions
 * @param {{ search?: string, category?: string, type?: string }} filters
 * @returns {Array<Object>}
 */
export function filterTransactions(transactions, { search = '', category = 'all', type = 'all' } = {}) {
  const q = search.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) {
      return false;
    }
    if (category !== 'all' && tx.category !== category) {
      return false;
    }
    if (q) {
      const hay = `${tx.title} ${tx.category} ${tx.description || ''}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Sorts transactions without mutating the input array.
 * @param {Array<Object>} transactions
 * @param {'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'} sortBy
 * @returns {Array<Object>}
 */
export function sortTransactions(transactions, sortBy = 'date-desc') {
  const copy = [...transactions];
  copy.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
  });
  return copy;
}

/**
 * Escapes HTML entities to safely render user-entered text in table templates.
 * @param {string} value
 * @returns {string}
 */
export function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ==========================================================================
   Transaction History & Modal UI Controller
   ========================================================================== */

const filterState = {
  search: '',
  type: 'all',
  category: 'all',
  sort: 'date-desc',
};

let pendingDeleteId = null;
let onDataChangeCallback = null;
let cachedTransactions = [];

function populateCategoryOptions(selectEl, type, selectedValue = '') {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  selectEl.innerHTML = [
    '<option value="">Select category...</option>',
    ...categories.map(
      (cat) => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
    ),
  ].join('');

  if (selectedValue && categories.includes(selectedValue)) {
    selectEl.value = selectedValue;
  } else if (categories.length > 0 && !selectedValue) {
    selectEl.value = '';
  }
}

function populateFilterCategoryDropdown(transactions) {
  const selectEl = document.getElementById('filter-category');
  if (!selectEl) return;

  const previous = filterState.category;
  const usedCategories = new Set(ALL_CATEGORIES);
  transactions.forEach((tx) => {
    if (tx.category) usedCategories.add(tx.category);
  });

  selectEl.innerHTML = [
    '<option value="all">All Categories</option>',
    ...Array.from(usedCategories).map(
      (cat) => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
    ),
  ].join('');

  selectEl.value = Array.from(usedCategories).includes(previous) ? previous : 'all';
  filterState.category = selectEl.value;
}

function clearFormErrors() {
  const errorMap = {
    title: 'err-tx-title',
    amount: 'err-tx-amount',
    date: 'err-tx-date',
    category: 'err-tx-category',
    description: 'err-tx-description',
  };
  const inputMap = {
    title: 'tx-title',
    amount: 'tx-amount',
    date: 'tx-date',
    category: 'tx-category',
    description: 'tx-description',
  };

  Object.entries(errorMap).forEach(([key, errId]) => {
    const errEl = document.getElementById(errId);
    const inputEl = document.getElementById(inputMap[key]);
    if (errEl) errEl.textContent = '';
    if (inputEl) inputEl.classList.remove('is-invalid');
  });
}

function showFormErrors(errors) {
  const errorMap = {
    title: 'err-tx-title',
    amount: 'err-tx-amount',
    date: 'err-tx-date',
    category: 'err-tx-category',
    description: 'err-tx-description',
  };
  const inputMap = {
    title: 'tx-title',
    amount: 'tx-amount',
    date: 'tx-date',
    category: 'tx-category',
    description: 'tx-description',
  };

  Object.entries(errors).forEach(([key, message]) => {
    const errEl = document.getElementById(errorMap[key]);
    const inputEl = document.getElementById(inputMap[key]);
    if (errEl) errEl.textContent = message;
    if (inputEl) inputEl.classList.add('is-invalid');
  });
}

function setModalTransactionType(type, selectedCategory = '') {
  const normalized = type === 'income' ? 'income' : 'expense';
  const hiddenType = document.getElementById('tx-type');
  const categorySelect = document.getElementById('tx-category');
  const typeButtons = document.querySelectorAll('[data-tx-type]');

  if (hiddenType) hiddenType.value = normalized;
  typeButtons.forEach((btn) => {
    const isActive = btn.dataset.txType === normalized;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  if (categorySelect) {
    populateCategoryOptions(categorySelect, normalized, selectedCategory);
  }
}

export function openTransactionModal(transactionToEdit = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('transaction-modal-title');
  const submitBtn = document.getElementById('btn-save-transaction');
  const idInput = document.getElementById('tx-id');
  const titleInput = document.getElementById('tx-title');
  const amountInput = document.getElementById('tx-amount');
  const dateInput = document.getElementById('tx-date');
  const descInput = document.getElementById('tx-description');

  clearFormErrors();

  if (transactionToEdit) {
    modalTitle.textContent = 'Edit Transaction';
    submitBtn.textContent = 'Update Transaction';
    idInput.value = transactionToEdit.id;
    titleInput.value = transactionToEdit.title;
    amountInput.value = String(transactionToEdit.amount);
    dateInput.value = transactionToEdit.date;
    descInput.value = transactionToEdit.description || '';
    setModalTransactionType(transactionToEdit.type, transactionToEdit.category);
  } else {
    modalTitle.textContent = 'Add Transaction';
    submitBtn.textContent = 'Save Transaction';
    idInput.value = '';
    titleInput.value = '';
    amountInput.value = '';
    dateInput.value = getTodayISO();
    descInput.value = '';
    setModalTransactionType('expense', '');
  }

  modal.classList.remove('is-hidden');
  titleInput.focus();
}

export function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.classList.add('is-hidden');
}

function openDeleteModal(transaction) {
  pendingDeleteId = transaction.id;
  const modal = document.getElementById('delete-modal');
  const msg = document.getElementById('delete-modal-message');
  if (msg) {
    msg.textContent = `Delete "${transaction.title}" (${formatCurrency(transaction.amount)})? This action cannot be undone.`;
  }
  modal.classList.remove('is-hidden');
  document.getElementById('btn-confirm-delete')?.focus();
}

function closeDeleteModal() {
  pendingDeleteId = null;
  const modal = document.getElementById('delete-modal');
  if (modal) modal.classList.add('is-hidden');
}

function resetFilters() {
  filterState.search = '';
  filterState.type = 'all';
  filterState.category = 'all';
  filterState.sort = 'date-desc';

  const searchInput = document.getElementById('filter-search');
  const categorySelect = document.getElementById('filter-category');
  const sortSelect = document.getElementById('sort-transactions');
  const typeBtns = document.querySelectorAll('[data-type-filter]');

  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = 'all';
  if (sortSelect) sortSelect.value = 'date-desc';
  typeBtns.forEach((btn) => {
    const isAll = btn.dataset.typeFilter === 'all';
    btn.classList.toggle('is-active', isAll);
    btn.setAttribute('aria-pressed', String(isAll));
  });
}

/**
 * Renders the Transaction History view based on current filters and sort order.
 * @param {Array<Object>} transactions
 */
export function renderTransactionHistory(transactions) {
  cachedTransactions = transactions;
  populateFilterCategoryDropdown(transactions);

  const filtered = filterTransactions(transactions, filterState);
  const sorted = sortTransactions(filtered, filterState.sort);

  const hasActiveFilters =
    filterState.search.trim() !== '' ||
    filterState.type !== 'all' ||
    filterState.category !== 'all';

  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.classList.toggle('is-hidden', !hasActiveFilters);
  }

  const countLabel = document.getElementById('transactions-count-label');
  const netLabel = document.getElementById('transactions-net-label');
  const netTotal = sorted.reduce(
    (sum, tx) => (tx.type === 'income' ? sum + tx.amount : sum - tx.amount),
    0
  );

  if (countLabel) {
    countLabel.textContent = `${sorted.length} ${sorted.length === 1 ? 'transaction' : 'transactions'}`;
  }
  if (netLabel) {
    const sign = netTotal > 0 ? '+' : '';
    netLabel.textContent = `Filtered Net: ${sign}${formatCurrency(netTotal)}`;
  }

  const tableContainer = document.getElementById('all-transactions-container');
  const tbody = document.getElementById('all-transactions-body');
  const emptyState = document.getElementById('all-transactions-empty');
  const emptyTitle = document.getElementById('all-empty-title');
  const emptyDesc = document.getElementById('all-empty-desc');
  const emptyClearBtn = document.getElementById('btn-empty-clear-filters');

  if (!tbody || !tableContainer || !emptyState) return;

  if (sorted.length === 0) {
    tableContainer.classList.add('is-hidden');
    emptyState.classList.remove('is-hidden');

    if (transactions.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No transactions recorded yet';
      if (emptyDesc) {
        emptyDesc.textContent = 'Add your first income or expense entry to start building your ledger.';
      }
      if (emptyClearBtn) emptyClearBtn.classList.add('is-hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No matching transactions';
      if (emptyDesc) {
        emptyDesc.textContent = 'Try clearing or adjusting your search terms and category filters.';
      }
      if (emptyClearBtn) emptyClearBtn.classList.remove('is-hidden');
    }
    tbody.innerHTML = '';
    return;
  }

  tableContainer.classList.remove('is-hidden');
  emptyState.classList.add('is-hidden');

  tbody.innerHTML = sorted
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const amountPrefix = isIncome ? '+' : '-';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const safeTitle = escapeHTML(tx.title);
      const safeDesc = tx.description ? `<div class="tx-desc">${escapeHTML(tx.description)}</div>` : '';

      return `
        <tr data-tx-id="${escapeHTML(tx.id)}">
          <td class="tx-date tabular-nums">${escapeHTML(formatDate(tx.date))}</td>
          <td>
            <div class="tx-title">${safeTitle}</div>
            ${safeDesc}
          </td>
          <td class="tx-category">${escapeHTML(tx.category)}</td>
          <td>
            <span class="tx-type ${isIncome ? 'is-income' : 'is-expense'}">${typeLabel}</span>
          </td>
          <td class="text-right tabular-nums tx-amount ${isIncome ? 'is-income' : 'is-expense'}">
            ${amountPrefix}${escapeHTML(formatCurrency(tx.amount))}
          </td>
          <td class="text-right">
            <div class="table-actions">
              <button
                type="button"
                class="btn-icon js-edit-tx"
                data-id="${escapeHTML(tx.id)}"
                aria-label="Edit ${safeTitle}"
                title="Edit transaction"
              >
                <i data-lucide="pencil" class="icon-xs" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="btn-icon btn-icon-danger js-delete-tx"
                data-id="${escapeHTML(tx.id)}"
                aria-label="Delete ${safeTitle}"
                title="Delete transaction"
              >
                <i data-lucide="trash-2" class="icon-xs" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  if (typeof window !== 'undefined' && window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/**
 * Wires event listeners for Transaction Form modal, Delete modal, and History filters.
 */
export function initTransactionUI({ onDataChange }) {
  onDataChangeCallback = onDataChange;

  // Type toggle inside Add/Edit modal
  document.querySelectorAll('[data-tx-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setModalTransactionType(btn.dataset.txType);
    });
  });

  // Transaction form submission
  const form = document.getElementById('transaction-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFormErrors();

    const id = document.getElementById('tx-id').value.trim();
    const rawInput = {
      type: document.getElementById('tx-type').value,
      title: document.getElementById('tx-title').value,
      amount: document.getElementById('tx-amount').value,
      date: document.getElementById('tx-date').value,
      category: document.getElementById('tx-category').value,
      description: document.getElementById('tx-description').value,
    };

    const validation = validateTransactionInput(rawInput);
    if (!validation.valid) {
      showFormErrors(validation.errors);
      return;
    }

    const record = createTransactionRecord(rawInput, id || undefined);
    (async () => {
      try {
        if (id) {
          await updateTransaction(id, record);
          onDataChangeCallback?.('Transaction updated.');
        } else {
          await addTransaction(record);
          onDataChangeCallback?.('Transaction added.');
        }
        closeTransactionModal();
      } catch (err) {
        showFormErrors({ amount: err.message || 'Server error occurred while saving.' });
      }
    })();
  });

  // Modal close / cancel handlers
  document.getElementById('btn-close-transaction-modal')?.addEventListener('click', closeTransactionModal);
  document.getElementById('btn-cancel-transaction')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'transaction-modal') closeTransactionModal();
  });

  // Delete confirmation modal handlers
  document.getElementById('btn-close-delete-modal')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') closeDeleteModal();
  });

  document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteTransaction(pendingDeleteId);
      closeDeleteModal();
      onDataChangeCallback?.('Transaction deleted.');
    } catch (err) {
      alert(err.message || 'Error deleting transaction from server.');
    }
  });

  // Table row Edit / Delete delegation
  document.getElementById('all-transactions-body')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.js-edit-tx');
    if (editBtn) {
      const tx = cachedTransactions.find((item) => item.id === editBtn.dataset.id);
      if (tx) openTransactionModal(tx);
      return;
    }

    const deleteBtn = e.target.closest('.js-delete-tx');
    if (deleteBtn) {
      const tx = cachedTransactions.find((item) => item.id === deleteBtn.dataset.id);
      if (tx) openDeleteModal(tx);
    }
  });

  // Search, filter, and sort controls
  document.getElementById('filter-search')?.addEventListener('input', (e) => {
    filterState.search = e.target.value;
    renderTransactionHistory(cachedTransactions);
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.type = btn.dataset.typeFilter;
      document.querySelectorAll('[data-type-filter]').forEach((el) => {
        const active = el === btn;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', String(active));
      });
      renderTransactionHistory(cachedTransactions);
    });
  });

  document.getElementById('filter-category')?.addEventListener('change', (e) => {
    filterState.category = e.target.value;
    renderTransactionHistory(cachedTransactions);
  });

  document.getElementById('sort-transactions')?.addEventListener('change', (e) => {
    filterState.sort = e.target.value;
    renderTransactionHistory(cachedTransactions);
  });

  const handleClearFilters = () => {
    resetFilters();
    renderTransactionHistory(cachedTransactions);
  };

  document.getElementById('btn-clear-filters')?.addEventListener('click', handleClearFilters);
  document.getElementById('btn-empty-clear-filters')?.addEventListener('click', handleClearFilters);
}
