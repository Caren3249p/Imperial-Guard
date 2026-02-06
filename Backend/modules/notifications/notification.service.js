const Notification = require('./notification.model');

exports.create = (data, callback) => {
    if (!data.title || !data.message) {
        return callback(new Error('Datos incompletos'));
    }
    Notification.createNotification(data, callback);
};

exports.getAll = (callback) => {
    Notification.getAllNotifications(callback);
};
exports.delete = (id, callback) => {
    Notification.deleteNotification(id, callback);
};
