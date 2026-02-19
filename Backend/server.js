'use strict';

require('dotenv').config();

const express         = require('express');
const cors            = require('cors');
const productosRoutes = require('./routes/productos.routes');
const paymentsRoutes  = require('./payments/http/payments.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/payments', paymentsRoutes);
app.use('/api/productos', productosRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});