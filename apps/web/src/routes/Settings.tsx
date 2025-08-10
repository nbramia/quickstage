import React, { useEffect, useState } from 'react';

type UserPlan = 'free' | 'pro';
type UserInfo = {
  uid: string;
  plan: UserPlan;
  createdAt: number;
  lastLoginAt?: number;
  passkeys?: Array<{
    id: string;
    publicKey: string;
    counter: number;
    transports?: string[];
  }>;
};

export function Settings() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        setError(null);
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData.user);
        } else {
          setError('Failed to fetch user data');
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setError('Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      setError(null);
      const response = await fetch('/api/billing/checkout', { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        } else {
          setError('No checkout URL received');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setError('Checkout failed');
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = () => {
    // Clear session by setting cookie to expired
    document.cookie = 'ps_sess=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '40px 20px' }}>
        <div>Loading settings...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Please log in to view settings</h2>
          <p>You need to be authenticated to access your account settings.</p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const planDetails = {
    free: {
      name: 'Free Plan',
      snapshots: '10 active snapshots',
      size: '20 MB per snapshot',
      fileSize: '5 MB per file',
      expiry: '7 days (1-14 configurable)',
      views: '1,000 views/month',
      price: 'Free',
      features: ['Basic snapshot hosting', 'Password protection', 'Comments system', '7-day expiry']
    },
    pro: {
      name: 'Pro Plan',
      snapshots: 'Unlimited snapshots',
      size: '100 MB per snapshot',
      fileSize: '25 MB per file',
      expiry: '30 days (1-90 configurable)',
      views: '10,000 views/month',
      price: '$9.99/month',
      features: ['Unlimited snapshots', 'Larger file sizes', 'Extended expiry', 'Priority support', 'Advanced analytics']
    }
  };

  const currentPlan = planDetails[user.plan];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, -apple-system' }}>
      {/* Navigation Header */}
      <div style={{ 
        borderBottom: '1px solid #ddd', 
        padding: '20px 0', 
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <nav style={{ display: 'flex', gap: '16px' }}>
          <a 
            href="/" 
            style={{ 
              color: '#666', 
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            Dashboard
          </a>
          <a 
            href="/app/settings" 
            style={{ 
              color: '#2563eb', 
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              backgroundColor: '#f0f8ff'
            }}
          >
            Settings
          </a>
        </nav>
      </div>

      {error && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#fee2e2', 
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
          marginBottom: '24px'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: 32 }}>
        <h2>Account</h2>
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '8px',
          border: '1px solid #eee'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'center' }}>
            <strong>User ID:</strong>
            <code style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{user.uid}</code>
            <strong>Created:</strong>
            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            {user.lastLoginAt && (
              <>
                <strong>Last Login:</strong>
                <span>{new Date(user.lastLoginAt).toLocaleDateString()}</span>
              </>
            )}
            <strong>Passkeys:</strong>
            <span>{user.passkeys?.length || 0} registered</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2>Current Plan: {currentPlan.name}</h2>
        <div style={{ 
          padding: '20px', 
          border: '2px solid #ddd', 
          borderRadius: '12px',
          backgroundColor: user.plan === 'pro' ? '#f0f8ff' : '#f9f9f9',
          borderColor: user.plan === 'pro' ? '#2563eb' : '#ddd'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <strong>Snapshots:</strong>
            <span>{currentPlan.snapshots}</span>
            <strong>Snapshot Size:</strong>
            <span>{currentPlan.size}</span>
            <strong>File Size Limit:</strong>
            <span>{currentPlan.fileSize}</span>
            <strong>Expiry:</strong>
            <span>{currentPlan.expiry}</span>
            <strong>Monthly Views:</strong>
            <span>{currentPlan.views}</span>
            <strong>Price:</strong>
            <span style={{ fontWeight: 'bold', color: user.plan === 'pro' ? '#2563eb' : '#059669' }}>
              {currentPlan.price}
            </span>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <strong>Features:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              {currentPlan.features.map((feature, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {user.plan === 'free' && (
        <div style={{ marginBottom: 32 }}>
          <h2>Upgrade to Pro</h2>
          <p style={{ color: '#666', marginBottom: '16px' }}>
            Get unlimited snapshots, larger file sizes, extended expiry, and priority support.
          </p>
          <button 
            onClick={handleUpgrade}
            disabled={upgrading}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: upgrading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: upgrading ? 'not-allowed' : 'pointer',
              opacity: upgrading ? 0.6 : 1
            }}
          >
            {upgrading ? 'Processing...' : 'Upgrade to Pro - $9.99/month'}
          </button>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <h2>API Access</h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Use your QuickStage extension to stage projects directly from VS Code.
        </p>
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '8px' }}>Extension Command: <code style={{ backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>QuickStage: Stage</code></div>
          <div style={{ marginBottom: '8px' }}>API Base: <code style={{ backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>https://quickstage.tech/api</code></div>
          <div>Authentication: Session cookies or Bearer token</div>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2>Support</h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Need help? Contact our support team.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a 
            href="mailto:support@quickstage.tech"
            style={{ 
              color: '#2563eb', 
              textDecoration: 'none',
              padding: '8px 16px',
              border: '1px solid #2563eb',
              borderRadius: '4px'
            }}
          >
            Email Support
          </a>
          <a 
            href="https://docs.quickstage.tech"
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: '#2563eb', 
              textDecoration: 'none',
              padding: '8px 16px',
              border: '1px solid #2563eb',
              borderRadius: '4px'
            }}
          >
            Documentation
          </a>
        </div>
      </div>

      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h2>Account Actions</h2>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button 
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
          <span style={{ color: '#666', fontSize: '14px' }}>
            Clear your session and return to the dashboard
          </span>
        </div>
      </div>
    </div>
  );
}
