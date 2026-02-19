'use strict';

const { createGateway }     = require('../infrastructure/factories/gateway.factory');
const { createRepository }  = require('../infrastructure/factories/repository.factory');
const HandleWebhookUseCase  = require('../application/use-cases/HandleWebhook.usecase');

const repository = createRepository();

class WebhookController {
  async handle(req, res, next) {
    try {
      // Obtener gateway del query param: /api/payments/webhook?gateway=mercadopago
      const gatewayName = req.query.gateway;
      if (!gatewayName) return res.status(400).json({ error: 'gateway param required' });

      const gateway   = createGateway(gatewayName);
      const useCase   = new HandleWebhookUseCase(repository, gateway);

      // rawBody fue guardado por express antes de JSON.parse (ver payments.routes.js)
      const signature = req.headers['x-signature']            // MercadoPago
                     || req.headers['stripe-signature']        // Stripe
                     || req.headers['x-hub-signature-256']     // genérico
                     || '';

      const result = await useCase.execute({
        rawBody:   req.rawBody,
        signature,
        ipAddress: req.clientIp || req.ip,
      });

      // Siempre responder 200 rápido a la pasarela
      res.status(200).json({ received: true, ...result });
    } catch (err) {
      // Para webhooks: log pero responder 200 para evitar reintento infinito
      // excepto errores de firma (401 → la pasarela no reintentará)
      if (err.code === 'INVALID_WEBHOOK_SIGNATURE') {
        return res.status(401).json({ error: err.message });
      }
      log('error', 'WebhookController: error', { err: err.message });
      res.status(200).json({ received: true, processed: false });
    }
  }
}

module.exports = new WebhookController();