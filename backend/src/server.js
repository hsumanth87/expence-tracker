const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
const backendDir = path.resolve(__dirname, '../');
dotenv.config({ path: path.join(backendDir, '.env') });

// Initialize database
const db = require('./config/database');

const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Expense Tracker API is running.',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// REST API routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/assistant', assistantRoutes);

// Catch-all for unknown /api routes
app.use('/api', notFoundHandler);

// Serve frontend static assets from parent directory (expence-tracker)
const frontendDir = path.resolve(__dirname, '../../');
app.use(express.static(frontendDir));

// Fallback to index.html for root or SPA navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendDir, 'index.html'));
  }
  next();
});

// Central error handling middleware
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server started successfully on http://localhost:${PORT}`);
    console.log(`API Health Check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
