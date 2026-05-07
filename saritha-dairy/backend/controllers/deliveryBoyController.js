// Add this function to deliveryController.js

// ✅ Update delivery status (mark as delivered or undo)
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  console.log(`📝 Updating delivery ID: ${id} to status: ${status}`);
  
  try {
    const result = await pool.query(
      `UPDATE daily_delivery 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }
    
    console.log(`✅ Delivery status updated to ${status}`);
    res.json({ success: true, data: result.rows[0], message: `Delivery marked as ${status}` });
  } catch (error) {
    console.error('❌ Error updating delivery status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};