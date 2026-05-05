// src/pages/Admin/Sales/Sales.jsx
import React, { useState, useEffect } from 'react';
import './Sales.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

const Sales = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('sell');
  const [salesHistory, setSalesHistory] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cartVisible, setCartVisible] = useState(false);
  const [expandedSale, setExpandedSale] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchSalesHistory();
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/store-stock`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        const availableProducts = result.data.filter(p => p.quantity > 0);
        setProducts(availableProducts);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const fetchSalesHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/sales-history`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) return;
      
      const result = await response.json();
      if (result.success) setSalesHistory(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
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

  const addToCart = (product) => {
    const existingItem = cart.find(item => 
      item.product_name === product.product_name && 
      item.pack_size_display === product.pack_size_display &&
      item.barcode === product.barcode
    );
    
    const pricePerItem = parseFloat(product.selling_price) || 0;
    
    if (existingItem) {
      if (existingItem.quantity + 1 > product.quantity) {
        showMessage('error', `Only ${product.quantity} available!`);
        return;
      }
      setCart(cart.map(item =>
        item.product_name === product.product_name && 
        item.pack_size_display === product.pack_size_display &&
        item.barcode === product.barcode
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_name: product.product_name,
        pack_size_display: product.pack_size_display,
        barcode: product.barcode || '',
        price: pricePerItem,
        quantity: 1,
        maxQuantity: product.quantity,
        image_url: product.image_url,
        icon: getProductIcon(product.product_name),
        isManualPaneer: product.pack_size_display?.toLowerCase().includes('piece')
      }]);
    }
    showMessage('success', 'Added to cart');
    setCartVisible(true);
  };

  const updateQuantity = (index, newQuantity) => {
    const item = cart[index];
    if (!item) return;
    
    if (newQuantity < 1) {
      removeFromCart(index);
      return;
    }
    
    if (newQuantity > item.maxQuantity) {
      showMessage('error', `Only ${item.maxQuantity} available!`);
      return;
    }
    
    const updatedCart = [...cart];
    updatedCart[index].quantity = newQuantity;
    setCart(updatedCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
    showMessage('success', 'Item removed');
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showMessage('error', 'Cart is empty!');
      return;
    }

    const saleData = {
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone || 'N/A',
      items: cart.map(item => ({
        product_name: item.product_name,
        pack_size_display: item.pack_size_display,
        barcode: item.barcode || '',
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      total: calculateTotal()
    };

    try {
      const response = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(saleData)
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        showMessage('success', `✅ Sale completed! Total: ₹${calculateTotal().toLocaleString()}`);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        fetchProducts();
        fetchSalesHistory();
        setCartVisible(false);
      } else {
        showMessage('error', result.error || 'Failed to complete sale');
      }
    } catch (err) {
      showMessage('error', 'Server error!');
    }
  };

  const deleteSale = async (id) => {
    if (window.confirm('Delete this sale record?')) {
      try {
        const response = await fetch(`${API_URL}/sales/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        const result = await response.json();
        if (result.success) {
          showMessage('success', 'Sale record deleted!');
          fetchSalesHistory();
        } else {
          showMessage('error', result.error);
        }
      } catch (err) {
        showMessage('error', 'Failed to delete');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const toggleSaleDetails = (id) => {
    setExpandedSale(expandedSale === id ? null : id);
  };

  const filteredProducts = products.filter(product =>
    product.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.pack_size_display?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSaleSummary = (items) => {
    const summary = items.reduce((acc, item) => {
      const key = `${item.product_name}-${item.pack_size_display}`;
      if (!acc[key]) {
        acc[key] = { product_name: item.product_name, pack_size_display: item.pack_size_display, quantity: 0, total: 0 };
      }
      acc[key].quantity += item.quantity;
      acc[key].total += item.total;
      return acc;
    }, {});
    return Object.values(summary);
  };

  return (
    <div className="modern-sales">
      {/* Header */}
      <div className="modern-sales-header">
        <div className="header-left">
          <h1>🛒 POS</h1>
          <span className="header-badge">Point of Sale</span>
        </div>
        <div className="header-tabs">
          <button className={`header-tab ${activeTab === 'sell' ? 'active' : ''}`} onClick={() => setActiveTab('sell')}>
            Sell Products
          </button>
          <button className={`header-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            Sales History ({salesHistory.length})
          </button>
        </div>
        <div className="header-right">
          <button className="cart-icon-btn" onClick={() => setCartVisible(true)}>
            🛒
            {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
          </button>
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div className={`modern-toast ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Sell Tab */}
      {activeTab === 'sell' && (
        <div className="modern-sales-content">
          <div className="products-modern-section">
            <div className="search-modern-bar">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
              {searchTerm && (
                <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
              )}
            </div>

            {loading ? (
              <div className="modern-loading">
                <div className="loading-spinner"></div>
                <p>Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="modern-empty">
                <span>📦</span>
                <p>{searchTerm ? 'No products match your search' : 'No products available in stock'}</p>
              </div>
            ) : (
              <div className="products-modern-grid">
                {filteredProducts.map((product, idx) => (
                  <div key={`${product.barcode || idx}`} className="product-modern-card">
                    <div className="product-modern-image">
                      {product.image_url ? (
                        <img src={`${BASE_URL}${product.image_url}`} alt={product.product_name} onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }} />
                      ) : null}
                      <div className="product-modern-icon" style={{ display: product.image_url ? 'none' : 'flex' }}>
                        {getProductIcon(product.product_name)}
                      </div>
                      {product.pack_size_display?.toLowerCase().includes('piece') && (
                        <span className="manual-badge">🧀 Cut</span>
                      )}
                    </div>
                    <div className="product-modern-info">
                      <h3 className="product-modern-name">{product.product_name}</h3>
                      <p className="product-modern-size">{product.pack_size_display}</p>
                      <div className="product-modern-price-row">
                        <span className="product-modern-price">₹{parseFloat(product.selling_price).toLocaleString()}</span>
                        <span className="product-modern-stock">{product.quantity} left</span>
                      </div>
                      <button className="product-modern-add" onClick={() => addToCart(product)}>
                        + Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="sales-history-container">
          <div className="history-header">
            <h3>📜 Sales History</h3>
            <button className="refresh-history" onClick={fetchSalesHistory}>🔄 Refresh</button>
          </div>

          {salesHistory.length === 0 ? (
            <div className="history-empty">
              <span>📊</span>
              <p>No sales yet</p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="sales-history-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Products</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.map((sale) => {
                    const saleSummary = getSaleSummary(sale.items || []);
                    return (
                      <React.Fragment key={sale.id}>
                        <tr className="sale-main-row" onClick={() => toggleSaleDetails(sale.id)}>
                          <td className="history-date">{formatDate(sale.sold_at)}</td>
                          <td className="history-customer">{sale.customer_name}</td>
                          <td>{sale.customer_phone}</td>
                          <td>
                            <div className="items-summary">
                              {saleSummary.map((item, i) => (
                                <span key={i} className="item-summary-badge">
                                  {item.product_name} - {item.pack_size_display} ({item.quantity} pcs)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="history-total">₹{parseFloat(sale.total_amount).toLocaleString()}</td>
                          <td className="action-cell">
                            <button 
                              className="delete-sale-btn" 
                              onClick={(e) => { e.stopPropagation(); deleteSale(sale.id); }}
                              title="Delete sale"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                        {expandedSale === sale.id && (
                          <tr className="sale-details-row">
                            <td colSpan="6">
                              <div className="sale-details">
                                <div className="details-title">📋 Complete Sale Details</div>
                                <table className="items-details-table">
                                  <thead>
                                    <tr>
                                      <th>Product Name</th>
                                      <th>Pack Size</th>
                                      <th>Qty</th>
                                      <th>Price</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sale.items?.map((item, i) => (
                                      <tr key={i}>
                                        <td>{item.product_name}</td>
                                        <td>{item.pack_size_display}</td>
                                        <td>{item.quantity}</td>
                                        <td>₹{parseFloat(item.price).toLocaleString()}</td>
                                        <td>₹{parseFloat(item.total).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                    <tr className="details-total-row">
                                      <td colSpan="4" className="details-total-label">Grand Total</td>
                                      <td className="details-total-amount">₹{parseFloat(sale.total_amount).toLocaleString()}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cart Sidebar */}
      <div className={`cart-modern-sidebar ${cartVisible ? 'open' : ''}`}>
        <div className="cart-modern-header">
          <h3>🛒 Your Cart ({cartItemCount})</h3>
          <button className="cart-close" onClick={() => setCartVisible(false)}>✕</button>
        </div>

        {cart.length === 0 ? (
          <div className="cart-modern-empty">
            <span>🛒</span>
            <p>Your cart is empty</p>
            <p className="cart-empty-subtitle">Tap on products to add them</p>
          </div>
        ) : (
          <>
            <div className="cart-modern-items">
              {cart.map((item, idx) => (
                <div key={idx} className="cart-modern-item">
                  <div className="cart-item-image">
                    {item.image_url ? (
                      <img src={`${BASE_URL}${item.image_url}`} alt={item.product_name} onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }} />
                    ) : null}
                    <div className="cart-item-icon" style={{ display: item.image_url ? 'none' : 'flex' }}>
                      {item.icon}
                    </div>
                  </div>
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.product_name}</div>
                    <div className="cart-item-size">
                      {item.pack_size_display}
                      {item.isManualPaneer && <span className="manual-tag">🧀 Cut Piece</span>}
                    </div>
                    <div className="cart-item-price">₹{item.price.toLocaleString()} / piece</div>
                  </div>
                  <div className="cart-item-quantity">
                    <button className="cart-qty-btn" onClick={() => updateQuantity(idx, item.quantity - 1)}>−</button>
                    <span className="cart-qty-value">{item.quantity}</span>
                    <button className="cart-qty-btn" onClick={() => updateQuantity(idx, item.quantity + 1)}>+</button>
                  </div>
                  <div className="cart-item-total-section">
                    <div className="cart-item-total">₹{(item.price * item.quantity).toLocaleString()}</div>
                    <button className="cart-item-remove" onClick={() => removeFromCart(idx)} title="Remove">🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-modern-customer">
              <div className="customer-field">
                <label>👤 Customer Name</label>
                <input 
                  type="text" 
                  placeholder="Walk-in Customer" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                />
              </div>
              <div className="customer-field">
                <label>📱 Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="Optional" 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                  maxLength={10}
                />
              </div>
            </div>

            <div className="cart-modern-total">
              <span>Total Amount:</span>
              <strong>₹{calculateTotal().toLocaleString()}</strong>
            </div>

            <button className="cart-modern-checkout" onClick={handleCheckout}>
              ✅ Complete Sale
            </button>
          </>
        )}
      </div>

      {cartVisible && <div className="cart-overlay" onClick={() => setCartVisible(false)}></div>}
    </div>
  );
};

export default Sales;