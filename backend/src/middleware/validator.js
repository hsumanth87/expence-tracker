function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return (
    dateObj.getFullYear() === y &&
    dateObj.getMonth() === m - 1 &&
    dateObj.getDate() === d
  );
}

function validateTransactionBody(req, res, next) {
  const { title, amount, category, type, date, description } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Title is required and must not be empty.',
    });
  }

  const numericAmount = Number(amount);
  if (amount === undefined || amount === null || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount is required and must be a number greater than 0.',
    });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({
      success: false,
      error: 'Type is required and must be either "income" or "expense".',
    });
  }

  if (!category || typeof category !== 'string' || category.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Category is required and must not be empty.',
    });
  }

  if (!date || !isValidDate(date)) {
    return res.status(400).json({
      success: false,
      error: 'Date is required and must be a valid calendar date in YYYY-MM-DD format.',
    });
  }

  // Attach normalized values to req.validatedData
  req.validatedData = {
    title: title.trim(),
    amount: Math.round(numericAmount * 100) / 100,
    category: category.trim(),
    type,
    date,
    description: typeof description === 'string' ? description.trim() : '',
  };

  next();
}

function validateIntegerId(req, res, next) {
  const idNum = Number(req.params.id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID. ID must be a positive integer.',
    });
  }
  req.parsedId = idNum;
  next();
}

function validateBudgetParams(req, res, next) {
  const year = Number(req.params.year);
  const month = Number(req.params.month);

  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return res.status(400).json({
      success: false,
      error: 'Year must be a valid 4-digit integer.',
    });
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({
      success: false,
      error: 'Month must be an integer between 1 and 12.',
    });
  }

  req.parsedYear = year;
  req.parsedMonth = month;
  next();
}

function validateBudgetBody(req, res, next) {
  const { year, month, amount } = req.body;

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1000 || yearNum > 9999) {
    return res.status(400).json({
      success: false,
      error: 'Year is required and must be a valid 4-digit integer.',
    });
  }

  const monthNum = Number(month);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    return res.status(400).json({
      success: false,
      error: 'Month is required and must be an integer between 1 and 12.',
    });
  }

  const amountNum = Number(amount);
  if (amount === undefined || amount === null || !Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount is required and must be a number greater than 0.',
    });
  }

  req.validatedBudget = {
    year: yearNum,
    month: monthNum,
    amount: Math.round(amountNum * 100) / 100,
  };

  next();
}

function validateBudgetUpdateBody(req, res, next) {
  const { amount } = req.body;
  const amountNum = Number(amount);

  if (amount === undefined || amount === null || !Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount is required and must be a number greater than 0.',
    });
  }

  req.validatedAmount = Math.round(amountNum * 100) / 100;
  next();
}

module.exports = {
  validateTransactionBody,
  validateIntegerId,
  validateBudgetParams,
  validateBudgetBody,
  validateBudgetUpdateBody,
};

