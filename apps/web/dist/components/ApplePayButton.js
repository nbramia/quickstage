import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { config } from '../config';
export function ApplePayButton({ plan, onSuccess, onError, disabled, requiresAuth, onAuthRequired }) {
    const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        const checkApplePayAvailability = async () => {
            try {
                console.log('🍎 Checking Apple Pay availability...');
                console.log('🔑 Stripe public key:', config.STRIPE_PUBLIC_KEY);
                const stripe = await loadStripe(config.STRIPE_PUBLIC_KEY);
                if (!stripe) {
                    console.error('❌ Stripe failed to load');
                    return;
                }
                console.log('✅ Stripe loaded successfully');
                // Check if Apple Pay is available
                const paymentRequest = stripe.paymentRequest({
                    country: 'US',
                    currency: 'usd',
                    total: {
                        label: `QuickStage Pro - ${plan === 'monthly' ? 'Monthly' : 'Annual'}`,
                        amount: plan === 'monthly' ? 600 : 6000, // Amount in cents
                    },
                    requestPayerName: true,
                    requestPayerEmail: true,
                });
                const result = await paymentRequest.canMakePayment();
                console.log('🔍 Payment request result:', result);
                console.log('🍎 Apple Pay available:', !!result?.applePay);
                setIsApplePayAvailable(!!result?.applePay);
            }
            catch (error) {
                console.error('❌ Error checking Apple Pay availability:', error);
            }
        };
        checkApplePayAvailability();
    }, [plan]);
    const handleApplePayClick = async () => {
        if (disabled || isLoading)
            return;
        // Check if authentication is required
        if (requiresAuth) {
            onAuthRequired?.();
            return;
        }
        setIsLoading(true);
        try {
            const stripe = await loadStripe(config.STRIPE_PUBLIC_KEY);
            if (!stripe)
                throw new Error('Stripe not loaded');
            const paymentRequest = stripe.paymentRequest({
                country: 'US',
                currency: 'usd',
                total: {
                    label: `QuickStage Pro - ${plan === 'monthly' ? 'Monthly' : 'Annual'}`,
                    amount: plan === 'monthly' ? 600 : 6000, // Amount in cents
                },
                requestPayerName: true,
                requestPayerEmail: true,
            });
            paymentRequest.on('paymentmethod', async (ev) => {
                try {
                    // Create the subscription with the payment method
                    const response = await fetch('/api/billing/subscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            plan,
                            payment_method_id: ev.paymentMethod.id,
                            payment_type: 'apple_pay'
                        }),
                    });
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.details || 'Failed to create subscription');
                    }
                    const result = await response.json();
                    if (result.success) {
                        ev.complete('success');
                        onSuccess?.();
                    }
                    else {
                        throw new Error('Subscription creation failed');
                    }
                }
                catch (error) {
                    console.error('Apple Pay payment failed:', error);
                    ev.complete('fail');
                    onError?.(error.message);
                }
            });
            paymentRequest.show();
        }
        catch (error) {
            console.error('Apple Pay error:', error);
            onError?.(error.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    if (!isApplePayAvailable) {
        return null;
    }
    return (_jsx("button", { onClick: handleApplePayClick, disabled: disabled || isLoading, className: "w-full mt-4 bg-black hover:bg-gray-800 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center", style: { backgroundColor: '#000', borderRadius: '8px' }, children: isLoading ? ('Processing...') : (_jsxs("div", { className: "flex items-center", children: [_jsxs("svg", { className: "w-5 h-5 mr-2", viewBox: "0 0 20 20", fill: "currentColor", children: [_jsx("path", { d: "M13.25 7.5c-.414 0-.75.336-.75.75s.336.75.75.75c1.792 0 3.25 1.458 3.25 3.25S15.042 15.5 13.25 15.5c-1.792 0-3.25-1.458-3.25-3.25V8.25c0-.414-.336-.75-.75-.75s-.75.336-.75.75V12.25C8.5 15.564 11.186 18.25 14.5 18.25S20.5 15.564 20.5 12.25 17.814 6.25 14.5 6.25h-1.25z" }), _jsx("path", { d: "M6.75 12.5c.414 0 .75-.336.75-.75s-.336-.75-.75-.75c-1.792 0-3.25-1.458-3.25-3.25S4.958 4.5 6.75 4.5c1.792 0 3.25 1.458 3.25 3.25v4c0 .414.336.75.75.75s.75-.336.75-.75v-4C11.5 4.436 8.814 1.75 5.5 1.75S-.5 4.436-.5 7.75 2.186 13.75 5.5 13.75h1.25z" })] }), "Pay"] })) }));
}
