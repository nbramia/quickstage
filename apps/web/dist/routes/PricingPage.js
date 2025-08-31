import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { ApplePayButton } from '../components/ApplePayButton';
export function PricingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    // Get mode and plan from URL params
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode') || 'upgrade'; // 'trial' or 'upgrade'
    const preSelectedPlan = urlParams.get('plan'); // 'monthly' or 'annual'
    const isTrialMode = mode === 'trial';
    // Auto-trigger subscription if user just signed up with a pre-selected plan
    useEffect(() => {
        if (user && preSelectedPlan && (preSelectedPlan === 'monthly' || preSelectedPlan === 'annual')) {
            // Small delay to ensure component is fully loaded
            setTimeout(() => {
                handlePlanSelect(preSelectedPlan);
            }, 500);
        }
    }, [user, preSelectedPlan]);
    const handlePlanSelect = async (plan) => {
        if (!user) {
            // Redirect to signup with plan pre-selected
            navigate(`/login?mode=signup&plan=${plan}&redirect=pricing`);
            return;
        }
        setLoading(true);
        try {
            const endpoint = isTrialMode ? '/billing/start-trial' : '/billing/subscribe';
            const payload = { plan };
            const response = await api.post(endpoint, payload);
            if (response.url) {
                // Redirect to Stripe checkout
                window.location.href = response.url;
            }
            else {
                throw new Error('No checkout URL received');
            }
        }
        catch (error) {
            console.error('Failed to create checkout session:', error);
            alert(`Failed to start checkout: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const monthlyPrice = 6;
    const annualPrice = 60;
    const monthlySavings = Math.round(((monthlyPrice * 12) - annualPrice) / (monthlyPrice * 12) * 100);
    return (_jsx("div", { className: "min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-poppins", children: _jsxs("div", { className: "max-w-3xl mx-auto", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 font-inconsolata", children: "Choose Your QuickStage Pro Plan" }), _jsx("p", { className: "mt-4 text-lg text-gray-600", children: isTrialMode
                                ? "Start your 7-day free trial with either plan - cancel anytime"
                                : user
                                    ? "Upgrade to QuickStage Pro for unlimited snapshots and features"
                                    : "Create an account and upgrade to QuickStage Pro for unlimited snapshots and features" }), !user && (_jsx("div", { className: "mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto", children: _jsxs("p", { className: "text-sm text-blue-700", children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "New to QuickStage?" }), " Select your plan below and we'll create your account in the next step."] }) }))] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-lg border border-gray-200 p-8 relative", children: [_jsxs("div", { className: "text-center", children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900 font-inconsolata", children: "Monthly" }), _jsxs("div", { className: "mt-4", children: [_jsxs("span", { className: "text-4xl font-bold text-gray-900", children: ["$", monthlyPrice] }), _jsx("span", { className: "text-gray-500", children: "/month" })] }), _jsx("p", { className: "mt-2 text-sm text-gray-500", children: "Billed monthly" })] }), _jsxs("ul", { className: "mt-8 space-y-4", children: [_jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsx("span", { className: "text-gray-700", children: "Unlimited snapshots" })] }), _jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsx("span", { className: "text-gray-700", children: "Extended expiration times" })] }), _jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsx("span", { className: "text-gray-700", children: "Cancel anytime" })] })] }), _jsx("button", { onClick: () => handlePlanSelect('monthly'), disabled: loading, className: "w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Creating...' : `Choose Monthly` }), _jsx(ApplePayButton, { plan: "monthly", disabled: loading, onSuccess: () => {
                                        // Redirect to dashboard or success page
                                        navigate('/dashboard');
                                    }, onError: (error) => {
                                        console.error('Apple Pay error:', error);
                                        alert(`Apple Pay failed: ${error}`);
                                    }, requiresAuth: !user, onAuthRequired: () => navigate(`/login?mode=signup&plan=monthly&redirect=pricing`) })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-lg border-2 border-blue-500 p-8 relative", children: [_jsx("div", { className: "absolute -top-4 left-1/2 transform -translate-x-1/2", children: _jsxs("span", { className: "bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium", children: ["Save ", monthlySavings, "%"] }) }), _jsxs("div", { className: "text-center", children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900 font-inconsolata", children: "Annual" }), _jsxs("div", { className: "mt-4", children: [_jsxs("span", { className: "text-4xl font-bold text-gray-900", children: ["$", annualPrice] }), _jsx("span", { className: "text-gray-500", children: "/year" })] }), _jsxs("p", { className: "mt-2 text-sm text-gray-500", children: ["Billed annually \u2022 ", _jsxs("span", { className: "text-green-600 font-medium", children: ["$", monthlyPrice * 12 - annualPrice, " savings"] })] })] }), _jsxs("ul", { className: "mt-8 space-y-4", children: [_jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsx("span", { className: "text-gray-700", children: "Everything in Monthly" })] }), _jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsx("span", { className: "text-gray-700", children: "2 months free" })] }), _jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsx("span", { className: "text-gray-700", children: "Priority support" })] })] }), _jsx("button", { onClick: () => handlePlanSelect('annual'), disabled: loading, className: "w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Creating...' : `Choose Annual` }), _jsx(ApplePayButton, { plan: "annual", disabled: loading, onSuccess: () => {
                                        // Redirect to dashboard or success page
                                        navigate('/dashboard');
                                    }, onError: (error) => {
                                        console.error('Apple Pay error:', error);
                                        alert(`Apple Pay failed: ${error}`);
                                    }, requiresAuth: !user, onAuthRequired: () => navigate(`/login?mode=signup&plan=annual&redirect=pricing`) })] })] }), _jsx("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8", children: _jsxs("div", { className: "text-center", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Have a promotion code?" }), _jsx("p", { className: "mt-2 text-sm text-gray-500", children: "You can enter it on the next step during checkout" })] }) }), _jsx("div", { className: "text-center", children: _jsxs("button", { onClick: () => navigate(user ? '/dashboard' : '/'), className: "text-gray-600 hover:text-gray-900 font-medium", children: ["\u2190 Back ", user ? 'to Dashboard' : 'to Home'] }) }), _jsxs("div", { className: "mt-12 text-center", children: [_jsx("p", { className: "text-sm text-gray-500 mb-4", children: "Secure payment powered by Stripe" }), _jsxs("div", { className: "flex justify-center items-center space-x-6", children: [_jsxs("div", { className: "flex items-center text-xs text-gray-400", children: [_jsx("svg", { className: "w-4 h-4 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }), "SSL Encrypted"] }), _jsxs("div", { className: "flex items-center text-xs text-gray-400", children: [_jsx("svg", { className: "w-4 h-4 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" }) }), "Cancel Anytime"] })] })] })] }) }));
}
