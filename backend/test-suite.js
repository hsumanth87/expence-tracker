const http = require('http');
const app = require('./src/server');

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  const results = [];

  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✔ ${name}`);
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
      console.error(`✖ ${name}: ${err.message}`);
    }
  }

  // 1. Health check
  await check('GET /api/health returns 200 and status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
    if (json.status !== 'ok') throw new Error(`Expected status: 'ok', got ${json.status}`);
  });

  // 2. Initial transactions list
  await check('GET /api/transactions returns 200 and array', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`);
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
    if (!Array.isArray(json.data)) throw new Error('Expected data to be an array');
  });

  // 3. Create valid income transaction
  let incomeId = null;
  await check('POST /api/transactions creates income and returns 201', async () => {
    const payload = {
      title: 'Consulting Project',
      amount: 1500,
      category: 'Freelance',
      type: 'income',
      date: '2026-11-10',
      description: 'Initial design retainer',
    };
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status} (${json.error})`);
    if (!json.data || !json.data.id) throw new Error('Expected data.id in response');
    if (json.data.title !== 'Consulting Project') throw new Error('Title mismatch');
    incomeId = json.data.id;
  });

  // 4. Create valid expense transaction
  let expenseId = null;
  await check('POST /api/transactions creates expense and returns 201', async () => {
    const payload = {
      title: 'Office Supplies',
      amount: 75.5,
      category: 'Shopping',
      type: 'expense',
      date: '2026-11-12',
      description: 'Desk organizer and pens',
    };
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status} (${json.error})`);
    if (!json.data || !json.data.id) throw new Error('Expected data.id in response');
    expenseId = json.data.id;
  });

  // 5. Validation: Missing title
  await check('POST /api/transactions rejects missing title with 400', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50, type: 'expense', category: 'Food', date: '2026-11-10' }),
    });
    const json = await res.json();
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (!json.error || !json.error.includes('Title')) throw new Error('Expected title error message');
  });

  // 6. Validation: Negative amount
  await check('POST /api/transactions rejects negative amount with 400', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Snacks', amount: -25, type: 'expense', category: 'Food', date: '2026-11-10' }),
    });
    const json = await res.json();
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (!json.error || !json.error.includes('Amount')) throw new Error('Expected amount error message');
  });

  // 7. Validation: Invalid type
  await check('POST /api/transactions rejects invalid type with 400', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Snacks', amount: 25, type: 'transfer', category: 'Food', date: '2026-11-10' }),
    });
    const json = await res.json();
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (!json.error || !json.error.includes('Type')) throw new Error('Expected type error message');
  });

  // 8. Validation: Invalid date
  await check('POST /api/transactions rejects invalid calendar date with 400', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Snacks', amount: 25, type: 'expense', category: 'Food', date: '2026-02-30' }),
    });
    const json = await res.json();
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (!json.error || !json.error.includes('Date')) throw new Error('Expected date error message');
  });

  // 9. GET /api/transactions/:id valid
  await check('GET /api/transactions/:id returns 200 with record', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/${incomeId}`);
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (json.data.id !== incomeId) throw new Error('ID mismatch');
  });

  // 10. GET /api/transactions/:id non-existent
  await check('GET /api/transactions/:id returns 404 for non-existent record', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/999999`);
    const json = await res.json();
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    if (!json.error) throw new Error('Expected error message');
  });

  // 11. GET /api/transactions/:id invalid integer
  await check('GET /api/transactions/:id returns 400 for non-integer id', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/invalid-id`);
    const json = await res.json();
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 12. PUT /api/transactions/:id update
  await check('PUT /api/transactions/:id updates transaction and returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/${incomeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Consulting Project (Updated)',
        amount: 1750,
        category: 'Freelance',
        type: 'income',
        date: '2026-11-10',
        description: 'Updated invoice amount',
      }),
    });
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (json.data.amount !== 1750) throw new Error('Amount was not updated');
    if (json.data.title !== 'Consulting Project (Updated)') throw new Error('Title was not updated');
  });

  // 13. DELETE /api/transactions/:id
  await check('DELETE /api/transactions/:id deletes transaction and returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/${expenseId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    const verify = await fetch(`${baseUrl}/api/transactions/${expenseId}`);
    if (verify.status !== 404) throw new Error('Deleted item still accessible');
  });

  // 14. DELETE /api/transactions/:id non-existent returns 404
  await check('DELETE /api/transactions/:id returns 404 for already deleted id', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/${expenseId}`, {
      method: 'DELETE',
    });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // 15. Create Budget
  let budgetId = null;
  await check('POST /api/budgets creates monthly budget and returns 201', async () => {
    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2026, month: 11, amount: 3500 }),
    });
    const json = await res.json();
    if (res.status !== 201 && res.status !== 409) {
      throw new Error(`Expected 201 or 409, got ${res.status} (${json.error})`);
    }
    if (res.status === 201) {
      budgetId = json.data.id;
    } else {
      budgetId = json.data.id;
    }
  });

  // 16. Duplicate Budget returns 409
  await check('POST /api/budgets returns 409 for duplicate month', async () => {
    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2026, month: 11, amount: 4000 }),
    });
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
  });

  // 17. Budget validation: invalid month
  await check('POST /api/budgets rejects month 13 with 400', async () => {
    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2026, month: 13, amount: 4000 }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 18. GET /api/budgets/:year/:month
  await check('GET /api/budgets/:year/:month returns 200 with budget', async () => {
    const res = await fetch(`${baseUrl}/api/budgets/2026/11`);
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (json.data.amount <= 0) throw new Error('Expected positive budget amount');
  });

  // 19. GET /api/budgets/:year/:month non-existent month
  await check('GET /api/budgets/:year/:month returns 404 for unconfigured month', async () => {
    const res = await fetch(`${baseUrl}/api/budgets/2099/1`);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // 20. PUT /api/budgets/:id
  await check('PUT /api/budgets/:id updates budget and returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/budgets/${budgetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 4200 }),
    });
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (json.data.amount !== 4200) throw new Error('Budget amount not updated');
  });

  // 21. Unknown API route returns 404 JSON
  await check('GET /api/unknown-endpoint returns 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-route`);
    const json = await res.json();
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    if (!json.error || !json.error.includes('Route not found')) throw new Error('Expected JSON error');
  });

  // 22. Frontend static serving
  await check('GET / serves index.html with 200', async () => {
    const res = await fetch(`${baseUrl}/`);
    const text = await res.text();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!text.includes('LedgerFlow Expense Tracker')) throw new Error('Expected index.html content');
  });

  await check('GET /css/style.css serves CSS with 200', async () => {
    const res = await fetch(`${baseUrl}/css/style.css`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await check('GET /js/app.js serves JavaScript with 200', async () => {
    const res = await fetch(`${baseUrl}/js/app.js`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 23. AI Assistant insights
  await check('GET /api/assistant/insights returns 200 and structured financial insights', async () => {
    const res = await fetch(`${baseUrl}/api/assistant/insights?month=2026-11`);
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (typeof json.data.healthScore !== 'number') throw new Error('Expected healthScore number');
    if (!Array.isArray(json.data.insights)) throw new Error('Expected insights array');
    if (!Array.isArray(json.data.recommendations)) throw new Error('Expected recommendations array');
  });

  // 24. AI Assistant chat
  await check('POST /api/assistant/chat answers financial inquiry with 200', async () => {
    const res = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How is my budget looking?', month: '2026-11' }),
    });
    const json = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!json.data.reply || typeof json.data.reply !== 'string') throw new Error('Expected reply text');
  });

  // 25. AI Assistant chat validation: empty query
  await check('POST /api/assistant/chat rejects empty message with 400', async () => {
    const res = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ', month: '2026-11' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await new Promise((resolve) => server.close(resolve));
  console.log(`\nTest summary: ${results.filter(r => r.passed).length}/${results.length} tests passed.`);
  if (results.some(r => !r.passed)) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

