'use strict';

const { v4: uuidv4 }             = require('uuid');
const PaymentRepositoryInterface = require('./PaymentRepository.interface');
const { ORDER_STATUS }           = require('../../payments.constants');

class PaymentsMySQLRepository extends PaymentRepositoryInterface {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  // ─── TRANSACCIONES DB ────────────────────────────────────────────────────────

  async beginTransaction() {
    const conn = await this.pool.getConnection();
    await conn.beginTransaction();
    return conn;
  }

  async commit(conn) {
    await conn.commit();
    conn.release();
  }

  async rollback(conn) {
    try { await conn.rollback(); } finally { conn.release(); }
  }

  // ─── ÓRDENES ────────────────────────────────────────────────────────────────

  async createOrder(orderData, conn) {
    const orderId = uuidv4();
    const {
      userId, productId, baseAmount, taxAmount,
      discountAmount, totalAmount, currency, idempotencyKey, promotionId,
    } = orderData;

    await (conn || this.pool).execute(
      `INSERT INTO orders
         (order_id, user_id, product_id, base_amount, tax_amount, discount_amount,
          total_amount, currency, status, idempotency_key, promotion_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [orderId, userId, productId, baseAmount, taxAmount,
       discountAmount, totalAmount, currency, idempotencyKey, promotionId || null]
    );

    return { orderId };
  }

  async getOrderById(orderId, conn, withLock = false) {
    const sql = withLock
      ? 'SELECT * FROM orders WHERE order_id = ? AND deleted_at IS NULL FOR UPDATE'
      : 'SELECT * FROM orders WHERE order_id = ? AND deleted_at IS NULL';
    const [rows] = await (conn || this.pool).execute(sql, [orderId]);
    return rows[0] || null;
  }

  async updateOrderStatus(orderId, status, conn) {
    await (conn || this.pool).execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?',
      [status, orderId]
    );
  }

  async lockOrder(orderId, conn) {
    const [rows] = await conn.execute(
      'SELECT * FROM orders WHERE order_id = ? AND deleted_at IS NULL FOR UPDATE',
      [orderId]
    );
    return rows[0] || null;
  }

  // ─── TRANSACCIONES ───────────────────────────────────────────────────────────

  async createTransaction(txData, conn) {
    const transactionId = uuidv4();
    const {
      orderId, gatewayName, gatewayOrderId,
      status, amount, currency, gatewayRawResponse,
    } = txData;

    await (conn || this.pool).execute(
      `INSERT INTO payment_transactions
         (transaction_id, order_id, gateway_name, gateway_order_id,
          status, amount, currency, gateway_raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, orderId, gatewayName, gatewayOrderId,
       status, amount, currency, JSON.stringify(gatewayRawResponse)]
    );

    return { transactionId };
  }

  async updateTransactionStatus(transactionId, status, gatewayRawResponse, conn) {
    await (conn || this.pool).execute(
      `UPDATE payment_transactions
         SET status = ?, gateway_raw_response = ?, updated_at = NOW()
       WHERE transaction_id = ?`,
      [status, JSON.stringify(gatewayRawResponse), transactionId]
    );
  }

  async findTransactionByIdempotencyKey(idempotencyKey) {
    const [rows] = await this.pool.execute(
      `SELECT pt.* FROM payment_transactions pt
         JOIN orders o ON pt.order_id = o.order_id
       WHERE o.idempotency_key = ? LIMIT 1`,
      [idempotencyKey]
    );
    return rows[0] || null;
  }

  async getTransactionByOrderId(orderId, conn) {
    const [rows] = await (conn || this.pool).execute(
      'SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
      [orderId]
    );
    return rows[0] || null;
  }

  // ─── INVENTARIO ──────────────────────────────────────────────────────────────

  async reserveProductForUser(productId, userId, conn) {
    // Verifica que el producto exista, tenga stock y el usuario no lo tenga ya
    const [products] = await (conn || this.pool).execute(
      `SELECT p.*, ps.available_stock
         FROM products p
         JOIN product_stock ps ON p.product_id = ps.product_id
       WHERE p.product_id = ? AND p.deleted_at IS NULL
         AND p.is_active = 1
         FOR UPDATE`,
      [productId]
    );
    if (!products.length) return { available: false, product: null };

    const product = products[0];
    if (product.available_stock <= 0) return { available: false, product };

    // Verifica que el usuario no lo posea ya
    const [existing] = await (conn || this.pool).execute(
      `SELECT 1 FROM user_inventory
         WHERE user_id = ? AND product_id = ? AND status = 'ACTIVE' LIMIT 1`,
      [userId, productId]
    );
    if (existing.length) return { available: false, product, alreadyOwned: true };

    // Reserva: decrementa stock temporalmente
    await (conn || this.pool).execute(
      `UPDATE product_stock
         SET reserved_stock = reserved_stock + 1,
             available_stock = available_stock - 1,
             updated_at = NOW()
       WHERE product_id = ? AND available_stock > 0`,
      [productId]
    );

    return { available: true, product };
  }

  async assignProductToUser(orderId, userId, productId, conn) {
    const inventoryId = uuidv4();
    await (conn || this.pool).execute(
      `INSERT INTO user_inventory
         (inventory_id, user_id, product_id, order_id, status, assigned_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', NOW())`,
      [inventoryId, userId, productId, orderId]
    );
    // Confirmar reserva: reduce reserved_stock
    await (conn || this.pool).execute(
      `UPDATE product_stock
         SET reserved_stock = reserved_stock - 1,
             updated_at = NOW()
       WHERE product_id = ?`,
      [productId]
    );
  }

  async releaseProductReservation(productId, userId, conn) {
    await (conn || this.pool).execute(
      `UPDATE product_stock
         SET reserved_stock = reserved_stock - 1,
             available_stock = available_stock + 1,
             updated_at = NOW()
       WHERE product_id = ? AND reserved_stock > 0`,
      [productId]
    );
  }

  // ─── AUDITORÍA ───────────────────────────────────────────────────────────────

  async createAuditLog(logData, conn) {
    const {
      entityType, entityId, action,
      previousStatus, newStatus, actorId, metadata,
    } = logData;

    // INSERT ONLY — nunca UPDATE o DELETE en audit_logs
    await (conn || this.pool).execute(
      `INSERT INTO audit_logs
         (log_id, entity_type, entity_id, action,
          previous_status, new_status, actor_id, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), entityType, entityId, action,
        previousStatus || null, newStatus || null,
        actorId, JSON.stringify(metadata || {}),
        metadata?.ipAddress || null,
      ]
    );
  }

  // ─── REEMBOLSOS ──────────────────────────────────────────────────────────────

  async createRefund(refundData, conn) {
    const refundId = uuidv4();
    const { transactionId, orderId, amount, reason, gatewayRefundId, requestedBy } = refundData;

    await (conn || this.pool).execute(
      `INSERT INTO refunds
         (refund_id, transaction_id, order_id, amount, reason,
          gateway_refund_id, requested_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
      [refundId, transactionId, orderId, amount, reason, gatewayRefundId, requestedBy]
    );

    return { refundId };
  }

  // ─── PROMOCIONES / IMPUESTOS ─────────────────────────────────────────────────

  async getValidPromotion(promoCode, productId, userId) {
    const [rows] = await this.pool.execute(
      `SELECT p.* FROM promotions p
       WHERE p.code = ?
         AND p.is_active = 1
         AND p.deleted_at IS NULL
         AND (p.product_id IS NULL OR p.product_id = ?)
         AND (p.max_uses IS NULL OR p.current_uses < p.max_uses)
         AND (p.valid_from IS NULL OR p.valid_from <= NOW())
         AND (p.valid_until IS NULL OR p.valid_until >= NOW())
       LIMIT 1`,
      [promoCode, productId]
    );
    if (!rows.length) return null;

    const promo = rows[0];
    // Verificar que el usuario no haya usado ya esta promo
    const [used] = await this.pool.execute(
      `SELECT 1 FROM orders
         WHERE user_id = ? AND promotion_id = ?
           AND status IN ('PAID','PROCESSING')
       LIMIT 1`,
      [userId, promo.promotion_id]
    );
    if (used.length) return null;

    return promo;
  }

  async getTaxRule(productId, countryCode) {
    const [rows] = await this.pool.execute(
      `SELECT tr.* FROM tax_rules tr
       WHERE (tr.product_id = ? OR tr.product_id IS NULL)
         AND tr.country_code = ?
         AND tr.is_active = 1
       ORDER BY tr.product_id DESC  -- específica tiene prioridad sobre genérica
       LIMIT 1`,
      [productId, countryCode]
    );
    return rows[0] || null;
  }

  // ─── RATE LIMIT / ANTIFRAUDE ─────────────────────────────────────────────────

  async countUserOrdersToday(userId) {
    const [rows] = await this.pool.execute(
      `SELECT COUNT(*) as cnt FROM orders
         WHERE user_id = ? AND DATE(created_at) = CURDATE()
           AND status NOT IN ('CANCELLED','FAILED')`,
      [userId]
    );
    return rows[0].cnt;
  }
}

module.exports = PaymentsMySQLRepository;