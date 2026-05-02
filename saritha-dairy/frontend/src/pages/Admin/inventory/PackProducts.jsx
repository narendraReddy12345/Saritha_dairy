// src/pages/Admin/inventory/PackProducts.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PackProducts.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const PackProducts = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [packingHistory, setPackingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [packing, setPacking] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [packConfig, setPackConfig] = useState([]);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('pack');

  useEffect(() => {
    fetchAvailablePurchases();
    fetchProducts();
    fetchPackingHistory();
  }, []);

  // ✅ Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchAvailablePurchases = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/farm-purchases`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        const availablePurchases = result.data.filter(purchase => {
          const remaining = parseFloat(purchase.remaining_quantity || purchase.quantity);
          return remaining > 0;
        });
        setPurchases(availablePurchases);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) return;
      
      const result = await response.json();
      if (result.success) setProducts(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchPackingHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/packing-history`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) return;
      
      const result = await response.json();
      if (result.success) setPackingHistory(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getProductPacks = (productName) => {
    const product = products.find(p => p.name === productName);
    if (product && product.packs) {
      try {
        return typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs;
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const addPackConfig = (packSize) => {
    const existingPack = packConfig.find(p => p.size === packSize.size && p.unit === packSize.unit);
    if (existingPack) {
      showMessage('Pack size already added!', 'error');
      return;
    }
    setPackConfig([...packConfig, { ...packSize, packetCount: 0 }]);
  };

  const updatePacketCount = (index, count) => {
    const updated = [...packConfig];
    const newCount = parseInt(count) || 0;
    updated[index].packetCount = newCount;
    
    const totalToPack = calculateTotalQuantity(updated);
    const availableQty = parseFloat(selectedPurchase.remaining_quantity || selectedPurchase.quantity);
    
    if (selectedPurchase && totalToPack > availableQty) {
      showMessage(`Cannot exceed available quantity! Available: ${availableQty} ${selectedPurchase.unit}`, 'error');
      return;
    }
    
    setPackConfig(updated);
  };

  const calculateTotalQuantity = (config = packConfig) => {
    if (!selectedPurchase) return 0;
    
    return config.reduce((total, pack) => {
      let packQuantity = parseFloat(pack.size);
      
      if (selectedPurchase.unit === 'Kg' || selectedPurchase.unit === 'kg') {
        if (pack.unit === 'g') packQuantity = pack.size / 1000;
        else if (pack.unit === 'kg') packQuantity = pack.size;
      } else if (selectedPurchase.unit === 'Litre' || selectedPurchase.unit === 'L') {
        if (pack.unit === 'ml') packQuantity = pack.size / 1000;
        else if (pack.unit === 'L') packQuantity = pack.size;
      }
      
      return total + (pack.packetCount * packQuantity);
    }, 0);
  };

  const removePackConfig = (index) => {
    setPackConfig(packConfig.filter((_, i) => i !== index));
  };

  const handlePack = async () => {
    if (!selectedPurchase) {
      showMessage('Please select a purchase first', 'error');
      return;
    }

    const totalToPack = calculateTotalQuantity();
    if (totalToPack === 0) {
      showMessage('Please add at least one packet to pack', 'error');
      return;
    }

    const availableQty = parseFloat(selectedPurchase.remaining_quantity || selectedPurchase.quantity);
    if (totalToPack > availableQty) {
      showMessage('Total to pack exceeds available quantity!', 'error');
      return;
    }

    setPacking(true);
    
    const batchNumber = `BATCH-${Date.now().toString().slice(-6)}`;
    const packedDate = new Date().toISOString().split('T')[0];
    
    const packItems = [];
    let totalPackets = 0;
    
    for (const pack of packConfig) {
      if (pack.packetCount > 0) {
        packItems.push({
          packDisplay: `${pack.size}${pack.unit}`,
          count: pack.packetCount,
          price: pack.price
        });
        totalPackets += pack.packetCount;
      }
    }
    
    const packData = {
      batchNumber, productName: selectedPurchase.product_name,
      purchaseId: selectedPurchase.id, packedDate, items: packItems,
      totalPackets, totalQuantity: totalToPack,
      remainingQuantity: availableQty - totalToPack, unit: selectedPurchase.unit
    };

    try {
      const response = await fetch(`${API_URL}/pack-products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(packData)
      });
      const result = await response.json();
      
      if (result.success) {
        showMessage(`✅ Successfully packed ${totalPackets} packets!`);
        setSelectedPurchase(null);
        setPackConfig([]);
        await fetchAvailablePurchases();
        await fetchPackingHistory();
      } else {
        showMessage(result.error || 'Failed to pack products', 'error');
      }
    } catch (error) {
      showMessage('Error connecting to server', 'error');
    }
    setPacking(false);
  };

  const deleteHistory = async (id) => {
    if (window.confirm('⚠️ Delete this packing record? Stock will be returned.')) {
      try {
        const response = await fetch(`${API_URL}/packing-history/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const result = await response.json();
        if (result.success) {
          showMessage('✅ Packing deleted! Stock returned.');
          fetchPackingHistory();
          fetchAvailablePurchases();
        } else {
          showMessage(result.error || 'Delete failed', 'error');
        }
      } catch (err) {
        showMessage('Delete failed!', 'error');
      }
    }
  };

  const getProductIcon = (name) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    return '📦';
  };

  const getProductColor = (productName) => {
    if (!productName) return '#64748b';
    const n = productName.toLowerCase();
    if (n.includes('milk')) return '#3b82f6';
    if (n.includes('curd')) return '#10b981';
    if (n.includes('paneer')) return '#f59e0b';
    if (n.includes('ghee')) return '#ef4444';
    if (n.includes('butter')) return '#8b5cf6';
    return '#64748b';
  };

  const getNumericValue = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="pack-container">
      <div className="pack-header">
        <h1>📦 Package Management</h1>
        <p>Pack bulk purchases into retail packets</p>
      </div>

      {message && (
        <div className={`pack-message ${message.type}`}>
          <span>{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      <div className="pack-tabs">
        <button className={`pack-tab ${activeTab === 'pack' ? 'active' : ''}`} onClick={() => setActiveTab('pack')}>
          📦 Pack Products
        </button>
        <button className={`pack-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📜 History ({packingHistory.length})
        </button>
      </div>

      {activeTab === 'pack' && (
        <div className="pack-main-grid">
          <div className="stock-grid-sidebar">
            <div className="stock-grid-header">
              <h3>📋 Available Stock</h3>
              <span className="stock-grid-count">{purchases.length} items</span>
            </div>
            
            {loading ? (
              <div className="stock-grid-loading">Loading...</div>
            ) : purchases.length === 0 ? (
              <div className="stock-grid-empty">
                <span>🏭</span>
                <p>No stock available</p>
                <button onClick={() => navigate('/purchases/add')}>+ Add Purchase</button>
              </div>
            ) : (
              <div className="stock-app-grid">
                {purchases.map(purchase => {
                  const availableQty = getNumericValue(purchase.remaining_quantity || purchase.quantity);
                  const color = getProductColor(purchase.product_name);
                  
                  return (
                    <div
                      key={purchase.id}
                      className={`stock-app-item ${selectedPurchase?.id === purchase.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedPurchase(purchase); setPackConfig([]); }}
                    >
                      <div className="stock-app-icon" style={{ background: color + '15' }}>
                        {getProductIcon(purchase.product_name)}
                      </div>
                      <div className="stock-app-name">{purchase.product_name}</div>
                      <div className="stock-app-quantity">
                        <span className="stock-app-number">{availableQty.toFixed(1)}</span>
                        <span className="stock-app-unit">{purchase.unit || 'L'}</span>
                      </div>
                      {selectedPurchase?.id === purchase.id && <div className="stock-app-check">✓</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="packing-area">
            {!selectedPurchase ? (
              <div className="packing-placeholder">
                <span>👆</span>
                <h3>Select an Item</h3>
                <p>Tap on any product to start packing</p>
              </div>
            ) : (
              <>
                <div className="packing-header">
                  <div className="packing-title">
                    <span>{getProductIcon(selectedPurchase.product_name)}</span>
                    <h3>Packing: {selectedPurchase.product_name}</h3>
                  </div>
                  <div className="packing-stock-badge">
                    Available: {getNumericValue(selectedPurchase.remaining_quantity || selectedPurchase.quantity).toFixed(2)} {selectedPurchase.unit}
                  </div>
                </div>

                <div className="pack-sizes">
                  <label>📏 Pack Sizes:</label>
                  <div className="size-buttons">
                    {getProductPacks(selectedPurchase.product_name).map((pack, idx) => (
                      <button key={idx} className="size-btn" onClick={() => addPackConfig(pack)}>
                        + {pack.size}{pack.unit} (₹{pack.price})
                      </button>
                    ))}
                  </div>
                </div>

                {packConfig.length > 0 && (
                  <>
                    <div className="pack-list">
                      {packConfig.map((pack, index) => {
                        let packQuantity = parseFloat(pack.size);
                        if (selectedPurchase.unit === 'Kg' && pack.unit === 'g') packQuantity = pack.size / 1000;
                        else if (selectedPurchase.unit === 'Litre' && pack.unit === 'ml') packQuantity = pack.size / 1000;
                        const totalLiters = pack.packetCount * packQuantity;
                        
                        return (
                          <div key={index} className="pack-item">
                            <div className="pack-details">
                              <span className="pack-size-name">{pack.size}{pack.unit}</span>
                              <span className="pack-price">₹{pack.price}</span>
                              <span className="pack-convert">({packQuantity.toFixed(3)} {selectedPurchase.unit})</span>
                            </div>
                            <div className="pack-control">
                              <input type="number" className="pack-count" value={pack.packetCount}
                                onChange={(e) => updatePacketCount(index, e.target.value)} placeholder="Qty" min="0" />
                              <span className="pack-total">= {totalLiters.toFixed(3)} {selectedPurchase.unit}</span>
                              <button className="pack-remove" onClick={() => removePackConfig(index)}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pack-summary">
                      <div className="summary-line"><span>📦 To Pack:</span><strong>{calculateTotalQuantity().toFixed(3)} {selectedPurchase.unit}</strong></div>
                      <div className="summary-line"><span>🎯 Packets:</span><strong>{packConfig.reduce((sum, p) => sum + p.packetCount, 0)} packets</strong></div>
                      <div className="summary-line"><span>📊 Remaining:</span><strong>{(getNumericValue(selectedPurchase.remaining_quantity || selectedPurchase.quantity) - calculateTotalQuantity()).toFixed(3)} {selectedPurchase.unit}</strong></div>
                    </div>

                    <button className="pack-submit" onClick={handlePack} disabled={packing || calculateTotalQuantity() === 0}>
                      {packing ? '⏳ Packing...' : '📦 Pack Now'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <div className="history-header">
            <h3>📜 Packing History</h3>
            <button className="refresh-history" onClick={fetchPackingHistory}>🔄 Refresh</button>
          </div>

          {packingHistory.length === 0 ? (
            <div className="empty-history"><span>📦</span><p>No packing history</p></div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Batch No</th><th>Product</th>
                    <th>Packets</th><th>Quantity</th><th>Items</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {packingHistory.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.packed_date)}</td>
                      <td><code className="batch-code">{record.batch_number}</code></td>
                      <td>{record.product_name}</td>
                      <td>{record.total_packets}</td>
                      <td>{parseFloat(record.total_quantity).toFixed(2)} {record.unit || 'L'}</td>
                      <td>
                        <div className="items-list">
                          {record.items?.map((item, i) => (
                            <span key={i} className="item-badge">{item.count}×{item.packDisplay}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => deleteHistory(record.id)}>🗑️ Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PackProducts;