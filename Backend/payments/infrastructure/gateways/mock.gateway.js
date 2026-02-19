'use strict';

const crypto = require('crypto');
const PaymentGatewayInterface = require('./PaymentGateway.interface');
const { TRANSACTION_STATUS }  = require('../../payments.constants');

/**
 * Mock gateway para testing/desarrollo.
 * Simula respuestas reales sin llamadas externas.
 */
class MockGateway extends PaymentGatewayInterface {
  getGatewayName() { return 'mock'; }

  async createPayment(orderData) {
    await this._delay(80);
    const gatewayOrderId = `mock_order_${crypto.randomUUID()}`;
    return {
      gatewayOrderId,
      redirectUrl:  `http://localhost:3000/mock-checkout/${gatewayOrderId}`,
      rawResponse:  { id: gatewayOrderId, status: 'created', mock: true },
    };
  }

  async verifyWebhook(rawBody, signature) {
    const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    return { valid: true, event };
  }

  async refund(gatewayTransactionId, amount, reason) {
    await this._delay(50);
    return {
      refundId:    `mock_refund_${crypto.randomUUID()}`,
      status:      'approved',
      rawResponse: { mock: true, gatewayTransactionId, amount },
    };
  }

  async getPaymentStatus(gatewayTransactionId) {
    await this._delay(30);
    return {
      status:      TRANSACTION_STATUS.APPROVED,
      rawResponse: { mock: true, id: gatewayTransactionId, status: 'approved' },
    };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = MockGateway;