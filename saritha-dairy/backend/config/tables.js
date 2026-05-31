// config/tables.js
const pool = require('./db');

const createAllTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET TIME ZONE 'Asia/Kolkata'");

    // ============================================
    // MIGRATION: Fix existing daily_delivery table
    // ============================================
    console.log('🔧 Checking and fixing daily_delivery table...');
    
    // Add missing columns to daily_delivery
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='daily_delivery' AND column_name='created_at') THEN
          ALTER TABLE daily_delivery ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='daily_delivery' AND column_name='updated_at') THEN
          ALTER TABLE daily_delivery ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='daily_delivery' AND column_name='total_amount') THEN
          ALTER TABLE daily_delivery ADD COLUMN total_amount DECIMAL(10,2);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='daily_delivery' AND column_name='delivered') THEN
          ALTER TABLE daily_delivery ADD COLUMN delivered BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Create trigger function for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_daily_delivery_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Add trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_daily_delivery_updated_at ON daily_delivery;
      CREATE TRIGGER update_daily_delivery_updated_at
        BEFORE UPDATE ON daily_delivery
        FOR EACH ROW
        EXECUTE FUNCTION update_daily_delivery_updated_at();
    `);

    // Remove unique constraint if it exists
    await client.query(`
      ALTER TABLE daily_delivery 
      DROP CONSTRAINT IF EXISTS unique_customer_daily_delivery;
    `);

    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_delivery_customer_date 
      ON daily_delivery(customer_id, delivery_date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_delivery_delivery_boy_date 
      ON daily_delivery(delivery_boy_id, delivery_date);
    `);

    // ============================================
    // CREATE TABLES (if they don't exist)
    // ============================================

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

    // ✅ UPDATED customers table with ALL required columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
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
        registration_number VARCHAR(50),
        alternate_phone VARCHAR(15),
        delivery_time VARCHAR(20) DEFAULT 'morning',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // ✅ Add missing columns to existing customers table (for databases already created)
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customers' AND column_name='registration_number') THEN
          ALTER TABLE customers ADD COLUMN registration_number VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customers' AND column_name='alternate_phone') THEN
          ALTER TABLE customers ADD COLUMN alternate_phone VARCHAR(15);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customers' AND column_name='delivery_time') THEN
          ALTER TABLE customers ADD COLUMN delivery_time VARCHAR(20) DEFAULT 'morning';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customers' AND column_name='notes') THEN
          ALTER TABLE customers ADD COLUMN notes TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customers' AND column_name='updated_at') THEN
          ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
      END $$;
    `);

    console.log('✅ Customers table ready with all required columns');

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
        id SERIAL PRIMARY KEY, 
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        delivery_boy_id INTEGER REFERENCES delivery_boys(id),
        delivery_date DATE DEFAULT CURRENT_DATE, 
        product_name VARCHAR(100),
        pack_size VARCHAR(50), 
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2), 
        total_amount DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        delivered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, 
        name VARCHAR(200) NOT NULL,
        packs TEXT, 
        image_url VARCHAR(500), 
        product_type VARCHAR(50) DEFAULT 'dairy',
        is_non_dairy BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS farm_purchases (
        id SERIAL PRIMARY KEY, 
        product_name VARCHAR(200) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL, 
        unit VARCHAR(50),
        price_per_unit DECIMAL(10,2), 
        total_cost DECIMAL(10,2),
        farm_name VARCHAR(200), 
        invoice_number VARCHAR(100),
        purchase_date DATE DEFAULT CURRENT_DATE, 
        notes TEXT,
        remaining_quantity DECIMAL(10,2), 
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS non_dairy_purchases (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(200) NOT NULL,
        pack_size VARCHAR(50),
        pack_unit VARCHAR(20) DEFAULT 'piece',
        quantity DECIMAL(10,2) NOT NULL,
        price_per_unit DECIMAL(10,2) NOT NULL,
        total_cost DECIMAL(10,2) NOT NULL,
        supplier VARCHAR(200),
        invoice_number VARCHAR(100),
        purchase_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_non_dairy_purchases_date 
      ON non_dairy_purchases(purchase_date)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_non_dairy_purchases_product 
      ON non_dairy_purchases(product_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS packing_batches (
        id SERIAL PRIMARY KEY, 
        batch_number VARCHAR(100) NOT NULL,
        product_name VARCHAR(200) NOT NULL, 
        packed_date DATE DEFAULT CURRENT_DATE,
        total_packets INTEGER DEFAULT 0, 
        total_quantity DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS packing_items (
        id SERIAL PRIMARY KEY, 
        batch_id INTEGER REFERENCES packing_batches(id) ON DELETE CASCADE,
        batch_number VARCHAR(100), 
        pack_size_display VARCHAR(50),
        packet_count INTEGER DEFAULT 0, 
        selling_price DECIMAL(10,2),
        purchase_id INTEGER REFERENCES farm_purchases(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS store_stock (
        id SERIAL PRIMARY KEY, 
        barcode VARCHAR(200), 
        product_name VARCHAR(200),
        pack_size_display VARCHAR(50), 
        selling_price DECIMAL(10,2),
        quantity INTEGER DEFAULT 0, 
        unit VARCHAR(50), 
        packed_date DATE,
        product_type VARCHAR(50) DEFAULT 'dairy',
        purchase_id INTEGER REFERENCES farm_purchases(id),
        non_dairy_purchase_id INTEGER REFERENCES non_dairy_purchases(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY, 
        customer_name VARCHAR(200),
        customer_phone VARCHAR(20), 
        total_amount DECIMAL(10,2),
        sold_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY, 
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_name VARCHAR(200), 
        pack_size_display VARCHAR(50),
        quantity INTEGER DEFAULT 1, 
        price DECIMAL(10,2), 
        total DECIMAL(10,2),
        product_type VARCHAR(50) DEFAULT 'dairy'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(200) NOT NULL,
        product_type VARCHAR(50) NOT NULL,
        movement_type VARCHAR(50) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(50),
        reference_id INTEGER,
        reference_type VARCHAR(50),
        previous_stock DECIMAL(10,2),
        new_stock DECIMAL(10,2),
        notes TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_product 
      ON stock_movements(product_name, product_type)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_date 
      ON stock_movements(created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(200),
        address TEXT,
        gst_number VARCHAR(50),
        supplier_type VARCHAR(50) DEFAULT 'both',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE farm_purchases 
      ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL
    `);

    await client.query(`
      ALTER TABLE non_dairy_purchases 
      ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS non_dairy_stock (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        product_name VARCHAR(200) NOT NULL,
        pack_size VARCHAR(50),
        pack_unit VARCHAR(20),
        quantity INTEGER DEFAULT 0,
        selling_price DECIMAL(10,2),
        purchase_price DECIMAL(10,2),
        last_purchase_id INTEGER REFERENCES non_dairy_purchases(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id, pack_size)
      )
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS non_dairy_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        pack_size VARCHAR(50),
        pack_unit VARCHAR(20) DEFAULT 'piece',
        selling_price DECIMAL(10,2) NOT NULL,
        purchase_price DECIMAL(10,2) DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 0,
        image_url VARCHAR(500),
        supplier VARCHAR(200),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS non_dairy_purchase_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES non_dairy_items(id) ON DELETE CASCADE,
        product_name VARCHAR(200) NOT NULL,
        quantity INTEGER NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        total_cost DECIMAL(10,2) NOT NULL,
        supplier VARCHAR(200),
        invoice_number VARCHAR(100),
        transaction_type VARCHAR(50) DEFAULT 'additional_stock',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_non_dairy_items_name 
      ON non_dairy_items(name)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_non_dairy_purchase_history_product 
      ON non_dairy_purchase_history(product_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_non_dairy_purchase_history_date 
      ON non_dairy_purchase_history(created_at)
    `);

    // ============================================
    // PAYMENT MANAGEMENT TABLES
    // ============================================

    // Payment requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'qr',
        screenshot_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'pending',
        reference VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Wallet transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(20) NOT NULL,
        reference_id INTEGER,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Payment settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        bank_name VARCHAR(100),
        account_name VARCHAR(100),
        account_number VARCHAR(50),
        ifsc_code VARCHAR(20),
        upi_id VARCHAR(100),
        qr_code_url VARCHAR(500),
        contact_number VARCHAR(20),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Customer skips table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_skips (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE,
        reason TEXT,
        skip_type VARCHAR(20) DEFAULT 'single',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add columns to customer_preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_preferences (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        want_milk BOOLEAN DEFAULT TRUE,
        quantity INTEGER DEFAULT 2,
        pack_size VARCHAR(20) DEFAULT '500ml',
        skip_days JSON DEFAULT NULL,
        extra_orders JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(customer_id)
      )
    `);

    // Add missing columns to customer_preferences if table already exists
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customer_preferences' AND column_name='skip_days') THEN
          ALTER TABLE customer_preferences ADD COLUMN skip_days JSON DEFAULT NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
          WHERE table_name='customer_preferences' AND column_name='extra_orders') THEN
          ALTER TABLE customer_preferences ADD COLUMN extra_orders JSON DEFAULT NULL;
        END IF;
      END $$;
    `);

    // Create indexes for payment tables
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_customer ON payment_requests(customer_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_requests(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_customer ON wallet_transactions(customer_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_type ON wallet_transactions(type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skip_customer ON customer_skips(customer_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skip_status ON customer_skips(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skip_dates ON customer_skips(start_date, end_date);`);

    // Add triggers for payment tables
    const paymentTables = ['payment_requests', 'customer_skips', 'customer_preferences'];
    
    for (const table of paymentTables) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Insert default payment settings if not exists
    await client.query(`
      INSERT INTO payment_settings (id, bank_name, account_name, account_number, ifsc_code, upi_id, contact_number)
      SELECT 1, 'Your Bank Name', 'Saritha Dairy', 'XXXXXXXXXXXXXX', 'IFSC0001234', 'sarithadairy@okhdfcbank', '9398263810'
      WHERE NOT EXISTS (SELECT 1 FROM payment_settings WHERE id = 1)
    `);

    const tablesWithUpdatedAt = ['products', 'farm_purchases', 'non_dairy_purchases', 'store_stock', 'suppliers', 'non_dairy_stock', 'non_dairy_items', 'payment_requests', 'customer_skips', 'customer_preferences'];
    
    for (const table of tablesWithUpdatedAt) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    await client.query('COMMIT');
    console.log('✅ All tables created successfully');
    console.log('✅ Daily_delivery table migration completed');
    console.log('📦 Non-dairy purchases table added');
    console.log('📦 Non-dairy items table with image_url column added');
    console.log('📊 Stock movements logging enabled');
    console.log('🏢 Suppliers table created');
    console.log('💰 Payment Management tables created:');
    console.log('   - payment_requests');
    console.log('   - wallet_transactions');
    console.log('   - payment_settings');
    console.log('   - customer_skips');
    console.log('   - customer_preferences (updated with skip_days, extra_orders)');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = createAllTables;