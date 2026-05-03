// src/pages/Admin/CreditManagement/CreditManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import './CreditManagement.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

// Helper to round to 2 decimal places
const round2 = (num) => Math.round(parseFloat(num || 0) * 100) / 100;

const CreditManagement = () => {
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLedger, setCustomerLedger] = useState([]);
  
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entry, setEntry] = useState({
    productName: '', packSize: '', price: '', quantity: 1
  });

  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    loadData();
    fetchProducts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/credit`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const grouped = groupByCustomer(data.data || []);
        setCreditCustomers(grouped);
      }
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.data) {
        const productsWithPacks = data.data.map(product => {
          let packs = [];
          try {
            packs = typeof product.packs === 'string' ? JSON.parse(product.packs) : (product.packs || []);
          } catch (e) { packs = []; }
          return { ...product, packs };
        });
        setProducts(productsWithPacks);
      }
    } catch (error) { console.error('Error:', error); }
  };

  const groupByCustomer = (entries) => {
    const grouped = {};
    
    entries.forEach(entry => {
      const key = entry.phone;
      if (!grouped[key]) {
        grouped[key] = {
          customerName: entry.customer_name,
          phone: entry.phone,
          entries: [],
          totalCredit: 0,
          totalPaid: 0,
          totalBalance: 0
        };
      }
      grouped[key].entries.push(entry);
    });
    
    Object.values(grouped).forEach(c => {
      c.totalCredit = round2(c.entries.reduce((sum, e) => sum + parseFloat(e.total_amount || 0), 0));
      c.totalPaid = round2(c.entries.reduce((sum, e) => sum + parseFloat(e.paid_amount || 0), 0));
      c.totalBalance = round2(c.totalCredit - c.totalPaid);
      if (Math.abs(c.totalBalance) < 0.01) c.totalBalance = 0;
      c.entries.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    });
    
    return Object.values(grouped);
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  };

  const openLedger = (customer) => {
    setSelectedCustomer(customer);
    setCustomerLedger(customer.entries);
  };

  const handleProductSelect = (productName, packSize, price) => {
    setEntry({ ...entry, productName, packSize, price: price || '' });
  };

  const saveEntry = async () => {
    if (!entry.productName || !entry.price) {
      showMsg('error', 'Please select a product');
      return;
    }

    const totalAmount = round2(parseFloat(entry.price) * parseInt(entry.quantity || 1));
    const productDisplay = entry.packSize 
      ? `${entry.productName} (${entry.packSize})` 
      : entry.productName;

    const payload = {
      customerName: selectedCustomer.customerName,
      phone: selectedCustomer.phone,
      date: new Date().toISOString().split('T')[0],
      items: [{
        product: productDisplay,
        quantity: parseInt(entry.quantity || 1),
        price: round2(entry.price),
        total: totalAmount
      }],
      totalAmount: totalAmount,
      paidAmount: 0,
      notes: ''
    };

    try {
      const res = await fetch(`${API_URL}/credit`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', '✅ Entry added!');
        setEntry({ productName: '', packSize: '', price: '', quantity: 1 });
        setShowAddEntry(false);
        refreshLedger(selectedCustomer.phone);
      } else { showMsg('error', data.error || 'Failed'); }
    } catch (error) { showMsg('error', 'Server error'); }
  };

  const refreshLedger = async (phone) => {
    try {
      const res = await fetch(`${API_URL}/credit`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const grouped = groupByCustomer(data.data || []);
        setCreditCustomers(grouped);
        const customer = grouped.find(c => c.phone === phone);
        if (customer) {
          setSelectedCustomer(customer);
          setCustomerLedger(customer.entries);
        }
      }
    } catch (error) { console.error('Error:', error); }
  };

  const recordPayment = async () => {
    const amount = round2(paymentAmount);
    
    if (amount <= 0 || amount > round2(selectedCustomer.totalBalance)) {
      showMsg('error', `Invalid amount. Max: ₹${round2(selectedCustomer.totalBalance).toLocaleString()}`);
      return;
    }

    let remainingToPay = amount;
    const pendingEntries = customerLedger
      .filter(e => round2(e.remaining_amount) > 0)
      .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));

    if (pendingEntries.length === 0) {
      showMsg('error', 'No pending entries to pay');
      return;
    }

    try {
      for (const entry of pendingEntries) {
        if (remainingToPay < 0.01) break;
        
        const entryRemaining = round2(entry.remaining_amount);
        const payForThis = round2(Math.min(remainingToPay, entryRemaining));
        
        if (payForThis < 0.01) continue;
        
        await fetch(`${API_URL}/credit/${entry.id}/settlement`, {
          method: 'POST', headers: getHeaders(), 
          body: JSON.stringify({ amount: payForThis, note: 'Payment' })
        });
        
        remainingToPay = round2(remainingToPay - payForThis);
      }

      showMsg('success', `✅ ₹${amount.toLocaleString()} recorded!`);
      setShowPayment(false);
      setPaymentAmount('');
      refreshLedger(selectedCustomer.phone);
    } catch (error) { showMsg('error', 'Payment failed'); }
  };

  const deleteEntry = async (id, name) => {
    if (window.confirm(`Delete entry for "${name}"?`)) {
      await fetch(`${API_URL}/credit/${id}`, { method: 'DELETE', headers: getHeaders() });
      showMsg('success', 'Deleted');
      refreshLedger(selectedCustomer.phone);
    }
  };

  const addNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      showMsg('error', 'Please enter name and phone');
      return;
    }
    const emptyCustomer = {
      customerName: newCustomer.name, phone: newCustomer.phone,
      entries: [], totalCredit: 0, totalPaid: 0, totalBalance: 0
    };
    setSelectedCustomer(emptyCustomer);
    setCustomerLedger([]);
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    showMsg('success', 'Customer created! Add entries below.');
  };

  // ==================== GENERATE RECEIPT IMAGE ====================

  // ==================== GENERATE RECEIPT IMAGE WITH LOGO ====================

const generateReceiptImage = (customer) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const width = 500;
      const padding = 30;
      let y = 0;
      
      const entries = customer.entries || customerLedger || [];
      const isAllCustomers = !customer.customerName;
      
      let height = 350;
      if (isAllCustomers) {
        const pendingList = creditCustomers.filter(c => c.totalBalance > 0);
        height = 300 + (pendingList.length * 50) + 120;
      } else {
        height = 380 + (Math.min(entries.length, 8) * 40) + 80;
      }
      
      canvas.width = width;
      canvas.height = Math.max(height, 450);
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // ===== LOAD AND DRAW LOGO =====
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = 'https://res.cloudinary.com/dzuixvh7w/image/upload/v1777819969/63d14490-2acb-4845-84ea-8136800f7fc0_krgt7a.jpg';
      
      logoImg.onload = () => {
        // ===== GREEN TOP HEADER =====
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(0, 0, width, 70);
        
        // Logo circle
        const logoSize = 50;
        const logoX = (width / 2) - 80;
        const logoY = 10;
        
        // White circle behind logo
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(logoX + (logoSize / 2), logoY + (logoSize / 2), logoSize / 2 + 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Clip and draw logo in circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + (logoSize / 2), logoY + (logoSize / 2), logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();
        
        // Shop Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('SARITHA DAIRY', logoX + logoSize + 12, logoY + 25);
        
        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('Pure by Nature, Trusted by Families', logoX + logoSize + 12, logoY + 42);
        
        // Date
        y = 95;
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, width / 2, y);
        
        // Divider
        y += 10;
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        if (isAllCustomers) {
          drawAllCustomersSummary(ctx, width, height, padding, y);
          finalizeCanvas();
        } else {
          drawSingleCustomerStatement(ctx, customer, entries, width, height, padding, y);
          finalizeCanvas();
        }
      };
      
      logoImg.onerror = () => {
        // Fallback without logo
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(0, 0, width, 60);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🥛 SARITHA DAIRY', width / 2, 38);
        
        y = 85;
        ctx.fillStyle = '#666666';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, width / 2, y);
        
        y += 12;
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        if (isAllCustomers) {
          drawAllCustomersSummary(ctx, width, height, padding, y);
          finalizeCanvas();
        } else {
          drawSingleCustomerStatement(ctx, customer, entries, width, height, padding, y);
          finalizeCanvas();
        }
      };
      
      function drawAllCustomersSummary(ctx, width, height, padding, startY) {
        let y = startY;
        const totalPendingAmount = round2(creditCustomers.reduce((s, c) => s + c.totalBalance, 0));
        const pendingCustomers = creditCustomers.filter(c => c.totalBalance > 0);
        
        y += 20;
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PENDING CREDITS', width / 2, y);
        
        y += 8;
        ctx.textAlign = 'center';
        ctx.font = '28px Arial';
        ctx.fillStyle = '#e65100';
        ctx.fillText(`₹${totalPendingAmount.toLocaleString()}`, width / 2, y);
        
        y += 16;
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`${pendingCustomers.length} customer(s) have pending balance`, width / 2, y);
        
        if (pendingCustomers.length > 0) {
          y += 25;
          ctx.fillStyle = '#333';
          ctx.font = 'bold 13px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('Customer List:', padding, y);
          
          y += 18;
          pendingCustomers.slice(0, 8).forEach((c, i) => {
            if (i % 2 === 0) {
              ctx.fillStyle = '#f9fafb';
              ctx.fillRect(padding - 5, y - 12, width - (padding * 2) + 10, 38);
            }
            
            ctx.fillStyle = '#333';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}. ${c.customerName}`, padding, y);
            
            ctx.fillStyle = '#e65100';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`₹${round2(c.totalBalance).toLocaleString()}`, width - padding, y);
            
            y += 18;
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`   📱 ${c.phone}`, padding, y);
            
            y += 22;
          });
        }
      }
      
      function drawSingleCustomerStatement(ctx, customer, entries, width, height, padding, startY) {
        let y = startY;
        
        // Customer Name
        y += 20;
        ctx.fillStyle = '#1a472a';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(customer.customerName, width / 2, y);
        
        y += 22;
        ctx.fillStyle = '#666';
        ctx.font = '13px Arial';
        ctx.fillText(`📱 ${customer.phone}`, width / 2, y);
        
        // Summary Box
        y += 25;
        const boxX = padding;
        const boxW = width - (padding * 2);
        const boxH = 90;
        
        ctx.fillStyle = '#f8faf8';
        ctx.fillRect(boxX, y, boxW, boxH);
        
        // Green left border
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(boxX, y, 4, boxH);
        
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, y, boxW, boxH);
        
        y += 22;
        ctx.fillStyle = '#555';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Total Credit', boxX + 18, y);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${round2(customer.totalCredit).toLocaleString()}`, boxX + boxW - 18, y);
        
        y += 22;
        ctx.fillStyle = '#555';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Total Paid', boxX + 18, y);
        ctx.fillStyle = '#2e7d32';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${round2(customer.totalPaid).toLocaleString()}`, boxX + boxW - 18, y);
        
        y += 22;
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(boxX + 15, y - 2);
        ctx.lineTo(boxX + boxW - 15, y - 2);
        ctx.stroke();
        
        const balance = round2(customer.totalBalance);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        const balanceLabel = balance > 0 ? 'BALANCE DUE' : 'STATUS';
        ctx.fillText(balanceLabel, boxX + 18, y + 6);
        ctx.fillStyle = balance > 0 ? '#e65100' : '#2e7d32';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(balance > 0 ? `₹${balance.toLocaleString()}` : '✅ All Clear', boxX + boxW - 18, y + 6);
        
        // Recent Transactions
        if (entries.length > 0) {
          y += boxH + 20;
          ctx.fillStyle = '#333';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('Recent Transactions', padding, y);
          
          // Small underline
          ctx.fillStyle = '#2e7d32';
          ctx.fillRect(padding, y + 6, 40, 2);
          
          const sorted = [...entries]
            .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
            .slice(0, 6);
          
          y += 10;
          sorted.forEach((entry, i) => {
            y += 18;
            
            if (i % 2 === 0) {
              ctx.fillStyle = '#fafdfa';
              ctx.fillRect(padding - 5, y - 10, width - (padding * 2) + 10, 35);
            }
            
            const product = entry.items?.map(item => item.product).join(', ') || '';
            const displayProduct = product.length > 20 ? product.substring(0, 18) + '..' : product;
            
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(displayProduct, padding, y);
            
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            const dateStr = new Date(entry.date || entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            ctx.fillText(dateStr, width / 2 - 25, y);
            
            ctx.fillStyle = '#1a472a';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`₹${round2(entry.total_amount).toLocaleString()}`, width - padding, y);
            
            y += 6;
          });
        }
      }
      
      function finalizeCanvas() {
        // Footer
        const footerY = canvas.height - 55;
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, footerY);
        ctx.lineTo(width - padding, footerY);
        ctx.stroke();
        
        let fy = footerY + 22;
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Saritha Dairy - JNTU, Hyderabad', width / 2, fy);
        
        fy += 16;
        ctx.fillText('📞 9398263810 | Pure by Nature, Trusted by Families', width / 2, fy);
        
        resolve(canvas.toDataURL('image/png'));
      }
    });
  };
  // ==================== SEND TO CUSTOMER WHATSAPP ====================

  const sendWhatsAppWithImage = async (customer) => {
    showMsg('success', '📱 Generating statement...');
    
    let phoneNumber;
    let isAllCustomers = !customer.customerName;
    
    if (isAllCustomers) {
      phoneNumber = '9398263810';
    } else {
      phoneNumber = customer.phone;
      
      if (!phoneNumber || phoneNumber.length < 10) {
        showMsg('error', '❌ Customer phone number not found!');
        setShowExportMenu(false);
        return;
      }
    }
    
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    try {
      const imageDataUrl = await generateReceiptImage(customer);
      
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'credit-statement.png', { type: 'image/png' });
      
      let caption = '';
      if (isAllCustomers) {
        caption = `📊 *SARITHA DAIRY - Pending Credits Summary*\n\n`;
        caption += `📅 ${new Date().toLocaleDateString('en-IN')}\n`;
        caption += `💰 Total Pending: ₹${round2(creditCustomers.reduce((s, c) => s + c.totalBalance, 0)).toLocaleString()}\n`;
        caption += `👥 Pending Customers: ${creditCustomers.filter(c => c.totalBalance > 0).length}\n`;
      } else {
        caption = `🧾 *SARITHA DAIRY - Credit Statement*\n\n`;
        caption += `👤 *${customer.customerName}*\n`;
        caption += `📅 ${new Date().toLocaleDateString('en-IN')}\n\n`;
        caption += `📊 *SUMMARY*\n`;
        caption += `💰 Total Credit: ₹${round2(customer.totalCredit).toLocaleString()}\n`;
        caption += `✅ Total Paid: ₹${round2(customer.totalPaid).toLocaleString()}\n`;
        
        const bal = round2(customer.totalBalance);
        if (bal > 0) {
          caption += `⚠️ *Balance Due: ₹${bal.toLocaleString()}*\n`;
        } else {
          caption += `✅ *All Clear - No Dues*\n`;
        }
      }
      
      caption += `\n📍 JNTU, Hyderabad\n📞 9398263810`;
      
      // Try Web Share API (mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Credit Statement',
            text: caption,
            files: [file]
          });
          showMsg('success', '✅ Statement shared!');
          setShowExportMenu(false);
          return;
        } catch (shareError) {
          console.log('Share cancelled, trying WhatsApp...');
        }
      }
      
      // Desktop: Download image + open WhatsApp
      const downloadLink = document.createElement('a');
      downloadLink.href = imageDataUrl;
      const filename = isAllCustomers 
        ? `credit-summary-${new Date().toISOString().split('T')[0]}.png`
        : `statement-${customer.customerName?.replace(/\s+/g, '-').toLowerCase()}.png`;
      downloadLink.download = filename;
      downloadLink.click();
      
      setTimeout(() => {
        const encodedMessage = encodeURIComponent(caption);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
      }, 500);
      
      showMsg('success', '📱 Opening WhatsApp...');
      
    } catch (error) {
      console.log('Error:', error);
      let fallbackMsg = '';
      if (isAllCustomers) {
        fallbackMsg = `📊 *SARITHA DAIRY - Pending Credits*\n\n`;
        fallbackMsg += `📅 ${new Date().toLocaleDateString('en-IN')}\n`;
        const pending = creditCustomers.filter(c => c.totalBalance > 0);
        fallbackMsg += `💰 Total Pending: ₹${round2(pending.reduce((s, c) => s + c.totalBalance, 0)).toLocaleString()}\n\n`;
        pending.slice(0, 5).forEach((c, i) => {
          fallbackMsg += `${i+1}. ${c.customerName} - ₹${round2(c.totalBalance).toLocaleString()}\n`;
        });
      } else {
        fallbackMsg = `🧾 *Credit Statement - ${customer.customerName}*\n\n`;
        fallbackMsg += `💰 Total: ₹${round2(customer.totalCredit).toLocaleString()}\n`;
        fallbackMsg += `✅ Paid: ₹${round2(customer.totalPaid).toLocaleString()}\n`;
        fallbackMsg += `⚠️ Balance: ₹${round2(customer.totalBalance).toLocaleString()}\n`;
      }
      fallbackMsg += `\n📍 JNTU, Hyderabad | 📞 9398263810`;
      
      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(fallbackMsg)}`, '_blank');
      showMsg('success', '📱 Opening WhatsApp...');
    }
    
    setShowExportMenu(false);
  };

  // ==================== DIRECT WHATSAPP CHAT ====================

  const openWhatsAppChat = (customer) => {
    const phone = customer.phone?.replace(/\D/g, '') || '';
    if (phone.length === 10) {
      const msg = encodeURIComponent(`Hello ${customer.customerName},\n\nYour credit details from Saritha Dairy 🥛\n\nPlease send your statement request.`);
      window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
    } else {
      showMsg('error', 'Invalid phone number');
    }
  };

  // ==================== DOWNLOAD REPORT ====================
  
  const downloadReport = async () => {
    const customer = selectedCustomer || {};
    const imageDataUrl = await generateReceiptImage(customer);
    
    const link = document.createElement('a');
    link.href = imageDataUrl;
    const filename = selectedCustomer 
      ? `credit-statement-${selectedCustomer.customerName.replace(/\s+/g, '-').toLowerCase()}.png`
      : `all-credit-summary-${new Date().toISOString().split('T')[0]}.png`;
    link.download = filename;
    link.click();
    
    setShowExportMenu(false);
    showMsg('success', '📄 Downloaded!');
  };

  const totalPending = round2(creditCustomers.reduce((s, c) => s + c.totalBalance, 0));
  const pendingCount = creditCustomers.filter(c => c.totalBalance > 0).length;

  const getProductIcon = (name) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    if (n.includes('tea')) return '☕';
    return '📦';
  };

  const filteredCustomers = creditCustomers.filter(c =>
    c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  // ========== LEDGER VIEW ==========
  if (selectedCustomer) {
    const displayBalance = round2(selectedCustomer.totalBalance);
    
    return (
      <div className="cr-container">
        {message && (
          <div className={`cr-toast ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        <div className="cr-ledger-header">
          <button className="cr-back-btn" onClick={() => setSelectedCustomer(null)}>← Back</button>
          <div className="cr-ledger-info">
            <div className="cr-ledger-avatar">{selectedCustomer.customerName?.charAt(0)?.toUpperCase()}</div>
            <div>
              <h2>{selectedCustomer.customerName}</h2>
              <p>
                📱 {selectedCustomer.phone}
                <button 
                  onClick={(e) => { e.stopPropagation(); openWhatsAppChat(selectedCustomer); }}
                  className="cr-whatsapp-chat-btn"
                  title="Chat on WhatsApp"
                >
                  💬 Chat
                </button>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button 
                className="cr-btn-outline" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                📤 Share
              </button>
              
              {showExportMenu && (
                <div className="cr-export-dropdown">
                  <button 
                    onClick={() => sendWhatsAppWithImage(selectedCustomer)}
                    className="cr-export-item"
                  >
                    <span className="cr-export-icon">🖼️</span>
                    <div>
                      <div className="cr-export-title">Send Statement</div>
                      <div className="cr-export-subtitle">To {selectedCustomer.phone}</div>
                    </div>
                  </button>
                  <button 
                    onClick={downloadReport}
                    className="cr-export-item"
                  >
                    <span className="cr-export-icon">📥</span>
                    <div>
                      <div className="cr-export-title">Download</div>
                      <div className="cr-export-subtitle">Save as PNG</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            <div className="cr-ledger-balance">
              <span>{displayBalance > 0 ? 'Balance Due' : 'Status'}</span>
              <strong style={{color: displayBalance > 0 ? '#e65100' : '#2e7d32'}}>
                {displayBalance > 0 ? `₹${displayBalance.toLocaleString()}` : '✅ Clear'}
              </strong>
            </div>
          </div>
        </div>

        <div className="cr-ledger-summary">
          <div className="cr-summary-item">
            <span>Total Credit</span>
            <strong>₹{round2(selectedCustomer.totalCredit).toLocaleString()}</strong>
          </div>
          <div className="cr-summary-item">
            <span>Total Paid</span>
            <strong style={{color:'#2e7d32'}}>₹{round2(selectedCustomer.totalPaid).toLocaleString()}</strong>
          </div>
          <div className="cr-summary-item">
            <span>Balance</span>
            <strong style={{color: displayBalance > 0 ? '#e65100' : '#2e7d32'}}>
              ₹{displayBalance.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="cr-ledger-actions">
          <button className="cr-btn-add" onClick={() => setShowAddEntry(true)}>➕ Add Entry</button>
          {displayBalance > 0 && (
            <button className="cr-btn-pay-lg" onClick={() => { 
              setPaymentAmount(displayBalance.toString());
              setShowPayment(true); 
            }}>💰 Record Payment</button>
          )}
        </div>

        {/* Ledger Table */}
        <div className="cr-ledger-table-wrap">
          <table className="cr-ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customerLedger.length === 0 ? (
                <tr><td colSpan="8" className="cr-empty-row">No entries yet. Click "➕ Add Entry" to start.</td></tr>
              ) : (
                (() => {
                  let runningBalance = 0;
                  const sorted = [...customerLedger].sort((a, b) => 
                    new Date(a.created_at || a.date) - new Date(b.created_at || b.date)
                  );
                  return sorted.map(entry => {
                    const amount = round2(entry.total_amount);
                    const paid = round2(entry.paid_amount);
                    runningBalance = round2(runningBalance + amount - paid);
                    
                    return (
                      <tr key={entry.id} className={entry.status === 'settled' ? 'settled-row' : ''}>
                        <td>{new Date(entry.date || entry.created_at).toLocaleDateString('en-IN')}</td>
                        <td>{entry.items?.map((item, i) => (
                          <div key={i} className="cr-entry-product">{getProductIcon(item.product)} {item.product}</div>
                        ))}</td>
                        <td>{entry.items?.[0]?.quantity || 1}</td>
                        <td className="cr-amount">₹{amount.toLocaleString()}</td>
                        <td className="cr-paid" style={{color: paid > 0 ? '#2e7d32' : '#888'}}>
                          {paid > 0 ? `₹${paid.toLocaleString()}` : '-'}
                        </td>
                        <td className="cr-balance" style={{color: runningBalance > 0 ? '#e65100' : '#2e7d32', fontWeight: 700}}>
                          ₹{runningBalance.toLocaleString()}
                        </td>
                        <td>
                          <span className={`cr-status-dot ${entry.status}`}>
                            {entry.status === 'settled' ? 'Paid' : entry.status === 'partial' ? 'Part' : 'Due'}
                          </span>
                        </td>
                        <td>
                          <button className="cr-btn-del-sm" onClick={() => deleteEntry(entry.id, selectedCustomer.customerName)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Add Entry Modal */}
        {showAddEntry && (
          <div className="cr-modal" onClick={() => setShowAddEntry(false)}>
            <div className="cr-modal-box" onClick={e => e.stopPropagation()}>
              <div className="cr-modal-head">
                <h2>➕ Add Entry for {selectedCustomer.customerName}</h2>
                <button className="cr-close" onClick={() => setShowAddEntry(false)}>✕</button>
              </div>
              <div className="cr-modal-body">
                <div className="cr-product-list">
                  {products.map(product => (
                    <div key={product.id} className="cr-product-group">
                      <div className="cr-product-header">
                        <span className="cr-product-icon">{getProductIcon(product.name)}</span>
                        <span className="cr-product-title">{product.name}</span>
                      </div>
                      <div className="cr-pack-list">
                        {product.packs?.length > 0 ? (
                          product.packs.map((pack, idx) => (
                            <button key={idx} className={`cr-pack-btn ${entry.productName === product.name && entry.packSize === `${pack.size}${pack.unit}` ? 'selected' : ''}`}
                              onClick={() => handleProductSelect(product.name, `${pack.size}${pack.unit}`, pack.price)}>
                              {pack.size}{pack.unit} - ₹{pack.price}
                            </button>
                          ))
                        ) : (
                          <button className={`cr-pack-btn ${entry.productName === product.name ? 'selected' : ''}`}
                            onClick={() => handleProductSelect(product.name, '', '')}>{product.name}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {entry.productName && (
                  <>
                    <div className="cr-selected-info">Selected: <strong>{entry.productName}</strong> {entry.packSize && `(${entry.packSize})`}</div>
                    <div className="cr-row">
                      <div className="cr-field"><label>Price (₹)</label><input type="number" value={entry.price} onChange={e => setEntry({...entry, price: e.target.value})} /></div>
                      <div className="cr-field"><label>Quantity</label><input type="number" value={entry.quantity} onChange={e => setEntry({...entry, quantity: e.target.value})} min="1" /></div>
                    </div>
                    <div className="cr-entry-total">Total: <strong>₹{round2(parseFloat(entry.price||0) * parseInt(entry.quantity||1)).toLocaleString()}</strong></div>
                    <button className="cr-btn-save" onClick={saveEntry}>💾 Save Entry</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayment && (
          <div className="cr-modal" onClick={() => setShowPayment(false)}>
            <div className="cr-modal-box cr-modal-sm" onClick={e => e.stopPropagation()}>
              <div className="cr-modal-head"><h2>💰 Record Payment</h2><button className="cr-close" onClick={() => setShowPayment(false)}>✕</button></div>
              <div className="cr-modal-body">
                <p style={{marginBottom:'12px'}}>Balance: <strong style={{color:'#e65100'}}>₹{displayBalance.toLocaleString()}</strong></p>
                <div className="cr-field"><label>Amount (₹)</label><input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="cr-input-lg" autoFocus /></div>
                <div className="cr-pay-btns">
                  <button className="cr-btn-cancel" onClick={() => setShowPayment(false)}>Cancel</button>
                  <button className="cr-btn-save" onClick={recordPayment}>✅ Confirm</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== MAIN CUSTOMER LIST ==========
  return (
    <div className="cr-container">
      {message && (
        <div className={`cr-toast ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="cr-header">
        <div>
          <h1>📒 Credit Book</h1>
          <p>{creditCustomers.length} customers • ₹{totalPending.toLocaleString()} pending</p>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button 
              className="cr-btn-outline" 
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📤 Share
            </button>
            
            {showExportMenu && (
              <div className="cr-export-dropdown">
                <button 
                  onClick={() => sendWhatsAppWithImage({})}
                  className="cr-export-item"
                >
                  <span className="cr-export-icon">🖼️</span>
                  <div>
                    <div className="cr-export-title">Send Summary</div>
                    <div className="cr-export-subtitle">Pending credits</div>
                  </div>
                </button>
                <button 
                  onClick={downloadReport}
                  className="cr-export-item"
                >
                  <span className="cr-export-icon">📥</span>
                  <div>
                    <div className="cr-export-title">Download</div>
                    <div className="cr-export-subtitle">Save as PNG</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button className="cr-btn-outline" onClick={() => setShowNewCustomer(true)}>+ New Customer</button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="cr-banner">⚠️ {pendingCount} customer{pendingCount > 1 ? 's' : ''} with pending: <strong>₹{totalPending.toLocaleString()}</strong></div>
      )}

      <div className="cr-search-wrap">
        <span>🔍</span>
        <input type="text" placeholder="Search customer name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="cr-search-input" />
      </div>

      {loading ? (
        <div className="cr-center">Loading...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="cr-center"><span style={{fontSize:'50px'}}>📒</span><h3>No customers</h3><p>Click "New Customer" to add one</p></div>
      ) : (
        <div className="cr-grid">
          {filteredCustomers.map(customer => {
            const bal = round2(customer.totalBalance);
            return (
              <div key={customer.phone} className="cr-card cr-card-clickable" onClick={() => openLedger(customer)}>
                <div className="cr-card-top">
                  <div className="cr-card-avatar">{customer.customerName?.charAt(0)?.toUpperCase()}</div>
                  <div className="cr-card-info">
                    <h3>{customer.customerName}</h3>
                    <p>📱 {customer.phone}</p>
                    <p className="cr-card-entries">{customer.entries.length} entries</p>
                  </div>
                  <div className="cr-card-balance-box">
                    <span>{bal > 0 ? 'Due' : 'Status'}</span>
                    <strong style={{color: bal > 0 ? '#e65100' : '#2e7d32'}}>
                      {bal > 0 ? `₹${bal.toLocaleString()}` : '✅ Clear'}
                    </strong>
                  </div>
                </div>
                <div className="cr-bar-wrap">
                  <div className="cr-bar">
                    <div className="cr-bar-fill" style={{width: `${customer.totalCredit > 0 ? Math.round((customer.totalPaid / customer.totalCredit) * 100) : 0}%`}}></div>
                  </div>
                </div>
                <div className="cr-card-click-hint">Click to view ledger →</div>
              </div>
            );
          })}
        </div>
      )}

      {showNewCustomer && (
        <div className="cr-modal" onClick={() => setShowNewCustomer(false)}>
          <div className="cr-modal-box cr-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-head"><h2>👤 New Customer</h2><button className="cr-close" onClick={() => setShowNewCustomer(false)}>✕</button></div>
            <div className="cr-modal-body">
              <div className="cr-field"><label>Customer Name *</label><input type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Enter name" autoFocus /></div>
              <div className="cr-field"><label>Phone Number *</label><input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10 digit" maxLength={10} /></div>
              <button className="cr-btn-save" onClick={addNewCustomer}>Create Customer & Open Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditManagement;