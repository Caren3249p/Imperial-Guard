'use strict';

const { ORDER_STATUS, TRANSACTION_STATUS, AUDIT_ACTIONS } = require('../../payments.constants');

class RefundPaymentUseCase {
  constructor(repository, gateway) {
    this.repository = repository;
    this.gateway    = gateway;
  }

  async execute({ orderId, userId, amount, reason, requestedBy }) {
    const conn = await this.repository.beginTransaction();
    try {
      // ── 1. Lock y validar orden ───────────────────────────────────────────────
      const order = await this.repository.lockOrder(orderId, conn);
      if (!order)                        throw createError('ORDER_NOT_FOUND', 'Orden no encontrada', 404);
      if (order.user_id !== userId)      throw createError('FORBIDDEN', 'No autorizado', 403);
      if (order.status !== ORDER_STATUS.PAID)
        throw createError('NOT_REFUNDABLE', `Orden en estado ${order.status} no es reembolsable`, 409);

      // ── 2. Obtener transacción ────────────────────────────────────────────────
      const tx = await this.repository.getTransactionByOrderId(orderId, conn);
      if (!tx || tx.status !== TRANSACTION_STATUS.APPROVED)
        throw createError('TX_NOT_FOUND', 'Transacción aprobada no encontrada', 404);

      const refundAmount = amount || order.total_amount; // Default: reembolso total

      // ── 3. Commit parcial antes de llamar pasarela ────────────────────────────
      await this.repository.commit(conn);

      // ── 4. Llamar pasarela para reembolso ─────────────────────────────────────
      const refundResult = await this.gateway.refund(tx.gateway_order_id, refundAmount, reason);

      // ── 5. Registrar reembolso en TX atómica ──────────────────────────────────
      const conn2 = await this.repository.beginTransaction();
      try {
        const { refundId } = await this.repository.createRefund({
          transactionId:   tx.transaction_id,
          orderId,
          amount:          refundAmount,
          reason,
          gatewayRefundId: refundResult.refundId,
          requestedBy:     requestedBy || userId,
        }, conn2);

        await this.repository.updateOrderStatus(orderId, ORDER_STATUS.REFUNDED, conn2);
        await this.repository.updateTransactionStatus(
          tx.transaction_id, TRANSACTION_STATUS.REFUNDED, refundResult.rawResponse, conn2
        );

        await this.repository.createAuditLog({
          entityType: 'REFUND', entityId: refundId,
          action: AUDIT_ACTIONS.REFUND_COMPLETED,
          previousStatus: ORDER_STATUS.PAID, newStatus: ORDER_STATUS.REFUNDED,
          actorId: requestedBy || userId,
          metadata: { orderId, amount: refundAmount, reason, gatewayRefundId: refundResult.refundId },
        }, conn2);

        await this.repository.commit(conn2);

        log('info', 'RefundPayment: refund completed', { orderId, refundId, refundAmount });
        return { refundId, orderId, amount: refundAmount, status: 'COMPLETED' };

      } catch (e) {
        await this.repository.rollback(conn2);
        throw e;
      }
    } catch (err) {
      try { await this.repository.rollback(conn); } catch (_) {}
      throw err;
    }
  }
}

module.exports = RefundPaymentUseCase;