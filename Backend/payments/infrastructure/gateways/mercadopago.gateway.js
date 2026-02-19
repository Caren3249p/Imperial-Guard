'use strict';

const https = require('https');
const crypto = require('crypto');
const PaymentGatewayInterface = require('./PaymentGateway.interface');
const { TRANSACTION_STATUS } = require('../../payments.constants');

class MercadoPagoGateway extends PaymentGatewayInterface {
  constructor({ accessToken, webhookSecret }) {
    super();
    if (!accessToken) throw new Error('MercadoPagoGateway: accessToken is required');
    this.accessToken   = accessToken;
    this.webhookSecret = webhookSecret;
    this.baseUrl       = 'https://api.mercadopago.com';
  }

  getGatewayName() { return 'mercadopago'; }

  async createPayment(orderData) {
    const { orderId, totalAmount, currency, description, idempotencyKey, buyer, items } = orderData;

    const payload = {
      external_reference: orderId,
      reason:             description,
      currency_id:        currency,
      items: items.map(i => ({
        title:      i.title,
        quantity:   i.quantity,
        unit_price: i.unitPrice / 100,  // MP usa decimales
        currency_id: currency,
      })),
      payer: {
        email: buyer.email,
        name:  buyer.name,
      },
      back_urls: {
        success: `${process.env.APP_BASE_URL}/payments/success`,
        failure: `${process.env.APP_BASE_URL}/payments/failure`,
        pending: `${process.env.APP_BASE_URL}/payments/pending`,
      },
      auto_return:          'approved',
      notification_url:     `${process.env.APP_BASE_URL}/api/payments/webhook?gateway=mercadopago`,
      statement_descriptor: process.env.STATEMENT_DESCRIPTOR || 'MIPREMIUM',
    };

    const raw = await this._request('POST', '/checkout/preferences', payload, idempotencyKey);

    return {
      gatewayOrderId: raw.id,
      redirectUrl:    process.env.NODE_ENV === 'production' ? raw.init_point : raw.sandbox_init_point,
      rawResponse:    raw,
    };
  }

  async verifyWebhook(rawBody, signature) {
    // MercadoPago envía x-signature header: ts=<timestamp>,v1=<hash>
    try {
      const parts    = (signature || '').split(',').reduce((acc, part) => {
        const [k, v] = part.split('=');
        acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const ts      = parts['ts'];
      const v1      = parts['v1'];
      const manifest = `id:${rawBody.id};request-id:${rawBody['x-request-id'] || ''};ts:${ts};`;

      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(manifest)
        .digest('hex');

      const valid = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(v1, 'hex')
      );

      return { valid, event: typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody };
    } catch (err) {
      return { valid: false, event: null };
    }
  }

  async refund(gatewayTransactionId, amount, reason) {
    const payload = amount ? { amount: amount / 100 } : {};
    const raw = await this._request('POST', `/v1/payments/${gatewayTransactionId}/refunds`, payload);
    return {
      refundId:    String(raw.id),
      status:      raw.status,
      rawResponse: raw,
    };
  }

  async getPaymentStatus(gatewayTransactionId) {
    const raw = await this._request('GET', `/v1/payments/${gatewayTransactionId}`);
    const statusMap = {
      approved: TRANSACTION_STATUS.APPROVED,
      rejected: TRANSACTION_STATUS.REJECTED,
      pending:  TRANSACTION_STATUS.PENDING,
      in_process: TRANSACTION_STATUS.PENDING,
      refunded: TRANSACTION_STATUS.REFUNDED,
    };
    return {
      status:      statusMap[raw.status] || TRANSACTION_STATUS.ERROR,
      rawResponse: raw,
    };
  }

  // ─── HTTP Helper ─────────────────────────────────────────────────────────────

  _request(method, path, body = null, idempotencyKey = null) {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : '';
      const headers = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'NodePaymentsModule/1.0',
      };
      if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
      if (bodyStr)        headers['Content-Length'] = Buffer.byteLength(bodyStr);

      const options = {
        hostname: 'api.mercadopago.com',
        path,
        method,
        headers,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const err = new Error(`MercadoPago API error ${res.statusCode}`);
              err.statusCode   = res.statusCode;
              err.gatewayError = parsed;
              return reject(err);
            }
            resolve(parsed);
          } catch (e) { reject(e); }
        });
      });

      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}

module.exports = MercadoPagoGateway;