// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');

require('dotenv').config();

const app = express();

// ✅ Import the database migration function (correct file name: tables.js)
const createAllTables = require('./config/tables');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// ✅ Run database migration FIRST, then start server
createAllTables()
  .then(() => {
    console.log('✅ Database migration completed');
    
    // Mount Routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/delivery-boys', require('./routes/deliveryBoys'));
    app.use('/api/admin', require('./routes/customers'));
    app.use('/api/delivery', require('./routes/deliveries'));
    app.use('/api/products', require('./routes/products'));
    app.use('/api/farm-purchases', require('./routes/purchases'));
    app.use('/api', require('./routes/packing'));
    app.use('/api', require('./routes/stock'));
    app.use('/api', require('./routes/sales'));

    // Credit and Customer Preferences
    app.use('/api/credit', require('./routes/credit'));
    app.use('/api/customer-preferences', require('./routes/customerPreferences'));

    // ✅ NEW: Non-Dairy Items Routes (Standalone)
    app.use('/api', require('./routes/nonDairyItemsRoutes'));

    // Initialize customer preferences table
    const { createTable } = require('./controllers/customerPreferences');
    createTable();

    // Start Server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📦 API endpoints:`);
      console.log(`   - GET  /api/non-dairy-items`);
      console.log(`   - POST /api/non-dairy-items`);
      console.log(`   - PUT  /api/non-dairy-items/:id`);
      console.log(`   - DELETE /api/non-dairy-items/:id`);
      console.log(`   - POST /api/non-dairy-items/purchase`);
      console.log(`   - GET  /api/non-dairy-purchase-history`);
    });
  })
  .catch((error) => {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  });