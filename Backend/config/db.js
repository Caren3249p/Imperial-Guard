const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Caren200505',
    database: 'nexus_game'
});

connection.connect((err) => {
    if (err) {
        console.error('Error conexión DB:', err);
        return;
    }
    console.log('DB conectada 😏');
});

module.exports = connection;
