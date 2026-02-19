// CRUD de productos
const db = require('../db');

// Obtener todos los productos
exports.getProductos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear producto
exports.createProducto = async (req, res) => {
  try {
    const { nombre, descripcion, precio, categoria, tiraje, premium } = req.body;

    const [result] = await db.query(
      `INSERT INTO productos 
       (nombre, descripcion, precio, categoria, tiraje, premium)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, descripcion, precio, categoria, tiraje, premium || false]
    );

    res.json({ message: 'Producto creado', id: result.insertId });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar producto
exports.updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, categoria, tiraje, estado } = req.body;

    await db.query(
      `UPDATE productos 
       SET nombre=?, descripcion=?, precio=?, categoria=?, tiraje=?, estado=? 
       WHERE id=?`,
      [nombre, descripcion, precio, categoria, tiraje, estado, id]
    );

    res.json({ message: 'Producto actualizado' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar producto
exports.deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM productos WHERE id=?', [id]);

    res.json({ message: 'Producto eliminado' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


