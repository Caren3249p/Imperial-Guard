'use strict';

const https   = require('https');
const crypto  = require('crypto');
const qs      = require('querystring');
const PaymentGatewayInterface = require('./PaymentGateway.interface');
const { TRANSACTION_STATUS }  = require('../../payments.constants');

class StripeGateway extends PaymentGatewayInterface {
  constructor({ secretKey, webhookSecret }) {
    super();
    if (!secretKey) throw new Error('StripeGateway: secretKey is required');
    this.secretKey     = secretKey;
    this.webhookSecret = webhookSecret;
  }

  getGatewayName() { return 'stripe'; }

  async createPayment(orderData) {
    const { orderId, totalAmount, currency, description, idempotencyKey, buyer, items } = orderData;

    // Crear PaymentIntent en Stripe
    const payload = {
      amount:      totalAmount,
      currency:    currency.toLowerCase(),
      description,
      metadata:    { orderId, buyerEmail: buyer.email },
      receipt_email: buyer.email,
    };

    const raw = await this._request('POST', '/v1/payment_intents',
      qs.stringify(payload), idempotencyKey);

    return {
      gatewayOrderId: raw.id,
      redirectUrl:    null,  // Stripe usa client_secret en frontend
      clientSecret:   raw.client_secret,
      rawResponse:    raw,
    };
  }

  async verifyWebhook(rawBody, signature) {
    // Stripe Webhook Signature: t=<ts>,v1=<hash>
    try {
      const parts   = signature.split(',').reduce((acc, p) => {
        const [k, v] = p.split('='); acc[k] = v; return acc;
      }, {});
      const payload  = `${parts.t}.${typeof rawBody === 'string' ? rawBody : rawBody.toString()}`;
      const expected = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
      const valid    = crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(parts.v1 || '')
      );
      const event = valid ? JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString()) : null;
      return { valid, event };
    } catch {
      return { valid: false, event: null };
    }
  }

  async refund(gatewayTransactionId, amount, reason) {
    const payload = qs.stringify({
      payment_intent: gatewayTransactionId,
      ...(amount ? { amount } : {}),
      reason: reason || 'requested_by_customer',
    });
    const raw = await this._request('POST', '/v1/refunds', payload);
    return { refundId: raw.id, status: raw.status, rawResponse: raw };
  }

  async getPaymentStatus(gatewayTransactionId) {
    const raw = await this._request('GET', `/v1/payment_intents/${gatewayTransactionId}`);
    const statusMap = {
      succeeded:              TRANSACTION_STATUS.APPROVED,
      requires_payment_method: TRANSACTION_STATUS.REJECTED,
      canceled:               TRANSACTION_STATUS.REJECTED,
      processing:             TRANSACTION_STATUS.PENDING,
    };
    return { status: statusMap[raw.status] || TRANSACTION_STATUS.ERROR, rawResponse: raw };
  }

  _request(method, path, body = null, idempotencyKey = null) {
    return new Promise((resolve, reject) => {
      const headers = {
        'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      };
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      if (body)           headers['Content-Length']  = Buffer.byteLength(body);

      const req = https.request({ hostname: 'api.stripe.com', path, method, headers }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const err = new Error(`Stripe API error ${res.statusCode}: ${parsed.error?.message}`);
              err.statusCode = res.statusCode; err.gatewayError = parsed;
              return reject(err);
            }
            resolve(parsed);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

module.exports = StripeGateway;

