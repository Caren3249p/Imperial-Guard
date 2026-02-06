const express = require('express');
const cors = require('cors');

const notificationRoutes = require('./modules/notifications/notification.routes');
const startScheduler = require('./modules/notifications/notification.scheduler');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', notificationRoutes);

// 👇 ahora sí llamas el scheduler
startScheduler();

app.listen(3000, () => {
    console.log('Servidor corriendo en puerto 3000 😏');
});
