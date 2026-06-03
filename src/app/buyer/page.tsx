'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, LogOut, Package, History, Check, AlertCircle, Trash2 } from 'lucide-react';
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
}

interface CartItem {
  product: Product;
  orderedQuantity: number;
  orderedUnit: Unit;
  calculatedPrice: number;
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
  items: OrderItem[];
}

export default function BuyerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dimensionFilter, setDimensionFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Selected product for ordering
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [orderUnit, setOrderUnit] = useState<Unit>('items');
  const [livePrice, setLivePrice] = useState<number>(0);
  const [orderError, setOrderError] = useState('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Orders history state
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'orders'>('browse');

  const [loading, setLoading] = useState(true);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch session, products, and order history
  useEffect(() => {
    async function initDashboard() {
      try {
        const userRes = await fetch('/api/auth/me');
        const userData = await userRes.json();
        if (!userData.user) {
          router.push('/login');
          return;
        }
        setUser(userData.user);

        await refreshProducts();
        await refreshOrders();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, []);

  // Update categories and products list
  const refreshProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.products) {
      setProducts(data.products);
      
      // Extract unique categories
      const uniqueCats: string[] = Array.from(
        new Set(data.products.map((p: Product) => p.category).filter(Boolean))
      ) as string[];
      setCategories(uniqueCats);
    }
  };

  const refreshOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    if (data.orders) {
      setOrders(data.orders);
    }
  };

  // Run price calculation in the UI on input change
  useEffect(() => {
    if (!selectedProduct) return;

    // Helper for base conversions
    const toBase = (qty: number, unit: Unit): number => {
      return (unit === 'kg' || unit === 'L') ? qty * 1000 : qty;
    };

    const baseQty = toBase(orderQuantity, orderUnit);
    const priceUnitFactor = toBase(1, selectedProduct.priceUnit);
    
    // Price rate per base unit (e.g. price per mL or price per g)
    const ratePerBase = Number(selectedProduct.price) / priceUnitFactor;
    
    const total = baseQty * ratePerBase;
    setLivePrice(isNaN(total) || total < 0 ? 0 : total);

    // Verify stock availability alert
    if (baseQty > Number(selectedProduct.stock)) {
      setOrderError(`Warning: Requested quantity (${orderQuantity} ${orderUnit}) exceeds available stock (${formatStock(selectedProduct.stock, selectedProduct.dimension, orderUnit)}).`);
    } else {
      setOrderError('');
    }
  }, [orderQuantity, orderUnit, selectedProduct]);

  // Handle product click to open ordering panel
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setOrderQuantity(1);
    
    // Set default unit based on product dimension
    if (product.dimension === 'WEIGHT') setOrderUnit('kg');
    else if (product.dimension === 'VOLUME') setOrderUnit('L');
    else setOrderUnit('items');
    
    setOrderError('');
  };

  const formatStock = (stockInBase: number | string, dimension: Dimension, displayUnit: Unit) => {
    const stockVal = Number(stockInBase);
    if (isNaN(stockVal)) return '0';
    if (dimension === 'WEIGHT') {
      if (displayUnit === 'kg') return `${(stockVal / 1000).toFixed(4)} kg`;
      return `${stockVal.toFixed(2)} g`;
    }
    if (dimension === 'VOLUME') {
      if (displayUnit === 'L') return `${(stockVal / 1000).toFixed(4)} L`;
      return `${stockVal.toFixed(2)} mL`;
    }
    return `${stockVal} items`;
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    if (orderQuantity <= 0) return;

    // Verify stock one more time
    const toBase = (qty: number, unit: Unit): number => {
      return (unit === 'kg' || unit === 'L') ? qty * 1000 : qty;
    };
    const reqBase = toBase(orderQuantity, orderUnit);
    if (reqBase > Number(selectedProduct.stock)) {
      showToast('Cannot add to cart: insufficient stock.', 'error');
      return;
    }

    const newItem: CartItem = {
      product: selectedProduct,
      orderedQuantity: orderQuantity,
      orderedUnit: orderUnit,
      calculatedPrice: livePrice,
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
    showToast(`${selectedProduct.name} added to cart!`, 'success');
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setSubmittingOrder(true);

    try {
      const orderItems = cart.map(item => ({
        productId: item.product.id,
        orderedQuantity: item.orderedQuantity,
        orderedUnit: item.orderedUnit,
      }));

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: orderItems }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to place order', 'error');
        setSubmittingOrder(false);
        return;
      }

      showToast('Order placed successfully!', 'success');
      setCart([]);
      await refreshProducts();
      await refreshOrders();
      setActiveTab('orders');
    } catch (err) {
      console.error(err);
      showToast('An error occurred while placing your order', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Filters application
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.sku.toLowerCase().includes(search.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    const matchesDimension = dimensionFilter ? p.dimension === dimensionFilter : true;

    return matchesSearch && matchesCategory && matchesDimension;
  });

  const cartTotal = cart.reduce((acc, item) => acc + item.calculatedPrice, 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Toast Notification */}
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
            <AlertCircle size={20} color="var(--error)" />
          )}
          <span style={{ fontWeight: 600 }}>{notification.message}</span>
        </div>
      )}

      {/* Header Nav */}
      <header className="dashboard-nav">
        <div className="logo-container" style={{ marginBottom: 0 }}>
          <div className="logo-icon" style={{ width: 32, height: 32, fontSize: '1.1rem' }}>A</div>
          <div className="logo-text" style={{ fontSize: '1.25rem' }}>AasaMedChem <span style={{ fontSize: '0.8rem', color: 'var(--primary)', verticalAlign: 'super' }}>Buyer Portal</span></div>
        </div>

        <div className="nav-user-info">
          <div className="user-badge badge-seller" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'rgb(147, 197, 253)' }}>
            <span>Buyer: {user?.name}</span>
          </div>
          <button className="nav-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Navigation Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} />
              Browse & Request Quotes
            </span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} />
              My Quotation Orders
            </span>
          </button>
        </div>

        {activeTab === 'browse' ? (
          <div className="grid-three-two">
            {/* Left Side: Product Browser */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ marginBottom: '15px' }}>Search Chemicals & Products</h3>
                <div className="filters-bar">
                  <div style={{ position: 'relative' }}>
                    <Search 
                      size={18} 
                      style={{ 
                        position: 'absolute', 
                        left: '12px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: 'var(--text-muted)' 
                      }} 
                    />
                    <input 
                      type="text" 
                      placeholder="Search SKU, name, chemical details..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ paddingLeft: '38px' }}
                    />
                  </div>
                  
                  <select 
                    value={categoryFilter} 
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select 
                    value={dimensionFilter} 
                    onChange={(e) => setDimensionFilter(e.target.value)}
                  >
                    <option value="">All Dimensions</option>
                    <option value="WEIGHT">Weight</option>
                    <option value="VOLUME">Volume</option>
                    <option value="COUNT">Count</option>
                  </select>
                </div>
              </div>

              {/* Product Listing */}
              <div className="grid-cards">
                {filteredProducts.length === 0 ? (
                  <div className="glass-panel empty-state" style={{ gridColumn: '1 / -1' }}>
                    <AlertCircle className="empty-state-icon" />
                    <p>No products match your filters</p>
                  </div>
                ) : (
                  filteredProducts.map(product => {
                    const isOutOfStock = Number(product.stock) <= 0;

                    return (
                      <div key={product.id} className="glass-panel product-card">
                        <span className="product-sku">{product.sku}</span>
                        {product.category && (
                          <span className="product-category">{product.category}</span>
                        )}
                        <h4 className="product-name">{product.name}</h4>
                        <p className="product-description">{product.description || 'No description provided.'}</p>
                        
                        <div className="product-meta-row">
                          <div>
                            <span className="product-price-label">₹{Number(product.price).toLocaleString('en-IN')}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {product.priceUnit}</span>
                          </div>
                          <div>
                            {isOutOfStock ? (
                              <span className="stock-alert">Out of Stock</span>
                            ) : (
                              <span className="product-stock-label">
                                In Stock: {formatStock(product.stock, product.dimension, product.dimension === 'WEIGHT' ? 'kg' : product.dimension === 'VOLUME' ? 'L' : 'items')}
                              </span>
                            )}
                          </div>
                        </div>

                        <button 
                          className="card-action-btn"
                          onClick={() => handleSelectProduct(product)}
                          disabled={isOutOfStock}
                        >
                          Configure Order
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Side: Configuration & Cart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 30, position: 'sticky', top: '100px', height: 'fit-content' }}>
              {/* Active Product Order Setup */}
              {selectedProduct ? (
                <div className="glass-panel" style={{ border: '1px solid var(--primary)', boxShadow: `0 4px 20px var(--primary-glow)` }}>
                  <div className="panel-header">
                    <h3>Configure Order</h3>
                    <button 
                      onClick={() => setSelectedProduct(null)} 
                      style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.2rem' }}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4 style={{ color: 'white' }}>{selectedProduct.name}</h4>
                      <span className="product-sku">{selectedProduct.sku}</span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Base Rate: <span style={{ color: 'white', fontWeight: 600 }}>₹{selectedProduct.price}</span> per {selectedProduct.priceUnit}
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Available Stock: <span style={{ color: 'white', fontWeight: 600 }}>
                        {formatStock(selectedProduct.stock, selectedProduct.dimension, orderUnit)}
                      </span>
                    </div>

                    <div className="form-grid">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Order Quantity</label>
                        <input 
                          type="number" 
                          step="any"
                          min="0.00000001"
                          value={orderQuantity} 
                          onChange={(e) => setOrderQuantity(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Unit of Measure</label>
                        <select 
                          value={orderUnit} 
                          onChange={(e) => setOrderUnit(e.target.value as Unit)}
                        >
                          {selectedProduct.dimension === 'WEIGHT' && (
                            <>
                              <option value="kg">Kilograms (kg)</option>
                              <option value="g">Grams (g)</option>
                            </>
                          )}
                          {selectedProduct.dimension === 'VOLUME' && (
                            <>
                              <option value="L">Liters (L)</option>
                              <option value="mL">Milliliters (mL)</option>
                            </>
                          )}
                          {selectedProduct.dimension === 'COUNT' && (
                            <option value="items">Items (count)</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {orderError && (
                      <div style={{ color: 'var(--error)', fontSize: '0.85rem', fontWeight: 500 }}>
                        {orderError}
                      </div>
                    )}

                    <div className="conversion-breakdown">
                      Pricing Math breakdown (Automatic Conversion):
                      {orderUnit !== selectedProduct.priceUnit ? (
                        <>
                          - Ordered Quantity: {orderQuantity} {orderUnit}
                          - Converted Base: {orderUnit === 'kg' || orderUnit === 'L' ? `${orderQuantity * 1000} base units` : `${orderQuantity} base units`}
                          - Configured pricing rate: ₹{selectedProduct.price} per {selectedProduct.priceUnit} (₹{selectedProduct.priceUnit === 'kg' || selectedProduct.priceUnit === 'L' ? Number(selectedProduct.price) / 1000 : selectedProduct.price} per base unit)
                        </>
                      ) : (
                        `- Directly calculated: Rate is matching order unit.`
                      )}
                      - Estimated Total Price: ₹{livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid var(--border-glass)' }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculated Total</span>
                        <h3 style={{ color: 'var(--success)' }}>₹{livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={addToCart}
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Cart Container */}
              <div className="glass-panel">
                <div className="panel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShoppingCart size={20} />
                    <h3>Your Selection Cart</h3>
                  </div>
                  <span className="user-badge" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                    {cart.length} items
                  </span>
                </div>

                <div className="panel-content">
                  {cart.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px' }}>
                      <ShoppingCart size={24} style={{ color: 'var(--text-muted)' }} />
                      <p>Your cart is empty.</p>
                      <p style={{ fontSize: '0.8rem' }}>Browse products and configure quantities to place a quotation.</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                        {cart.map((item, index) => (
                          <div key={index} className="cart-item">
                            <div className="cart-item-details">
                              <span className="cart-item-name">{item.product.name}</span>
                              <span className="cart-item-subtext">
                                {item.orderedQuantity} {item.orderedUnit} @ ₹{item.product.price}/{item.product.priceUnit}
                              </span>
                            </div>
                            <div className="cart-item-actions">
                              <span className="cart-item-price">₹{item.calculatedPrice.toFixed(2)}</span>
                              <button className="btn-remove" onClick={() => removeFromCart(index)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="cart-summary">
                        <div className="cart-summary-row">
                          <span>Subtotal Valuation</span>
                          <span className="cart-total-price">₹{cartTotal.toFixed(2)}</span>
                        </div>
                        <button 
                          className="btn-primary" 
                          onClick={handlePlaceOrder}
                          disabled={submittingOrder}
                          style={{ width: '100%', marginTop: '10px' }}
                        >
                          {submittingOrder ? 'Placing Quotation...' : 'Submit Quotation Request'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Order History Screen */
          <div className="glass-panel" style={{ width: '100%' }}>
            <div className="panel-header">
              <h3>My Submitted Quotations & Order History</h3>
            </div>
            
            <div className="panel-content">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <History size={40} className="empty-state-icon" />
                  <p>You have not placed any orders yet</p>
                </div>
              ) : (
                <div className="order-list">
                  {orders.map(order => (
                    <div key={order.id} className="glass-panel order-card">
                      <div className="order-header">
                        <div className="order-meta">
                          <span>Quotation ID: <span className="order-id">{order.id.slice(0, 8)}...</span></span>
                          <span>Placed: {new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{Number(order.totalPrice).toFixed(2)}</span>
                          <span className={`status-badge status-${order.status.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="order-body">
                        <table className="order-items-table">
                           <thead>
                             <tr>
                               <th>Product SKU & Name</th>
                               <th>Ordered Qty / Unit</th>
                               <th>Rate Applied</th>
                               <th>Converted Base Qty</th>
                               <th style={{ textAlign: 'right' }}>Calculated Price</th>
                             </tr>
                           </thead>
                           <tbody>
                             {order.items.map(item => {
                               const baseUnit = item.product.dimension === 'WEIGHT' ? 'g' : item.product.dimension === 'VOLUME' ? 'mL' : 'items';
                               return (
                                 <tr key={item.id}>
                                   <td>
                                     <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                                     <div className="product-sku">{item.product.sku}</div>
                                   </td>
                                   <td>{item.orderedQuantity} {item.orderedUnit}</td>
                                   <td>₹{item.priceAtOrder} / {item.priceUnitAtOrder}</td>
                                   <td>{item.baseQuantity} {baseUnit}</td>
                                   <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(item.calculatedPrice).toFixed(2)}</td>
                                 </tr>
                               );
                             })}
                           </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
