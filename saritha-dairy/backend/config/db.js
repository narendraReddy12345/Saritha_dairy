// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'saritha_dairy',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? {
    rejectUnauthorized: false
  } : false
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DB connection failed:', err.message);
  } else {
    console.log('✅ DB connected successfully');
    client.query("SET TIME ZONE 'Asia/Kolkata'", (err) => {
      if (err) console.error('Error setting timezone:', err.message);
      release();
    });
  }
});

// Helper function to get IST date
const getISTDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

module.exports = pool;
module.exports.getISTDate = getISTDate;