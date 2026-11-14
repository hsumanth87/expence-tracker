/**
 * Centralized Data Persistence Layer (REST API Client with Migration).
 *
 * Communicates with the Node.js + Express + SQLite backend.
 * All dashboard totals, charts, and budget values are computed from records
 * returned by the database.
 */

export const API_BASE = '/api';

export const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerflow_transactions_v1',
  BUDGETS: 'ledgerflow_budgets_v1',
  INITIALIZED: 'ledgerflow_initialized_v1',
  MIGRATED: 'ledgerflow_migrated_v1',
};

// In-memory cache populated from database API
let cachedTransactions = [];
let cachedBudgets = {}; // Map of "YYYY-MM" -> { id, year, month, amount }
let isDataLoading = false;
let apiErrorMessage = null;

export function getIsLoading() {
  return isDataLoading;
}

export function getApiError() {
  return apiErrorMessage;
}

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
 * Builds deterministic sample transactions anchored to the current month.
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
    { title: 'Monthly Salary', amount: 5400, category: 'Salary', type: 'income', date: `${m0}-01`, description: 'Primary payroll direct deposit' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m0}-03`, description: 'Monthly lease payment' },
    { title: 'Grocery Shopping', amount: 245.5, category: 'Food', type: 'expense', date: `${m0}-05`, description: 'Weekly groceries and household staples' },
    { title: 'Design Consulting', amount: 850, category: 'Freelance', type: 'income', date: `${m0}-08`, description: 'UI audit retainer invoice #104' },
    { title: 'Electric & Fiber Internet', amount: 168.75, category: 'Utilities', type: 'expense', date: `${m0}-10`, description: 'Monthly home utilities' },
    { title: 'City Transit Pass', amount: 96, category: 'Transportation', type: 'expense', date: `${m0}-11`, description: 'Monthly commuter metro card' },
    { title: 'Organic Market & Coffee', amount: 112.4, category: 'Food', type: 'expense', date: `${m0}-12`, description: 'Fresh produce and espresso beans' },
    { title: 'Monthly Salary', amount: 5400, category: 'Salary', type: 'income', date: `${m1}-01`, description: 'Primary payroll direct deposit' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m1}-03`, description: 'Monthly lease payment' },
    { title: 'Supermarket & Dining', amount: 520, category: 'Food', type: 'expense', date: `${m1}-14`, description: 'Groceries and team dinner' },
    { title: 'Dental Checkup', amount: 185, category: 'Healthcare', type: 'expense', date: `${m1}-19`, description: 'Routine cleaning and exam' },
    { title: 'Monthly Salary', amount: 5200, category: 'Salary', type: 'income', date: `${m2}-01`, description: 'Primary payroll direct deposit' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m2}-03`, description: 'Monthly lease payment' },
    { title: 'Grocery & Meal Prep', amount: 470, category: 'Food', type: 'expense', date: `${m2}-15`, description: 'Monthly food expenses' },
    { title: 'Running Shoes & Apparel', amount: 215, category: 'Shopping', type: 'expense', date: `${m2}-21`, description: 'Seasonal athletic gear' },
    { title: 'Monthly Salary', amount: 5200, category: 'Salary', type: 'income', date: `${m3}-01`, description: 'Primary payroll direct deposit' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m3}-03`, description: 'Monthly lease payment' },
    { title: 'Online Course Subscription', amount: 199, category: 'Education', type: 'expense', date: `${m3}-12`, description: 'Annual technical workshop' },
    { title: 'Streaming & Concert Tickets', amount: 148, category: 'Entertainment', type: 'expense', date: `${m3}-20`, description: 'Weekend live show and subscriptions' },
    { title: 'Monthly Salary', amount: 5200, category: 'Salary', type: 'income', date: `${m4}-01`, description: 'Primary payroll direct deposit' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m4}-03`, description: 'Monthly lease payment' },
    { title: 'Groceries & Produce', amount: 430, category: 'Food', type: 'expense', date: `${m4}-16`, description: 'Monthly grocery runs' },
    { title: 'Quarterly Dividend', amount: 420, category: 'Investments', type: 'income', date: `${m5}-15`, description: 'Index fund distribution' },
    { title: 'Monthly Salary', amount: 5200, category: 'Salary', type: 'income', date: `${m5}-01`, description: 'Primary payroll direct deposit' },
    { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m5}-03`, description: 'Monthly lease payment' },
    { title: 'Utilities & Mobile Plan', amount: 210, category: 'Utilities', type: 'expense', date: `${m5}-11`, description: 'Electricity, gas, and phone' },
  ];
}

/**
 * One-time migration: imports existing LocalStorage transactions and budgets
 * into the SQLite database via API.
 * Original LocalStorage data is kept intact as backup.
 * Sets a flag 'ledgerflow_migrated_v1' so it never runs twice.
 */
export async function migrateLocalStorageIfNeeded() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { migratedCount: 0, skipped: true };
  }

  const isMigrated = window.localStorage.getItem(STORAGE_KEYS.MIGRATED);
  if (isMigrated === 'true') {
    return { migratedCount: 0, alreadyMigrated: true };
  }

  let txImportCount = 0;
  let budgetImportCount = 0;

  try {
    // 1. Check for existing LocalStorage transactions
    const rawTx = window.localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (rawTx) {
      const parsedTx = JSON.parse(rawTx);
      if (Array.isArray(parsedTx) && parsedTx.length > 0) {
        for (const item of parsedTx) {
          try {
            await fetch(`${API_BASE}/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.title,
                amount: Number(item.amount),
                category: item.category,
                type: item.type,
                date: item.date,
                description: item.description || '',
              }),
            });
            txImportCount += 1;
          } catch (e) {
            console.error('Failed to migrate transaction:', item, e);
          }
        }
      }
    }

    // 2. Check for existing LocalStorage budgets
    const rawBudgets = window.localStorage.getItem(STORAGE_KEYS.BUDGETS);
    if (rawBudgets) {
      const parsedBudgets = JSON.parse(rawBudgets);
      if (parsedBudgets && typeof parsedBudgets === 'object') {
        for (const [monthKey, limit] of Object.entries(parsedBudgets)) {
          if (!/^\d{4}-\d{2}$/.test(monthKey) || Number(limit) <= 0) continue;
          const [yearStr, monthStr] = monthKey.split('-');
          try {
            await fetch(`${API_BASE}/budgets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                year: Number(yearStr),
                month: Number(monthStr),
                amount: Number(limit),
              }),
            });
            budgetImportCount += 1;
          } catch (e) {
            console.error('Failed to migrate budget for month:', monthKey, e);
          }
        }
      }
    }

    // Mark as migrated so this migration runs only once
    window.localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
    console.log(
      `[Migration] Completed: ${txImportCount} transactions and ${budgetImportCount} monthly budgets imported into SQLite.`
    );

    return {
      migratedCount: txImportCount + budgetImportCount,
      transactions: txImportCount,
      budgets: budgetImportCount,
    };
  } catch (err) {
    console.error('[Migration] Error during migration:', err);
    return { migratedCount: txImportCount + budgetImportCount, error: err };
  }
}

/**
 * Fetches all transactions and budgets from the backend database.
 */
export async function loadAllData() {
  isDataLoading = true;
  apiErrorMessage = null;

  try {
    // 1. Fetch transactions (newest first from API)
    const txRes = await fetch(`${API_BASE}/transactions`);
    if (!txRes.ok) {
      throw new Error(`Failed to load transactions (Status ${txRes.status})`);
    }
    const txJson = await txRes.json();
    cachedTransactions = Array.isArray(txJson.data) ? txJson.data : [];

    // 2. Fetch budgets
    const budgetRes = await fetch(`${API_BASE}/budgets`);
    if (budgetRes.ok) {
      const budgetJson = await budgetRes.json();
      const budgetList = Array.isArray(budgetJson.data) ? budgetJson.data : [];
      cachedBudgets = {};
      for (const b of budgetList) {
        const key = `${b.year}-${String(b.month).padStart(2, '0')}`;
        cachedBudgets[key] = b;
      }
    }

    // 3. If database is completely empty on first launch, seed sample data once
    if (cachedTransactions.length === 0) {
      const currentMonth = getCurrentMonthKey();
      const samples = buildSampleTransactions(currentMonth);
      for (const s of samples) {
        try {
          await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          });
        } catch {}
      }
      // Seed initial default budget
      const [currY, currM] = currentMonth.split('-').map(Number);
      try {
        await fetch(`${API_BASE}/budgets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: currY, month: currM, amount: 3000 }),
        });
      } catch {}

      // Re-fetch after seeding
      const reTx = await fetch(`${API_BASE}/transactions`);
      if (reTx.ok) {
        const reTxJson = await reTx.json();
        cachedTransactions = Array.isArray(reTxJson.data) ? reTxJson.data : [];
      }
      const reBudget = await fetch(`${API_BASE}/budgets`);
      if (reBudget.ok) {
        const reBJson = await reBudget.json();
        const bList = Array.isArray(reBJson.data) ? reBJson.data : [];
        cachedBudgets = {};
        for (const b of bList) {
          const key = `${b.year}-${String(b.month).padStart(2, '0')}`;
          cachedBudgets[key] = b;
        }
      }
    }

    isDataLoading = false;
    return { success: true };
  } catch (err) {
    isDataLoading = false;
    apiErrorMessage = err.message || 'Unable to connect to backend server.';
    console.error('[API] Error loading data:', err);
    return { success: false, error: apiErrorMessage };
  }
}

/**
 * Retrieves all stored transactions from the database cache.
 * @returns {Array<Object>}
 */
export function getTransactions() {
  return [...cachedTransactions];
}

/**
 * Creates a new transaction record via REST API and refreshes data.
 * @param {Object} transaction
 * @returns {Promise<Array<Object>>}
 */
export async function addTransaction(transaction) {
  try {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: transaction.title,
        amount: Number(transaction.amount),
        category: transaction.category,
        type: transaction.type,
        date: transaction.date,
        description: transaction.description || '',
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    // Refresh transactions list
    await loadAllData();
    return getTransactions();
  } catch (err) {
    console.error('[API] addTransaction failed:', err);
    throw err;
  }
}

/**
 * Updates an existing transaction by ID via REST API.
 * @param {string|number} id
 * @param {Object} updatedRecord
 * @returns {Promise<Array<Object>>}
 */
export async function updateTransaction(id, updatedRecord) {
  try {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: updatedRecord.title,
        amount: Number(updatedRecord.amount),
        category: updatedRecord.category,
        type: updatedRecord.type,
        date: updatedRecord.date,
        description: updatedRecord.description || '',
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    // Refresh transactions list
    await loadAllData();
    return getTransactions();
  } catch (err) {
    console.error('[API] updateTransaction failed:', err);
    throw err;
  }
}

/**
 * Removes a transaction by ID via REST API.
 * @param {string|number} id
 * @returns {Promise<Array<Object>>}
 */
export async function deleteTransaction(id) {
  try {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    // Refresh transactions list
    await loadAllData();
    return getTransactions();
  } catch (err) {
    console.error('[API] deleteTransaction failed:', err);
    throw err;
  }
}

/**
 * Returns the configured budget limit for a given YYYY-MM month, or 0 if unset.
 * @param {string} monthKey
 * @returns {number}
 */
export function getBudgetForMonth(monthKey) {
  const budget = cachedBudgets[monthKey];
  if (budget && Number(budget.amount) > 0) {
    return Number(budget.amount);
  }
  return 0;
}

/**
 * Persists the monthly budget limit for a given YYYY-MM month via API.
 * Creates a new budget if none exists, or updates the existing one.
 * @param {string} monthKey
 * @param {number} limit
 * @returns {Promise<number>}
 */
export async function saveBudgetForMonth(monthKey, limit) {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const amount = Number(limit);

  const existing = cachedBudgets[monthKey];

  try {
    if (existing && existing.id) {
      // Update existing budget
      const res = await fetch(`${API_BASE}/budgets/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      cachedBudgets[monthKey] = json.data;
    } else {
      // Create new budget
      const res = await fetch(`${API_BASE}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json.data?.id) {
          // If conflict occurred because record existed, update it
          const putRes = await fetch(`${API_BASE}/budgets/${json.data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
          });
          const putJson = await putRes.json();
          cachedBudgets[monthKey] = putJson.data;
        } else {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
      } else {
        cachedBudgets[monthKey] = json.data;
      }
    }

    return amount;
  } catch (err) {
    console.error('[API] saveBudgetForMonth failed:', err);
    throw err;
  }
}

/**
 * Restores initial demo data and default budget by clearing database through API
 * and re-inserting sample records.
 */
export async function resetDemoData() {
  try {
    // Delete existing transactions
    for (const tx of cachedTransactions) {
      try {
        await fetch(`${API_BASE}/transactions/${tx.id}`, { method: 'DELETE' });
      } catch {}
    }

    // Insert fresh sample transactions
    const currentMonth = getCurrentMonthKey();
    const samples = buildSampleTransactions(currentMonth);
    for (const s of samples) {
      try {
        await fetch(`${API_BASE}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        });
      } catch {}
    }

    // Set default budget
    const [y, m] = currentMonth.split('-').map(Number);
    const existing = cachedBudgets[currentMonth];
    if (existing?.id) {
      await fetch(`${API_BASE}/budgets/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 3000 }),
      });
    } else {
      await fetch(`${API_BASE}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: y, month: m, amount: 3000 }),
      });
    }

    await loadAllData();
    return getTransactions();
  } catch (err) {
    console.error('[API] resetDemoData failed:', err);
    throw err;
  }
}
