const db = require('../config/database');

const selectUserBudgetByYearMonthStmt = db.prepare(`
  SELECT id, user_id, month, year, amount, created_at
  FROM monthly_budgets
  WHERE (user_id = ? OR (user_id IS NULL AND ? = 1)) AND year = ? AND month = ?
`);

const selectUserBudgetByIdStmt = db.prepare(`
  SELECT id, user_id, month, year, amount, created_at
  FROM monthly_budgets
  WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))
`);

const selectAllUserBudgetsStmt = db.prepare(`
  SELECT id, user_id, month, year, amount, created_at
  FROM monthly_budgets
  WHERE user_id = ? OR (user_id IS NULL AND ? = 1)
  ORDER BY year DESC, month DESC
`);

const insertUserBudgetStmt = db.prepare(`
  INSERT INTO monthly_budgets (user_id, year, month, amount)
  VALUES (@userId, @year, @month, @amount)
`);

const updateUserBudgetStmt = db.prepare(`
  UPDATE monthly_budgets
  SET amount = @amount
  WHERE id = @id AND (user_id = @userId OR (user_id IS NULL AND @userId = 1))
`);

function getAllBudgets(req, res, next) {
  try {
    const userId = req.user.id;
    const budgets = selectAllUserBudgetsStmt.all(userId, userId);
    return res.status(200).json({
      success: true,
      data: budgets,
    });
  } catch (err) {
    next(err);
  }
}

function getBudgetForMonth(req, res, next) {
  try {
    const userId = req.user.id;
    const budget = selectUserBudgetByYearMonthStmt.get(userId, userId, req.parsedYear, req.parsedMonth);
    if (!budget) {
      return res.status(404).json({
        success: false,
        error: `No budget configured for ${req.parsedYear}-${String(req.parsedMonth).padStart(2, '0')}.`,
      });
    }
    return res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (err) {
    next(err);
  }
}

function createBudget(req, res, next) {
  try {
    const userId = req.user.id;
    const { year, month, amount } = req.validatedBudget;

    // Check if budget already exists for this user in this year and month
    const existing = selectUserBudgetByYearMonthStmt.get(userId, userId, year, month);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A budget already exists for ${year}-${String(month).padStart(2, '0')}. Use PUT to update it.`,
        data: existing,
      });
    }

    const info = insertUserBudgetStmt.run({ userId, year, month, amount });
    const newBudget = selectUserBudgetByIdStmt.get(info.lastInsertRowid, userId, userId);

    return res.status(201).json({
      success: true,
      message: 'Monthly budget created successfully.',
      data: newBudget,
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(err.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        error: 'A budget already exists for this month.',
      });
    }
    next(err);
  }
}

function updateBudget(req, res, next) {
  try {
    const userId = req.user.id;
    const existing = selectUserBudgetByIdStmt.get(req.parsedId, userId, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Budget with ID ${req.parsedId} not found.`,
      });
    }

    updateUserBudgetStmt.run({
      id: req.parsedId,
      userId,
      amount: req.validatedAmount,
    });

    const updated = selectUserBudgetByIdStmt.get(req.parsedId, userId, userId);
    return res.status(200).json({
      success: true,
      message: 'Monthly budget updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllBudgets,
  getBudgetForMonth,
  createBudget,
  updateBudget,
};
