// CRUD de productos
const db = require('../../../../Backend/db');

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

// Suspender producto
exports.suspenderProducto = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;

    // Verificar si el producto existe y no está eliminado
    const [producto] = await connection.query(
      'SELECT * FROM products WHERE product_id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (producto.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar si ya está suspendido
    if (producto[0].is_active === 0) {
      return res.status(400).json({ error: 'El producto ya está suspendido' });
    }

    // Actualizar estado a suspendido
    await connection.query(
      'UPDATE products SET is_active = 0 WHERE product_id = ?',
      [id]
    );

    // Registrar en audit logs
    const log_id = uuidv4();
    await connection.query(
      `INSERT INTO audit_logs 
       (log_id, entity_type, entity_id, action, previous_status, new_status, actor_id, metadata)
       VALUES (?, 'PRODUCT', ?, 'SUSPEND', ?, ?, ?, ?)`,
      [
        log_id,
        id,
        '1', // previous_status (activo)
        '0', // new_status (suspendido)
        req.user?.id || 'SYSTEM',
        JSON.stringify({ reason: req.body.reason || 'Suspensión administrativa' })
      ]
    );

    await connection.commit();

    res.json({ 
      message: 'Producto suspendido exitosamente',
      product_id: id,
      is_active: 0
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Reactivar producto
exports.reactivarProducto = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;

    // Verificar si el producto existe y no está eliminado
    const [producto] = await connection.query(
      'SELECT * FROM products WHERE product_id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (producto.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar si ya está activo
    if (producto[0].is_active === 1) {
      return res.status(400).json({ error: 'El producto ya está activo' });
    }

    // Actualizar estado a activo
    await connection.query(
      'UPDATE products SET is_active = 1 WHERE product_id = ?',
      [id]
    );

    // Registrar en audit logs
    const log_id = uuidv4();
    await connection.query(
      `INSERT INTO audit_logs 
       (log_id, entity_type, entity_id, action, previous_status, new_status, actor_id, metadata)
       VALUES (?, 'PRODUCT', ?, 'REACTIVATE', ?, ?, ?, ?)`,
      [
        log_id,
        id,
        '0', // previous_status (suspendido)
        '1', // new_status (activo)
        req.user?.id || 'SYSTEM',
        JSON.stringify({ reason: req.body.reason || 'Reactivación administrativa' })
      ]
    );

    await connection.commit();

    res.json({ 
      message: 'Producto reactivado exitosamente',
      product_id: id,
      is_active: 1
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Previsualizar cambios masivos
exports.previsualizarCambiosMasivos = async (req, res) => {
  try {
    const { product_ids, cambios } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un producto' });
    }

    // Obtener productos actuales
    const placeholders = product_ids.map(() => '?').join(',');
    const [productos] = await db.query(
      `SELECT id, nombre, precio, estado, categoria, tiraje, premium
       FROM productos 
       WHERE id IN (${placeholders})`,
      product_ids
    );

    if (productos.length !== product_ids.length) {
      return res.status(404).json({ error: 'Algunos productos no fueron encontrados' });
    }

    // Simular los cambios para vista previa
    const previsualizacion = productos.map(producto => {
      const productoSimulado = { ...producto };
      
      if (cambios.categoria) {
        productoSimulado.categoria_nueva = cambios.categoria;
      }
      
      if (cambios.estado) {
        productoSimulado.estado_nuevo = cambios.estado;
      }
      
      if (cambios.precio_porcentaje) {
        const porcentaje = parseFloat(cambios.precio_porcentaje);
        productoSimulado.precio_nuevo = producto.precio * (1 + porcentaje / 100);
      }
      
      if (cambios.precio_fijo) {
        productoSimulado.precio_nuevo = parseFloat(cambios.precio_fijo);
      }

      if (cambios.tiraje) {
        productoSimulado.tiraje_nuevo = cambios.tiraje;
      }

      if (cambios.premium !== undefined) {
        productoSimulado.premium_nuevo = cambios.premium;
      }

      return {
        id: producto.id,
        nombre: producto.nombre,
        antes: {
          precio: producto.precio,
          estado: producto.estado || 'activo',
          categoria: producto.categoria,
          tiraje: producto.tiraje,
          premium: producto.premium
        },
        despues: {
          precio: productoSimulado.precio_nuevo || producto.precio,
          estado: productoSimulado.estado_nuevo || producto.estado || 'activo',
          categoria: productoSimulado.categoria_nueva || producto.categoria,
          tiraje: productoSimulado.tiraje_nuevo || producto.tiraje,
          premium: productoSimulado.premium_nuevo !== undefined ? productoSimulado.premium_nuevo : producto.premium
        }
      };
    });

    res.json({
      requiere_confirmacion: true,
      total_productos: previsualizacion.length,
      cambios_solicitados: cambios,
      previsualizacion
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Aplicar cambios masivos
exports.aplicarCambiosMasivos = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { product_ids, cambios, confirmado = false } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un producto' });
    }

    if (!cambios || Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'Debe especificar al menos un cambio a aplicar' });
    }

    // Verificar que los productos existen
    const placeholders = product_ids.map(() => '?').join(',');
    const [productosExistentes] = await connection.query(
      `SELECT id, nombre, precio, estado 
       FROM productos 
       WHERE id IN (${placeholders})`,
      product_ids
    );

    if (productosExistentes.length !== product_ids.length) {
      return res.status(404).json({ error: 'Algunos productos no fueron encontrados' });
    }

    // Construir SET dinámico
    const updateFields = [];
    const updateValues = [];
    const cambiosAplicados = {};

    // Procesar cambios
    if (cambios.categoria) {
      updateFields.push('categoria = ?');
      updateValues.push(cambios.categoria);
      cambiosAplicados.categoria = cambios.categoria;
    }

    if (cambios.estado) {
      updateFields.push('estado = ?');
      updateValues.push(cambios.estado);
      cambiosAplicados.estado = cambios.estado;
    }

    if (cambios.precio_porcentaje) {
      const porcentaje = parseFloat(cambios.precio_porcentaje);
      updateFields.push('precio = ROUND(precio * (1 + ? / 100), 2)');
      updateValues.push(porcentaje);
      cambiosAplicados.precio = `${porcentaje}% ${porcentaje > 0 ? 'aumento' : 'descuento'}`;
    }

    if (cambios.precio_fijo) {
      const precio = parseFloat(cambios.precio_fijo);
      updateFields.push('precio = ?');
      updateValues.push(precio);
      cambiosAplicados.precio = `$${precio} (fijo)`;
    }

    if (cambios.tiraje) {
      updateFields.push('tiraje = ?');
      updateValues.push(cambios.tiraje);
      cambiosAplicados.tiraje = cambios.tiraje;
    }

    if (cambios.premium !== undefined) {
      updateFields.push('premium = ?');
      updateValues.push(cambios.premium ? 1 : 0);
      cambiosAplicados.premium = cambios.premium ? 'Sí' : 'No';
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No se especificaron cambios válidos' });
    }

    // Si no está confirmado, mostrar resumen
    if (!confirmado) {
      const resumen = {
        productos_seleccionados: productosExistentes.map(p => ({
          id: p.id,
          nombre: p.nombre,
          precio_actual: p.precio,
          estado_actual: p.estado || 'activo'
        })),
        cambios_a_aplicar: cambiosAplicados,
        total_productos: productosExistentes.length
      };

      return res.json({
        requiere_confirmacion: true,
        mensaje: 'Confirme para aplicar los cambios',
        resumen
      });
    }

    // Aplicar cambios
    const updateValuesConIds = [...updateValues, ...product_ids];
    
    await connection.query(
      `UPDATE productos 
       SET ${updateFields.join(', ')}
       WHERE id IN (${placeholders})`,
      updateValuesConIds
    );

    await connection.commit();

    res.json({
      message: 'Cambios masivos aplicados exitosamente',
      cambios_aplicados: cambiosAplicados,
      total_modificados: product_ids.length
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Buscar productos con filtros
exports.buscarProductos = async (req, res) => {
  try {
    const {
      nombre,
      categoria,
      estado,
      precio_min,
      precio_max,
      tipo_carta,
      premium,
      ordenar_por = 'nombre',
      orden = 'ASC',
      pagina = 1,
      limite = 16
    } = req.query;

    // Construir query base
    let query = `
      SELECT 
        p.product_id,
        p.name,
        p.description,
        p.price_cents / 100 as price,
        p.currency,
        p.category,
        p.is_active,
        p.max_per_user,
        p.metadata->>'$.premium' as premium,
        p.created_at,
        p.updated_at,
        ps.available_stock,
        ps.unlimited_stock,
        ps.total_stock,
        COUNT(DISTINCT o.order_id) as total_ventas,
        AVG(o.total_amount) / 100 as precio_promedio_venta
      FROM products p
      LEFT JOIN product_stock ps ON p.product_id = ps.product_id
      LEFT JOIN orders o ON p.product_id = o.product_id AND o.status = 'PAID'
      WHERE p.deleted_at IS NULL
    `;

    const queryParams = [];
    const condiciones = [];

    // Aplicar filtros
    if (nombre) {
      condiciones.push(`(p.name LIKE ? OR p.description LIKE ?)`);
      queryParams.push(`%${nombre}%`, `%${nombre}%`);
    }

    if (categoria) {
      if (Array.isArray(categoria)) {
        // Múltiples categorías
        const placeholders = categoria.map(() => '?').join(',');
        condiciones.push(`p.category IN (${placeholders})`);
        queryParams.push(...categoria);
      } else {
        // Categoría única
        condiciones.push(`p.category = ?`);
        queryParams.push(categoria);
      }
    }

    if (estado) {
      if (estado === 'activo') {
        condiciones.push(`p.is_active = 1`);
      } else if (estado === 'suspendido') {
        condiciones.push(`p.is_active = 0`);
      }
    }

    if (precio_min) {
      condiciones.push(`p.price_cents >= ?`);
      queryParams.push(parseFloat(precio_min) * 100);
    }

    if (precio_max) {
      condiciones.push(`p.price_cents <= ?`);
      queryParams.push(parseFloat(precio_max) * 100);
    }

    if (tipo_carta) {
      condiciones.push(`p.metadata->>'$.card_type' = ?`);
      queryParams.push(tipo_carta);
    }

    if (premium !== undefined) {
      condiciones.push(`p.metadata->>'$.premium' = ?`);
      queryParams.push(premium === 'true' ? 'true' : 'false');
    }

    // Agregar condiciones a la query
    if (condiciones.length > 0) {
      query += ' AND ' + condiciones.join(' AND ');
    }

    // Agrupar por producto para el COUNT
    query += ' GROUP BY p.product_id';

    // Contar total de resultados (para paginación)
    const countQuery = `
      SELECT COUNT(DISTINCT p.product_id) as total
      FROM products p
      LEFT JOIN product_stock ps ON p.product_id = ps.product_id
      WHERE p.deleted_at IS NULL
      ${condiciones.length > 0 ? ' AND ' + condiciones.join(' AND ') : ''}
    `;

    const [countResult] = await db.query(countQuery, queryParams);
    const totalResultados = countResult[0].total;

    // Aplicar ordenamiento
    const ordenamientoPermitido = {
      'nombre': 'p.name',
      'precio': 'p.price_cents',
      'fecha': 'p.created_at',
      'ventas': 'total_ventas',
      'stock': 'ps.available_stock'
    };

    const campoOrden = ordenamientoPermitido[ordenar_por] || 'p.name';
    query += ` ORDER BY ${campoOrden} ${orden === 'DESC' ? 'DESC' : 'ASC'}`;

    // Aplicar paginación
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limite), offset);

    // Ejecutar query
    const [productos] = await db.query(query, queryParams);

    // Calcular estadísticas de los resultados
    const stats = {
      precio_promedio: 0,
      precio_minimo: Infinity,
      precio_maximo: 0,
      categorias_encontradas: [],
      estados: {
        activos: 0,
        suspendidos: 0
      }
    };

    const categoriasSet = new Set();
    
    productos.forEach(p => {
      // Estadísticas de precios
      if (p.price < stats.precio_minimo) stats.precio_minimo = p.price;
      if (p.price > stats.precio_maximo) stats.precio_maximo = p.price;
      stats.precio_promedio += p.price;
      
      // Categorías únicas
      if (p.category) categoriasSet.add(p.category);
      
      // Estados
      if (p.is_active) {
        stats.estados.activos++;
      } else {
        stats.estados.suspendidos++;
      }
    });

    if (productos.length > 0) {
      stats.precio_promedio = stats.precio_promedio / productos.length;
    }

    stats.categorias_encontradas = Array.from(categoriasSet);

    // Si no hay resultados
    if (productos.length === 0) {
      return res.json({
        resultados: [],
        total: 0,
        pagina: parseInt(pagina),
        total_paginas: 0,
        mensaje: 'No se encontraron productos que coincidan con los filtros seleccionados',
        estadisticas: {
          precio_promedio: 0,
          precio_minimo: 0,
          precio_maximo: 0,
          categorias_encontradas: [],
          estados: { activos: 0, suspendidos: 0 }
        },
        filtros_aplicados: {
          nombre: nombre || null,
          categoria: categoria || null,
          estado: estado || null,
          precio_min: precio_min || null,
          precio_max: precio_max || null,
          tipo_carta: tipo_carta || null,
          premium: premium || null
        }
      });
    }

    // Formatear resultados
    const resultadosFormateados = productos.map(p => ({
      id: p.product_id,
      nombre: p.name,
      descripcion: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''),
      precio: parseFloat(p.price).toFixed(2),
      moneda: p.currency,
      categoria: p.category,
      estado: p.is_active ? 'activo' : 'suspendido',
      premium: p.premium === 'true',
      stock: p.unlimited_stock ? 'Ilimitado' : (p.available_stock || 0),
      total_ventas: p.total_ventas || 0,
      precio_promedio_venta: parseFloat(p.precio_promedio_venta || 0).toFixed(2),
      fecha_creacion: p.created_at,
      fecha_actualizacion: p.updated_at
    }));

    const totalPaginas = Math.ceil(totalResultados / parseInt(limite));

    res.json({
      resultados: resultadosFormateados,
      total: totalResultados,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total_paginas: totalPaginas,
      estadisticas: {
        precio_promedio: parseFloat(stats.precio_promedio).toFixed(2),
        precio_minimo: stats.precio_minimo === Infinity ? 0 : parseFloat(stats.precio_minimo).toFixed(2),
        precio_maximo: parseFloat(stats.precio_maximo).toFixed(2),
        categorias_encontradas: stats.categorias_encontradas,
        estados: stats.estados
      },
      filtros_aplicados: {
        nombre: nombre || null,
        categoria: categoria || null,
        estado: estado || null,
        precio_min: precio_min || null,
        precio_max: precio_max || null,
        tipo_carta: tipo_carta || null,
        premium: premium || null,
        ordenar_por,
        orden
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valores únicos para filtros (categorías, tipos, etc)
exports.getOpcionesFiltros = async (req, res) => {
  try {
    // Obtener categorías únicas
    const [categorias] = await db.query(`
      SELECT DISTINCT category 
      FROM products 
      WHERE category IS NOT NULL AND category != '' AND deleted_at IS NULL
      ORDER BY category
    `);

    // Obtener tipos de carta únicos
    const [tiposCarta] = await db.query(`
      SELECT DISTINCT metadata->>'$.card_type' as card_type
      FROM products 
      WHERE metadata->>'$.card_type' IS NOT NULL AND deleted_at IS NULL
      ORDER BY card_type
    `);

    // Obtener rangos de precios
    const [precios] = await db.query(`
      SELECT 
        MIN(price_cents) / 100 as precio_min,
        MAX(price_cents) / 100 as precio_max,
        AVG(price_cents) / 100 as precio_promedio
      FROM products 
      WHERE deleted_at IS NULL
    `);

    // Obtener totales por estado
    const [estados] = await db.query(`
      SELECT 
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as suspendidos
      FROM products 
      WHERE deleted_at IS NULL
    `);

    res.json({
      categorias: categorias.map(c => c.category),
      tipos_carta: tiposCarta.map(t => t.card_type).filter(Boolean),
      rangos_precio: {
        minimo: precios[0]?.precio_min || 0,
        maximo: precios[0]?.precio_max || 0,
        promedio: parseFloat(precios[0]?.precio_promedio || 0).toFixed(2)
      },
      totales_estado: {
        activos: estados[0]?.activos || 0,
        suspendidos: estados[0]?.suspendidos || 0
      },
      opciones_ordenamiento: [
        { valor: 'nombre', etiqueta: 'Nombre' },
        { valor: 'precio', etiqueta: 'Precio' },
        { valor: 'fecha', etiqueta: 'Fecha de creación' },
        { valor: 'ventas', etiqueta: 'Más vendidos' },
        { valor: 'stock', etiqueta: 'Stock disponible' }
      ]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Búsqueda rápida (autocompletado)
exports.busquedaRapida = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ sugerencias: [] });
    }

    const [resultados] = await db.query(`
      SELECT 
        product_id,
        name,
        price_cents / 100 as price,
        category,
        is_active,
        metadata->>'$.card_type' as card_type,
        metadata->>'$.premium' as premium
      FROM products 
      WHERE deleted_at IS NULL 
        AND (name LIKE ? OR description LIKE ? OR category LIKE ?)
      LIMIT 10
    `, [`%${q}%`, `%${q}%`, `%${q}%`]);

    const sugerencias = resultados.map(r => ({
      id: r.product_id,
      nombre: r.name,
      precio: parseFloat(r.price).toFixed(2),
      categoria: r.category,
      tipo: r.card_type,
      estado: r.is_active ? 'activo' : 'suspendido',
      premium: r.premium === 'true',
      texto_busqueda: `${r.name} ${r.category || ''} ${r.card_type || ''}`.toLowerCase()
    }));

    res.json({
      termino_busqueda: q,
      sugerencias,
      total: sugerencias.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Limpiar filtros (endpoint informativo)
exports.limpiarFiltros = (req, res) => {
  res.json({
    mensaje: 'Filtros limpiados',
    filtros_por_defecto: {
      ordenar_por: 'nombre',
      orden: 'ASC',
      pagina: 1,
      limite: 16
    }
  });
};