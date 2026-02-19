'use strict';

const Money        = require('../../domain/value-objects/Money');
const PricingRules = require('../../domain/rules/PricingRules');
const { ORDER_STATUS, AUDIT_ACTIONS, PAYMENT_LIMITS } = require('../../payments.constants');

class CreateOrderUseCase {
  /**
   * @param {PaymentRepositoryInterface} repository
   */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * @param {Object} input
   * @param {string} input.userId
   * @param {string} input.productId
   * @param {string} input.currency
   * @param {string} input.countryCode
   * @param {string} input.idempotencyKey
   * @param {Object} input.buyerInfo
   * @param {string} [input.promoCode]
   */
  async execute(input) {
    const { userId, productId, currency, countryCode,
            idempotencyKey, promoCode } = input;

    // ── 1. Idempotency check ──────────────────────────────────────────────────
    const existing = await this.repository.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      log('info', 'CreateOrder: idempotency hit', { idempotencyKey, existing });
      const order = await this.repository.getOrderById(existing.order_id, null, false);
      return { orderId: order.order_id, idempotent: true };
    }

    // ── 2. Control de límites diarios ─────────────────────────────────────────
    const dailyCount = await this.repository.countUserOrdersToday(userId);
    if (dailyCount >= PAYMENT_LIMITS.MAX_DAILY_ORDERS) {
      throw createError('DAILY_LIMIT_EXCEEDED',
        'Has alcanzado el límite de órdenes diarias', 429);
    }

    // ── 3. Obtener producto y precio base ─────────────────────────────────────
    // El precio siempre viene de BD, NUNCA del cliente (seguridad crítica)
    let product, available;
    const conn = await this.repository.beginTransaction();

    try {
      ({ product, available } = await this.repository.reserveProductForUser(productId, userId, conn));

      if (!available) {
        await this.repository.rollback(conn);
        if (product?.alreadyOwned) throw createError('PRODUCT_ALREADY_OWNED', 'Ya posees este producto', 409);
        throw createError('PRODUCT_UNAVAILABLE', 'Producto no disponible o sin stock', 422);
      }

      const baseAmount = new Money(product.price_cents, currency);

      // ── 4. Calcular impuestos ────────────────────────────────────────────────
      const taxRule   = await this.repository.getTaxRule(productId, countryCode);
      const taxAmount = PricingRules.calculateTax(baseAmount, taxRule);

      // ── 5. Aplicar promoción ─────────────────────────────────────────────────
      let promotion    = null;
      let discountAmount = new Money(0, currency);
      if (promoCode) {
        promotion     = await this.repository.getValidPromotion(promoCode, productId, userId);
        if (!promotion) throw createError('INVALID_PROMO', 'Código promocional inválido o expirado', 422);
        discountAmount = PricingRules.calculateDiscount(baseAmount, {
          type:  promotion.discount_type,
          value: promotion.discount_value,
        });
      }

      // ── 6. Total final ────────────────────────────────────────────────────────
      const totalAmount = PricingRules.calculateTotal(baseAmount, taxAmount, discountAmount);

      if (totalAmount.amountInCents < PAYMENT_LIMITS.MIN_AMOUNT_CENTS)
        throw createError('AMOUNT_TOO_LOW', `Monto mínimo: $${PAYMENT_LIMITS.MIN_AMOUNT_CENTS / 100}`, 422);
      if (totalAmount.amountInCents > PAYMENT_LIMITS.MAX_AMOUNT_CENTS)
        throw createError('AMOUNT_TOO_HIGH', 'Monto supera el límite permitido', 422);

      // ── 7. Crear orden ────────────────────────────────────────────────────────
      const { orderId } = await this.repository.createOrder({
        userId,
        productId,
        baseAmount:     baseAmount.amountInCents,
        taxAmount:      taxAmount.amountInCents,
        discountAmount: discountAmount.amountInCents,
        totalAmount:    totalAmount.amountInCents,
        currency,
        idempotencyKey,
        promotionId:    promotion?.promotion_id || null,
      }, conn);

      // ── 8. Auditoría ──────────────────────────────────────────────────────────
      await this.repository.createAuditLog({
        entityType:     'ORDER',
        entityId:       orderId,
        action:         AUDIT_ACTIONS.ORDER_CREATED,
        previousStatus: null,
        newStatus:      ORDER_STATUS.PENDING,
        actorId:        userId,
        metadata:       { productId, totalAmount: totalAmount.amountInCents, currency, promoCode },
      }, conn);

      await this.repository.commit(conn);

      log('info', 'CreateOrder: order created', { orderId, userId, totalAmount: totalAmount.toString() });

      return {
        orderId,
        amounts: {
          base:     baseAmount.toDecimal(),
          tax:      taxAmount.toDecimal(),
          discount: discountAmount.toDecimal(),
          total:    totalAmount.toDecimal(),
          currency,
        },
        idempotent: false,
      };

    } catch (err) {
      await this.repository.rollback(conn);
      throw err;
    }
  }
}

module.exports = CreateOrderUseCase;