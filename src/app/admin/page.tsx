'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, LogOut, Package, ListOrdered, Plus, Edit2, Trash2, 
  AlertTriangle, Check, X, Info, TrendingUp, DollarSign, Database, Settings, ShieldAlert
} from 'lucide-react';
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

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SELLER' | 'BUYER';
  createdAt: string;
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

interface ReportsSummary {
  users: {
    total: number;
    admin: number;
    seller: number;
    buyer: number;
  };
  inventory: {
    totalProducts: number;
    totalValuation: number;
    lowStockAlerts: number;
  };
  sales: {
    totalOrders: number;
    revenue: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    cancelledCount: number;
  };
  recentActivity: {
    id: string;
    buyerName: string;
    buyerEmail: string;
    totalPrice: number;
    status: string;
    createdAt: string;
  }[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);

  // Tab State: 'users' | 'products' | 'inventory' | 'orders' | 'reports' | 'settings'
  const [activeTab, setActiveTab] = useState<'users' | 'products' | 'inventory' | 'orders' | 'reports' | 'settings'>('users');

  // Core Data States
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ReportsSummary | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Product modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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

  // Fetch session and default active tab data
  useEffect(() => {
    async function initDashboard() {
      try {
        const userRes = await fetch('/api/auth/me');
        const userData = await userRes.json();
        if (!userData.user || userData.user.role !== 'ADMIN') {
          router.push('/login');
          return;
        }
        setAdminUser(userData.user);

        // Load users on mount
        await refreshUsers();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, []);

  // Fetch data as tab changes
  useEffect(() => {
    if (!adminUser) return;
    if (activeTab === 'users') refreshUsers();
    else if (activeTab === 'products') refreshProducts();
    else if (activeTab === 'inventory') refreshProducts();
    else if (activeTab === 'orders') refreshOrders();
    else if (activeTab === 'reports') refreshReports();
  }, [activeTab]);

  const refreshUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.users) setUsers(data.users);
  };

  const refreshProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.products) setProducts(data.products);
  };

  const refreshOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    if (data.orders) setOrders(data.orders);
  };

  const refreshReports = async () => {
    const res = await fetch('/api/reports');
    const data = await res.json();
    if (data.summary) setReports(data.summary);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Modify user role
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to update user role', 'error');
        return;
      }

      showToast(`User role updated to ${newRole}!`, 'success');
      await refreshUsers();
    } catch (err) {
      console.error(err);
      showToast('An error occurred while changing user role', 'error');
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? All their submitted quotations will also be deleted.')) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to delete user account', 'error');
        return;
      }

      showToast('User account successfully deleted.', 'success');
      await refreshUsers();
    } catch (err) {
      console.error(err);
      showToast('An error occurred during account deletion', 'error');
    }
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

    setIsProductModalOpen(true);
  };

  // Sync pricing unit defaults as dimensions change
  useEffect(() => {
    if (editingProduct) return;
    
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
      setIsProductModalOpen(false);
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
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Admin Portal...</p>
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

      {/* Admin Nav */}
      <header className="dashboard-nav">
        <div className="logo-container" style={{ marginBottom: 0 }}>
          <div className="logo-icon" style={{ width: 32, height: 32, fontSize: '1.1rem' }}>A</div>
          <div className="logo-text" style={{ fontSize: '1.25rem' }}>AasaMedChem <span style={{ fontSize: '0.8rem', color: 'var(--primary)', verticalAlign: 'super' }}>Admin Portal</span></div>
        </div>

        <div className="nav-user-info">
          <div className="user-badge badge-admin">
            <span>Admin: {adminUser?.name}</span>
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
        <div className="tabs-container" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={16} /> User Directory</span>
          </button>
          <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={16} /> Product Directory</span>
          </button>
          <button className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> Stock Warnings</span>
          </button>
          <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ListOrdered size={16} /> Orders & Quotes</span>
          </button>
          <button className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} /> Reports & Stats</span>
          </button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={16} /> Config Settings</span>
          </button>
        </div>

        {/* Tab content rendering */}
        {activeTab === 'users' && (
          /* User Management Tab */
          <div className="glass-panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h3>Role Management & Accounts</h3>
            </div>
            <div className="panel-content">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th>Current Role</th>
                    <th>Account Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px 12px', fontWeight: 600, color: 'white' }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select 
                          value={u.role} 
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={adminUser?.id === u.id}
                          style={{ width: 'auto', padding: '6px 12px', border: '1px solid var(--border-glass)', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="SELLER">SELLER</option>
                          <option value="BUYER">BUYER</option>
                        </select>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn-remove" 
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={adminUser?.id === u.id}
                          style={{ opacity: adminUser?.id === u.id ? 0.3 : 1 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          /* Product Management Tab */
          <div className="glass-panel">
            <div className="panel-header">
              <h3>System Product Catalog</h3>
              <button className="btn-primary" onClick={() => openProductModal(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                <Plus size={16} /> Add Product
              </button>
            </div>
            <div className="panel-content">
              <div className="grid-cards">
                {products.map(product => (
                  <div key={product.id} className="glass-panel product-card">
                    <span className="product-sku">{product.sku}</span>
                    <span className="product-category">{product.category || 'General'}</span>
                    <h4 className="product-name">{product.name}</h4>
                    <p className="product-description">{product.description || 'No description provided.'}</p>
                    <div className="product-meta-row">
                      <div>
                        <span className="product-price-label">₹{Number(product.price).toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {product.priceUnit}</span>
                      </div>
                      <div>
                        <span className="product-stock-label">
                          Stock: {formatStock(product.stock, product.dimension, product.dimension === 'WEIGHT' ? 'kg' : product.dimension === 'VOLUME' ? 'L' : 'items')}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                      <button className="btn-secondary" onClick={() => openProductModal(product)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button className="btn-secondary" onClick={() => handleDeleteProduct(product.id)} style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '8px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          /* Inventory Management Tab */
          <div className="glass-panel">
            <div className="panel-header">
              <h3>Stock Alerts & Depleted Levels</h3>
            </div>
            <div className="panel-content">
              <div className="grid-cards">
                {products.filter(p => Number(p.stock) <= Number(p.minStockAlert)).length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px' }}>
                    <Check size={40} color="var(--success)" style={{ marginBottom: '15px' }} />
                    <p>All products have healthy inventory levels!</p>
                  </div>
                ) : (
                  products.filter(p => Number(p.stock) <= Number(p.minStockAlert)).map(product => {
                    const isOutOfStock = Number(product.stock) <= 0;
                    
                    return (
                      <div key={product.id} className="glass-panel product-card" style={{ border: `1px solid ${isOutOfStock ? 'var(--error)' : 'var(--warning)'}`, boxShadow: `0 4px 15px ${isOutOfStock ? 'var(--error-glow)' : 'var(--warning-glow)'}` }}>
                        <span className="product-sku">{product.sku}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span className="product-category">{product.category || 'General'}</span>
                          <span className="status-badge status-rejected" style={{ backgroundColor: isOutOfStock ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: isOutOfStock ? 'rgb(252,165,165)' : 'rgb(253,230,138)', fontSize: '0.65rem' }}>
                            {isOutOfStock ? 'Out of Stock' : 'Low Stock Warning'}
                          </span>
                        </div>
                        <h4 className="product-name">{product.name}</h4>
                        <div className="product-meta-row" style={{ marginTop: '15px' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Min Stock Alert: </span>
                            <span style={{ color: 'white', fontWeight: 600 }}>{formatStock(product.minStockAlert, product.dimension, product.dimension === 'WEIGHT' ? 'kg' : product.dimension === 'VOLUME' ? 'L' : 'items')}</span>
                          </div>
                          <div>
                            <span className="product-stock-label" style={{ color: isOutOfStock ? 'var(--error)' : 'var(--warning)' }}>
                              Stock: {formatStock(product.stock, product.dimension, product.dimension === 'WEIGHT' ? 'kg' : product.dimension === 'VOLUME' ? 'L' : 'items')}
                            </span>
                          </div>
                        </div>
                        <button className="btn-primary" onClick={() => openProductModal(product)} style={{ marginTop: '16px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-glass)', color: 'white' }}>
                          Restock Product
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          /* Orders & Quotations Tab */
          <div className="glass-panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h3>System Influx Orders</h3>
            </div>
            <div className="panel-content">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ListOrdered size={40} className="empty-state-icon" />
                  <p>No quotations have been placed yet</p>
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
                              <th>Rate Applied</th>
                              <th>Base Storage Quantity</th>
                              <th style={{ textAlign: 'right' }}>Calculated Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(item => {
                              const baseUnit = item.product.dimension === 'WEIGHT' ? 'g' : item.product.dimension === 'VOLUME' ? 'mL' : 'items';
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
                            <button className="btn-secondary" onClick={() => handleOrderStatus(order.id, 'REJECTED')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                              <X size={16} /> Reject
                            </button>
                            <button className="btn-primary" onClick={() => handleOrderStatus(order.id, 'APPROVED')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, var(--success), #059669)', boxShadow: '0 4px 12px var(--success-glow)' }}>
                              <Check size={16} /> Approve & Dispatch
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
        )}

        {activeTab === 'reports' && reports && (
          /* Reports and Analytics Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="grid-three">
              {/* Card 1: Revenue */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ padding: '15px', borderRadius: '12px', backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>
                  <DollarSign size={28} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Approved Revenue</span>
                  <h2 style={{ color: 'white', marginTop: '4px' }}>₹{reports.sales.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
                </div>
              </div>

              {/* Card 2: Inventory Value */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ padding: '15px', borderRadius: '12px', backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--primary)' }}>
                  <Database size={28} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Inventory Valuation</span>
                  <h2 style={{ color: 'white', marginTop: '4px' }}>₹{reports.inventory.totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
                </div>
              </div>

              {/* Card 3: Warnings */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ padding: '15px', borderRadius: '12px', backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--error)' }}>
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Low Stock Warning Products</span>
                  <h2 style={{ color: 'var(--error)', marginTop: '4px' }}>{reports.inventory.lowStockAlerts} items</h2>
                </div>
              </div>
            </div>

            <div className="grid-three-two">
              {/* Left Column: Sales Status Breakdown */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '20px' }}>Quotation Volume Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                      <span>Approved Orders ({reports.sales.approvedCount})</span>
                      <span style={{ fontWeight: 600 }}>{((reports.sales.approvedCount / (reports.sales.totalOrders || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(reports.sales.approvedCount / (reports.sales.totalOrders || 1)) * 100}%`, height: '100%', backgroundColor: 'var(--success)' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                      <span>Pending Orders ({reports.sales.pendingCount})</span>
                      <span style={{ fontWeight: 600 }}>{((reports.sales.pendingCount / (reports.sales.totalOrders || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(reports.sales.pendingCount / (reports.sales.totalOrders || 1)) * 100}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                      <span>Rejected/Cancelled ({reports.sales.rejectedCount + reports.sales.cancelledCount})</span>
                      <span style={{ fontWeight: 600 }}>{(((reports.sales.rejectedCount + reports.sales.cancelledCount) / (reports.sales.totalOrders || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-glass)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${((reports.sales.rejectedCount + reports.sales.cancelledCount) / (reports.sales.totalOrders || 1)) * 100}%`, height: '100%', backgroundColor: 'var(--error)' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Product SKUs</span>
                    <h3 style={{ color: 'white', marginTop: '5px' }}>{reports.inventory.totalProducts}</h3>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Registered Users</span>
                    <h3 style={{ color: 'white', marginTop: '5px' }}>{reports.users.total}</h3>
                  </div>
                </div>
              </div>

              {/* Right Column: User Roles Distribution */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '20px' }}>Registered Accounts by Role</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(219,39,119,0.15)' }}>
                    <span>Administrators (Full Access)</span>
                    <span style={{ fontWeight: 700, color: '#f472b6', fontSize: '1.1rem' }}>{reports.users.admin}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)' }}>
                    <span>Sellers (Product & Inventory)</span>
                    <span style={{ fontWeight: 700, color: '#6ee7b7', fontSize: '1.1rem' }}>{reports.users.seller}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.15)' }}>
                    <span>Buyers (Catalog Browsing & Ordering)</span>
                    <span style={{ fontWeight: 700, color: '#93c5fd', fontSize: '1.1rem' }}>{reports.users.buyer}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders List */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '15px' }}>Recent Sales Activity</h3>
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Quotation ID</th>
                    <th>Buyer Account</th>
                    <th>Total Price</th>
                    <th>Placement Date</th>
                    <th style={{ textAlign: 'right' }}>Quotation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.recentActivity.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '14px 12px', fontFamily: 'monospace' }}>{item.id.slice(0, 8)}...</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'white' }}>{item.buyerName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.buyerEmail}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{item.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td>{new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          /* General Config Settings Tab */
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <div className="panel-header">
              <h3>System Settings & Properties</h3>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Active Session Mode</label>
                <input type="text" value="JSON Web Token (JWT) Cookie" disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Database Provider</label>
                <input type="text" value="Neon Serverless PostgreSQL" disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Client Adapter version</label>
                <input type="text" value="Prisma 7.8.0" disabled />
              </div>
              <div className="form-group">
                <label className="form-label">High-Precision Calculations Decimal Scale</label>
                <input type="text" value="Decimal (28, 8)" disabled />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '20px', marginTop: '10px' }}>
                <button className="btn-primary" onClick={() => showToast('Configurations updated (placeholder)', 'success')} style={{ width: 'auto', padding: '10px 24px' }}>
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product CRUD Modal (Shared Admin) */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <div className="panel-header">
              <h3>{editingProduct ? 'Edit Product Details' : 'Create New Product'}</h3>
              <button onClick={() => setIsProductModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>×</button>
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
                      disabled={!!editingProduct}
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
                <button type="button" className="btn-secondary" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
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
