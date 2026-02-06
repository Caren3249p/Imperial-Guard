const cron = require('node-cron');
const db = require('../../config/db');

const startScheduler = () => {

    cron.schedule('* * * * *', () => {
        console.log('Revisando notificaciones programadas...');

        const query = `
        SELECT * FROM notifications 
        WHERE status='pendiente' 
        AND scheduled_date <= NOW()
        `;

        db.query(query, (err, results) => {

            if (err) {
                console.error(err);
                return;
            }

            results.forEach(notification => {

                console.log('Enviando notificación:', notification.title);

                db.query(
                `UPDATE notifications SET status='enviada' WHERE id=?`,
                [notification.id],
                (err, result) => {
                    if (err) {
                        console.error("Error UPDATE:", err);
                    } else {
                        console.log("Notificación actualizada:", notification.id);
                    }
                });


                db.query(
                    `INSERT INTO notification_logs (notification_id, action)
                    VALUES (?, 'enviada')`,
                    [notification.id]
                );

            });

        });

    });

};

module.exports = startScheduler;
