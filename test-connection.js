require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('Testing connection...');
console.log('URL:', process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'));

client.connect()
  .then(() => {
    console.log('✅ Connected successfully!');
    return client.query('SELECT version()');
  })
  .then(result => {
    console.log('Database version:', result.rows[0].version);
    client.end();
  })
  .catch(err => {
    console.error('❌ Connection error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  });
