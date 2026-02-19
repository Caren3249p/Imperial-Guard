'use strict';

const { createGateway }    = require('../infrastructure/factories/gateway.factory');
const { createRepository } = require('../infrastructure/factories/repository.factory');
const CreateOrderUseCase   = require('../application/use-cases/CreateOrder.usecase');
const ProcessPaymentUseCase= require('../application/use-cases/ProcessPayment.usecase');
const RefundPaymentUseCase = require('../application/use-cases/RefundPayment.usecase');

// Inicializar dependencias (inyección via fábrica)
const repository = createRepository();

class PaymentsController {

  async createOrder(req, res, next) {
    try {
      const useCase = new CreateOrderUseCase(repository);
      const result  = await useCase.execute({
        userId:         req.user.id,          // Viene de middleware auth
        productId:      req.body.productId,
        currency:       req.body.currency,
        countryCode:    req.body.countryCode,
        idempotencyKey: req.body.idempotencyKey,
        buyerInfo:      req.body.buyerInfo,
        promoCode:      req.body.promoCode,
      });
      res.status(result.idempotent ? 200 : 201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async processPayment(req, res, next) {
    try {
      const gatewayName = req.body.gateway || process.env.DEFAULT_PAYMENT_GATEWAY;
      const gateway     = createGateway(gatewayName);
      const useCase     = new ProcessPaymentUseCase(repository, gateway);
      const result      = await useCase.execute({
        orderId:  req.params.orderId,
        userId:   req.user.id,
        buyerInfo: req.body.buyerInfo,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async refundPayment(req, res, next) {
    try {
      const gateway = createGateway(req.body.gateway || process.env.DEFAULT_PAYMENT_GATEWAY);
      const useCase = new RefundPaymentUseCase(repository, gateway);
      const result  = await useCase.execute({
        orderId:     req.params.orderId,
        userId:      req.user.id,
        amount:      req.body.amount,
        reason:      req.body.reason,
        requestedBy: req.user.id,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async getOrderStatus(req, res, next) {
    try {
      const order = await repository.getOrderById(req.params.orderId);
      if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
      if (order.user_id !== req.user.id)
        return res.status(403).json({ success: false, error: 'FORBIDDEN' });
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }
}

module.exports = new PaymentsController();