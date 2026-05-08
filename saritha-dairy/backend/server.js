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
const pool = require('./config/db');
const createAllTables = require('./config/tables');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// Test route
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Saritha Dairy API is running' });
});

app.get('/api/status', (req, res) => {
  res.json({ success: true, message: 'API is working', timestamp: new Date().toISOString() });
});

// Debug route to check registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  const extractRoutes = (stack, basePath = '') => {
    if (!stack) return;
    for (const layer of stack) {
      if (layer.route) {
        routes.push({
          path: basePath + layer.route.path,
          methods: Object.keys(layer.route.methods).join(', ')
        });
      } else if (layer.handle && layer.handle.stack) {
        const newPath = basePath + (layer.regexp?.source?.replace('\\/?(?=\\/|$)', '').replace(/\\/g, '') || '');
        extractRoutes(layer.handle.stack, newPath);
      }
    }
  };
  
  if (app._router && app._router.stack) {
    extractRoutes(app._router.stack);
  }
  
  res.json({ 
    success: true, 
    routes: routes.filter(r => r.path.includes('admin') || r.path.includes('customer'))
  });
});

// Start server function
const startServer = async () => {
  try {
    // Run database migration
    await createAllTables();
    console.log('✅ Database migration completed');
    
    // Mount Routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/delivery-boys', require('./routes/deliveryBoys'));
    app.use('/api/admin', require('./routes/admin')); // ✅ CHANGED: Use admin.js instead of customers.js
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
    await createTable();

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🕐 Server time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
};

// Start the server
startServer();