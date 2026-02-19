'use strict';

const { ORDER_STATUS } = require('../../payments.constants');

class Order {
  constructor({ orderId, userId, productId, baseAmount, taxAmount, discountAmount,
                totalAmount, currency, status, idempotencyKey, promotionId, createdAt }) {
    this.orderId        = orderId;
    this.userId         = userId;
    this.productId      = productId;
    this.baseAmount     = baseAmount;     // En centavos
    this.taxAmount      = taxAmount;
    this.discountAmount = discountAmount;
    this.totalAmount    = totalAmount;
    this.currency       = currency;
    this.status         = status || ORDER_STATUS.PENDING;
    this.idempotencyKey = idempotencyKey;
    this.promotionId    = promotionId || null;
    this.createdAt      = createdAt || new Date();
  }

  isPending()    { return this.status === ORDER_STATUS.PENDING; }
  isPaid()       { return this.status === ORDER_STATUS.PAID; }
  isRefundable() { return this.status === ORDER_STATUS.PAID; }
  isCancellable(){ return [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING].includes(this.status); }

  canTransitionTo(newStatus) {
    const allowed = {
      [ORDER_STATUS.PENDING]:    [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.PAID, ORDER_STATUS.FAILED],
      [ORDER_STATUS.PAID]:       [ORDER_STATUS.REFUNDED],
      [ORDER_STATUS.FAILED]:     [ORDER_STATUS.PENDING],
      [ORDER_STATUS.REFUNDED]:   [],
      [ORDER_STATUS.CANCELLED]:  [],
    };
    return (allowed[this.status] || []).includes(newStatus);
  }
}

module.exports = Order;