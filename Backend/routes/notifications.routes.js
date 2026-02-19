const db = require('../db');

exports.getNotifications = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT n.*, t.name as type_name
      FROM notifications n
      JOIN notification_types t ON n.type_id = t.id
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
