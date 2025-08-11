import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Google API types
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { 
    user, 
    loginWithEmailPassword, 
    loginWithGoogle, 
    registerWithEmailPassword,
    error: authError, 
    clearError 
  } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [showPasskeySection, setShowPasskeySection] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Check if passkeys are supported
  useEffect(() => {
    const checkPasskeySupport = async () => {
      try {
        const isSupported = window.PublicKeyCredential &&
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
          typeof window.PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
          await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() &&
          await window.PublicKeyCredential.isConditionalMediationAvailable();
        
        setPasskeySupported(!!isSupported);
      } catch (error) {
        console.warn('Passkey support check failed:', error);
        setPasskeySupported(false);
      }
    };
    
    checkPasskeySupport();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Clear errors when switching modes
  useEffect(() => {
    clearError();
    setError('');
  }, [authMode, clearError]);

  const handleEmailPasswordAuth = async () => {
    if (authMode === 'register' && (!email || !password || !name)) {
      setError('Please fill in all fields');
      return;
    }
    
    if (authMode === 'login' && (!email || !password)) {
      setError('Please enter email and password');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      if (authMode === 'register') {
        await registerWithEmailPassword(email.trim(), password, name.trim());
      } else {
        await loginWithEmailPassword(email.trim(), password);
      }
      // Success - user should now be authenticated and redirected
    } catch (err: any) {
      console.error('Authentication failed:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Initialize Google Sign-In
      if (typeof window !== 'undefined' && window.google) {
        const google = window.google;
        const client = google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id',
          scope: 'email profile',
          callback: async (response) => {
            if (response.access_token) {
              try {
                // Get user info from Google
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                  headers: {
                    Authorization: `Bearer ${response.access_token}`,
                  },
                });
                
                if (userInfoResponse.ok) {
                  const userInfo = await userInfoResponse.json();
                  // For now, we'll use the access token as the ID token
                  // In production, you might want to exchange this for an ID token
                  await loginWithGoogle(response.access_token);
                }
              } catch (err: any) {
                console.error('Failed to get user info:', err);
                setError('Failed to authenticate with Google');
              }
            }
          },
        });
        
        client.requestAccessToken();
      } else {
        // Fallback for when Google API is not loaded
        setError('Google authentication is not available. Please try again later.');
      }
    } catch (err: any) {
      console.error('Google authentication failed:', err);
      setError('Google authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Start passkey registration
      const response = await fetch('/api/auth/register-passkey/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: displayName.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start passkey registration');
      }
      
      const data = await response.json();
      
      // Convert challenge to ArrayBuffer
      const challenge = Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0));
      
      // Create credentials
      const credential = await navigator.credentials.create({
        publicKey: {
          ...data,
          challenge,
          user: {
            ...data.user,
            id: Uint8Array.from(atob(data.user.id), c => c.charCodeAt(0))
          }
        }
      });
      
      if (!credential) {
        throw new Error('Failed to create passkey');
      }
      
      // Send credential to server
      const finishResponse = await fetch('/api/auth/register-passkey/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: displayName.trim(),
          response: credential
        })
      });
      
      if (!finishResponse.ok) {
        throw new Error('Failed to complete passkey registration');
      }
      
      // Success - user should now be authenticated
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Passkey registration failed:', err);
      setError(err.message || 'Failed to register passkey');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Start passkey authentication
      const response = await fetch('/api/auth/login-passkey/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: displayName.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start passkey authentication');
      }
      
      const data = await response.json();
      
      // Convert challenge to ArrayBuffer
      const challenge = Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0));
      
      // Get credentials
      const credential = await navigator.credentials.get({
        publicKey: {
          ...data,
          challenge,
          allowCredentials: data.allowCredentials.map((cred: any) => ({
            ...cred,
            id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0))
          }))
        }
      });
      
      if (!credential) {
        throw new Error('Failed to authenticate with passkey');
      }
      
      // Send credential to server
      const finishResponse = await fetch('/api/auth/login-passkey/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: displayName.trim(),
          response: credential
        })
      });
      
      if (!finishResponse.ok) {
        throw new Error('Failed to complete passkey authentication');
      }
      
      // Success - user should now be authenticated
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Passkey login failed:', err);
      setError(err.message || 'Failed to authenticate with passkey');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
      case 'name':
        setName(value);
        break;
      case 'displayName':
        setDisplayName(value);
        break;
    }
    // Clear errors when user types
    if (error) setError('');
    if (authError) clearError();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {authMode === 'register' ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {authMode === 'register' 
              ? 'Sign up for QuickStage to start sharing your prototypes' 
              : 'Sign in to your QuickStage account'
            }
          </p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Email/Password Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {authMode === 'register' ? 'Create Account' : 'Sign In'}
            </h2>
            
            {authMode === 'register' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            
            <button
              onClick={handleEmailPasswordAuth}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                authMode === 'register' ? 'Create Account' : 'Sign In'
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">or</span>
            </div>
          </div>

          {/* Google OAuth */}
          <div className="mb-6">
            <button
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Passkey Section Toggle */}
          {passkeySupported && (
            <div className="mb-6">
              <button
                onClick={() => setShowPasskeySection(!showPasskeySection)}
                className="w-full text-blue-600 hover:text-blue-700 font-medium py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {showPasskeySection ? 'Hide' : 'Show'} Passkey Authentication
              </button>
            </div>
          )}

          {/* Passkey Section */}
          {passkeySupported && showPasskeySection && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Passkey Authentication
              </h3>
              
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Display name for passkey"
                  value={displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-colors ${
                    authMode === 'register'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Register
                </button>
                
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-colors ${
                    authMode === 'login'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Login
                </button>
              </div>
              
              <button
                onClick={authMode === 'register' ? handlePasskeyRegister : handlePasskeyLogin}
                disabled={isLoading || !displayName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
              >
                {isLoading ? 'Processing...' : authMode === 'register' ? 'Register Passkey' : 'Login with Passkey'}
              </button>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="text-center mb-6">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline transition-colors duration-200"
            >
              {authMode === 'login' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'
              }
            </button>
          </div>

          {/* Error Display */}
          {(error || authError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error || authError}
            </div>
          )}

          {/* Back to Landing */}
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-700 text-sm font-medium hover:underline transition-colors duration-200 flex items-center justify-center mx-auto"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to landing page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
