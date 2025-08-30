import { getUidByStripeCustomerId } from './auth';
import { AnalyticsManager } from './analytics';

/**
 * Stripe webhook handlers for the QuickStage Worker
 * Handles all Stripe events including subscriptions, payments, and customer management
 */

/**
 * Handle customer.created webhook
 */
export async function handleCustomerCreated(c: any, customer: any, analytics: AnalyticsManager) {
  console.log(`Processing customer creation: ${customer.id}`);
  
  // Find user by Stripe customer ID to track analytics
  const uid = await getUidByStripeCustomerId(c, customer.id);
  if (uid) {
    // Track analytics event for customer creation
    await analytics.trackEvent(uid, 'customer_created', { 
      stripeCustomerId: customer.id,
      email: customer.email
    });
  }
  
  // Customer created event doesn't require immediate action
  // The subscription creation will handle the user status update
}

/**
 * Handle checkout.session.completed webhook
 */
export async function handleCheckoutSessionCompleted(c: any, session: any, analytics: AnalyticsManager) {
  const uid = session.metadata?.uid;
  if (!uid) {
    console.error('No UID in checkout session metadata');
    return;
  }
  
  console.log(`Processing checkout session completion for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) {
    console.error(`User ${uid} not found for checkout session`);
    return;
  }
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update user with Stripe customer ID - update both new and legacy fields
  if (session.customer) {
    user.subscription.stripeCustomerId = session.customer;
    user.stripeCustomerId = session.customer;
  }
  
  // Update user with subscription ID if available - update both new and legacy fields
  if (session.subscription) {
    user.subscription.stripeSubscriptionId = session.subscription;
    user.stripeSubscriptionId = session.subscription;
  }
  
  // Determine if this is a trial period or 100% discount
  const wasFreeCheckout = session.amount_total === 0;
  const hasSubscription = !!session.subscription;
  
  // Check if there are any discounts applied (indicating coupon use)
  const hasDiscounts = session.total_details?.breakdown?.discounts && session.total_details.breakdown.discounts.length > 0;
  
  if (wasFreeCheckout && hasDiscounts && !hasSubscription) {
    // This was a $0 checkout due to 100% discount coupon (no subscription created)
    user.subscription.status = 'active';
    user.subscriptionStatus = 'active';
    user.plan = 'pro';
    // No trial end date for full pro access from coupon
    user.subscription.trialEnd = null;
    user.trialEndsAt = null;
    console.log(`User ${uid} received full pro access due to $0 checkout (100% discount coupon)`);
  } else if (wasFreeCheckout && hasSubscription) {
    // This is a free trial (subscription created but $0 initial charge)
    user.subscription.status = 'trial';
    user.subscriptionStatus = 'trial';
    user.plan = 'pro';
    user.subscription.trialEnd = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
    user.trialEndsAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
    console.log(`User ${uid} started 7-day free trial`);
  } else {
    // Normal paid checkout (no trial)
    user.subscription.status = 'active';
    user.subscriptionStatus = 'active';
    user.plan = 'pro';
    user.subscription.trialEnd = null;
    user.trialEndsAt = null;
    console.log(`User ${uid} completed paid checkout`);
  }
  
  if (!user.subscriptionStartedAt) {
    user.subscriptionStartedAt = Date.now();
  }
  
  // Save updated user
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for checkout completion
  await analytics.trackEvent(uid, 'subscription_started', { 
    method: 'checkout_session',
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription
  });
  
  console.log(`Updated user ${uid} to trial status with checkout session data`);
}

/**
 * Handle customer.subscription.created webhook
 */
export async function handleSubscriptionCreated(c: any, subscription: any, analytics: AnalyticsManager) {
  const customerId = subscription.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }
  
  console.log(`Processing subscription creation for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update new schema
  user.subscription.stripeSubscriptionId = subscription.id;
  
  // Update legacy fields for backward compatibility
  user.stripeSubscriptionId = subscription.id;
  
  // Check if this subscription has a 100% discount (permanent free access)
  const has100PercentDiscount = subscription.discount && 
    subscription.discount.coupon && 
    subscription.discount.coupon.percent_off === 100;
  
  if (subscription.status === 'trialing') {
    if (has100PercentDiscount) {
      // 100% discount coupon - treat as active Pro, not trial
      user.subscription.status = 'active';
      user.subscriptionStatus = 'active';
      user.plan = 'pro';
      // No trial end date for 100% discount users - they get permanent Pro access
      user.subscription.trialEnd = null;
      user.trialEndsAt = null;
      console.log(`User ${uid} marked as active (100% discount coupon) - permanent Pro access`);
    } else {
      // Regular trial (including with partial discounts like 10%, 50%, etc.)
      // All non-100% discounts should still go through the normal trial period
      user.subscription.status = 'trial';
      user.subscriptionStatus = 'trial';
      user.plan = 'pro';
      
      // Set trial end date from Stripe subscription
      if (subscription.trial_end) {
        user.subscription.trialEnd = subscription.trial_end * 1000; // Convert to milliseconds
        user.trialEndsAt = subscription.trial_end * 1000; // Legacy field for backward compatibility
      }
      
      const discountInfo = subscription.discount ? 
        `${subscription.discount.coupon.percent_off || subscription.discount.coupon.amount_off}${subscription.discount.coupon.percent_off ? '%' : ' cents'} discount` : 
        'no discount';
      console.log(`User ${uid} marked as trial (${discountInfo}) with end date: ${subscription.trial_end ? new Date(subscription.trial_end * 1000) : 'unknown'}`);
    }
    
    if (!user.subscriptionStartedAt) {
      user.subscriptionStartedAt = Date.now();
    }
  } else if (subscription.status === 'active') {
    user.subscription.status = 'active';
    user.subscriptionStatus = 'active';
    user.plan = 'pro';
    if (!user.subscriptionStartedAt) {
      user.subscriptionStartedAt = Date.now();
    }
    console.log(`User ${uid} marked as active subscription`);
  }
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for subscription creation
  await analytics.trackEvent(uid, 'subscription_started', { 
    method: 'stripe_webhook',
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEnd: subscription.trial_end
  });
}

/**
 * Handle customer.subscription.updated webhook
 */
export async function handleSubscriptionUpdated(c: any, subscription: any, analytics: AnalyticsManager) {
  const customerId = subscription.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing subscription update for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Check if this subscription has a 100% discount (permanent free access)
  const has100PercentDiscount = subscription.discount && 
    subscription.discount.coupon && 
    subscription.discount.coupon.percent_off === 100;
  
  if (subscription.status === 'trialing') {
    if (has100PercentDiscount) {
      // 100% discount coupon - treat as active Pro, not trial
      user.subscription.status = 'active';
      user.subscriptionStatus = 'active';
      user.plan = 'pro';
      // No trial end date for 100% discount users - they get permanent Pro access
      user.subscription.trialEnd = null;
      user.trialEndsAt = null;
    } else {
      // Regular trial (including with partial discounts like 10%, 50%, etc.)
      // All non-100% discounts should still go through the normal trial period
      user.subscription.status = 'trial';
      user.subscriptionStatus = 'trial';
      user.plan = 'pro';
      
      // Set trial end date from Stripe subscription
      if (subscription.trial_end) {
        user.subscription.trialEnd = subscription.trial_end * 1000; // Convert to milliseconds
        user.trialEndsAt = subscription.trial_end * 1000; // Legacy field for backward compatibility
      }
    }
  } else if (subscription.status === 'active') {
    user.subscription.status = 'active';
    user.subscriptionStatus = 'active';
    user.plan = 'pro';
  } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    user.subscription.status = 'cancelled';
    user.subscriptionStatus = 'cancelled';
    user.plan = 'free';
  } else if (subscription.status === 'past_due') {
    user.subscription.status = 'past_due';
    user.subscriptionStatus = 'past_due';
  }
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for subscription update
  await analytics.trackEvent(uid, 'subscription_renewed', { 
    method: 'stripe_webhook',
    subscriptionId: subscription.id,
    status: subscription.status,
    previousStatus: user.subscriptionStatus
  });
}

/**
 * Handle customer.subscription.deleted webhook
 */
export async function handleSubscriptionDeleted(c: any, subscription: any, analytics: AnalyticsManager) {
  const customerId = subscription.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing subscription deletion for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update both new and legacy fields
  user.subscription.status = 'cancelled';
  user.subscriptionStatus = 'cancelled';
  user.plan = 'free';
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for subscription deletion
  await analytics.trackEvent(uid, 'subscription_cancelled', { 
    method: 'stripe_webhook',
    subscriptionId: subscription.id
  });
}

/**
 * Handle customer.deleted webhook
 */
export async function handleCustomerDeleted(c: any, customer: any, analytics: AnalyticsManager) {
  const customerId = customer.id;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing customer deletion for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  user.stripeCustomerId = undefined;
  user.stripeSubscriptionId = undefined;
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for customer deletion
  await analytics.trackEvent(uid, 'customer_deleted', { 
    stripeCustomerId: customer.id
  });
}

/**
 * Handle invoice.payment_succeeded webhook
 */
export async function handlePaymentSucceeded(c: any, invoice: any, analytics: AnalyticsManager) {
  const customerId = invoice.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing payment success for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update both new and legacy fields
  user.subscription.lastPaymentAt = Date.now();
  user.lastPaymentAt = Date.now();
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for successful payment
  await analytics.trackEvent(uid, 'payment_succeeded', { 
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency
  });
}

/**
 * Handle invoice.payment_failed webhook
 */
export async function handlePaymentFailed(c: any, invoice: any, analytics: AnalyticsManager) {
  const customerId = invoice.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing payment failure for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update both new and legacy fields
  user.subscription.status = 'past_due';
  user.subscriptionStatus = 'past_due';
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for failed payment
  await analytics.trackEvent(uid, 'payment_failed', { 
    invoiceId: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency
  });
}
