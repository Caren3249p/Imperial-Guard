'use strict';
const { GATEWAY_NAMES } = require('../../payments.constants');

const MercadoPagoGateway = require('../gateways/mercadopago.gateway');
const StripeGateway      = require('../gateways/stripe.gateway');
const MockGateway        = require('../gateways/mock.gateway');

/**
 * Resuelve qué implementación de gateway usar según configuración.
 * Los servicios de aplicación solo reciben PaymentGatewayInterface.
 */
function createGateway(gatewayName) {
  const name = gatewayName || process.env.DEFAULT_PAYMENT_GATEWAY || GATEWAY_NAMES.MERCADOPAGO;

  switch (name) {
    case GATEWAY_NAMES.MERCADOPAGO:
      return new MercadoPagoGateway({
        accessToken: process.env.MP_ACCESS_TOKEN,
        webhookSecret: process.env.MP_WEBHOOK_SECRET,
      });
    case GATEWAY_NAMES.STRIPE:
      return new StripeGateway({
        secretKey:     process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      });
    case GATEWAY_NAMES.MOCK:
      return new MockGateway();
    default:
      throw new Error(`Unknown payment gateway: ${name}`);
  }
}

module.exports = { createGateway };