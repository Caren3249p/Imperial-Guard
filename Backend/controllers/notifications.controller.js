
//es el crud de notificaciones//

const express = require('express');
const router = express.Router();
const controller = require('../controllers/productos.controller');

router.get('/', controller.getProductos);
router.post('/', controller.createProducto);
router.put('/:id', controller.updateProducto);
router.delete('/:id', controller.deleteProducto);

module.exports = router;

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
