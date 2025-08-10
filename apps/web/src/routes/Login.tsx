import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const { user, login, error: authError, clearError } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [passkeySupported, setPasskeySupported] = useState(false);

  // Check if passkeys are supported
  useEffect(() => {
    setPasskeySupported(
      window.PublicKeyCredential &&
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      window.PublicKeyCredential.isConditionalMediationAvailable
    );
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

  const handlePasskeyRegister = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Start passkey registration
      const response = await api.post('/auth/register-passkey/begin', {
        displayName: displayName.trim()
      });
      
      // Convert challenge to ArrayBuffer
      const challenge = Uint8Array.from(atob(response.challenge), c => c.charCodeAt(0));
      
      // Create credentials
      const credential = await navigator.credentials.create({
        publicKey: {
          ...response,
          challenge,
          user: {
            ...response.user,
            id: Uint8Array.from(atob(response.user.id), c => c.charCodeAt(0))
          }
        }
      });
      
      if (!credential) {
        throw new Error('Failed to create passkey');
      }
      
      // Send credential to server
      await api.post('/auth/register-passkey/finish', {
        displayName: displayName.trim(),
        response: credential
      });
      
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
      const response = await api.post('/auth/login-passkey/begin', {
        displayName: displayName.trim()
      });
      
      // Convert challenge to ArrayBuffer
      const challenge = Uint8Array.from(atob(response.challenge), c => c.charCodeAt(0));
      
      // Get credentials
      const credential = await navigator.credentials.get({
        publicKey: {
          ...response,
          challenge,
          allowCredentials: response.allowCredentials.map((cred: any) => ({
            ...cred,
            id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0))
          }))
        }
      });
      
      if (!credential) {
        throw new Error('Failed to authenticate with passkey');
      }
      
      // Send credential to server
      await api.post('/auth/login-passkey/finish', {
        displayName: displayName.trim(),
        response: credential
      });
      
      // Success - user should now be authenticated
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Passkey login failed:', err);
      setError(err.message || 'Failed to authenticate with passkey');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Generate a simple UID for dev login
      const uid = `dev-${Date.now()}`;
      await login(uid);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Dev login failed:', err);
      setError(err.message || 'Dev login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
    // Clear errors when user types
    if (error) setError('');
    if (authError) clearError();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your QuickStage account</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Passkey Section */}
          {passkeySupported && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Passkey Authentication
              </h2>
              
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={handleDisplayNameChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    authMode === 'register'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Register
                </button>
                
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    authMode === 'login'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Login
                </button>
              </div>
              
              <button
                onClick={authMode === 'register' ? handlePasskeyRegister : handlePasskeyLogin}
                disabled={isLoading || !displayName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Processing...' : authMode === 'register' ? 'Register Passkey' : 'Login with Passkey'}
              </button>
            </div>
          )}

          {/* Divider */}
          {passkeySupported && (
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
          )}

          {/* Dev Login */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Development</h3>
            <button
              onClick={handleDevLogin}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'Loading...' : 'Dev Login'}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              For development and testing only
            </p>
          </div>

          {/* Error Display */}
          {(error || authError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error || authError}
            </div>
          )}

          {/* Back to Landing */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to landing page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
