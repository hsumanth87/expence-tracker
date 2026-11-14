const express = require('express');
const router = express.Router();
const {
  getAllBudgets,
  getBudgetForMonth,
  createBudget,
  updateBudget,
} = require('../controllers/budgetController');
const {
  validateBudgetParams,
  validateBudgetBody,
  validateBudgetUpdateBody,
  validateIntegerId,
} = require('../middleware/validator');
const { authenticateToken } = require('../middleware/authMiddleware');

// Protect all budget routes with JWT authentication
router.use(authenticateToken);

router.get('/', getAllBudgets);
router.get('/:year/:month', validateBudgetParams, getBudgetForMonth);
router.post('/', validateBudgetBody, createBudget);
router.put('/:id', validateIntegerId, validateBudgetUpdateBody, updateBudget);

module.exports = router;
