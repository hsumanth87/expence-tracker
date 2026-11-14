const db = require('../config/database');

const selectUserTxStmt = db.prepare(`
  SELECT id, user_id, title, amount, category, type, date, description, created_at
  FROM transactions
  WHERE user_id = ? OR (user_id IS NULL AND ? = 1)
  ORDER BY date DESC, id DESC
`);

const selectUserBudgetStmt = db.prepare(`
  SELECT id, user_id, month, year, amount, created_at
  FROM monthly_budgets
  WHERE (user_id = ? OR (user_id IS NULL AND ? = 1)) AND year = ? AND month = ?
`);

/**
 * Calculates financial analytics for a specific month scoped to user.
 */
function getFinancialContext(monthKey, userId = 1) {
  const [yearStr, monthStr] = (monthKey || new Date().toISOString().slice(0, 7)).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  const allTransactions = selectUserTxStmt.all(userId, userId);
  const budgetRecord = selectUserBudgetStmt.get(userId, userId, year, month);
  const budgetLimit = budgetRecord ? Number(budgetRecord.amount) : 0;

  // Filter for the selected month
  const monthTransactions = allTransactions.filter(
    (tx) => typeof tx.date === 'string' && tx.date.startsWith(monthKey)
  );

  let monthIncome = 0;
  let monthExpense = 0;
  const categoryTotals = {};

  for (const tx of monthTransactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      monthIncome += amt;
    } else if (tx.type === 'expense') {
      monthExpense += amt;
      const cat = tx.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  }

  // All-time totals
  let totalIncome = 0;
  let totalExpense = 0;
  for (const tx of allTransactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') totalIncome += amt;
    else if (tx.type === 'expense') totalExpense += amt;
  }

  // Top expense categories sorted
  const sortedCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: monthExpense > 0 ? Math.round((amount / monthExpense) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const remainingBudget = budgetLimit > 0 ? Math.round((budgetLimit - monthExpense) * 100) / 100 : 0;
  const budgetUtilization = budgetLimit > 0 ? Math.round((monthExpense / budgetLimit) * 1000) / 10 : 0;
  const netSavings = Math.round((monthIncome - monthExpense) * 100) / 100;
  const savingsRate = monthIncome > 0 ? Math.round((netSavings / monthIncome) * 1000) / 10 : 0;

  // Calculate a Financial Health Score (0 - 100)
  let healthScore = 70;
  if (budgetLimit > 0) {
    if (budgetUtilization <= 70) healthScore += 15;
    else if (budgetUtilization <= 85) healthScore += 5;
    else if (budgetUtilization > 100) healthScore -= 25;
    else healthScore -= 10;
  }
  if (savingsRate >= 20) healthScore += 15;
  else if (savingsRate >= 10) healthScore += 10;
  else if (savingsRate < 0) healthScore -= 20;

  healthScore = Math.max(10, Math.min(100, healthScore));

  return {
    monthKey,
    monthIncome: Math.round(monthIncome * 100) / 100,
    monthExpense: Math.round(monthExpense * 100) / 100,
    netSavings,
    savingsRate,
    budgetLimit,
    remainingBudget,
    budgetUtilization,
    sortedCategories,
    totalTransactionsCount: monthTransactions.length,
    allTimeTransactionsCount: allTransactions.length,
    allTimeBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
    healthScore,
    recentTransactions: monthTransactions.slice(0, 5),
  };
}

/**
 * Generates structured smart spending insights and actionable tips.
 */
async function generateSmartInsights(monthKey) {
  const context = getFinancialContext(monthKey);
  const insights = [];
  const recommendations = [];

  // Insight 1: Budget utilization check
  if (context.budgetLimit > 0) {
    if (context.budgetUtilization > 100) {
      insights.push({
        type: 'danger',
        title: 'Budget Exceeded',
        description: `You have spent $${context.monthExpense.toFixed(2)}, exceeding your $${context.budgetLimit.toFixed(2)} limit by $${Math.abs(context.remainingBudget).toFixed(2)} (${context.budgetUtilization}% used).`,
      });
    } else if (context.budgetUtilization >= 80) {
      insights.push({
        type: 'warning',
        title: 'Budget Alert (80%+ Reached)',
        description: `You have utilized ${context.budgetUtilization}% of your monthly cap. $${context.remainingBudget.toFixed(2)} remaining for this period.`,
      });
    } else {
      insights.push({
        type: 'positive',
        title: 'Budget On Track',
        description: `Spending is healthy at ${context.budgetUtilization}% of your $${context.budgetLimit.toFixed(2)} cap. You have $${context.remainingBudget.toFixed(2)} safe buffer left.`,
      });
    }
  } else {
    insights.push({
      type: 'info',
      title: 'No Spending Cap Configured',
      description: 'Set a monthly budget to unlock active variance tracking and predictive threshold alerts.',
    });
  }

  // Insight 2: Top category allocation
  if (context.sortedCategories.length > 0) {
    const topCat = context.sortedCategories[0];
    insights.push({
      type: topCat.percentage > 40 ? 'warning' : 'info',
      title: `Highest Spending: ${topCat.category}`,
      description: `${topCat.category} represents $${topCat.amount.toFixed(2)} (${topCat.percentage}% of all your expenses this month).`,
    });

    if (topCat.percentage > 35) {
      recommendations.push(
        `Review discretionary items in "${topCat.category}". Trimming 10% would free up $${(topCat.amount * 0.1).toFixed(2)} into savings.`
      );
    }
  }

  // Insight 3: Savings rate evaluation
  if (context.monthIncome > 0) {
    if (context.savingsRate >= 20) {
      insights.push({
        type: 'positive',
        title: 'Strong Savings Rate',
        description: `You are saving ${context.savingsRate}% of your income this month ($${context.netSavings.toFixed(2)} saved).`,
      });
    } else if (context.savingsRate > 0) {
      insights.push({
        type: 'info',
        title: 'Positive Cash Flow',
        description: `Your net savings is $${context.netSavings.toFixed(2)} (${context.savingsRate}% savings rate). Aim for 20% for accelerated wealth growth.`,
      });
      recommendations.push(
        `To reach a 20% target, aim to reserve $${(context.monthIncome * 0.2).toFixed(2)} per month before allocating variable spending.`
      );
    } else {
      insights.push({
        type: 'danger',
        title: 'Deficit Warning',
        description: `Expenses exceed recorded income by $${Math.abs(context.netSavings).toFixed(2)}. Look for non-essential cuts to avoid debt.`,
      });
      recommendations.push(
        'Pause non-essential shopping and subscription renewals until monthly cash flow returns positive.'
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain your current spending discipline to build emergency reserves.');
    recommendations.push('Review recurring utility and subscription plans quarterly for lower promo rates.');
  }

  // If Gemini API Key is configured, enhance with LLM commentary
  let aiNarrative = null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      aiNarrative = await queryGemini(
        `You are a wise, encouraging financial spending assistant. Here is the user's spending data for ${monthKey}:
Income: $${context.monthIncome}
Expenses: $${context.monthExpense}
Net Savings: $${context.netSavings} (${context.savingsRate}%)
Budget Limit: $${context.budgetLimit} (${context.budgetUtilization}% used)
Top Categories: ${context.sortedCategories.map((c) => `${c.category}: $${c.amount} (${c.percentage}%)`).join(', ')}

Provide a concise, 2-3 sentence personalized financial assessment and 1 key tip for them. Keep it professional, friendly, and direct.`,
        apiKey
      );
    } catch (e) {
      console.warn('[AI Assistant] Gemini API call skipped/failed, using local intelligence engine:', e.message);
    }
  }

  return {
    monthKey,
    healthScore: context.healthScore,
    summary: {
      income: context.monthIncome,
      expenses: context.monthExpense,
      netSavings: context.netSavings,
      savingsRate: context.savingsRate,
      budgetLimit: context.budgetLimit,
      budgetUtilization: context.budgetUtilization,
      remainingBudget: context.remainingBudget,
    },
    topCategories: context.sortedCategories.slice(0, 4),
    insights,
    recommendations,
    aiNarrative: aiNarrative || `Your financial health score is ${context.healthScore}/100. ${context.netSavings >= 0 ? `You have maintained a positive balance of $${context.netSavings.toFixed(2)}.` : `Monthly outlays currently exceed inflows by $${Math.abs(context.netSavings).toFixed(2)}.`} ${context.sortedCategories[0] ? `Your largest expense driver is ${context.sortedCategories[0].category} at ${context.sortedCategories[0].percentage}%.` : ''}`,
    source: aiNarrative ? 'gemini' : 'local-intelligence',
  };
}

/**
 * Handles conversational inquiries from the user regarding their finances.
 */
async function processUserChat(userMessage, monthKey) {
  const context = getFinancialContext(monthKey);
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const prompt = `You are LedgerFlow's Smart Spending Assistant. The user asks: "${userMessage}".
Here is their live financial data for month ${monthKey}:
- Total Monthly Income: $${context.monthIncome}
- Total Monthly Expenses: $${context.monthExpense}
- Net Balance / Savings: $${context.netSavings} (Savings rate: ${context.savingsRate}%)
- Monthly Budget Cap: $${context.budgetLimit > 0 ? `$${context.budgetLimit} (${context.budgetUtilization}% used, $${context.remainingBudget} remaining)` : 'No budget set'}
- Top Expense Categories: ${context.sortedCategories.map((c) => `${c.category}: $${c.amount} (${c.percentage}%)`).join(', ') || 'No expenses yet'}
- Recent transactions: ${context.recentTransactions.map((t) => `${t.title}: $${t.amount} (${t.category})`).join(', ') || 'None'}

Answer the user directly with specific numbers from their ledger. Be concise, actionable, and encouraging.`;

      const geminiReply = await queryGemini(prompt, apiKey);
      if (geminiReply) {
        return {
          reply: geminiReply,
          source: 'gemini',
          healthScore: context.healthScore,
        };
      }
    } catch (err) {
      console.warn('[AI Assistant] Fallback to deterministic intelligence engine:', err.message);
    }
  }

  // Built-in Deterministic Financial Intelligence Engine
  const q = (userMessage || '').toLowerCase();
  let reply = '';

  if (q.includes('budget') || q.includes('cap') || q.includes('limit')) {
    if (context.budgetLimit <= 0) {
      reply = `You haven't set a budget for ${monthKey} yet! You can head over to the Budget tab to configure a spending limit. So far this month, you have spent $${context.monthExpense.toFixed(2)}.`;
    } else if (context.budgetUtilization > 100) {
      reply = `⚠️ Alert: You have exceeded your $${context.budgetLimit.toFixed(2)} budget by $${Math.abs(context.remainingBudget).toFixed(2)} (${context.budgetUtilization}% utilized). Consider trimming non-essential expenses for the rest of the month.`;
    } else {
      reply = `✅ Your ${monthKey} budget is in good shape! You have spent $${context.monthExpense.toFixed(2)} out of $${context.budgetLimit.toFixed(2)} (${context.budgetUtilization}% used). You still have $${context.remainingBudget.toFixed(2)} remaining.`;
    }
  } else if (q.includes('save') || q.includes('saving') || q.includes('tips')) {
    const topCat = context.sortedCategories[0];
    reply = `💡 Here are tailored tips for ${monthKey}:\n\n` +
      `1. **Focus on your biggest category**: You spent $${topCat ? `${topCat.amount.toFixed(2)} on ${topCat.category}` : '0'}. Reducing this by 10% would save you $${topCat ? (topCat.amount * 0.1).toFixed(2) : '0'}.\n` +
      `2. **Current Savings Rate**: You are currently saving ${context.savingsRate}% of your income ($${context.netSavings.toFixed(2)}).\n` +
      `3. **Target 20%**: A solid baseline target is to set aside $${(context.monthIncome * 0.2).toFixed(2)} each month.`;
  } else if (q.includes('biggest') || q.includes('highest') || q.includes('most') || q.includes('category')) {
    if (context.sortedCategories.length > 0) {
      const top3 = context.sortedCategories.slice(0, 3);
      reply = `📊 Your highest spending categories for ${monthKey} are:\n\n` +
        top3.map((c, i) => `${i + 1}. **${c.category}**: $${c.amount.toFixed(2)} (${c.percentage}% of expenses)`).join('\n') +
        `\n\nTotal monthly spending across all categories is $${context.monthExpense.toFixed(2)}.`;
    } else {
      reply = `You have no recorded expenses for ${monthKey} yet! Once you add transactions, I will analyze your top categories.`;
    }
  } else if (q.includes('summary') || q.includes('flow') || q.includes('overview') || q.includes('how am i doing')) {
    reply = `📈 **Financial Summary for ${monthKey}**:\n\n` +
      `• **Total Inflows (Income)**: $${context.monthIncome.toFixed(2)}\n` +
      `• **Total Outflows (Expenses)**: $${context.monthExpense.toFixed(2)}\n` +
      `• **Net Balance**: $${context.netSavings.toFixed(2)} (${context.savingsRate}% savings rate)\n` +
      `• **Budget Status**: ${context.budgetLimit > 0 ? `${context.budgetUtilization}% used of $${context.budgetLimit.toFixed(2)} limit` : 'No budget configured'}\n` +
      `• **Financial Health Score**: ${context.healthScore}/100`;
  } else {
    reply = `Hello! I'm your AI Smart Spending Assistant. For ${monthKey}, you have recorded $${context.monthIncome.toFixed(2)} in income and $${context.monthExpense.toFixed(2)} in expenses, leaving a net balance of $${context.netSavings.toFixed(2)}.\n\n` +
      `You can ask me questions like:\n` +
      `• "How is my budget looking?"\n` +
      `• "What is my biggest expense?"\n` +
      `• "How can I save more money?"\n` +
      `• "Give me a summary of my spending."`;
  }

  return {
    reply,
    source: 'local-intelligence',
    healthScore: context.healthScore,
  };
}

/**
 * Direct call to Gemini REST API without requiring heavy external dependencies.
 */
async function queryGemini(promptText, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : null;
}

module.exports = {
  getFinancialContext,
  generateSmartInsights,
  processUserChat,
};
