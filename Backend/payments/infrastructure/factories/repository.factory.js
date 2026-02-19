'use strict';
const pool = require('../../../db');  // pool.promise() de db.js existente
const PaymentsMySQLRepository = require('../repositories/payments.mysql.repository');

let _instance = null;

/**
 * Singleton del repositorio MySQL.
 * Para cambiar a PostgreSQL: crear PostgresRepository implementando la misma interfaz
 * y cambiar aquí. Cero cambios en dominio/aplicación.
 */
function createRepository() {
  if (!_instance) {
    _instance = new PaymentsMySQLRepository(pool);
  }
  return _instance;
}

module.exports = { createRepository };