// server.js
process.env.TZ = 'Asia/Kolkata';
console.log('🕐 Server timezone set to:', process.env.TZ);
console.log('🕐 Current server time:', new Date().toString());

const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Import database modules
const createAllTables = require('./config/tables');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const startServer = async () => {
  try {
    await createAllTables();
    console.log('✅ Database migration completed');
    
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/delivery-boys', require('./routes/deliveryBoys'));
    app.use('/api/admin', require('./routes/customers'));
    app.use('/api/delivery', require('./routes/deliveries'));
    app.use('/api/products', require('./routes/products'));
    app.use('/api/farm-purchases', require('./routes/purchases'));
    app.use('/api', require('./routes/packing'));
    app.use('/api', require('./routes/stock'));
    app.use('/api', require('./routes/sales'));
    app.use('/api/credit', require('./routes/credit'));
    app.use('/api/customer-preferences', require('./routes/customerPreferences'));
    app.use('/api', require('./routes/nonDairyItemsRoutes'));

    const { createTable } = require('./controllers/customerPreferences');
    createTable();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🕐 Server time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
};

startServer();