'use strict';

/**
 * PaymentRepositoryInterface
 * Contrato de acceso a datos para el módulo de pagos.
 * Permite cambiar MySQL por PostgreSQL, MongoDB, etc. sin tocar dominio/aplicación.
 */
class PaymentRepositoryInterface {
  // ─── ÓRDENES ────────────────────────────────────────────────────────────────

  /**
   * Crea una orden en estado PENDING.
   * @param {Object} orderData
   * @param {string} orderData.userId
   * @param {string} orderData.productId
   * @param {number} orderData.baseAmount
   * @param {number} orderData.taxAmount
   * @param {number} orderData.discountAmount
   * @param {number} orderData.totalAmount
   * @param {string} orderData.currency
   * @param {string} orderData.idempotencyKey
   * @param {string} [orderData.promotionId]
   * @param {Object} conn - Conexión de transacción activa
   * @returns {Promise<{orderId: string}>}
   */
  async createOrder(orderData, conn) {
    throw new Error('PaymentRepositoryInterface.createOrder() not implemented');
  }

  /**
   * Obtiene orden por ID. Opcionalmente con lock FOR UPDATE.
   * @param {string}  orderId
   * @param {Object}  conn
   * @param {boolean} withLock - Si true, aplica SELECT ... FOR UPDATE
   * @returns {Promise<Object|null>}
   */
  async getOrderById(orderId, conn, withLock = false) {
    throw new Error('PaymentRepositoryInterface.getOrderById() not implemented');
  }

  /**
   * Actualiza estado de una orden.
   * @param {string} orderId
   * @param {string} status  - ENUM: PENDING|PROCESSING|PAID|FAILED|REFUNDED|CANCELLED
   * @param {Object} conn
   * @returns {Promise<void>}
   */
  async updateOrderStatus(orderId, status, conn) {
    throw new Error('PaymentRepositoryInterface.updateOrderStatus() not implemented');
  }

  /**
   * Bloquea la orden con SELECT FOR UPDATE para control de concurrencia.
   * @param {string} orderId
   * @param {Object} conn
   * @returns {Promise<Object>} - Orden bloqueada
   */
  async lockOrder(orderId, conn) {
    throw new Error('PaymentRepositoryInterface.lockOrder() not implemented');
  }

  // ─── TRANSACCIONES ───────────────────────────────────────────────────────────

  /**
   * Registra una transacción de pago.
   * @param {Object} txData
   * @param {string} txData.orderId
   * @param {string} txData.gatewayName
   * @param {string} txData.gatewayOrderId
   * @param {string} txData.status
   * @param {number} txData.amount
   * @param {string} txData.currency
   * @param {Object} txData.gatewayRawResponse
   * @param {Object} conn
   * @returns {Promise<{transactionId: string}>}
   */
  async createTransaction(txData, conn) {
    throw new Error('PaymentRepositoryInterface.createTransaction() not implemented');
  }

  /**
   * Actualiza estado de una transacción y guarda respuesta gateway.
   * @param {string} transactionId
   * @param {string} status
   * @param {Object} gatewayRawResponse
   * @param {Object} conn
   * @returns {Promise<void>}
   */
  async updateTransactionStatus(transactionId, status, gatewayRawResponse, conn) {
    throw new Error('PaymentRepositoryInterface.updateTransactionStatus() not implemented');
  }

  /**
   * Busca transacción por idempotency key (prevención doble pago).
   * @param {string} idempotencyKey
   * @returns {Promise<Object|null>}
   */
  async findTransactionByIdempotencyKey(idempotencyKey) {
    throw new Error('PaymentRepositoryInterface.findTransactionByIdempotencyKey() not implemented');
  }

  // ─── INVENTARIO ──────────────────────────────────────────────────────────────

  /**
   * Verifica y reserva stock del producto.
   * @param {string} productId
   * @param {string} userId
   * @param {Object} conn
   * @returns {Promise<{available: boolean, product: Object}>}
   */
  async reserveProductForUser(productId, userId, conn) {
    throw new Error('PaymentRepositoryInterface.reserveProductForUser() not implemented');
  }

  /**
   * Confirma asignación de producto a usuario tras pago exitoso.
   * @param {string} orderId
   * @param {string} userId
   * @param {string} productId
   * @param {Object} conn
   * @returns {Promise<void>}
   */
  async assignProductToUser(orderId, userId, productId, conn) {
    throw new Error('PaymentRepositoryInterface.assignProductToUser() not implemented');
  }

  /**
   * Libera reserva si el pago falla.
   * @param {string} productId
   * @param {string} userId
   * @param {Object} conn
   * @returns {Promise<void>}
   */
  async releaseProductReservation(productId, userId, conn) {
    throw new Error('PaymentRepositoryInterface.releaseProductReservation() not implemented');
  }

  // ─── AUDITORÍA ───────────────────────────────────────────────────────────────

  /**
   * Inserta registro inmutable de auditoría.
   * NUNCA actualiza ni elimina registros de esta tabla.
   * @param {Object} logData
   * @param {string} logData.entityType  - 'ORDER' | 'TRANSACTION' | 'REFUND'
   * @param {string} logData.entityId
   * @param {string} logData.action      - 'CREATED' | 'STATUS_CHANGED' | 'WEBHOOK_RECEIVED' etc.
   * @param {string} logData.previousStatus
   * @param {string} logData.newStatus
   * @param {string} logData.actorId     - userId o 'SYSTEM' o 'WEBHOOK'
   * @param {Object} logData.metadata    - datos adicionales JSON
   * @param {Object} conn
   * @returns {Promise<void>}
   */
  async createAuditLog(logData, conn) {
    throw new Error('PaymentRepositoryInterface.createAuditLog() not implemented');
  }

  // ─── REEMBOLSOS ──────────────────────────────────────────────────────────────

  /**
   * Registra un reembolso.
   * @param {Object} refundData
   * @param {string} refundData.transactionId
   * @param {string} refundData.orderId
   * @param {number} refundData.amount
   * @param {string} refundData.reason
   * @param {string} refundData.gatewayRefundId
   * @param {string} refundData.requestedBy
   * @param {Object} conn
   * @returns {Promise<{refundId: string}>}
   */
  async createRefund(refundData, conn) {
    throw new Error('PaymentRepositoryInterface.createRefund() not implemented');
  }

  // ─── PROMOCIONES / IMPUESTOS ─────────────────────────────────────────────────

  /**
   * Obtiene promoción válida por código.
   * @param {string} promoCode
   * @param {string} productId
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getValidPromotion(promoCode, productId, userId) {
    throw new Error('PaymentRepositoryInterface.getValidPromotion() not implemented');
  }

  /**
   * Obtiene regla de impuesto aplicable.
   * @param {string} productId
   * @param {string} countryCode
   * @returns {Promise<Object|null>}
   */
  async getTaxRule(productId, countryCode) {
    throw new Error('PaymentRepositoryInterface.getTaxRule() not implemented');
  }

  // ─── TRANSACCIONES DB ────────────────────────────────────────────────────────

  /**
   * Inicia una transacción de base de datos.
   * @returns {Promise<Object>} conn con transacción activa
   */
  async beginTransaction() {
    throw new Error('PaymentRepositoryInterface.beginTransaction() not implemented');
  }

  /**
   * Commit de la transacción.
   * @param {Object} conn
   */
  async commit(conn) {
    throw new Error('PaymentRepositoryInterface.commit() not implemented');
  }

  /**
   * Rollback de la transacción.
   * @param {Object} conn
   */
  async rollback(conn) {
    throw new Error('PaymentRepositoryInterface.rollback() not implemented');
  }
}

module.exports = PaymentRepositoryInterface;