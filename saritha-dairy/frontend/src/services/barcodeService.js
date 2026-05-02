// src/services/barcodeService.js

// Generate unique barcode for each packet
export const generateBarcode = (productId, batchNumber, packetNumber) => {
  // Format: 890 (India) + Product ID (4 digits) + Batch (6 digits) + Packet (4 digits)
  // Example: 890000100010001 (18 digits)
  const countryCode = '890';
  const productCode = (productId % 10000).toString().padStart(4, '0');
  const batchCode = batchNumber.slice(-6);
  const packetCode = packetNumber.toString().padStart(4, '0');
  
  return `${countryCode}${productCode}${batchCode}${packetCode}`;
};

// Generate unique packet ID
export const generatePacketId = (batchNumber, packetNumber) => {
  // Format: PKT-B240101-001
  const batchSuffix = batchNumber.slice(-6);
  const packetCode = packetNumber.toString().padStart(3, '0');
  return `PKT-${batchSuffix}-${packetCode}`;
};

// Generate batch number
export const generateBatchNumber = (productId) => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `B${year}${month}${day}-${productId}-${random}`;
};

// Calculate expiry date (default 7 days for milk)
export const calculateExpiryDate = (packedDate, productName) => {
  const expiryDays = {
    'Fresh Milk': 7,
    'Milk (Toned)': 7,
    'Curd': 10,
    'Paneer': 5,
    'Ghee': 180,
    'Butter': 30,
    'Flavoured Yogurt': 14,
    'Lassi': 10,
    'Buttermilk': 5
  };
  
  const days = expiryDays[productName] || 7;
  const expiry = new Date(packedDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString().split('T')[0];
};

// Format barcode for display
export const formatBarcode = (barcode) => {
  if (!barcode) return '';
  return barcode.replace(/(.{4})/g, '$1 ').trim();
};

// Generate QR code data (for scanning)
export const generateQRData = (packetId, productName, expiryDate, price) => {
  return {
    packetId: packetId,
    product: productName,
    expiry: expiryDate,
    price: price,
    verify: `https://sarita-dairy.com/verify/${packetId}`
  };
};