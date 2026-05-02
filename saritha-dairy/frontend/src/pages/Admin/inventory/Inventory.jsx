import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Inventory.css';

const Inventory = () => {
  const navigate = useNavigate();

  const inventorySteps = [
    {
      step: 1,
      title: 'Products',
      description: 'Manage your dairy products with pack sizes',
      icon: '📦',
      color: '#3b82f6',
      bgColor: '#eff6ff',
      link: '/inventory/products',
      action: 'Manage Products →'
    },
    {
      step: 2,
      title: 'Purchases',
      description: 'Record bulk purchases from farms',
      icon: '🏭',
      color: '#10b981',
      bgColor: '#f0fdf4',
      link: '/purchases/add',
      action: 'Record Purchase →'
    },
    {
      step: 3,
      title: 'Pack Products',
      description: 'Pack bulk products into sale packets with barcodes',
      icon: '📦',
      color: '#8b5cf6',
      bgColor: '#faf5ff',
      link: '/inventory/pack-products',
      action: 'Pack & Generate Barcodes →'
    },
    {
      step: 4,
      title: 'Store Stock',
      description: 'View stock by pack size (500ml, 1L, 2L)',
      icon: '🏪',
      color: '#f59e0b',
      bgColor: '#fff7ed',
      link: '/inventory/store-stock',
      action: 'View Stock →'
    }
  ];

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <div>
          <h1>🏪 Inventory Management</h1>
          <p>Products → Purchases → Pack with Barcodes → Store Stock</p>
        </div>
        <button className="quick-add-btn" onClick={() => navigate('/inventory/products')}>
          <span className="plus-icon">+</span>
          Add Product
        </button>
      </div>

      <div className="workflow-steps">
        {inventorySteps.map((step) => (
          <div key={step.step} className="workflow-card" onClick={() => navigate(step.link)}>
            <div className="workflow-step-number" style={{ background: step.color }}>{step.step}</div>
            <div className="workflow-icon" style={{ background: step.bgColor, color: step.color }}>
              {step.icon}
            </div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <button className="workflow-btn" style={{ color: step.color }}>{step.action}</button>
          </div>
        ))}
      </div>

      <button 
        className="fab-add-product"
        onClick={() => navigate('/inventory/products')}
        title="Add New Product"
      >
        <span className="fab-icon">+</span>
      </button>
    </div>
  );
};

export default Inventory;