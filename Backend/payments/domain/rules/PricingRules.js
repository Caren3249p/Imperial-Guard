'use strict';
const Money = require('../value-objects/Money');

class PricingRules {
  /**
   * Calcula impuesto aplicando la tasa de la regla fiscal.
   * @param {Money} baseAmount
   * @param {Object} taxRule  - { rate: 0.21 } (21%)
   * @returns {Money} taxAmount
   */
  static calculateTax(baseAmount, taxRule) {
    if (!taxRule) return new Money(0, baseAmount.currency);
    return baseAmount.multiply(taxRule.rate);
  }

  /**
   * Aplica descuento de promoción al monto base.
   * @param {Money}  baseAmount
   * @param {Object} promotion - { type: 'PERCENTAGE'|'FIXED', value: number }
   * @returns {Money} discountAmount
   */
  static calculateDiscount(baseAmount, promotion) {
    if (!promotion) return new Money(0, baseAmount.currency);
    if (promotion.type === 'PERCENTAGE') {
      return baseAmount.multiply(promotion.value / 100);
    }
    if (promotion.type === 'FIXED') {
      const fixed = new Money(Math.round(promotion.value * 100), baseAmount.currency);
      // Descuento no puede superar el monto base
      return fixed.amountInCents > baseAmount.amountInCents
        ? baseAmount
        : fixed;
    }
    return new Money(0, baseAmount.currency);
  }

  /**
   * Calcula total final.
   */
  static calculateTotal(baseAmount, taxAmount, discountAmount) {
    return baseAmount.add(taxAmount).subtract(discountAmount);
  }
}

module.exports = PricingRules;