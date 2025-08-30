import { getUidFromSession } from '../auth';
import { getSubscriptionDisplayStatus, canAccessProFeatures } from '../user';
import { getAnalyticsManager } from '../worker-utils';
// @ts-ignore
import Stripe from 'stripe';
// Billing route handlers
export async function handleStartTrial(c) {
    try {
        console.log('🔥 handleStartTrial: Starting trial handler');
        const uid = await getUidFromSession(c);
        if (!uid) {
            // Track analytics event for unauthorized access attempt
            try {
                const analytics = getAnalyticsManager(c);
                await analytics.trackEvent('anonymous', 'unauthorized_access', {
                    endpoint: '/billing/start-trial',
                    method: 'POST'
                });
            }
            catch (analyticsError) {
                console.error('Failed to track analytics for unauthorized access:', analyticsError);
            }
            return c.json({ error: 'unauthorized' }, 401);
        }
        // Parse request body for plan selection
        let body = {};
        try {
            body = await c.req.json();
        }
        catch (e) {
            // If no body, default to monthly
            body = { plan: 'monthly' };
        }
        const plan = body.plan || 'monthly'; // 'monthly' or 'annual'
        const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
        if (!userRaw)
            return c.json({ error: 'user_not_found' }, 404);
        const user = JSON.parse(userRaw);
        // Check if user already has trial/subscription - use new schema with fallback
        const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
        if (subscriptionStatus && subscriptionStatus !== 'none' && subscriptionStatus !== 'cancelled') {
            return c.json({ error: 'already_subscribed' }, 400);
        }
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });
        // Create or get Stripe customer - use new schema with fallback
        let customerId = user.subscription?.stripeCustomerId || user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: { uid }
            });
            customerId = customer.id;
            // Update both new and legacy fields
            if (!user.subscription) {
                user.subscription = { status: 'none' };
            }
            user.subscription.stripeCustomerId = customerId;
            user.stripeCustomerId = customerId;
        }
        // Create checkout session for trial with required payment method
        // Select the correct price ID based on plan
        const priceId = plan === 'annual'
            ? (c.env.STRIPE_ANNUAL_PRICE_ID && c.env.STRIPE_ANNUAL_PRICE_ID !== 'your_annual_price_id_here' ? c.env.STRIPE_ANNUAL_PRICE_ID : c.env.STRIPE_PRICE_ID) // Fallback to monthly if annual not configured
            : c.env.STRIPE_PRICE_ID;
        // Build checkout session configuration
        const sessionConfig = {
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            subscription_data: {
                trial_period_days: 7,
                metadata: { uid, plan }
            },
            success_url: `${c.env.PUBLIC_BASE_URL}/dashboard?trial=started`,
            cancel_url: `${c.env.PUBLIC_BASE_URL}/dashboard?trial=cancelled`,
            metadata: { uid, action: 'start_trial', plan },
        };
        // Always allow promotion codes to be entered during checkout
        sessionConfig.allow_promotion_codes = true;
        const session = await stripe.checkout.sessions.create(sessionConfig);
        // Track analytics event for trial start
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'subscription_started', {
            method: 'trial',
            trialDays: 7
        });
        return c.json({ url: session.url });
    }
    catch (error) {
        console.error('🔥 handleStartTrial: Error occurred:', error);
        console.error('🔥 handleStartTrial: Error message:', error.message);
        console.error('🔥 handleStartTrial: Error stack:', error.stack);
        return c.json({
            error: 'internal_server_error',
            details: error.message,
            stack: error.stack
        }, 500);
    }
}
export async function handleSubscribe(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/billing/subscribe',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    // Parse request body for plan selection
    let body = {};
    try {
        body = await c.req.json();
    }
    catch (e) {
        // If no body, default to monthly
        body = { plan: 'monthly' };
    }
    const plan = body.plan || 'monthly'; // 'monthly' or 'annual'
    const paymentMethodId = body.payment_method_id;
    const paymentType = body.payment_type; // 'apple_pay', 'card', or undefined for checkout
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
    });
    // Create or get Stripe customer - use new schema with fallback
    let customerId = user.subscription?.stripeCustomerId || user.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
            metadata: { uid }
        });
        customerId = customer.id;
        // Update both new and legacy fields
        if (!user.subscription) {
            user.subscription = { status: 'none' };
        }
        user.subscription.stripeCustomerId = customerId;
        user.stripeCustomerId = customerId;
    }
    // Select the correct price ID based on plan
    const priceId = plan === 'annual'
        ? (c.env.STRIPE_ANNUAL_PRICE_ID && c.env.STRIPE_ANNUAL_PRICE_ID !== 'your_annual_price_id_here' ? c.env.STRIPE_ANNUAL_PRICE_ID : c.env.STRIPE_PRICE_ID) // Fallback to monthly if annual not configured
        : c.env.STRIPE_PRICE_ID;
    // Handle Apple Pay direct payment
    if (paymentMethodId && paymentType === 'apple_pay') {
        try {
            // Attach payment method to customer
            await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
            // Create subscription with immediate payment
            const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: priceId }],
                default_payment_method: paymentMethodId,
                expand: ['latest_invoice.payment_intent'],
                metadata: { uid, action: 'subscribe', plan, payment_type: 'apple_pay' },
            });
            // Update user record with subscription details
            const now = Date.now();
            if (!user.subscription) {
                user.subscription = { status: 'none' };
            }
            user.subscription.status = 'active';
            user.subscription.stripeSubscriptionId = subscription.id;
            user.subscription.stripeCustomerId = customerId;
            user.subscription.currentPeriodStart = now;
            user.subscription.currentPeriodEnd = subscription.current_period_end * 1000;
            user.subscription.lastPaymentAt = now;
            user.plan = 'pro';
            // Save updated user record
            await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            // Track analytics event for subscription start
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'subscription_started', {
                method: 'apple_pay',
                plan
            });
            return c.json({
                success: true,
                subscription_id: subscription.id,
                status: 'active'
            });
        }
        catch (error) {
            console.error('Apple Pay subscription creation failed:', error);
            return c.json({ error: 'payment_failed', details: error.message }, 400);
        }
    }
    // Fall back to regular checkout session for non-Apple Pay
    const sessionConfig = {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${c.env.PUBLIC_BASE_URL}/dashboard?billing=success`,
        cancel_url: `${c.env.PUBLIC_BASE_URL}/dashboard?billing=canceled`,
        metadata: { uid, action: 'subscribe', plan },
    };
    // Always allow promotion codes to be entered during checkout
    sessionConfig.allow_promotion_codes = true;
    const session = await stripe.checkout.sessions.create(sessionConfig);
    // Track analytics event for subscription start
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'subscription_started', {
        method: 'checkout_session'
    });
    return c.json({ url: session.url });
}
export async function handleBillingStatus(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    return c.json({
        status: getSubscriptionDisplayStatus(user),
        canAccessPro: canAccessProFeatures(user),
        trialEndsAt: user.subscription?.trialEnd || user.trialEndsAt,
        subscriptionStartedAt: user.subscription?.currentPeriodStart || user.subscriptionStartedAt,
        lastPaymentAt: user.subscription?.lastPaymentAt || user.lastPaymentAt,
        stripeCustomerId: user.subscription?.stripeCustomerId || user.stripeCustomerId
    });
}
export async function handleBillingCancel(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/billing/cancel',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    // Check for subscription ID in both new and legacy fields
    const stripeSubscriptionId = user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
        return c.json({ error: 'no_subscription' }, 400);
    }
    try {
        // Check if Stripe secret key is available
        if (!c.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Initialize Stripe client with environment variables
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        console.log(`Cancelling subscription ${stripeSubscriptionId} for user ${uid}`);
        // Cancel the subscription at period end (user keeps access until paid period ends)
        const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true
        });
        // Update user status - update both new and legacy fields
        if (user.subscription) {
            user.subscription.status = 'cancelled';
        }
        user.subscriptionStatus = 'cancelled';
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
        // Track analytics event for subscription cancellation
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'subscription_cancelled', {
            stripeSubscriptionId: stripeSubscriptionId,
            cancelAt: subscription.cancel_at
        });
        console.log(`Subscription ${stripeSubscriptionId} cancelled for user ${uid}`);
        return c.json({
            ok: true,
            message: 'Subscription cancelled. You will retain access until the end of your current billing period.',
            cancelAt: subscription.cancel_at
        });
    }
    catch (error) {
        console.error('Stripe cancel subscription error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ error: 'cancel_failed', details: errorMessage }, 500);
    }
}
export async function handleCheckout(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    try {
        // Check if Stripe secret key is available
        if (!c.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Check if Stripe price ID is available
        if (!c.env.STRIPE_PRICE_ID) {
            console.error('STRIPE_PRICE_ID not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Initialize Stripe client with environment variables
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        console.log(`Creating checkout session for user ${uid} with price ${c.env.STRIPE_PRICE_ID}`);
        // Create or retrieve Stripe customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            console.log(`Creating new Stripe customer for user ${uid}`);
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: { uid }
            });
            customerId = customer.id;
            // Update user with Stripe customer ID
            user.stripeCustomerId = customerId;
            await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            console.log(`Created Stripe customer ${customerId} for user ${uid}`);
        }
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                    price: c.env.STRIPE_PRICE_ID, // Your $6/mo price ID
                    quantity: 1,
                }],
            mode: 'subscription',
            success_url: `https://quickstage.tech/dashboard?success=true`,
            cancel_url: `https://quickstage.tech/dashboard?canceled=true`,
            subscription_data: {
                trial_period_days: 7, // 7-day trial
                metadata: { uid: user.uid }
            },
            metadata: { uid: user.uid }
        });
        console.log(`Created checkout session ${session.id} for user ${uid}`);
        return c.json({ url: session.url });
    }
    catch (error) {
        console.error('Stripe checkout error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ error: 'checkout_failed', details: errorMessage }, 500);
    }
}
export async function handleChangePayment(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    if (!user.stripeCustomerId) {
        return c.json({ error: 'no_subscription' }, 400);
    }
    try {
        // Check if Stripe secret key is available
        if (!c.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Initialize Stripe client with environment variables
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        console.log(`Creating payment method update session for user ${uid}`);
        // Create a checkout session for updating payment method
        const session = await stripe.checkout.sessions.create({
            customer: user.stripeCustomerId,
            payment_method_types: ['card'],
            mode: 'setup', // Setup mode for updating payment method
            success_url: `https://quickstage.tech/settings?payment_updated=true`,
            cancel_url: `https://quickstage.tech/settings?payment_canceled=true`,
            metadata: { uid: user.uid, action: 'change_payment' }
        });
        console.log(`Created payment method update session ${session.id} for user ${uid}`);
        return c.json({ url: session.url });
    }
    catch (error) {
        console.error('Stripe payment method update error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ error: 'payment_update_failed', details: errorMessage }, 500);
    }
}
export async function handleBillingPortal(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/billing/portal',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    if (!user.stripeCustomerId) {
        return c.json({ error: 'no_subscription' }, 400);
    }
    try {
        // Check if Stripe secret key is available
        if (!c.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Initialize Stripe client with environment variables
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        console.log(`Creating billing portal session for user ${uid}`);
        // Create billing portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `https://quickstage.tech/dashboard`,
        });
        console.log(`Created billing portal session ${session.id} for user ${uid}`);
        return c.json({ url: session.url });
    }
    catch (error) {
        console.error('Stripe billing portal error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ error: 'portal_failed', details: errorMessage }, 500);
    }
}
