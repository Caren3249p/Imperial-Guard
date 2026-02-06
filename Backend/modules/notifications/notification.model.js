const db = require('../../config/db');

exports.createNotification = (data, callback) => {
    const sql = `
        INSERT INTO notifications 
        (title, message, type_id, priority, status, scheduled_date, is_automatic, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [
        data.title,
        data.message,
        data.type_id,
        data.priority,
        data.status,
        data.scheduled_date,
        data.is_automatic,
        data.created_by
    ], callback);
};

exports.getAllNotifications = (callback) => {
    db.query('SELECT * FROM notifications', callback);
};
exports.deleteNotification = (id, callback) => {
    db.query(
        'DELETE FROM notifications WHERE id=?',
        [id],
        callback
    );
};
