const pool = require('./db');

const createAllTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_boys (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
        email VARCHAR(200), vehicle VARCHAR(100), vehicle_no VARCHAR(50),
        area VARCHAR(200), address TEXT, salary DECIMAL(10,2),
        shift VARCHAR(50) DEFAULT 'morning', status VARCHAR(50) DEFAULT 'active',
        joined_date DATE DEFAULT CURRENT_DATE, created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE, phone VARCHAR(20) NOT NULL,
        password VARCHAR(255), address TEXT, area VARCHAR(100),
        colony VARCHAR(100), apartment VARCHAR(100), flat_no VARCHAR(50),
        landmark VARCHAR(200), pincode VARCHAR(10), city VARCHAR(100),
        state VARCHAR(100), created_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_products (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        product_name VARCHAR(100), pack_size VARCHAR(50),
        quantity_per_day INTEGER DEFAULT 1, price DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_delivery_assignments (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        delivery_boy_id INTEGER REFERENCES delivery_boys(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT NOW(), UNIQUE(customer_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_delivery (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        delivery_boy_id INTEGER REFERENCES delivery_boys(id),
        delivery_date DATE DEFAULT CURRENT_DATE, product_name VARCHAR(100),
        pack_size VARCHAR(50), quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2), total_amount DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL,
        packs TEXT, image_url VARCHAR(500), created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS farm_purchases (
        id SERIAL PRIMARY KEY, product_name VARCHAR(200) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL, unit VARCHAR(50),
        price_per_unit DECIMAL(10,2), total_cost DECIMAL(10,2),
        farm_name VARCHAR(200), invoice_number VARCHAR(100),
        purchase_date DATE DEFAULT CURRENT_DATE, notes TEXT,
        remaining_quantity DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS packing_batches (
        id SERIAL PRIMARY KEY, batch_number VARCHAR(100) NOT NULL,
        product_name VARCHAR(200) NOT NULL, packed_date DATE DEFAULT CURRENT_DATE,
        total_packets INTEGER DEFAULT 0, total_quantity DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS packing_items (
        id SERIAL PRIMARY KEY, batch_id INTEGER REFERENCES packing_batches(id) ON DELETE CASCADE,
        batch_number VARCHAR(100), pack_size_display VARCHAR(50),
        packet_count INTEGER DEFAULT 0, selling_price DECIMAL(10,2),
        purchase_id INTEGER REFERENCES farm_purchases(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS store_stock (
        id SERIAL PRIMARY KEY, barcode VARCHAR(200), product_name VARCHAR(200),
        pack_size_display VARCHAR(50), selling_price DECIMAL(10,2),
        quantity INTEGER DEFAULT 0, unit VARCHAR(50), packed_date DATE,
        purchase_id INTEGER REFERENCES farm_purchases(id), created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY, customer_name VARCHAR(200),
        customer_phone VARCHAR(20), total_amount DECIMAL(10,2),
        sold_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY, sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_name VARCHAR(200), pack_size_display VARCHAR(50),
        quantity INTEGER DEFAULT 1, price DECIMAL(10,2), total DECIMAL(10,2)
      )
    `);

    await client.query('COMMIT');
    console.log('✅ All tables created');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
  } finally {
    client.release();
  }
};

module.exports = createAllTables;