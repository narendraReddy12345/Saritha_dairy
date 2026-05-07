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

// ✅ Force timezone on every connection
pool.on('connect', async (client) => {
  await client.query("SET TIME ZONE 'Asia/Kolkata'");
  const result = await client.query("SELECT NOW() as current_time");
  console.log('✅ DB timezone set, current DB time:', result.rows[0].current_time);
});

// ✅ Wrapper function to ensure timezone is set for queries
const queryWithTimezone = async (text, params) => {
  const client = await pool.connect();
  try {
    await client.query("SET TIME ZONE 'Asia/Kolkata'");
    return await client.query(text, params);
  } finally {
    client.release();
  }
};

pool.connect((err) => {
  if (err) {
    console.error('❌ DB connection failed:', err.message);
  } else {
    console.log('✅ DB connected successfully');
  }
});

// ✅ Helper to get current IST date directly from database
const getISTDateFromDB = async () => {
  const result = await pool.query("SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE as ist_date");
  return result.rows[0].ist_date;
};

// ✅ Helper to get current IST date from server (fallback)
const getISTDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createAllTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Set timezone for this session
    await client.query("SET TIME ZONE 'Asia/Kolkata'");
    
    // ✅ Create a function to get IST date in PostgreSQL
    await client.query(`
      CREATE OR REPLACE FUNCTION get_ist_date()
      RETURNS DATE AS $$
      BEGIN
        RETURN (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    
    // ✅ Create a function to get IST timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION get_ist_timestamp()
      RETURNS TIMESTAMP AS $$
      BEGIN
        RETURN NOW() AT TIME ZONE 'Asia/Kolkata';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`CREATE TABLE IF NOT EXISTS delivery_boys (
      id SERIAL PRIMARY KEY, 
      name VARCHAR(200) NOT NULL, 
      phone VARCHAR(20) UNIQUE NOT NULL, 
      password VARCHAR(255) NOT NULL, 
      email VARCHAR(200), 
      vehicle VARCHAR(100), 
      vehicle_no VARCHAR(50), 
      area VARCHAR(200), 
      address TEXT, 
      salary DECIMAL(10,2), 
      shift VARCHAR(50) DEFAULT 'morning', 
      status VARCHAR(50) DEFAULT 'active', 
      joined_date DATE DEFAULT get_ist_date(), 
      created_at TIMESTAMP DEFAULT get_ist_timestamp(), 
      updated_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY, 
      name VARCHAR(200) NOT NULL, 
      email VARCHAR(200) UNIQUE, 
      phone VARCHAR(20) NOT NULL, 
      password VARCHAR(255), 
      address TEXT, 
      area VARCHAR(100), 
      colony VARCHAR(100), 
      apartment VARCHAR(100), 
      flat_no VARCHAR(50), 
      landmark VARCHAR(200), 
      pincode VARCHAR(10), 
      city VARCHAR(100), 
      state VARCHAR(100), 
      created_at TIMESTAMP DEFAULT get_ist_timestamp(), 
      is_active BOOLEAN DEFAULT TRUE
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS customer_products (
      id SERIAL PRIMARY KEY, 
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, 
      product_name VARCHAR(100), 
      pack_size VARCHAR(50), 
      quantity_per_day INTEGER DEFAULT 1, 
      price DECIMAL(10,2), 
      created_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS customer_delivery_assignments (
      id SERIAL PRIMARY KEY, 
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, 
      delivery_boy_id INTEGER REFERENCES delivery_boys(id) ON DELETE CASCADE, 
      assigned_at TIMESTAMP DEFAULT get_ist_timestamp(), 
      UNIQUE(customer_id)
    )`);
    
    // ✅ Updated daily_delivery table - use get_ist_date() for default
    await client.query(`CREATE TABLE IF NOT EXISTS daily_delivery (
      id SERIAL PRIMARY KEY, 
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      delivery_boy_id INTEGER REFERENCES delivery_boys(id),
      delivery_date DATE DEFAULT get_ist_date(),
      product_name VARCHAR(100), 
      pack_size VARCHAR(50),
      quantity INTEGER DEFAULT 1, 
      price DECIMAL(10,2),
      total_amount DECIMAL(10,2), 
      status VARCHAR(50) DEFAULT 'pending',
      delivered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT get_ist_timestamp(),
      updated_at TIMESTAMP DEFAULT get_ist_timestamp(),
      UNIQUE(customer_id, delivery_date)
    )`);
    
    // ✅ Add index for faster queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_delivery_customer_date 
      ON daily_delivery(customer_id, delivery_date)`);
    
    // Rest of your tables...
    await client.query(`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY, 
      name VARCHAR(200) NOT NULL, 
      packs TEXT, 
      image_url VARCHAR(500), 
      created_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS farm_purchases (
      id SERIAL PRIMARY KEY, 
      product_name VARCHAR(200) NOT NULL, 
      quantity DECIMAL(10,2) NOT NULL, 
      unit VARCHAR(50), 
      price_per_unit DECIMAL(10,2), 
      total_cost DECIMAL(10,2), 
      farm_name VARCHAR(200), 
      invoice_number VARCHAR(100), 
      purchase_date DATE DEFAULT get_ist_date(), 
      notes TEXT, 
      remaining_quantity DECIMAL(10,2), 
      created_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS packing_batches (
      id SERIAL PRIMARY KEY, 
      batch_number VARCHAR(100) NOT NULL, 
      product_name VARCHAR(200) NOT NULL, 
      packed_date DATE DEFAULT get_ist_date(), 
      total_packets INTEGER DEFAULT 0, 
      total_quantity DECIMAL(10,2) DEFAULT 0, 
      created_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS packing_items (
      id SERIAL PRIMARY KEY, 
      batch_id INTEGER REFERENCES packing_batches(id) ON DELETE CASCADE, 
      batch_number VARCHAR(100), 
      pack_size_display VARCHAR(50), 
      packet_count INTEGER DEFAULT 0, 
      selling_price DECIMAL(10,2), 
      purchase_id INTEGER REFERENCES farm_purchases(id)
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS store_stock (
      id SERIAL PRIMARY KEY, 
      barcode VARCHAR(200), 
      product_name VARCHAR(200), 
      pack_size_display VARCHAR(50), 
      selling_price DECIMAL(10,2), 
      quantity INTEGER DEFAULT 0, 
      unit VARCHAR(50), 
      packed_date DATE, 
      purchase_id INTEGER REFERENCES farm_purchases(id), 
      created_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY, 
      customer_name VARCHAR(200), 
      customer_phone VARCHAR(20), 
      total_amount DECIMAL(10,2), 
      sold_at TIMESTAMP DEFAULT get_ist_timestamp()
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY, 
      sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE, 
      product_name VARCHAR(200), 
      pack_size_display VARCHAR(50), 
      quantity INTEGER DEFAULT 1, 
      price DECIMAL(10,2), 
      total DECIMAL(10,2)
    )`);

    await client.query('COMMIT');
    console.log('✅ All tables created successfully with IST timezone');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error.message);
  } finally { 
    client.release(); 
  }
};

// Only run table creation after successful connection
pool.connect((err) => {
  if (!err) {
    createAllTables();
  }
});

module.exports = { pool, getISTDate, getISTDateFromDB, queryWithTimezone };