'use strict';

/**
 * Value Object para representar dinero de forma segura.
 * Todos los montos se operan en centavos (enteros) para evitar floating point.
 */
class Money {
  constructor(amountInCents, currency) {
    if (!Number.isInteger(amountInCents) || amountInCents < 0)
      throw new Error(`Money: amount must be a non-negative integer (cents). Got: ${amountInCents}`);
    if (!currency || typeof currency !== 'string')
      throw new Error('Money: currency is required');

    this.amountInCents = amountInCents;
    this.currency      = currency.toUpperCase();
  }

  add(other)      { this._assertSameCurrency(other); return new Money(this.amountInCents + other.amountInCents, this.currency); }
  subtract(other) { this._assertSameCurrency(other); const r = this.amountInCents - other.amountInCents; if (r < 0) throw new Error('Money: subtraction result cannot be negative'); return new Money(r, this.currency); }
  multiply(factor){ return new Money(Math.round(this.amountInCents * factor), this.currency); }
  equals(other)   { return this.amountInCents === other.amountInCents && this.currency === other.currency; }
  toDecimal()     { return this.amountInCents / 100; }
  toString()      { return `${this.currency} ${this.toDecimal().toFixed(2)}`; }

  _assertSameCurrency(other) {
    if (this.currency !== other.currency)
      throw new Error(`Money: currency mismatch ${this.currency} vs ${other.currency}`);
  }

  static fromDecimal(decimal, currency) {
    return new Money(Math.round(decimal * 100), currency);
  }
}

module.exports = Money;
