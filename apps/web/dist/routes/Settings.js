import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, adminApi } from '../api';
import '../fonts.css';
export function Settings() {
    const navigate = useNavigate();
    const { user, logout, loading: authLoading, cancelSubscription } = useAuth();
    const [upgrading, setUpgrading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    // Debug logging
    useEffect(() => {
        console.log('Settings - Current user object:', user);
        console.log('Settings - User subscription details:', {
            plan: user?.plan,
            subscriptionStatus: user?.subscriptionStatus,
            subscriptionDisplay: user?.subscriptionDisplay,
            canAccessPro: user?.canAccessPro,
            role: user?.role
        });
    }, [user]);
    // Track page view
    useEffect(() => {
        const trackPageView = async () => {
            try {
                await api.post('/analytics/track', {
                    eventType: 'page_view',
                    eventData: { page: 'Settings' }
                });
            }
            catch (error) {
                console.error('Failed to track page view:', error);
            }
        };
        trackPageView();
    }, []);
    const handleUpgrade = () => {
        // Navigate to pricing page to select plan
        const mode = (user?.subscription?.status || user?.subscriptionStatus) === 'trial' ? 'upgrade' : 'trial';
        navigate(`/pricing?mode=${mode}`);
    };
    const handleManageBilling = async () => {
        try {
            setError(null);
            const response = await api.post('/billing/portal');
            if (response.url) {
                window.location.href = response.url;
            }
            else {
                setError('No billing portal URL received');
            }
        }
        catch (error) {
            console.error('Billing portal error:', error);
            setError('Failed to open billing portal');
        }
    };
    const handleChangePaymentMethod = async () => {
        try {
            setError(null);
            const response = await api.post('/billing/change-payment');
            if (response.url) {
                window.location.href = response.url;
            }
            else {
                setError('No payment update URL received');
            }
        }
        catch (error) {
            console.error('Payment method update error:', error);
            setError('Failed to update payment method');
        }
    };
    const handleCancelSubscription = async () => {
        if (!confirm('Are you sure you want to cancel your Pro subscription? You will retain access until the end of your current billing period.')) {
            return;
        }
        try {
            setError(null);
            const result = await cancelSubscription();
            if (result.ok) {
                setSuccessMessage(result.message || 'Subscription cancelled successfully');
                setTimeout(() => setSuccessMessage(null), 5000);
            }
            else {
                setError(result.error || 'Failed to cancel subscription');
            }
        }
        catch (error) {
            console.error('Cancel subscription error:', error);
            setError('Failed to cancel subscription');
        }
    };
    const handleLogout = () => {
        logout();
    };
    const handleDeleteAccount = async () => {
        if (!confirm(`⚠️  DANGER: Are you absolutely sure you want to PERMANENTLY DELETE your account "${user?.name || user?.email}"?\n\nThis will:\n• Remove all your data from the system\n• Delete all your snapshots\n• Delete all your PATs\n• Delete all your comments\n• This action CANNOT be undone!\n\nType "DELETE" to confirm:`)) {
            return;
        }
        const confirmation = prompt('Type "DELETE" to confirm permanent deletion:');
        if (confirmation !== 'DELETE') {
            alert('Deletion cancelled. Your data is safe.');
            return;
        }
        try {
            setError(null);
            await adminApi.deleteUser(user.uid);
            setSuccessMessage('Your account has been completely deleted from the system. You will be redirected to the login page.');
            // Wait a moment for the user to see the success message, then logout and redirect
            setTimeout(() => {
                logout();
                window.location.href = '/login';
            }, 3000);
        }
        catch (error) {
            setError(error.message || 'Failed to delete account');
        }
    };
    if (authLoading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading settings..." })] }) }));
    }
    if (!user) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-4 font-inconsolata", children: "Authentication Required" }), _jsx("p", { className: "text-gray-600 mb-6", children: "You need to be logged in to access your account settings." }), _jsx(Link, { to: "/login", className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Go to Login" })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 font-poppins", children: [_jsx("header", { className: "bg-white shadow-lg border-b border-gray-200", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex justify-between items-center h-16 sm:h-20", children: [_jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent font-share-tech-mono", children: "QuickStage" }) }), _jsxs("nav", { className: "hidden sm:flex items-center space-x-4", children: [_jsx(Link, { to: "/dashboard", className: "text-gray-600 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors", children: "Dashboard" }), _jsxs(Link, { to: "/settings", className: "relative text-blue-600 px-4 py-2 text-sm font-semibold transition-colors", children: ["Settings", _jsx("div", { className: "absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full" })] }), user?.role === 'superadmin' && (_jsx(Link, { to: "/admin", className: "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md", children: "\uD83D\uDEE1\uFE0F Admin Panel" })), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 rounded-full", children: _jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "font-semibold", children: user.subscriptionDisplay || 'Free' }), _jsx("span", { className: "text-gray-500 ml-2", children: "Plan" })] }) }), _jsx("button", { onClick: handleLogout, className: "bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md", children: "Sign Out" })] })] }), _jsx("div", { className: "sm:hidden", children: _jsx("button", { onClick: () => setIsMobileMenuOpen(!isMobileMenuOpen), className: "text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500", children: _jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) }) }) })] }), isMobileMenuOpen && (_jsx("div", { className: "sm:hidden", children: _jsxs("div", { className: "px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200", children: [_jsx("div", { className: "px-3 py-2", children: _jsx("div", { className: "bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 rounded-full text-center", children: _jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "font-semibold", children: user.subscriptionDisplay || 'Free' }), _jsx("span", { className: "text-gray-500 ml-2", children: "Plan" })] }) }) }), _jsx(Link, { to: "/dashboard", onClick: () => setIsMobileMenuOpen(false), className: "block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50", children: "Dashboard" }), _jsx(Link, { to: "/settings", onClick: () => setIsMobileMenuOpen(false), className: "block px-3 py-2 text-base font-medium text-blue-600 border-l-4 border-blue-600 bg-blue-50", children: "Settings" }), user?.role === 'superadmin' && (_jsx(Link, { to: "/admin", onClick: () => setIsMobileMenuOpen(false), className: "block px-3 py-2 text-base font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 mx-3 rounded-lg", children: "\uD83D\uDEE1\uFE0F Admin Panel" })), _jsx("button", { onClick: () => {
                                            setIsMobileMenuOpen(false);
                                            handleLogout();
                                        }, className: "block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50", children: "Sign Out" })] }) }))] }) }), _jsxs("main", { className: "max-w-4xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "mb-6 sm:mb-8", children: [_jsx("h2", { className: "text-2xl sm:text-3xl font-bold text-gray-900 font-inconsolata", children: "Account Settings" }), _jsx("p", { className: "mt-2 text-sm sm:text-base text-gray-600", children: "Manage your account, plan, and preferences." })] }), error && (_jsx("div", { className: "px-4 sm:px-0 mb-6", children: _jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg", children: error }) })), successMessage && (_jsx("div", { className: "px-4 sm:px-0 mb-4", children: _jsx("div", { className: "bg-green-50 border border-green-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-green-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm text-green-800", children: successMessage }) })] }) }) })), _jsx("div", { className: "mb-6 sm:mb-8", children: _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8", children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0", children: [_jsx("div", { className: "w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-0 sm:mr-4 flex-shrink-0", children: _jsx("svg", { className: "w-4 h-4 sm:w-5 sm:h-5 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }) }), _jsx("h3", { className: "text-lg sm:text-xl font-semibold text-gray-900 font-inconsolata", children: "Account Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Name" }), _jsx("div", { className: "bg-gray-50 rounded-lg px-4 py-3", children: _jsx("p", { className: "text-gray-900", children: user.name || 'Not provided' }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Email Address" }), _jsx("div", { className: "bg-gray-50 rounded-lg px-4 py-3", children: _jsx("p", { className: "text-gray-900", children: user.email }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "User ID" }), _jsx("div", { className: "bg-gray-50 rounded-lg px-4 py-3", children: _jsx("p", { className: "text-gray-900", children: user.uid }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Staging Since" }), _jsx("div", { className: "bg-gray-50 rounded-lg px-4 py-3", children: _jsx("p", { className: "text-gray-900", children: new Date(user.createdAt).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        }) }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Current Plan" }), _jsx("div", { className: "bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg px-4 py-3 border border-blue-100", children: _jsx("p", { className: "text-blue-900 font-semibold", children: user.subscriptionDisplay || 'Free' }) })] }), ((user.subscription?.status || user.subscriptionStatus) === 'active' || (user.subscription?.status || user.subscriptionStatus) === 'trial') && user.nextBillingDate && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Next Billing" }), _jsxs("div", { className: "bg-green-50 rounded-lg px-4 py-3 border border-green-100", children: [_jsx("p", { className: "text-green-900 font-medium", children: new Date(user.nextBillingDate).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            }) }), user.nextBillingAmount !== null && user.nextBillingAmount !== undefined && (_jsxs("p", { className: "text-green-700 text-sm mt-1", children: ["Amount: ", user.nextBillingAmount === 0 ? 'Free' : `$${(user.nextBillingAmount / 100).toFixed(2)}`] }))] })] }))] })] }) }), _jsx("div", { className: "mb-6 sm:mb-8", children: _jsxs("div", { className: "bg-white rounded-lg shadow p-4 sm:p-6", children: [_jsx("h3", { className: "text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 font-inconsolata", children: "Plan Management" }), user.role === 'superadmin' ? (_jsxs("div", { children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-purple-600 font-medium mb-2", children: "\u2713 Pro (Superadmin) - Permanent Access" }), _jsx("p", { className: "text-gray-600 text-sm", children: "As a superadmin, you have permanent access to all Pro features without any subscription requirements." })] }), _jsx("div", { className: "text-sm text-gray-500", children: "No billing management needed - your access is permanent." })] })) : !(user.subscription?.status || user.subscriptionStatus) || (user.subscription?.status || user.subscriptionStatus) === 'none' ? (_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 mb-4", children: "Upgrade to Pro for unlimited snapshots, larger file sizes, and extended expiry times." }), _jsx("button", { onClick: handleUpgrade, disabled: upgrading, className: "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-6 rounded-lg transition-colors", children: upgrading ? 'Processing...' : 'Upgrade to Pro' })] })) : (user.subscription?.status || user.subscriptionStatus) === 'trial' ? (_jsxs("div", { children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-blue-600 font-medium mb-2", children: "\u2713 Pro (Trial) - Active" }), _jsx("p", { className: "text-gray-600 text-sm", children: "You're currently on a 7-day free trial of the Pro plan. Enjoy unlimited snapshots, 100MB per snapshot, and up to 90-day expiry times." }), (user.subscription?.trialEnd || user.trialEndsAt) && (_jsxs("p", { className: "text-sm text-gray-500 mt-2", children: ["Trial ends: ", new Date(user.subscription?.trialEnd || user.trialEndsAt).toLocaleDateString()] })), user.nextBillingDate && (_jsxs("div", { className: "text-sm text-gray-500 mt-2", children: [_jsxs("p", { children: ["Next billing: ", new Date(user.nextBillingDate).toLocaleDateString()] }), user.nextBillingAmount !== null && user.nextBillingAmount !== undefined && (_jsxs("p", { children: ["Amount: ", user.nextBillingAmount === 0 ? 'Free' : `$${(user.nextBillingAmount / 100).toFixed(2)}`] }))] }))] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleChangePaymentMethod, className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Change Payment Method" }), _jsx("button", { onClick: handleCancelSubscription, className: "bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors", children: "Cancel Subscription" })] })] })) : (user.subscription?.status || user.subscriptionStatus) === 'active' ? (_jsxs("div", { children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-green-600 font-medium mb-2", children: "\u2713 Pro - Active Subscription" }), _jsx("p", { className: "text-gray-600 text-sm", children: "You have full access to all Pro features: unlimited snapshots, 100MB per snapshot, and up to 90-day expiry times." }), user.nextBillingDate && (_jsxs("div", { className: "text-sm text-gray-500 mt-2", children: [_jsxs("p", { children: ["Next billing: ", new Date(user.nextBillingDate).toLocaleDateString()] }), user.nextBillingAmount !== null && user.nextBillingAmount !== undefined && (_jsxs("p", { children: ["Amount: ", user.nextBillingAmount === 0 ? 'Free' : `$${(user.nextBillingAmount / 100).toFixed(2)}`] }))] }))] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleChangePaymentMethod, className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Change Payment Method" }), _jsx("button", { onClick: handleCancelSubscription, className: "bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Cancel Subscription" })] })] })) : (user.subscription?.status || user.subscriptionStatus) === 'cancelled' ? (_jsxs("div", { children: [_jsx("p", { className: "text-orange-600 font-medium mb-2", children: "\u26A0\uFE0F Pro (Cancelled)" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Your subscription has been cancelled. You will retain access to Pro features until the end of your current billing period." }), _jsx("button", { onClick: handleUpgrade, disabled: upgrading, className: "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-6 rounded-lg transition-colors", children: upgrading ? 'Processing...' : 'Reactivate Pro' })] })) : (user.subscription?.status || user.subscriptionStatus) === 'past_due' ? (_jsxs("div", { children: [_jsx("p", { className: "text-red-600 font-medium mb-2", children: "\u26A0\uFE0F Pro (Payment Past Due)" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Your subscription payment is past due. Please update your payment method to continue access to Pro features." }), _jsx("button", { onClick: handleManageBilling, className: "bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Update Payment Method" })] })) : (_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 mb-4", children: "Upgrade to Pro for unlimited snapshots, larger file sizes, and extended expiry times." }), _jsx("button", { onClick: handleUpgrade, disabled: upgrading, className: "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-6 rounded-lg transition-colors", children: upgrading ? 'Processing...' : 'Upgrade to Pro' })] }))] }) }), _jsx("div", { className: "mb-6 sm:mb-8", children: _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8", children: [_jsx("div", { className: "flex items-center mb-4 sm:mb-6", children: _jsx("h3", { className: "text-lg sm:text-xl font-semibold text-gray-900 font-inconsolata", children: "Account Actions" }) }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3 sm:gap-4", children: [_jsxs("button", { onClick: handleLogout, className: "bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors shadow-md flex items-center justify-center", children: [_jsx("svg", { className: "w-4 h-4 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }), "Sign Out"] }), _jsxs("button", { onClick: handleDeleteAccount, className: "bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors shadow-md flex items-center justify-center", children: [_jsx("svg", { className: "w-4 h-4 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }), "Delete Account"] })] })] }) })] })] }));
}
