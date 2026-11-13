/**
 * Centralized Data Persistence Layer (LocalStorage).
 *
 * Designed as an isolated repository module so that LocalStorage calls can be
 * replaced with REST API calls (fetch to Node/Express/SQL) in a future phase
 * without modifying UI components or financial calculation logic.
 */

export const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerflow_transactions_v1',
  BUDGETS: 'ledgerflow_budgets_v1',
  INITIALIZED: 'ledgerflow_initialized_v1',
};

/**
 * Returns local today date string in YYYY-MM-DD format.
 * @param {Date} [dateObj]
 * @returns {string}
 */
export function getTodayISO(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns local month key in YYYY-MM format.
 * @param {Date} [dateObj]
 * @returns {string}
 */
export function getCurrentMonthKey(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Shifts a YYYY-MM month key by a signed delta of months.
 * @param {string} monthKey
 * @param {number} delta
 * @returns {string}
 */
export function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getCurrentMonthKey(d);
}

/**
 * Builds deterministic sample transactions anchored to the current month
 * so dashboards, analytics, and budget tracking work out of the box.
 * @param {string} [baseMonth]
 */
export function buildSampleTransactions(baseMonth = getCurrentMonthKey()) {
  const m0 = baseMonth;
  const m1 = shiftMonthKey(baseMonth, -1);
  const m2 = shiftMonthKey(baseMonth, -2);
  const m3 = shiftMonthKey(baseMonth, -3);
  const m4 = shiftMonthKey(baseMonth, -4);
  const m5 = shiftMonthKey(baseMonth, -5);

  return [
    {
      id: 'tx_seed_01',
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: `${m0}-01`,
      description: 'Primary payroll direct deposit',
    },
    {
      id: 'tx_seed_02',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m0}-03`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_03',
      title: 'Grocery Shopping',
      amount: 245.5,
      category: 'Food',
      type: 'expense',
      date: `${m0}-05`,
      description: 'Weekly groceries and household staples',
    },
    {
      id: 'tx_seed_04',
      title: 'Design Consulting',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: `${m0}-08`,
      description: 'UI audit retainer invoice #104',
    },
    {
      id: 'tx_seed_05',
      title: 'Electric & Fiber Internet',
      amount: 168.75,
      category: 'Utilities',
      type: 'expense',
      date: `${m0}-10`,
      description: 'Monthly home utilities',
    },
    {
      id: 'tx_seed_06',
      title: 'City Transit Pass',
      amount: 96,
      category: 'Transportation',
      type: 'expense',
      date: `${m0}-11`,
      description: 'Monthly commuter metro card',
    },
    {
      id: 'tx_seed_07',
      title: 'Organic Market & Coffee',
      amount: 112.4,
      category: 'Food',
      type: 'expense',
      date: `${m0}-12`,
      description: 'Fresh produce and espresso beans',
    },
    {
      id: 'tx_seed_08',
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: `${m1}-01`,
      description: 'Primary payroll direct deposit',
    },
    {
      id: 'tx_seed_09',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m1}-03`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_10',
      title: 'Supermarket & Dining',
      amount: 520,
      category: 'Food',
      type: 'expense',
      date: `${m1}-14`,
      description: 'Groceries and team dinner',
    },
    {
      id: 'tx_seed_11',
      title: 'Dental Checkup',
      amount: 185,
      category: 'Healthcare',
      type: 'expense',
      date: `${m1}-19`,
      description: 'Routine cleaning and exam',
    },
    {
      id: 'tx_seed_12',
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m2}-01`,
      description: 'Primary payroll direct deposit',
    },
    {
      id: 'tx_seed_13',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m2}-03`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_14',
      title: 'Grocery & Meal Prep',
      amount: 470,
      category: 'Food',
      type: 'expense',
      date: `${m2}-15`,
      description: 'Monthly food expenses',
    },
    {
      id: 'tx_seed_15',
      title: 'Running Shoes & Apparel',
      amount: 215,
      category: 'Shopping',
      type: 'expense',
      date: `${m2}-21`,
      description: 'Seasonal athletic gear',
    },
    {
      id: 'tx_seed_16',
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m3}-01`,
      description: 'Primary payroll direct deposit',
    },
    {
      id: 'tx_seed_17',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m3}-03`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_18',
      title: 'Online Course Subscription',
      amount: 199,
      category: 'Education',
      type: 'expense',
      date: `${m3}-12`,
      description: 'Annual technical workshop',
    },
    {
      id: 'tx_seed_19',
      title: 'Streaming & Concert Tickets',
      amount: 148,
      category: 'Entertainment',
      type: 'expense',
      date: `${m3}-20`,
      description: 'Weekend live show and subscriptions',
    },
    {
      id: 'tx_seed_20',
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m4}-01`,
      description: 'Primary payroll direct deposit',
    },
    {
      id: 'tx_seed_21',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m4}-03`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_22',
      title: 'Groceries & Produce',
      amount: 430,
      category: 'Food',
      type: 'expense',
      date: `${m4}-16`,
      description: 'Monthly grocery runs',
    },
    {
      id: 'tx_seed_23',
      title: 'Quarterly Dividend',
      amount: 420,
      category: 'Investments',
      type: 'income',
      date: `${m5}-15`,
      description: 'Index fund distribution',
    },
    {
      id: 'tx_seed_24',
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m5}-01`,
      description: 'Primary payroll direct deposit',
    },
    {
      id: 'tx_seed_25',
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: `${m5}-03`,
      description: 'Monthly lease payment',
    },
    {
      id: 'tx_seed_26',
      title: 'Utilities & Mobile Plan',
      amount: 210,
      category: 'Utilities',
      type: 'expense',
      date: `${m5}-11`,
      description: 'Electricity, gas, and phone',
    },
  ];
}

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

/**
 * Seeds sample transactions and a default monthly budget on first visit only.
 */
export function seedDemoDataIfNeeded() {
  const storage = getStorage();
  if (!storage) return;

  const isInitialized = storage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!isInitialized) {
    const currentMonth = getCurrentMonthKey();
    storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(buildSampleTransactions(currentMonth)));
    storage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify({ [currentMonth]: 3000 }));
    storage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

/**
 * Restores initial demo data and default budget for the current month.
 */
export function resetDemoData() {
  const storage = getStorage();
  if (!storage) return;

  const currentMonth = getCurrentMonthKey();
  const sample = buildSampleTransactions(currentMonth);
  storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
  storage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify({ [currentMonth]: 3000 }));
  storage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

/**
 * Retrieves all stored transactions.
 * @returns {Array<Object>}
 */
export function getTransactions() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Overwrites the full transactions array in LocalStorage.
 * @param {Array<Object>} transactions
 */
export function saveTransactions(transactions) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

/**
 * Appends a new transaction record and persists it.
 * @param {Object} transaction
 * @returns {Array<Object>} Updated transactions list
 */
export function addTransaction(transaction) {
  const current = getTransactions();
  const next = [transaction, ...current];
  saveTransactions(next);
  return next;
}

/**
 * Updates an existing transaction by ID.
 * @param {string} id
 * @param {Object} updatedRecord
 * @returns {Array<Object>} Updated transactions list
 */
export function updateTransaction(id, updatedRecord) {
  const current = getTransactions();
  const next = current.map((tx) => (tx.id === id ? { ...tx, ...updatedRecord, id } : tx));
  saveTransactions(next);
  return next;
}

/**
 * Removes a transaction by ID.
 * @param {string} id
 * @returns {Array<Object>} Updated transactions list
 */
export function deleteTransaction(id) {
  const current = getTransactions();
  const next = current.filter((tx) => tx.id !== id);
  saveTransactions(next);
  return next;
}

/**
 * Retrieves the map of monthly budgets ({ "YYYY-MM": number }).
 * @returns {Record<string, number>}
 */
export function getBudgets() {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(STORAGE_KEYS.BUDGETS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Returns the configured budget limit for a given YYYY-MM month, or 0 if unset.
 * @param {string} monthKey
 * @returns {number}
 */
export function getBudgetForMonth(monthKey) {
  const budgets = getBudgets();
  const val = Number(budgets[monthKey]);
  return Number.isFinite(val) && val > 0 ? val : 0;
}

/**
 * Persists the monthly budget limit for a given YYYY-MM month.
 * @param {string} monthKey
 * @param {number} limit
 * @returns {Record<string, number>}
 */
export function saveBudgetForMonth(monthKey, limit) {
  const storage = getStorage();
  const budgets = getBudgets();
  const next = { ...budgets, [monthKey]: Number(limit) };
  if (storage) {
    storage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(next));
  }
  return next;
}
