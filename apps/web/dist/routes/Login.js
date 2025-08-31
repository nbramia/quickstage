import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import '../fonts.css';
export default function Login() {
    const navigate = useNavigate();
    const { user, loginWithEmailPassword, loginWithGoogle, registerWithEmailPassword, error: authError, clearError } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [authMode, setAuthMode] = useState('login');
    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    // Redirect if already authenticated
    useEffect(() => {
        if (user) {
            // Check if user came from pricing page with a plan selection
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');
            const plan = urlParams.get('plan');
            if (redirect === 'pricing' && plan) {
                // Redirect back to pricing page to complete subscription
                navigate(`/pricing?plan=${plan}`);
            }
            else {
                navigate('/dashboard');
            }
        }
    }, [user, navigate]);
    // Track page view
    useEffect(() => {
        const trackPageView = async () => {
            try {
                await api.post('/analytics/track', {
                    eventType: 'page_view',
                    eventData: { page: 'Login/Signup' }
                });
            }
            catch (error) {
                console.error('Failed to track page view:', error);
            }
        };
        trackPageView();
    }, []);
    // Check URL parameters for initial auth mode
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        if (mode === 'signup') {
            setAuthMode('register');
        }
    }, []);
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
            }
            else {
                await loginWithEmailPassword(email.trim(), password);
            }
            // Success - user should now be authenticated and redirected
        }
        catch (err) {
            console.error('Authentication failed:', err);
            setError(err.message || 'Authentication failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleGoogleAuth = async () => {
        setIsLoading(true);
        setError('');
        try {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId) {
                setError('Google OAuth is not configured. Please set VITE_GOOGLE_CLIENT_ID.');
                return;
            }
            // Initialize Google Sign-In
            if (typeof window !== 'undefined' && window.google) {
                const google = window.google;
                const client = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
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
                            }
                            catch (err) {
                                console.error('Failed to get user info:', err);
                                setError('Failed to authenticate with Google');
                            }
                        }
                    },
                });
                client.requestAccessToken();
            }
            else {
                // Fallback for when Google API is not loaded
                setError('Google authentication is not available. Please try again later.');
            }
        }
        catch (err) {
            console.error('Google authentication failed:', err);
            setError('Google authentication failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleInputChange = (field, value) => {
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
        }
        // Clear errors when user types
        if (error)
            setError('');
        if (authError)
            clearError();
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12 font-poppins", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "mb-4", children: _jsx("div", { className: "w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }) }), _jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2 font-inconsolata", children: authMode === 'register' ? 'Create Account' : 'Welcome Back' }), _jsx("p", { className: "text-gray-600", children: authMode === 'register'
                                ? 'Sign up for QuickStage to start sharing your prototypes'
                                : 'Sign in to your QuickStage account' })] }), _jsxs("div", { className: "bg-white rounded-2xl shadow-xl border border-gray-100 p-8", children: [_jsxs("div", { className: "mb-6", children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center font-inconsolata", children: [_jsx("svg", { className: "w-5 h-5 mr-2 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }), authMode === 'register' ? 'Create Account' : 'Sign In'] }), authMode === 'register' && (_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Full Name" }), _jsx("input", { type: "text", placeholder: "Enter your full name", value: name, onChange: (e) => handleInputChange('name', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" })] })), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email Address" }), _jsx("input", { type: "email", placeholder: "Enter your email", value: email, onChange: (e) => handleInputChange('email', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", placeholder: "Enter your password", value: password, onChange: (e) => handleInputChange('password', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" })] }), _jsx("button", { onClick: handleEmailPasswordAuth, disabled: isLoading, className: "w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none", children: isLoading ? (_jsxs("div", { className: "flex items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" }), "Processing..."] })) : (authMode === 'register' ? 'Create Account' : 'Sign In') })] }), _jsxs("div", { className: "relative mb-6", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-gray-200" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-4 bg-white text-gray-500 font-medium", children: "or" }) })] }), _jsx("div", { className: "mb-6", children: _jsxs("button", { onClick: handleGoogleAuth, disabled: isLoading, className: "w-full bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none flex items-center justify-center", children: [_jsxs("svg", { className: "w-5 h-5 mr-3", viewBox: "0 0 24 24", children: [_jsx("path", { fill: "#4285F4", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { fill: "#34A853", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { fill: "#FBBC05", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { fill: "#EA4335", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), "Continue with Google"] }) }), _jsx("div", { className: "text-center mb-6", children: _jsx("button", { onClick: () => setAuthMode(authMode === 'login' ? 'register' : 'login'), className: "text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline transition-colors duration-200", children: authMode === 'login'
                                    ? "Don't have an account? Sign up"
                                    : 'Already have an account? Sign in' }) }), (error || authError) && (_jsxs("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center", children: [_jsx("svg", { className: "w-5 h-5 mr-2 text-red-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), error || authError] })), _jsx("div", { className: "text-center", children: _jsxs("button", { onClick: () => navigate('/'), className: "text-gray-600 hover:text-gray-700 text-sm font-medium hover:underline transition-colors duration-200 flex items-center justify-center mx-auto", children: [_jsx("svg", { className: "w-4 h-4 mr-1", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 19l-7-7m0 0l7-7m-7 7h18" }) }), "Back to landing page"] }) })] })] }) }));
}
