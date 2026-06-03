'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, User } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Registration failed');
          setLoading(false);
          return;
        }

        setSuccess('Account created successfully! Redirecting...');
        setTimeout(() => {
          router.push('/buyer');
          router.refresh();
        }, 1500);
      } catch (err) {
        console.error(err);
        setError('An error occurred. Please try again.');
        setLoading(false);
      }
    } else {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid credentials');
          setLoading(false);
          return;
        }

        // Redirect based on user role
        const userRole = data.user.role;
        if (userRole === 'ADMIN') {
          router.push('/admin');
        } else if (userRole === 'SELLER') {
          router.push('/seller');
        } else {
          router.push('/buyer');
        }
        router.refresh();
      } catch (err) {
        console.error(err);
        setError('An error occurred. Please try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-card glass-panel">
      <div className="logo-container" style={{ marginBottom: '20px' }}>
        <div className="logo-icon">A</div>
        <div className="logo-text">AasaMedChem</div>
      </div>

      <h1 className="auth-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
      <p className="auth-subtitle">
        {isRegister 
          ? 'Register as a Buyer to place quotations' 
          : 'Sign in to manage inventory & orders'}
      </p>

      {error && <div className="alert-error" style={{ marginBottom: '15px' }}>{error}</div>}
      {success && <div className="glass-panel" style={{ borderLeft: '4px solid var(--success)', padding: '10px', color: 'var(--success)', marginBottom: '15px', fontWeight: 600 }}>{success}</div>}

      <form onSubmit={handleSubmit}>
        {isRegister && (
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                style={{ paddingLeft: '38px' }}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isRegister ? "buyer@example.com" : "name@aasamedchem.com"}
              style={{ paddingLeft: '38px' }}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: isRegister ? '20px' : '30px' }}>
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ paddingLeft: '38px' }}
              disabled={loading}
            />
          </div>
        </div>

        {isRegister && (
          <div className="form-group" style={{ marginBottom: '30px' }}>
            <label className="form-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingLeft: '38px' }}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading 
            ? (isRegister ? 'Registering...' : 'Signing in...') 
            : (isRegister ? 'Register' : 'Sign In')}
        </button>
      </form>

      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account? ' : "Need to order? "}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
            setSuccess('');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            fontWeight: 600,
            textDecoration: 'underline',
            padding: 0
          }}
        >
          {isRegister ? 'Sign In' : 'Register as Buyer'}
        </button>
      </div>

      {!isRegister && (
        <div style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)', paddingTop: '15px' }}>
          <p style={{ fontWeight: 600, marginBottom: '5px' }}>Quick Demo Accounts:</p>
          <p>
            Admin: <span style={{ color: 'var(--text-secondary)' }}>admin@aasamedchem.com</span> (admin123)
          </p>
          <p>
            Seller: <span style={{ color: 'var(--text-secondary)' }}>seller@aasamedchem.com</span> (seller123)
          </p>
          <p>
            Buyer: <span style={{ color: 'var(--text-secondary)' }}>buyer@aasamedchem.com</span> (buyer123)
          </p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-container">
      <Suspense fallback={
        <div className="auth-card glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Authentication Portal...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
