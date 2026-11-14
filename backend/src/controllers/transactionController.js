const db = require('../config/database');

// Prepared statements scoped by authenticated user_id
const selectAllUserTxStmt = db.prepare(`
  SELECT id, user_id, title, amount, category, type, date, description, created_at
  FROM transactions
  WHERE user_id = ? OR (user_id IS NULL AND ? = 1)
  ORDER BY date DESC, id DESC
`);

const selectUserTxByIdStmt = db.prepare(`
  SELECT id, user_id, title, amount, category, type, date, description, created_at
  FROM transactions
  WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))
`);

const insertUserTxStmt = db.prepare(`
  INSERT INTO transactions (user_id, title, amount, category, type, date, description)
  VALUES (@userId, @title, @amount, @category, @type, @date, @description)
`);

const updateUserTxStmt = db.prepare(`
  UPDATE transactions
  SET title = @title,
      amount = @amount,
      category = @category,
      type = @type,
      date = @date,
      description = @description
  WHERE id = @id AND (user_id = @userId OR (user_id IS NULL AND @userId = 1))
`);

const deleteUserTxStmt = db.prepare(`
  DELETE FROM transactions
  WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))
`);

function getAllTransactions(req, res, next) {
  try {
    const userId = req.user.id;
    const transactions = selectAllUserTxStmt.all(userId, userId);
    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
}

function getTransactionById(req, res, next) {
  try {
    const userId = req.user.id;
    const transaction = selectUserTxByIdStmt.get(req.parsedId, userId, userId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${req.parsedId} not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
}

function createTransaction(req, res, next) {
  try {
    const userId = req.user.id;
    const { title, amount, category, type, date, description } = req.validatedData;
    const info = insertUserTxStmt.run({
      userId,
      title,
      amount,
      category,
      type,
      date,
      description,
    });

    const newTransaction = selectUserTxByIdStmt.get(info.lastInsertRowid, userId, userId);
    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully.',
      data: newTransaction,
    });
  } catch (err) {
    next(err);
  }
}

function updateTransaction(req, res, next) {
  try {
    const userId = req.user.id;
    const existing = selectUserTxByIdStmt.get(req.parsedId, userId, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${req.parsedId} not found.`,
      });
    }

    const { title, amount, category, type, date, description } = req.validatedData;
    updateUserTxStmt.run({
      id: req.parsedId,
      userId,
      title,
      amount,
      category,
      type,
      date,
      description,
    });

    const updated = selectUserTxByIdStmt.get(req.parsedId, userId, userId);
    return res.status(200).json({
      success: true,
      message: 'Transaction updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

function deleteTransaction(req, res, next) {
  try {
    const userId = req.user.id;
    const existing = selectUserTxByIdStmt.get(req.parsedId, userId, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${req.parsedId} not found.`,
      });
    }

    deleteUserTxStmt.run(req.parsedId, userId, userId);
    return res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
