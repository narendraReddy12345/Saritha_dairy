// backend/routes/packing.js
const pool = require('../config/db');

exports.create = async (req, res) => {
  const { batchNumber, productName, purchaseId, packedDate, items, totalPackets, totalQuantity, remainingQuantity, unit, packType, totalAmount } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const batchResult = await client.query(
      `INSERT INTO packing_batches (batch_number, product_name, packed_date, total_packets, total_quantity) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [batchNumber, productName, packedDate, totalPackets, totalQuantity]
    );
    
    const batchId = batchResult.rows[0].id;
    
    for (const item of items) {
      // ✅ FIX: Calculate the correct selling price
      // For manual paneer: use item.total (weight × price per Kg)
      // For regular packing: use item.price as-is
      let sellingPrice;
      if (packType === 'manual_paneer' && item.cutWeight && item.total) {
        // Manual paneer: selling_price = total price for that piece
        sellingPrice = item.total;  // e.g., 0.75kg × ₹320 = ₹240
      } else {
        // Regular packing: selling_price = price per packet
        sellingPrice = item.price;
      }
      
      await client.query(
        `INSERT INTO packing_items (batch_id, batch_number, pack_size_display, packet_count, selling_price, purchase_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [batchId, batchNumber, item.packDisplay, item.count, sellingPrice, purchaseId]
      );
      
      const stockId = `${productName.replace(/\s/g, '')}-${item.packDisplay}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      
      const stockCheck = await client.query(
        'SELECT id, quantity FROM store_stock WHERE product_name = $1 AND pack_size_display = $2',
        [productName, item.packDisplay]
      );
      
      if (stockCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO store_stock (barcode, product_name, pack_size_display, selling_price, quantity, unit, packed_date, purchase_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [stockId, productName, item.packDisplay, sellingPrice, item.count, unit || 'Kg', packedDate, purchaseId]
        );
      } else {
        await client.query(
          'UPDATE store_stock SET quantity = quantity + $1, selling_price = $2 WHERE product_name = $3 AND pack_size_display = $4',
          [item.count, sellingPrice, productName, item.packDisplay]
        );
      }
    }
    
    if (remainingQuantity !== undefined) {
      await client.query(
        'UPDATE farm_purchases SET remaining_quantity = $1 WHERE id = $2',
        [remainingQuantity, purchaseId]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: `Successfully packed ${totalPackets} packets` });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.getHistory = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pb.id, pb.batch_number, pb.product_name, pb.packed_date,
        pb.total_packets, pb.total_quantity,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'packDisplay', pi.pack_size_display,
            'count', pi.packet_count,
            'price', pi.selling_price
          )) FROM packing_items pi WHERE pi.batch_id = pb.id),
          '[]'::json
        ) as items
      FROM packing_batches pb
      ORDER BY pb.packed_date DESC
    `);
    
    // Add unit info
    for (let record of result.rows) {
      const unitResult = await pool.query(
        'SELECT unit FROM farm_purchases WHERE product_name = $1 LIMIT 1',
        [record.product_name]
      );
      record.unit = unitResult.rows[0]?.unit || 'Kg';
    }
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.remove = async (req, res) => {
  const batchId = req.params.id;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get items before deleting
    const items = await client.query(
      `SELECT pi.*, pb.product_name 
       FROM packing_items pi
       JOIN packing_batches pb ON pi.batch_id = pb.id
       WHERE pi.batch_id = $1`,
      [batchId]
    );
    
    for (const item of items.rows) {
      // Return quantity to farm purchase
      if (item.purchase_id) {
        const packDisplay = item.pack_size_display;
        let size = parseFloat(packDisplay);
        let quantityToReturn = 0;
        
        if (packDisplay.includes('g')) {
          quantityToReturn = (size / 1000) * item.packet_count;
        } else if (packDisplay.includes('ml')) {
          quantityToReturn = (size / 1000) * item.packet_count;
        } else if (packDisplay.includes('L')) {
          quantityToReturn = size * item.packet_count;
        } else if (packDisplay.includes('Kg') || packDisplay.includes('kg')) {
          quantityToReturn = size * item.packet_count;
        } else if (packDisplay.toLowerCase().includes('piece')) {
          // For manual paneer pieces
          const weightMatch = packDisplay.match(/([\d.]+)\s*(Kg|kg|g)/);
          if (weightMatch) {
            const weight = parseFloat(weightMatch[1]);
            quantityToReturn = weightMatch[2].toLowerCase() === 'g' ? weight / 1000 : weight;
          } else {
            quantityToReturn = item.packet_count;
          }
        } else {
          quantityToReturn = item.packet_count;
        }
        
        await client.query(
          'UPDATE farm_purchases SET remaining_quantity = remaining_quantity + $1 WHERE id = $2',
          [quantityToReturn, item.purchase_id]
        );
      }
      
      // Reduce store stock
      await client.query(
        'UPDATE store_stock SET quantity = quantity - $1 WHERE product_name = $2 AND pack_size_display = $3',
        [item.packet_count, item.product_name, item.pack_size_display]
      );
    }
    
    // Clean up zero quantity items
    await client.query('DELETE FROM store_stock WHERE quantity <= 0');
    
    // Delete packing items and batch
    await client.query('DELETE FROM packing_items WHERE batch_id = $1', [batchId]);
    await client.query('DELETE FROM packing_batches WHERE id = $1', [batchId]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Packing record deleted and stock returned' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};