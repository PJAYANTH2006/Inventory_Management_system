'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Package, ListOrdered, Plus, Edit2, Trash2, AlertTriangle, Check, X, Info } from 'lucide-react';
import { Unit, Dimension } from '@prisma/client';

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  dimension: Dimension;
  stock: number;
  price: number;
  priceUnit: Unit;
  minStockAlert: number;
}

interface OrderItem {
  id: string;
  productId: string;
  orderedQuantity: number;
  orderedUnit: Unit;
  baseQuantity: number;
  priceAtOrder: number;
  priceUnitAtOrder: Unit;
  calculatedPrice: number;
  product: {
    name: string;
    sku: string;
    dimension: Dimension;
  };
}

interface Order {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  totalPrice: number;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  items: OrderItem[];
}

export default function SellerDashboard() {
  const router = useRouter();
  const [sellerUser, setSellerUser] = useState<{ name: string; email: string; role: string } | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');

  // Core data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Product CRUD states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDimension, setFormDimension] = useState<Dimension>('WEIGHT');
  const [formStock, setFormStock] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formPriceUnit, setFormPriceUnit] = useState<Unit>('kg');
  const [formMinAlert, setFormMinAlert] = useState<number>(0);
  
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch initial session, orders, and products
  useEffect(() => {
    async function initDashboard() {
      try {
        const userRes = await fetch('/api/auth/me');
        const userData = await userRes.json();
        if (!userData.user || (userData.user.role !== 'SELLER' && userData.user.role !== 'ADMIN')) {
          router.push('/login');
          return;
        }
        setSellerUser(userData.user);

        await refreshOrders();
        await refreshProducts();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, []);

  const refreshOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    if (data.orders) {
      setOrders(data.orders);
    }
  };

  const refreshProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.products) {
      setProducts(data.products);
    }
  };

  // Toast notifications helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handle Order status actions
  const handleOrderStatus = async (orderId: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED') => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to update order status', 'error');
        return;
      }

      showToast(`Order status updated to ${status}!`, 'success');
      await refreshOrders();
      await refreshProducts(); // stock might have changed
    } catch (err) {
      console.error(err);
      showToast('An error occurred updating the order status', 'error');
    }
  };

  // Open modal for Create/Edit product
  const openProductModal = (product: Product | null = null) => {
    setEditingProduct(product);
    setFormError('');

    if (product) {
      // populate form
      setFormName(product.name);
      setFormSku(product.sku);
      setFormDescription(product.description || '');
      setFormCategory(product.category || '');
      setFormDimension(product.dimension);
      setFormStock(Number(product.stock));
      setFormPrice(Number(product.price));
      setFormPriceUnit(product.priceUnit);
      setFormMinAlert(Number(product.minStockAlert));
    } else {
      // reset form
      setFormName('');
      setFormSku('');
      setFormDescription('');
      setFormCategory('');
      setFormDimension('WEIGHT');
      setFormStock(0);
      setFormPrice(0);
      setFormPriceUnit('kg');
      setFormMinAlert(0);
    }

    setIsModalOpen(true);
  };

  // Sync pricing unit defaults as dimensions change
  useEffect(() => {
    if (editingProduct) return; // don't override while editing existing
    
    if (formDimension === 'WEIGHT') setFormPriceUnit('kg');
    else if (formDimension === 'VOLUME') setFormPriceUnit('L');
    else setFormPriceUnit('items');
  }, [formDimension]);

  // Handle Product CRUD submit
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    if (!formName || !formSku || !formDimension || !formPriceUnit) {
      setFormError('Please fill out all required fields.');
      setFormSubmitting(false);
      return;
    }

    const payload = {
      name: formName,
      sku: formSku,
      description: formDescription,
      category: formCategory,
      dimension: formDimension,
      stock: Number(formStock),
      price: Number(formPrice),
      priceUnit: formPriceUnit,
      minStockAlert: Number(formMinAlert),
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to save product details.');
        setFormSubmitting(false);
        return;
      }

      showToast(
        editingProduct ? 'Product details updated successfully!' : 'New product created successfully!',
        'success'
      );
      setIsModalOpen(false);
      await refreshProducts();
    } catch (err) {
      console.error(err);
      setFormError('Server error occurred while saving product details.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action is permanent.')) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to delete product', 'error');
        return;
      }

      showToast('Product successfully deleted.', 'success');
      await refreshProducts();
    } catch (err) {
      console.error(err);
      showToast('An error occurred during deletion', 'error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const formatStock = (stockInBase: number | string, dimension: Dimension, unit: Unit) => {
    const stockVal = Number(stockInBase);
    if (isNaN(stockVal)) return '0';
    if (dimension === 'WEIGHT') {
      if (unit === 'kg') return `${(stockVal / 1000).toFixed(4)} kg`;
      return `${stockVal.toFixed(2)} g`;
    }
    if (dimension === 'VOLUME') {
      if (unit === 'L') return `${(stockVal / 1000).toFixed(4)} L`;
      return `${stockVal.toFixed(2)} mL`;
    }
    return `${stockVal} items`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Seller Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Toast Alert */}
      {notification && (
        <div 
          className="glass-panel" 
          style={{
            position: 'fixed',
            top: '80px',
            right: '40px',
            zIndex: 2000,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: `4px solid ${notification.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
            backgroundColor: 'rgba(21, 28, 44, 0.95)',
          }}
        >
          {notification.type === 'success' ? (
            <Check size={20} color="var(--success)" />
          ) : (
            <AlertTriangle size={20} color="var(--error)" />
          )}
          <span style={{ fontWeight: 600 }}>{notification.message}</span>
        </div>
      )}

      {/* Seller Nav */}
      <header className="dashboard-nav">
        <div className="logo-container" style={{ marginBottom: 0 }}>
          <div className="logo-icon" style={{ width: 32, height: 32, fontSize: '1.1rem' }}>A</div>
          <div className="logo-text" style={{ fontSize: '1.25rem' }}>AasaMedChem <span style={{ fontSize: '0.8rem', color: 'var(--primary)', verticalAlign: 'super' }}>Seller Dashboard</span></div>
        </div>

        <div className="nav-user-info">
          <div className="user-badge badge-seller">
            <span>Seller: {sellerUser?.name}</span>
          </div>
          <button className="nav-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Dashboard Main Grid */}
      <main className="dashboard-main">
        {/* Navigation Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListOrdered size={18} />
              Quotation Orders ({orders.filter(o => o.status === 'PENDING').length} Pending)
            </span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} />
              Chemical Directory & Inventory
            </span>
          </button>
        </div>

        {activeTab === 'orders' ? (
          /* Incoming Quotations Panel */
          <div className="glass-panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h3>Buyer Quotation Influx</h3>
            </div>
            
            <div className="panel-content">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ListOrdered size={40} className="empty-state-icon" />
                  <p>No orders or quotations have been submitted yet</p>
                </div>
              ) : (
                <div className="order-list">
                  {orders.map(order => (
                    <div key={order.id} className="glass-panel order-card">
                      <div className="order-header">
                        <div className="order-meta">
                          <span>Quotation ID: <span className="order-id">{order.id.slice(0, 8)}...</span></span>
                          <span>Buyer: <span style={{ color: 'white', fontWeight: 600 }}>{order.user.name}</span> ({order.user.email})</span>
                          <span>Date: {new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>₹{Number(order.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <span className={`status-badge status-${order.status.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="order-body">
                        <table className="order-items-table" style={{ marginBottom: 0 }}>
                          <thead>
                            <tr>
                              <th>Product Description</th>
                              <th>Ordered Quantity</th>
                              <th>Configured Rate</th>
                              <th>Base Storage Quantity</th>
                              <th style={{ textAlign: 'right' }}>Total Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(item => {
                              const baseUnit = item.product.dimension === 'WEIGHT' ? 'g' : item.product.dimension === 'VOLUME' ? 'mL' : 'items';
                              
                              // Check if a conversion took place
                              const isConverted = item.orderedUnit !== item.priceUnitAtOrder;

                              return (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                                  <td style={{ padding: '16px 12px' }}>
                                    <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                                    <div className="product-sku">{item.product.sku}</div>
                                    {isConverted && (
                                      <div className="conversion-breakdown" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Info size={12} color="var(--primary)" />
                                        <span>
                                          Conversion Audit: Converted {item.orderedQuantity} {item.orderedUnit} to {item.baseQuantity} {baseUnit}. 
                                          Pricing rate: ₹{item.priceAtOrder} per {item.priceUnitAtOrder} (calculated rate of ₹{(item.priceUnitAtOrder === 'kg' || item.priceUnitAtOrder === 'L' ? Number(item.priceAtOrder) / 1000 : Number(item.priceAtOrder)).toFixed(6)} per base {baseUnit}).
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td>{item.orderedQuantity} {item.orderedUnit}</td>
                                  <td>₹{item.priceAtOrder} / {item.priceUnitAtOrder}</td>
                                  <td>{item.baseQuantity} {baseUnit}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'white' }}>₹{Number(item.calculatedPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {order.status === 'PENDING' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-glass)' }}>
                            <button 
                              className="btn-secondary" 
                              onClick={() => handleOrderStatus(order.id, 'REJECTED')}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            >
                              <X size={16} />
                              Reject Quotation
                            </button>
                            <button 
                              className="btn-primary" 
                              onClick={() => handleOrderStatus(order.id, 'APPROVED')}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, var(--success), #059669)', boxShadow: '0 4px 12px var(--success-glow)' }}
                            >
                              <Check size={16} />
                              Approve & Dispatch
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Inventory and Alerts Panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="glass-panel">
              <div className="panel-header">
                <h3>Chemical Directory & Alerting Thresholds</h3>
                <button className="btn-primary" onClick={() => openProductModal(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                  <Plus size={16} />
                  Add New Chemical
                </button>
              </div>

              <div className="panel-content">
                <div className="grid-cards">
                  {products.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      <Package size={40} className="empty-state-icon" />
                      <p>Inventory directory is empty. Add a product to get started.</p>
                    </div>
                  ) : (
                    products.map(product => {
                      const isOutOfStock = Number(product.stock) <= 0;
                      const isLowStock = !isOutOfStock && Number(product.stock) <= Number(product.minStockAlert);
                      
                      let stockStatusClass = '';
                      let borderStyle = {};
                      if (isOutOfStock) {
                        stockStatusClass = 'stock-alert';
                        borderStyle = { border: '1px solid var(--error)', boxShadow: '0 4px 15px var(--error-glow)' };
                      } else if (isLowStock) {
                        stockStatusClass = 'stock-warning';
                        borderStyle = { border: '1px solid var(--warning)', boxShadow: '0 4px 15px var(--warning-glow)' };
                      }

                      return (
                        <div key={product.id} className="glass-panel product-card" style={borderStyle}>
                          <span className="product-sku">{product.sku}</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                            {product.category && (
                              <span className="product-category">{product.category}</span>
                            )}
                            {isOutOfStock && <span className="status-badge status-rejected" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Out of stock</span>}
                            {isLowStock && <span className="status-badge status-pending" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Low Stock Alert</span>}
                          </div>
                          
                          <h4 className="product-name">{product.name}</h4>
                          <p className="product-description">{product.description || 'No description provided.'}</p>
                          
                          <div className="product-meta-row">
                            <div>
                              <span className="product-price-label">₹{Number(product.price).toLocaleString('en-IN')}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {product.priceUnit}</span>
                            </div>
                            <div>
                              <span className={`product-stock-label ${stockStatusClass}`}>
                                Stock: {formatStock(product.stock, product.dimension, product.dimension === 'WEIGHT' ? 'kg' : product.dimension === 'VOLUME' ? 'L' : 'items')}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button 
                              className="btn-secondary" 
                              onClick={() => openProductModal(product)}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}
                            >
                              <Edit2 size={14} />
                              Edit Product
                            </button>
                            <button 
                              className="btn-secondary" 
                              onClick={() => handleDeleteProduct(product.id)}
                              style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '8px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product CRUD Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <div className="panel-header">
              <h3>{editingProduct ? 'Edit Product Details' : 'Create New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>×</button>
            </div>

            <form onSubmit={handleProductSubmit}>
              <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '450px', overflowY: 'auto' }}>
                {formError && <div className="alert-error">{formError}</div>}

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input 
                      type="text" 
                      required
                      value={formName} 
                      onChange={(e) => setFormName(e.target.value)} 
                      placeholder="e.g. Purified Acetonitrile"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU Code (Unique) *</label>
                    <input 
                      type="text" 
                      required
                      value={formSku} 
                      onChange={(e) => setFormSku(e.target.value)} 
                      placeholder="e.g. SOL-ACN-005"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    value={formDescription} 
                    onChange={(e) => setFormDescription(e.target.value)} 
                    placeholder="Provide details about grades, purity, molecular structure, etc."
                    rows={3}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input 
                      type="text" 
                      value={formCategory} 
                      onChange={(e) => setFormCategory(e.target.value)} 
                      placeholder="e.g. Solvents, Acids"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dimension Group *</label>
                    <select 
                      value={formDimension} 
                      onChange={(e) => setFormDimension(e.target.value as Dimension)}
                      disabled={!!editingProduct} // Dimension cannot be changed once product exists
                    >
                      <option value="WEIGHT">Weight (Mass)</option>
                      <option value="VOLUME">Volume (Liquid)</option>
                      <option value="COUNT">Count (Discrete items)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Stock Count *
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'none', marginTop: '2px' }}>
                        Stored in base unit: {formDimension === 'WEIGHT' ? 'grams (g)' : formDimension === 'VOLUME' ? 'milliliters (mL)' : 'items'}
                      </span>
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      required
                      value={formStock} 
                      onChange={(e) => setFormStock(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Low Stock Alert Threshold
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'none', marginTop: '2px' }}>
                        Enter in base unit (g, mL, items)
                      </span>
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      value={formMinAlert} 
                      onChange={(e) => setFormMinAlert(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Pricing Rate (INR) *</label>
                    <input 
                      type="number" 
                      step="any"
                      required
                      value={formPrice} 
                      onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pricing Unit Base *</label>
                    <select 
                      value={formPriceUnit} 
                      onChange={(e) => setFormPriceUnit(e.target.value as Unit)}
                    >
                      {formDimension === 'WEIGHT' && (
                        <>
                          <option value="kg">per Kilogram (kg)</option>
                          <option value="g">per Gram (g)</option>
                        </>
                      )}
                      {formDimension === 'VOLUME' && (
                        <>
                          <option value="L">per Liter (L)</option>
                          <option value="mL">per Milliliter (mL)</option>
                        </>
                      )}
                      {formDimension === 'COUNT' && (
                        <option value="items">per Item (count)</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={formSubmitting} style={{ width: 'auto' }}>
                  {formSubmitting ? 'Saving Details...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
