'use strict';

/**
 * PaymentGatewayInterface
 * Contrato que toda pasarela de pago debe implementar.
 * Los servicios de aplicación dependen SOLO de esta interfaz.
 */

class PaymentGatewayInterface {
  /**
   * Crea una intención/preferencia de pago en la pasarela externa.
   * @param {Object} orderData
   * @param {string} orderData.orderId
   * @param {number} orderData.totalAmount   - En centavos o unidad mínima
   * @param {string} orderData.currency      - 'COP', 'USD', etc.
   * @param {string} orderData.description
   * @param {string} orderData.idempotencyKey
   * @param {Object} orderData.buyer         - { email, name, documentId }
   * @param {Array}  orderData.items         - [{ title, quantity, unitPrice }]
   * @returns {Promise<{gatewayOrderId: string, redirectUrl: string, rawResponse: Object}>}
   */
  async createPayment(orderData) {
    throw new Error('PaymentGatewayInterface.createPayment() not implemented');
  }

  /**
   * Verifica autenticidad criptográfica de un webhook entrante.
   * @param {Buffer|string} rawBody   - Body crudo sin parsear (para HMAC)
   * @param {string}        signature - Header de firma de la pasarela
   * @returns {Promise<{valid: boolean, event: Object}>}
   */
  async verifyWebhook(rawBody, signature) {
    throw new Error('PaymentGatewayInterface.verifyWebhook() not implemented');
  }

  /**
   * Emite un reembolso total o parcial.
   * @param {string} gatewayTransactionId
   * @param {number} amount   - Monto a reembolsar
   * @param {string} reason
   * @returns {Promise<{refundId: string, status: string, rawResponse: Object}>}
   */
  async refund(gatewayTransactionId, amount, reason) {
    throw new Error('PaymentGatewayInterface.refund() not implemented');
  }

  /**
   * Consulta estado actual de un pago en la pasarela.
   * @param {string} gatewayTransactionId
   * @returns {Promise<{status: string, rawResponse: Object}>}
   */
  async getPaymentStatus(gatewayTransactionId) {
    throw new Error('PaymentGatewayInterface.getPaymentStatus() not implemented');
  }

  /**
   * Obtiene nombre identificador de la pasarela (para logging/auditoría).
   * @returns {string}
   */
  getGatewayName() {
    throw new Error('PaymentGatewayInterface.getGatewayName() not implemented');
  }
}

module.exports = PaymentGatewayInterface;