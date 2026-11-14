const express = require('express');
const router = express.Router();
const { getInsights, handleChat } = require('../controllers/assistantController');

router.get('/insights', getInsights);
router.post('/chat', handleChat);

module.exports = router;

