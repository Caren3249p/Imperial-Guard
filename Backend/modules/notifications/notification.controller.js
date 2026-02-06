const service = require('./notification.service');

exports.createNotification = (req, res) => {
    service.create(req.body, (err, result) => {
        if (err) return res.status(400).json(err.message);
        res.json({ message: 'Notificación creada', result });
    });
};

exports.getNotifications = (req, res) => {
    service.getAll((err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
};
exports.deleteNotification = (req, res) => {

    const id = req.params.id;

    service.delete(id, (err, result) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json({
            message: 'Notificación eliminada 😏'
        });

    });

};
