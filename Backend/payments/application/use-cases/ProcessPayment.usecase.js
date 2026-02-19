'use strict';

const { ORDER_STATUS, TRANSACTION_STATUS, AUDIT_ACTIONS } = require('../../payments.constants');

class ProcessPaymentUseCase {
  /**
   * @param {PaymentRepositoryInterface} repository
   * @param {PaymentGatewayInterface}    gateway
   */
  constructor(repository, gateway) {
    this.repository = repository;
    this.gateway    = gateway;
  }

  async execute({ orderId, userId, buyerInfo }) {
    const conn = await this.repository.beginTransaction();

    try {
      // ── 1. Lock orden (control race conditions) ───────────────────────────────
      const order = await this.repository.lockOrder(orderId, conn);
      if (!order) throw createError('ORDER_NOT_FOUND', 'Orden no encontrada', 404);
      if (order.user_id !== userId) throw createError('FORBIDDEN', 'No autorizado', 403);
      if (order.status !== ORDER_STATUS.PENDING)
        throw createError('ORDER_NOT_PENDING',
          `La orden está en estado ${order.status}`, 409);

      // ── 2. Transición a PROCESSING ────────────────────────────────────────────
      await this.repository.updateOrderStatus(orderId, ORDER_STATUS.PROCESSING, conn);
      await this.repository.createAuditLog({
        entityType: 'ORDER', entityId: orderId,
        action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
        previousStatus: ORDER_STATUS.PENDING, newStatus: ORDER_STATUS.PROCESSING,
        actorId: userId, metadata: { gateway: this.gateway.getGatewayName() },
      }, conn);

      // ── 3. Crear registro tx en INITIATED ─────────────────────────────────────
      const { transactionId } = await this.repository.createTransaction({
        orderId,
        gatewayName:        this.gateway.getGatewayName(),
        gatewayOrderId:     null,
        status:             TRANSACTION_STATUS.INITIATED,
        amount:             order.total_amount,
        currency:           order.currency,
        gatewayRawResponse: {},
      }, conn);

      await this.repository.createAuditLog({
        entityType: 'TRANSACTION', entityId: transactionId,
        action: AUDIT_ACTIONS.TRANSACTION_CREATED,
        previousStatus: null, newStatus: TRANSACTION_STATUS.INITIATED,
        actorId: userId, metadata: { orderId, gateway: this.gateway.getGatewayName() },
      }, conn);

      // ── 4. Commit parcial antes de llamar pasarela ────────────────────────────
      //    (Evita tener TX abierta durante llamada HTTP externa)
      await this.repository.commit(conn);

      // ── 5. Llamar pasarela (fuera de TX) ─────────────────────────────────────
      let gatewayResult;
      try {
        gatewayResult = await this.gateway.createPayment({
          orderId,
          totalAmount:    order.total_amount,
          currency:       order.currency,
          description:    `Orden ${orderId}`,
          idempotencyKey: order.idempotency_key,
          buyer:          buyerInfo,
          items: [{
            title:     `Producto Premium ${order.product_id}`,
            quantity:  1,
            unitPrice: order.total_amount,
          }],
        });
      } catch (gatewayErr) {
        // Actualizar estado a FAILED sin TX abierta (operación independiente)
        await this._handleGatewayError(transactionId, orderId, userId, gatewayErr);
        throw createError('GATEWAY_ERROR',
          'Error al procesar el pago en la pasarela', 502, { cause: gatewayErr.message });
      }

      // ── 6. Actualizar transacción con datos de pasarela ───────────────────────
      const conn2 = await this.repository.beginTransaction();
      try {
        await this.repository.updateTransactionStatus(
          transactionId, TRANSACTION_STATUS.PENDING, gatewayResult.rawResponse, conn2
        );
        // Guardar gatewayOrderId en la tx (necesario para webhook)
        await conn2.execute(
          'UPDATE payment_transactions SET gateway_order_id = ? WHERE transaction_id = ?',
          [gatewayResult.gatewayOrderId, transactionId]
        );
        await this.repository.commit(conn2);
      } catch (e) {
        await this.repository.rollback(conn2);
        throw e;
      }

      log('info', 'ProcessPayment: payment initiated', {
        orderId, transactionId, gateway: this.gateway.getGatewayName(),
        gatewayOrderId: gatewayResult.gatewayOrderId,
      });

      return {
        orderId,
        transactionId,
        gatewayOrderId: gatewayResult.gatewayOrderId,
        redirectUrl:    gatewayResult.redirectUrl || null,
        clientSecret:   gatewayResult.clientSecret || null,
        gateway:        this.gateway.getGatewayName(),
      };

    } catch (err) {
      // Si conn todavía está activa, rollback
      try { await this.repository.rollback(conn); } catch (_) {}
      throw err;
    }
  }

  async _handleGatewayError(transactionId, orderId, userId, gatewayErr) {
    const conn = await this.repository.beginTransaction();
    try {
      await this.repository.updateTransactionStatus(
        transactionId, TRANSACTION_STATUS.ERROR,
        { error: gatewayErr.message, gatewayError: gatewayErr.gatewayError }, conn
      );
      await this.repository.updateOrderStatus(orderId, ORDER_STATUS.FAILED, conn);
      await this.repository.createAuditLog({
        entityType: 'TRANSACTION', entityId: transactionId,
        action: AUDIT_ACTIONS.TX_STATUS_CHANGED,
        previousStatus: TRANSACTION_STATUS.INITIATED, newStatus: TRANSACTION_STATUS.ERROR,
        actorId: userId, metadata: { error: gatewayErr.message },
      }, conn);
      await this.repository.commit(conn);
    } catch (e) {
      await this.repository.rollback(conn);
      log('error', 'ProcessPayment: failed to record gateway error', { e: e.message });
    }
  }
}

module.exports = ProcessPaymentUseCase;