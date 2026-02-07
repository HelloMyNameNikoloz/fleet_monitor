const express = require('express');
const { authenticate } = require('../middleware/auth');
const logStore = require('../services/logStore');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
    const limit = req.query?.limit;
    const logs = logStore.listLogs(limit);
    res.json({ logs });
});

module.exports = router;
