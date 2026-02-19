'use strict';

const { ORDER_STATUS, TRANSACTION_STATUS, AUDIT_ACTIONS } = require('../../payments.constants');

class HandleWebhookUseCase {
  constructor(repository, gateway) {
    this.repository = repository;
    this.gateway    = gateway;
  }

  async execute({ rawBody, signature, ipAddress }) {
    // ── 1. Verificación criptográfica ─────────────────────────────────────────
    const { valid, event } = await this.gateway.verifyWebhook(rawBody, signature);
    if (!valid) {
      log('warn', 'HandleWebhook: invalid signature', { gateway: this.gateway.getGatewayName(), ipAddress });
      throw createError('INVALID_WEBHOOK_SIGNATURE', 'Firma de webhook inválida', 401);
    }

    log('info', 'HandleWebhook: received valid event', {
      gateway: this.gateway.getGatewayName(), type: event.type || event.action
    });

    // ── 2. Extraer gatewayOrderId según pasarela ──────────────────────────────
    const gatewayOrderId = this._extractGatewayOrderId(event);
    if (!gatewayOrderId) {
      log('warn', 'HandleWebhook: could not extract gatewayOrderId', { event });
      return { processed: false, reason: 'NO_GATEWAY_ORDER_ID' };
    }

    // ── 3. Buscar transacción local ───────────────────────────────────────────
    const [txRows] = await this.repository.pool.execute(
      'SELECT * FROM payment_transactions WHERE gateway_order_id = ? LIMIT 1',
      [gatewayOrderId]
    );
    if (!txRows?.length) {
      log('warn', 'HandleWebhook: transaction not found', { gatewayOrderId });
      return { processed: false, reason: 'TX_NOT_FOUND' };
    }
    const tx = txRows[0];

    // ── 4. Consultar estado real en pasarela (no confiar solo en webhook) ──────
    const { status: gatewayStatus, rawResponse } = await this.gateway.getPaymentStatus(gatewayOrderId);

    const conn = await this.repository.beginTransaction();
    try {
      // ── 5. Lock orden ───────────────────────────────────────────────────────
      const order = await this.repository.lockOrder(tx.order_id, conn);
      if (!order) { await this.repository.rollback(conn); return { processed: false, reason: 'ORDER_NOT_FOUND' }; }

      // Idempotencia: si ya está PAID/REFUNDED, ignorar
      if ([ORDER_STATUS.PAID, ORDER_STATUS.REFUNDED].includes(order.status)) {
        await this.repository.rollback(conn);
        return { processed: true, reason: 'ALREADY_PROCESSED', orderId: order.order_id };
      }

      if (gatewayStatus === TRANSACTION_STATUS.APPROVED) {
        await this._confirmPayment(order, tx, rawResponse, conn);
      } else if ([TRANSACTION_STATUS.REJECTED, TRANSACTION_STATUS.ERROR].includes(gatewayStatus)) {
        await this._failPayment(order, tx, rawResponse, conn);
      } else {
        // PENDING: solo actualizar tx, no cambiar orden
        await this.repository.updateTransactionStatus(tx.transaction_id, gatewayStatus, rawResponse, conn);
      }

      await this.repository.createAuditLog({
        entityType: 'TRANSACTION', entityId: tx.transaction_id,
        action: AUDIT_ACTIONS.WEBHOOK_RECEIVED,
        previousStatus: tx.status, newStatus: gatewayStatus,
        actorId: 'WEBHOOK',
        metadata: { gateway: this.gateway.getGatewayName(), gatewayOrderId, ipAddress },
      }, conn);

      await this.repository.commit(conn);
      return { processed: true, orderId: order.order_id, newStatus: gatewayStatus };

    } catch (err) {
      await this.repository.rollback(conn);
      log('error', 'HandleWebhook: error processing', { err: err.message });
      throw err;
    }
  }

  async _confirmPayment(order, tx, rawResponse, conn) {
    // Transacción SQL atómica: tx APPROVED + order PAID + inventario + auditoría
    await this.repository.updateTransactionStatus(
      tx.transaction_id, TRANSACTION_STATUS.APPROVED, rawResponse, conn
    );
    await this.repository.updateOrderStatus(order.order_id, ORDER_STATUS.PAID, conn);
    await this.repository.assignProductToUser(
      order.order_id, order.user_id, order.product_id, conn
    );
    await this.repository.createAuditLog({
      entityType: 'ORDER', entityId: order.order_id,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      previousStatus: order.status, newStatus: ORDER_STATUS.PAID,
      actorId: 'WEBHOOK', metadata: { transactionId: tx.transaction_id },
    }, conn);
    await this.repository.createAuditLog({
      entityType: 'ORDER', entityId: order.order_id,
      action: AUDIT_ACTIONS.INVENTORY_ASSIGNED,
      previousStatus: null, newStatus: 'ACTIVE',
      actorId: 'WEBHOOK',
      metadata: { productId: order.product_id, userId: order.user_id },
    }, conn);

    log('info', 'HandleWebhook: payment confirmed', { orderId: order.order_id });
  }

  async _failPayment(order, tx, rawResponse, conn) {
    await this.repository.updateTransactionStatus(
      tx.transaction_id, TRANSACTION_STATUS.REJECTED, rawResponse, conn
    );
    await this.repository.updateOrderStatus(order.order_id, ORDER_STATUS.FAILED, conn);
    await this.repository.releaseProductReservation(order.product_id, order.user_id, conn);
    await this.repository.createAuditLog({
      entityType: 'ORDER', entityId: order.order_id,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      previousStatus: order.status, newStatus: ORDER_STATUS.FAILED,
      actorId: 'WEBHOOK', metadata: { transactionId: tx.transaction_id },
    }, conn);
  }

  _extractGatewayOrderId(event) {
    // MercadoPago
    if (event?.data?.id) return String(event.data.id);
    // Stripe
    if (event?.data?.object?.id) return event.data.object.id;
    // Mock
    if (event?.gatewayOrderId) return event.gatewayOrderId;
    return null;
  }
}

module.exports = HandleWebhookUseCase;

