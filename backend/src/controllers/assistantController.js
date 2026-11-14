const { generateSmartInsights, processUserChat } = require('../services/aiAssistantService');

async function getInsights(req, res, next) {
  try {
    const monthKey = req.query.month || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month format. Please use YYYY-MM.',
      });
    }

    const insights = await generateSmartInsights(monthKey);
    return res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (err) {
    next(err);
  }
}

async function handleChat(req, res, next) {
  try {
    const { message, month } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Please enter a message or question.',
      });
    }

    const monthKey = month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : new Date().toISOString().slice(0, 7);

    const chatResponse = await processUserChat(message.trim(), monthKey);
    return res.status(200).json({
      success: true,
      data: chatResponse,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInsights,
  handleChat,
};

