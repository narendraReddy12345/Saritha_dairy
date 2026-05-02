// controllers/creditController.js - COMPLETE FILE
const pool = require('../config/db');

// Helper to round to 2 decimal places
const round2 = (num) => Math.round(parseFloat(num || 0) * 100) / 100;

// Create credit tables if not exists
const createCreditTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_entries (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(200) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        total_amount DECIMAL(10,2) DEFAULT 0,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        remaining_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_items (
        id SERIAL PRIMARY KEY,
        credit_id INTEGER REFERENCES credit_entries(id) ON DELETE CASCADE,
        product VARCHAR(200),
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2),
        total DECIMAL(10,2)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_settlements (
        id SERIAL PRIMARY KEY,
        credit_id INTEGER REFERENCES credit_entries(id) ON DELETE CASCADE,
        amount DECIMAL(10,2),
        note TEXT,
        date TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Credit tables ready');
  } catch (error) {
    console.error('Error creating credit tables:', error);
  }
};

createCreditTables();

// Get all credit entries
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ce.*,
        (SELECT json_agg(json_build_object(
          'product', ci.product,
          'quantity', ci.quantity,
          'price', ci.price,
          'total', ci.total
        )) FROM credit_items ci WHERE ci.credit_id = ce.id) as items,
        (SELECT json_agg(json_build_object(
          'amount', cs.amount,
          'note', cs.note,
          'date', cs.date
        )) FROM credit_settlements cs WHERE cs.credit_id = ce.id) as settlements
      FROM credit_entries ce
      ORDER BY ce.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create credit entry
exports.create = async (req, res) => {
  const { customerName, phone, date, items, totalAmount, paidAmount, notes } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const roundedTotal = round2(totalAmount);
    const roundedPaid = round2(paidAmount || 0);
    const remainingAmount = round2(roundedTotal - roundedPaid);
    const finalRemaining = Math.abs(remainingAmount) < 0.01 ? 0 : remainingAmount;
    const status = finalRemaining <= 0 ? 'settled' : roundedPaid > 0 ? 'partial' : 'pending';
    
    console.log('📝 Creating credit entry:', { customerName, roundedTotal, roundedPaid, finalRemaining, status });
    
    const result = await client.query(
      `INSERT INTO credit_entries (customer_name, phone, date, total_amount, paid_amount, remaining_amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [customerName, phone, date, roundedTotal, roundedPaid, finalRemaining, status, notes]
    );
    
    const creditId = result.rows[0].id;
    
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO credit_items (credit_id, product, quantity, price, total)
           VALUES ($1, $2, $3, $4, $5)`,
          [creditId, item.product, item.quantity, round2(item.price), round2(item.total)]
        );
      }
    }
    
    if (roundedPaid > 0) {
      await client.query(
        `INSERT INTO credit_settlements (credit_id, amount, note)
         VALUES ($1, $2, $3)`,
        [creditId, roundedPaid, 'Initial payment']
      );
    }
    
    await client.query('COMMIT');
    console.log('✅ Credit entry created:', creditId);
    res.json({ success: true, message: 'Credit entry created', id: creditId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Update credit entry
exports.update = async (req, res) => {
  const { id } = req.params;
  const { customerName, phone, date, items, totalAmount, notes } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const current = await client.query('SELECT paid_amount FROM credit_entries WHERE id = $1', [id]);
    const paidAmount = round2(current.rows[0]?.paid_amount || 0);
    const roundedTotal = round2(totalAmount);
    const remainingAmount = round2(roundedTotal - paidAmount);
    const finalRemaining = Math.abs(remainingAmount) < 0.01 ? 0 : remainingAmount;
    const status = finalRemaining <= 0 ? 'settled' : paidAmount > 0 ? 'partial' : 'pending';
    
    await client.query(
      `UPDATE credit_entries SET customer_name=$1, phone=$2, date=$3, total_amount=$4, remaining_amount=$5, status=$6, notes=$7, updated_at=NOW()
       WHERE id=$8`,
      [customerName, phone, date, roundedTotal, finalRemaining, status, notes, id]
    );
    
    await client.query('DELETE FROM credit_items WHERE credit_id = $1', [id]);
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO credit_items (credit_id, product, quantity, price, total)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, item.product, item.quantity, round2(item.price), round2(item.total)]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Credit entry updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Delete credit entry
exports.remove = async (req, res) => {
  try {
    await pool.query('DELETE FROM credit_entries WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ FIXED: Record settlement/payment with proper rounding
exports.addSettlement = async (req, res) => {
  const { id } = req.params;
  const { amount, note } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const roundedAmount = round2(amount);
    
    console.log('💰 Recording payment:', { creditId: id, amount: roundedAmount });
    
    // Insert settlement
    await client.query(
      `INSERT INTO credit_settlements (credit_id, amount, note) VALUES ($1, $2, $3)`,
      [id, roundedAmount, note || 'Payment received']
    );
    
    // Get current entry
    const current = await client.query('SELECT * FROM credit_entries WHERE id = $1', [id]);
    const entry = current.rows[0];
    
    const currentPaid = round2(entry.paid_amount || 0);
    const totalAmount = round2(entry.total_amount || 0);
    
    const newPaid = round2(currentPaid + roundedAmount);
    const newRemaining = round2(totalAmount - newPaid);
    const finalRemaining = Math.abs(newRemaining) < 0.01 ? 0 : newRemaining;
    const newStatus = finalRemaining <= 0 ? 'settled' : 'partial';
    
    console.log('📊 Payment calculation:', {
      creditId: id,
      beforePaid: currentPaid,
      payment: roundedAmount,
      afterPaid: newPaid,
      total: totalAmount,
      remaining: finalRemaining,
      status: newStatus
    });
    
    await client.query(
      `UPDATE credit_entries SET paid_amount=$1, remaining_amount=$2, status=$3, updated_at=NOW()
       WHERE id=$4`,
      [newPaid, finalRemaining, newStatus, id]
    );
    
    await client.query('COMMIT');
    console.log('✅ Payment recorded successfully');
    res.json({ success: true, message: 'Payment recorded' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};