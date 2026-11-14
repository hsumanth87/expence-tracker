const express = require('express');
const router = express.Router();
const {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');
const {
  validateTransactionBody,
  validateIntegerId,
} = require('../middleware/validator');
const { authenticateToken } = require('../middleware/authMiddleware');

// Protect all transaction routes with JWT authentication
router.use(authenticateToken);

router.get('/', getAllTransactions);
router.get('/:id', validateIntegerId, getTransactionById);
router.post('/', validateTransactionBody, createTransaction);
router.put('/:id', validateIntegerId, validateTransactionBody, updateTransaction);
router.delete('/:id', validateIntegerId, deleteTransaction);

module.exports = router;
