const express = require('express');
const router = express.Router();
const controller = require('./notification.controller');

router.post('/notifications', controller.createNotification);
router.get('/notifications', controller.getNotifications);
router.delete('/notifications/:id', controller.deleteNotification);

module.exports = router;
