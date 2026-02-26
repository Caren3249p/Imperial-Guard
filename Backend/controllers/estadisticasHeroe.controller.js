// controllers/estadisticasHeroe.controller.js
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Obtener lista de héroes disponibles
exports.getHeroes = async (req, res) => {
  try {
    const [heroes] = await db.query(`
      SELECT 
        h.hero_id,
        h.name,
        h.type,
        h.power_base,
        h.health_base,
        h.defense_base,
        h.is_active,
        COUNT(DISTINCT hep.product_id) as total_products_equipped,
        (
          SELECT COUNT(*) 
          FROM orders o 
          INNER JOIN products p ON o.product_id = p.product_id
          INNER JOIN hero_equippable_products hep2 ON p.product_id = hep2.product_id
          WHERE hep2.hero_id = h.hero_id AND o.status = 'PAID'
        ) as total_uses
      FROM heroes h
      LEFT JOIN hero_equippable_products hep ON h.hero_id = hep.hero_id AND hep.deleted_at IS NULL
      WHERE h.deleted_at IS NULL
      GROUP BY h.hero_id
      ORDER BY 
        CASE 
          WHEN h.type LIKE 'Guerrero%' THEN 1
          WHEN h.type LIKE 'Mago%' THEN 2
          WHEN h.type LIKE 'Pícaro%' THEN 3
          WHEN h.type LIKE 'Chamán%' OR h.type LIKE 'Médico%' THEN 4
          ELSE 5
        END,
        h.name
    `);
    
    res.json(heroes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas detalladas por héroe
exports.getEstadisticasHeroe = async (req, res) => {
  try {
    const { heroeId } = req.params;

    // Verificar que el héroe existe
    const [heroe] = await db.query(
      `SELECT * FROM heroes WHERE hero_id = ? AND deleted_at IS NULL`,
      [heroeId]
    );
    
    if (heroe.length === 0) {
      return res.status(404).json({ error: 'Héroe no encontrado' });
    }

    // Productos (cartas) equipados por este héroe y sus estadísticas de uso
    const [productos] = await db.query(`
      SELECT 
        p.product_id,
        p.name as product_name,
        p.description,
        p.price_cents / 100 as price,
        p.category,
        p.card_type,
        p.card_subtype,
        p.equipment_slot,
        p.is_active as product_active,
        
        -- Estadísticas de uso
        COUNT(DISTINCT o.order_id) as times_purchased,
        COUNT(DISTINCT o.user_id) as unique_users,
        SUM(o.total_amount) / 100 as total_revenue,
        AVG(o.total_amount) / 100 as avg_ticket,
        
        -- Frecuencia de uso
        COUNT(DISTINCT DATE(o.created_at)) as days_with_purchases,
        
        -- Información de equipamiento
        hep.is_equipped,
        hep.equipped_at,
        
        -- Stock disponible
        ps.available_stock,
        ps.unlimited_stock
        
      FROM hero_equippable_products hep
      INNER JOIN products p ON hep.product_id = p.product_id
      LEFT JOIN orders o ON p.product_id = o.product_id AND o.status = 'PAID'
      LEFT JOIN product_stock ps ON p.product_id = ps.product_id
      WHERE hep.hero_id = ? AND hep.deleted_at IS NULL AND p.deleted_at IS NULL
      GROUP BY p.product_id
      ORDER BY times_purchased DESC, hep.is_equipped DESC
    `, [heroeId]);

    // Estadísticas de combate del héroe
    const [combate] = await db.query(`
      SELECT 
        -- Rendimiento en batallas
        COUNT(DISTINCT b.battle_id) as total_battles,
        SUM(CASE WHEN b.winner_hero_id = ? THEN 1 ELSE 0 END) as battles_won,
        SUM(CASE WHEN b.winner_hero_id != ? AND b.winner_hero_id IS NOT NULL THEN 1 ELSE 0 END) as battles_lost,
        
        -- Estadísticas de daño
        AVG(bc.damage_dealt) as avg_damage_per_battle,
        MAX(bc.damage_dealt) as max_damage_dealt,
        SUM(bc.damage_dealt) as total_damage_dealt,
        
        -- Efectividad de acciones
        COUNT(DISTINCT ba.action_id) as total_actions_used,
        AVG(ba.effectiveness) as avg_action_effectiveness
        
      FROM heroes h
      LEFT JOIN battles b ON h.hero_id = b.hero1_id OR h.hero_id = b.hero2_id
      LEFT JOIN battle_combat bc ON b.battle_id = bc.battle_id AND bc.hero_id = h.hero_id
      LEFT JOIN battle_actions ba ON b.battle_id = ba.battle_id AND ba.hero_id = h.hero_id
      WHERE h.hero_id = ? AND h.deleted_at IS NULL
      GROUP BY h.hero_id
    `, [heroeId, heroeId, heroeId]);

    // Efectos aleatorios del héroe (según tablas del documento)
    const [efectos] = await db.query(`
      SELECT 
        effect_name,
        base_percentage,
        current_percentage,
        damage_multiplier,
        min_rows,
        max_rows
      FROM random_effects
      WHERE hero_type = ?
      ORDER BY min_rows
    `, [heroe[0].type]);

    // Acciones/habilidades del héroe (Tablas 8-9 del documento)
    const [acciones] = await db.query(`
      SELECT 
        name,
        cost_power,
        effect,
        action_type,
        cooldown_turns
      FROM hero_actions
      WHERE hero_id = ?
      ORDER BY cost_power
    `, [heroeId]);

    // Distribución por tipo de carta
    const [porTipoCarta] = await db.query(`
      SELECT 
        p.card_type,
        p.card_subtype,
        COUNT(*) as total_cards,
        SUM(CASE WHEN hep.is_equipped = 1 THEN 1 ELSE 0 END) as currently_equipped,
        SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) as times_used
      FROM hero_equippable_products hep
      INNER JOIN products p ON hep.product_id = p.product_id
      LEFT JOIN orders o ON p.product_id = o.product_id
      WHERE hep.hero_id = ? AND hep.deleted_at IS NULL
      GROUP BY p.card_type, p.card_subtype
      ORDER BY times_used DESC
    `, [heroeId]);

    // Carta más usada por el héroe
    const [cartaTop] = await db.query(`
      SELECT 
        p.name,
        p.card_type,
        COUNT(o.order_id) as usage_count
      FROM hero_equippable_products hep
      INNER JOIN products p ON hep.product_id = p.product_id
      LEFT JOIN orders o ON p.product_id = o.product_id
      WHERE hep.hero_id = ? AND hep.deleted_at IS NULL
      GROUP BY p.product_id
      ORDER BY usage_count DESC
      LIMIT 1
    `, [heroeId]);

    // Tendencia de compras de productos de este héroe (últimos 30 días)
    const [tendencia] = await db.query(`
      SELECT 
        DATE(o.created_at) as date,
        COUNT(o.order_id) as purchases,
        SUM(o.total_amount) / 100 as revenue
      FROM hero_equippable_products hep
      INNER JOIN products p ON hep.product_id = p.product_id
      INNER JOIN orders o ON p.product_id = o.product_id
      WHERE hep.hero_id = ? 
        AND o.status = 'PAID'
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
    `, [heroeId]);

    // Calcular win rate
    const winRate = combate[0]?.total_battles > 0 
      ? ((combate[0].battles_won / combate[0].total_battles) * 100).toFixed(2)
      : 0;

    // Formatear respuesta
    const productosFormateados = productos.map(p => ({
      id: p.product_id,
      nombre: p.product_name,
      tipo: p.card_type,
      subtipo: p.card_subtype,
      slot: p.equipment_slot,
      precio: p.price,
      equipado: p.is_equipped ? true : false,
      equipado_desde: p.equipped_at,
      metricas: {
        veces_comprado: p.times_purchased || 0,
        usuarios_unicos: p.unique_users || 0,
        ingresos_generados: parseFloat(p.total_revenue || 0).toFixed(2),
        ticket_promedio: parseFloat(p.avg_ticket || 0).toFixed(2),
        dias_activo: p.days_with_purchases || 0
      },
      stock: p.unlimited_stock ? 'Ilimitado' : (p.available_stock || 0)
    }));

    res.json({
      heroe: {
        id: heroe[0].hero_id,
        nombre: heroe[0].name,
        tipo: heroe[0].type,
        estadisticas_base: {
          poder: heroe[0].power_base,
          vida: heroe[0].health_base,
          defensa: heroe[0].defense_base,
          ataque: heroe[0].attack_base,
          daño: heroe[0].damage_base,
          sanacion: heroe[0].heal_base
        }
      },
      rendimiento_combate: {
        total_batallas: combate[0]?.total_battles || 0,
        victorias: combate[0]?.battles_won || 0,
        derrotas: combate[0]?.battles_lost || 0,
        win_rate: winRate + '%',
        daño_promedio: Math.round(combate[0]?.avg_damage_per_battle || 0),
        daño_total: combate[0]?.total_damage_dealt || 0,
        daño_maximo: combate[0]?.max_damage_dealt || 0,
        acciones_usadas: combate[0]?.total_actions_used || 0
      },
      carta_mas_usada: cartaTop[0] ? {
        nombre: cartaTop[0].name,
        tipo: cartaTop[0].card_type,
        usos: cartaTop[0].usage_count || 0
      } : null,
      productos: productosFormateados,
      acciones: acciones.map(a => ({
        nombre: a.name,
        costo_poder: a.cost_power,
        efecto: a.effect,
        tipo: a.action_type,
        enfriamiento: a.cooldown_turns
      })),
      efectos_aleatorios: efectos.map(e => ({
        nombre: e.effect_name,
        probabilidad_base: e.base_percentage + '%',
        probabilidad_actual: e.current_percentage + '%',
        multiplicador_daño: e.damage_multiplier,
        rango_filas: `${e.min_rows} - ${e.max_rows}`
      })),
      distribucion_cartas: porTipoCarta.map(c => ({
        tipo: c.card_type,
        subtipo: c.card_subtype,
        total_cartas: c.total_cards,
        equipadas_actualmente: c.currently_equipped,
        veces_utilizadas: c.times_used || 0
      })),
      tendencia_compras_30dias: tendencia.map(t => ({
        fecha: t.date,
        compras: t.purchases || 0,
        ingresos: parseFloat(t.revenue || 0).toFixed(2)
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener comparativa entre todos los héroes
exports.getComparativaHeroes = async (req, res) => {
  try {
    const [comparativa] = await db.query(`
      SELECT 
        h.hero_id,
        h.name,
        h.type,
        h.health_base,
        h.defense_base,
        
        -- Métricas de ventas de productos asociados
        COUNT(DISTINCT hep.product_id) as total_productos_asociados,
        COUNT(DISTINCT o.order_id) as total_compras_productos,
        COUNT(DISTINCT o.user_id) as total_compradores_unicos,
        SUM(o.total_amount) / 100 as ingresos_totales_productos,
        
        -- Métricas de combate
        COUNT(DISTINCT b.battle_id) as total_batallas,
        SUM(CASE WHEN b.winner_hero_id = h.hero_id THEN 1 ELSE 0 END) as batallas_ganadas,
        AVG(bc.damage_dealt) as daño_promedio,
        
        -- Popularidad (basada en órdenes)
        DENSE_RANK() OVER (ORDER BY COUNT(DISTINCT o.order_id) DESC) as rank_ventas,
        
        -- Win rate
        CASE 
          WHEN COUNT(DISTINCT b.battle_id) > 0 
          THEN (SUM(CASE WHEN b.winner_hero_id = h.hero_id THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT b.battle_id))
          ELSE 0
        END as win_rate
        
      FROM heroes h
      LEFT JOIN hero_equippable_products hep ON h.hero_id = hep.hero_id AND hep.deleted_at IS NULL
      LEFT JOIN products p ON hep.product_id = p.product_id
      LEFT JOIN orders o ON p.product_id = o.product_id AND o.status = 'PAID'
      LEFT JOIN battles b ON h.hero_id = b.hero1_id OR h.hero_id = b.hero2_id
      LEFT JOIN battle_combat bc ON b.battle_id = bc.battle_id AND bc.hero_id = h.hero_id
      WHERE h.deleted_at IS NULL
      GROUP BY h.hero_id
      ORDER BY rank_ventas, win_rate DESC
    `);

    // Calcular estadísticas globales
    const [globales] = await db.query(`
      SELECT 
        COUNT(DISTINCT hero_id) as total_heroes,
        SUM(total_compras) as compras_totales,
        SUM(ingresos_totales) / 100 as ingresos_totales
      FROM (
        SELECT 
          h.hero_id,
          COUNT(DISTINCT o.order_id) as total_compras,
          SUM(o.total_amount) as ingresos_totales
        FROM heroes h
        LEFT JOIN hero_equippable_products hep ON h.hero_id = hep.hero_id
        LEFT JOIN orders o ON hep.product_id = o.product_id
        WHERE h.deleted_at IS NULL AND o.status = 'PAID'
        GROUP BY h.hero_id
      ) as subquery
    `);

    res.json({
      resumen_global: {
        total_heroes: globales[0]?.total_heroes || 0,
        compras_totales_productos: globales[0]?.compras_totales || 0,
        ingresos_totales_productos: parseFloat(globales[0]?.ingresos_totales || 0).toFixed(2)
      },
      comparativa: comparativa.map(h => ({
        id: h.hero_id,
        nombre: h.name,
        tipo: h.type,
        estadisticas_base: {
          vida: h.health_base,
          defensa: h.defense_base
        },
        metricas_productos: {
          productos_asociados: h.total_productos_asociados || 0,
          compras_realizadas: h.total_compras_productos || 0,
          compradores_unicos: h.total_compradores_unicos || 0,
          ingresos_generados: parseFloat(h.ingresos_totales_productos || 0).toFixed(2),
          rank_ventas: h.rank_ventas
        },
        metricas_combate: {
          total_batallas: h.total_batallas || 0,
          batallas_ganadas: h.batallas_ganadas || 0,
          win_rate: parseFloat(h.win_rate || 0).toFixed(2) + '%',
          daño_promedio: Math.round(h.daño_promedio || 0)
        }
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registrar equipamiento de producto a héroe
exports.equiparProducto = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { heroeId, productoId } = req.body;

    // Verificar que el héroe existe
    const [heroe] = await connection.query(
      'SELECT * FROM heroes WHERE hero_id = ? AND deleted_at IS NULL',
      [heroeId]
    );
    
    if (heroe.length === 0) {
      return res.status(404).json({ error: 'Héroe no encontrado' });
    }

    // Verificar que el producto existe
    const [producto] = await connection.query(
      'SELECT * FROM products WHERE product_id = ? AND deleted_at IS NULL',
      [productoId]
    );
    
    if (producto.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar si ya existe la relación
    const [existente] = await connection.query(
      `SELECT * FROM hero_equippable_products 
       WHERE hero_id = ? AND product_id = ? AND deleted_at IS NULL`,
      [heroeId, productoId]
    );

    if (existente.length > 0) {
      // Si existe, actualizar equipamiento
      await connection.query(
        `UPDATE hero_equippable_products 
         SET is_equipped = NOT is_equipped, 
             equipped_at = IF(is_equipped = 0, NOW(), NULL)
         WHERE hero_id = ? AND product_id = ?`,
        [heroeId, productoId]
      );
    } else {
      // Si no existe, crear nueva relación
      const id = uuidv4();
      await connection.query(
        `INSERT INTO hero_equippable_products (id, hero_id, product_id, is_equipped, equipped_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, heroeId, productoId, true, new Date()]
      );
    }

    await connection.commit();

    res.json({ 
      message: 'Producto equipado/desequipado exitosamente',
      heroe_id: heroeId,
      producto_id: productoId
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};