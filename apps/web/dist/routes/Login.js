import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
export default function Login() {
    const navigate = useNavigate();
    const { user, login, error: authError, clearError } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [passkeySupported, setPasskeySupported] = useState(false);
    // Check if passkeys are supported
    useEffect(() => {
        setPasskeySupported(window.PublicKeyCredential &&
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
            window.PublicKeyCredential.isConditionalMediationAvailable);
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
        }
        catch (err) {
            console.error('Passkey registration failed:', err);
            setError(err.message || 'Failed to register passkey');
        }
        finally {
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
                    allowCredentials: response.allowCredentials.map((cred) => ({
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
        }
        catch (err) {
            console.error('Passkey login failed:', err);
            setError(err.message || 'Failed to authenticate with passkey');
        }
        finally {
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
        }
        catch (err) {
            console.error('Dev login failed:', err);
            setError(err.message || 'Dev login failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleDisplayNameChange = (e) => {
        setDisplayName(e.target.value);
        // Clear errors when user types
        if (error)
            setError('');
        if (authError)
            clearError();
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-6", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-4xl font-bold text-gray-900 mb-2", children: "Welcome Back" }), _jsx("p", { className: "text-gray-600", children: "Sign in to your QuickStage account" })] }), _jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-8", children: [passkeySupported && (_jsxs("div", { className: "mb-6", children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center", children: [_jsx("svg", { className: "w-5 h-5 mr-2 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" }) }), "Passkey Authentication"] }), _jsx("div", { className: "mb-4", children: _jsx("input", { type: "text", placeholder: "Display name", value: displayName, onChange: handleDisplayNameChange, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" }) }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx("button", { onClick: () => setAuthMode('register'), className: `flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${authMode === 'register'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: "Register" }), _jsx("button", { onClick: () => setAuthMode('login'), className: `flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${authMode === 'login'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: "Login" })] }), _jsx("button", { onClick: authMode === 'register' ? handlePasskeyRegister : handlePasskeyLogin, disabled: isLoading || !displayName.trim(), className: "w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: isLoading ? 'Processing...' : authMode === 'register' ? 'Register Passkey' : 'Login with Passkey' })] })), passkeySupported && (_jsxs("div", { className: "relative mb-6", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-gray-300" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-2 bg-white text-gray-500", children: "or" }) })] })), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 mb-3", children: "Development" }), _jsx("button", { onClick: handleDevLogin, disabled: isLoading, className: "w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: isLoading ? 'Loading...' : 'Dev Login' }), _jsx("p", { className: "text-xs text-gray-500 mt-2 text-center", children: "For development and testing only" })] }), (error || authError) && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4", children: error || authError })), _jsx("div", { className: "text-center mt-6", children: _jsx("button", { onClick: () => navigate('/'), className: "text-blue-600 hover:text-blue-700 text-sm font-medium", children: "\u2190 Back to landing page" }) })] })] }) }));
}
