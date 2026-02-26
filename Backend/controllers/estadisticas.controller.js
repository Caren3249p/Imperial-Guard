// controllers/estadisticas.controller.js
const db = require('../../../Backend/db');

// Obtener estadísticas generales del inventario
exports.getEstadisticasInventario = async (req, res) => {
  try {
    // Estadísticas generales
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) as total_productos,
        SUM(CASE WHEN estado = 'activo' OR estado IS NULL THEN 1 ELSE 0 END) as productos_activos,
        SUM(CASE WHEN estado = 'suspendido' THEN 1 ELSE 0 END) as productos_suspendidos
      FROM productos
    `);

    // Productos más utilizados (basado en órdenes/compras)
    const [masUtilizados] = await db.query(`
      SELECT 
        p.id,
        p.nombre,
        p.precio,
        p.estado,
        COUNT(o.id) as total_compras
      FROM productos p
      LEFT JOIN ordenes o ON p.id = o.producto_id
      GROUP BY p.id, p.nombre, p.precio, p.estado
      ORDER BY total_compras DESC
      LIMIT 10
    `);

    // Distribución por categoría
    const [porCategoria] = await db.query(`
      SELECT 
        categoria,
        COUNT(*) as total
      FROM productos
      WHERE categoria IS NOT NULL
      GROUP BY categoria
      ORDER BY total DESC
    `);

    res.json({
      totales: {
        total_productos: totales[0].total_productos,
        productos_activos: totales[0].productos_activos,
        productos_suspendidos: totales[0].productos_suspendidos
      },
      mas_utilizados: masUtilizados.map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        estado: p.estado || 'activo',
        total_compras: p.total_compras || 0
      })),
      por_categoria: porCategoria,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};