/**
 * Comprehensive Subscription Scenarios Test
 * Tests all discount types and state transitions for robust subscription handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  handleCheckoutSessionCompleted, 
  handleSubscriptionCreated, 
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentFailed,
  handlePaymentSucceeded
} from '../stripe';
import { AnalyticsManager } from '../analytics';

// Mock environment for testing
const createMockEnv = () => ({
  KV_USERS: {
    data: new Map(),
    async get(key: string) {
      return this.data.get(key) || null;
    },
    async put(key: string, value: string) {
      this.data.set(key, value);
    },
    async delete(key: string) {
      this.data.delete(key);
    },
    async list(options: any) {
      const keys = Array.from(this.data.keys())
        .filter(key => !options.prefix || key.startsWith(options.prefix))
        .map(key => ({ name: key }));
      
      return {
        keys,
        list_complete: true,
        cursor: undefined
      };
    }
  },
  KV_ANALYTICS: {
    data: new Map(),
    async get(key: string) {
      return this.data.get(key) || null;
    },
    async put(key: string, value: string) {
      this.data.set(key, value);
    }
  }
});

// Mock context
const createMockContext = (env: any) => ({
  env,
  waitUntil: (promise: Promise<any>) => promise,
  passThroughOnException: () => {}
});

// Test user factory
const createTestUser = (uid: string, email: string, initialPlan = 'free'): any => ({
  uid,
  email,
  name: 'Test User',
  plan: initialPlan,
  role: 'user',
  subscription: {
    status: 'none'
  },
  subscriptionStatus: 'none'
});

// Helper to get user from mock KV
const getUser = async (env: any, uid: string) => {
  const raw = await env.KV_USERS.get(`user:${uid}`);
  return raw ? JSON.parse(raw) : null;
};

// Helper to put user in mock KV
const putUser = async (env: any, uid: string, user: any) => {
  await env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  // Also create customer mapping if the user has a customer ID
  if (user.stripeCustomerId || (user.subscription && user.subscription.stripeCustomerId)) {
    const customerId = user.stripeCustomerId || user.subscription.stripeCustomerId;
    await env.KV_USERS.put(`user:by-customer:${customerId}`, uid);
  }
};

describe('Comprehensive Subscription Scenarios', () => {
  let env: any;
  let c: any;
  let analytics: AnalyticsManager;

  beforeEach(() => {
    env = createMockEnv();
    c = createMockContext(env);
    analytics = new AnalyticsManager(env);
  });

  describe('SCENARIO 1: Regular 7-day trial (no discount)', () => {
    it('should set user to trial status with 7-day end date', async () => {
      const uid = 'regular-trial-user';
      const customerId = 'cus_regular_trial';
      const subscriptionId = 'sub_regular_trial';
      
      // Create test user
      const user = createTestUser(uid, 'regular@test.com');
      user.stripeCustomerId = customerId;
      await putUser(env, uid, user);
      
      // Simulate checkout session completion (free trial, no discount)
      const session = {
        id: 'cs_regular_trial',
        customer: customerId,
        subscription: subscriptionId,
        amount_total: 0,
        metadata: { uid },
        total_details: { breakdown: { discounts: [] } }
      };
      
      await handleCheckoutSessionCompleted(c, session, analytics);
      
      // Simulate subscription creation (trialing)
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 604800, // 7 days from now
        discount: null
      };
      
      await handleSubscriptionCreated(c, subscription, analytics);
      
      // Verify user state
      const updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('trial');
      expect(updatedUser.subscription.status).toBe('trial');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.trialEnd).toBeGreaterThan(Date.now());
      expect(updatedUser.trialEndsAt).toBeGreaterThan(Date.now());
    });
  });

  describe('SCENARIO 2: 100% discount coupon (permanent Pro access)', () => {
    it('should set user to active status immediately, not trial', async () => {
      const uid = '100percent-discount-user';
      const customerId = 'cus_100_discount';
      const subscriptionId = 'sub_100_discount';
      
      // Create test user
      const user = createTestUser(uid, '100discount@test.com');
      user.stripeCustomerId = customerId;
      await putUser(env, uid, user);
      
      // Simulate checkout session completion with 100% discount
      const session = {
        id: 'cs_100_discount',
        customer: customerId,
        subscription: subscriptionId,
        amount_total: 0,
        metadata: { uid },
        total_details: { breakdown: { discounts: [{ amount: 600 }] } }
      };
      
      await handleCheckoutSessionCompleted(c, session, analytics);
      
      // Simulate subscription creation with 100% discount
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 604800,
        discount: {
          coupon: {
            percent_off: 100
          }
        }
      };
      
      await handleSubscriptionCreated(c, subscription, analytics);
      
      // Verify user state
      const updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('active');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.trialEnd).toBe(null);
      expect(updatedUser.trialEndsAt).toBe(null);
    });
  });

  describe('SCENARIO 3: 50% discount coupon (trial then discounted billing)', () => {
    it('should set user to trial status with discount preserved for billing', async () => {
      const uid = '50percent-discount-user';
      const customerId = 'cus_50_discount';
      const subscriptionId = 'sub_50_discount';
      
      // Create test user
      const user = createTestUser(uid, '50discount@test.com');
      user.stripeCustomerId = customerId;
      await putUser(env, uid, user);
      
      // Simulate checkout session completion with 50% discount
      const session = {
        id: 'cs_50_discount',
        customer: customerId,
        subscription: subscriptionId,
        amount_total: 0,
        metadata: { uid },
        total_details: { breakdown: { discounts: [{ amount: 300 }] } }
      };
      
      await handleCheckoutSessionCompleted(c, session, analytics);
      
      // Simulate subscription creation with 50% discount
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 604800,
        discount: {
          coupon: {
            percent_off: 50
          }
        }
      };
      
      await handleSubscriptionCreated(c, subscription, analytics);
      
      // Verify user state
      const updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('trial');
      expect(updatedUser.subscription.status).toBe('trial');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.trialEnd).toBeGreaterThan(Date.now());
      expect(updatedUser.trialEndsAt).toBeGreaterThan(Date.now());
    });
  });

  describe('SCENARIO 4: Trial converts to active subscription', () => {
    it('should transition from trial to active when trial period ends', async () => {
      const uid = 'trial-to-active-user';
      const customerId = 'cus_trial_active';
      const subscriptionId = 'sub_trial_active';
      
      // Step 1: Create user with trial status
      const user = createTestUser(uid, 'trial2active@test.com');
      user.subscriptionStatus = 'trial';
      user.subscription = {
        status: 'trial',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        trialEnd: Date.now() + 604800000 // 7 days from now
      };
      user.plan = 'pro';
      await putUser(env, uid, user);
      
      // Step 2: Simulate subscription update to active (trial ended)
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'active',
        trial_end: null,
        discount: null
      };
      
      await handleSubscriptionUpdated(c, subscription, analytics);
      
      // Verify user state
      const updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('active');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.plan).toBe('pro');
    });
  });

  describe('SCENARIO 5: Active → Cancelled → Reactivated subscription', () => {
    it('should handle full subscription lifecycle', async () => {
      const uid = 'active-cancel-reactive-user';
      const customerId = 'cus_lifecycle';
      const subscriptionId = 'sub_lifecycle';
      
      // Step 1: Create user with active status
      const user = createTestUser(uid, 'lifecycle@test.com');
      user.subscriptionStatus = 'active';
      user.subscription = {
        status: 'active',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId
      };
      user.plan = 'pro';
      await putUser(env, uid, user);
      
      // Step 2: Cancel subscription
      const cancelledSubscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'canceled',
        trial_end: null,
        discount: null
      };
      
      await handleSubscriptionUpdated(c, cancelledSubscription, analytics);
      
      // Verify cancelled state
      let updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('cancelled');
      expect(updatedUser.subscription.status).toBe('cancelled');
      expect(updatedUser.plan).toBe('free');
      
      // Step 3: Reactivate with new subscription (with discount)
      const newSubscriptionId = 'sub_reactivated';
      
      // Simulate new checkout session
      const reactivationSession = {
        id: 'cs_reactivation',
        customer: customerId,
        subscription: newSubscriptionId,
        amount_total: 540, // $5.40 (10% discount)
        metadata: { uid },
        total_details: { breakdown: { discounts: [{ amount: 60 }] } }
      };
      
      await handleCheckoutSessionCompleted(c, reactivationSession, analytics);
      
      // Simulate new subscription creation
      const reactivatedSubscription = {
        id: newSubscriptionId,
        customer: customerId,
        status: 'active',
        trial_end: null,
        discount: {
          coupon: {
            percent_off: 10
          }
        }
      };
      
      await handleSubscriptionCreated(c, reactivatedSubscription, analytics);
      
      // Verify reactivated state
      updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('active');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.stripeSubscriptionId).toBe(newSubscriptionId);
    });
  });

  describe('SCENARIO 6: Trial → Cancel → Resubscribe with partial one-time discount', () => {
    it('should handle trial cancellation and resubscription with coupon', async () => {
      const uid = 'trial-cancel-coupon-user';
      const customerId = 'cus_trial_coupon';
      const subscriptionId = 'sub_trial_coupon';
      
      // Step 1: Create user with trial status
      const user = createTestUser(uid, 'trialcoupon@test.com');
      user.subscriptionStatus = 'trial';
      user.subscription = {
        status: 'trial',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        trialEnd: Date.now() + 604800000
      };
      user.plan = 'pro';
      await putUser(env, uid, user);
      
      // Step 2: Cancel during trial
      const cancelledSubscription = {
        id: subscriptionId,
        customer: customerId
      };
      
      await handleSubscriptionDeleted(c, cancelledSubscription, analytics);
      
      // Verify cancelled state
      let updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('cancelled');
      expect(updatedUser.subscription.status).toBe('cancelled');
      expect(updatedUser.plan).toBe('free');
      
      // Step 3: Resubscribe with 25% one-time discount
      const newSubscriptionId = 'sub_resub_coupon';
      
      // Simulate resubscription checkout (one-time discount, so paid immediately)
      const resubSession = {
        id: 'cs_resub_coupon',
        customer: customerId,
        subscription: newSubscriptionId,
        amount_total: 450, // $4.50 (25% discount)
        metadata: { uid },
        total_details: { breakdown: { discounts: [{ amount: 150 }] } }
      };
      
      await handleCheckoutSessionCompleted(c, resubSession, analytics);
      
      // For one-time discount, goes directly to active (no trial)
      const resubSubscription = {
        id: newSubscriptionId,
        customer: customerId,
        status: 'active',
        trial_end: null,
        discount: {
          coupon: {
            percent_off: 25,
            duration: 'once'
          }
        }
      };
      
      await handleSubscriptionCreated(c, resubSubscription, analytics);
      
      // Verify resubscription state
      updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('active');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.stripeSubscriptionId).toBe(newSubscriptionId);
    });
  });

  describe('SCENARIO 7: Payment failure and recovery', () => {
    it('should handle payment failures and successful recovery', async () => {
      const uid = 'payment-fail-recover-user';
      const customerId = 'cus_payment_fail';
      const subscriptionId = 'sub_payment_fail';
      
      // Step 1: Create user with active status
      const user = createTestUser(uid, 'paymentfail@test.com');
      user.subscriptionStatus = 'active';
      user.subscription = {
        status: 'active',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId
      };
      user.plan = 'pro';
      await putUser(env, uid, user);
      
      // Step 2: Payment fails
      const failedInvoice = {
        id: 'inv_failed',
        customer: customerId,
        subscription: subscriptionId,
        amount_due: 600,
        currency: 'usd'
      };
      
      await handlePaymentFailed(c, failedInvoice, analytics);
      
      // Verify past_due status
      let updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('past_due');
      expect(updatedUser.subscription.status).toBe('past_due');
      
      // Step 3: Payment succeeds (recovery)
      const succeededInvoice = {
        id: 'inv_succeeded',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: 600,
        currency: 'usd'
      };
      
      await handlePaymentSucceeded(c, succeededInvoice, analytics);
      
      // Update subscription back to active
      const recoveredSubscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'active',
        trial_end: null,
        discount: null
      };
      
      await handleSubscriptionUpdated(c, recoveredSubscription, analytics);
      
      // Verify recovery
      updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('active');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.lastPaymentAt).toBeDefined();
    });
  });

  describe('SCENARIO 8: 10% discount with forever duration', () => {
    it('should maintain 10% discount permanently', async () => {
      const uid = '10percent-forever-user';
      const customerId = 'cus_10_forever';
      const subscriptionId = 'sub_10_forever';
      
      // Create test user
      const user = createTestUser(uid, '10forever@test.com');
      user.stripeCustomerId = customerId;
      await putUser(env, uid, user);
      
      // Simulate subscription creation with 10% forever discount
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 604800,
        discount: {
          coupon: {
            percent_off: 10,
            duration: 'forever'
          }
        }
      };
      
      await handleSubscriptionCreated(c, subscription, analytics);
      
      // Verify user state - should still be trial with discount preserved
      const updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('trial');
      expect(updatedUser.subscription.status).toBe('trial');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.trialEnd).toBeGreaterThan(Date.now());
    });
  });

  describe('SCENARIO 9: Edge case - Multiple rapid state changes', () => {
    it('should handle rapid succession of webhook events correctly', async () => {
      const uid = 'rapid-changes-user';
      const customerId = 'cus_rapid';
      const subscriptionId = 'sub_rapid';
      
      // Create test user
      const user = createTestUser(uid, 'rapid@test.com');
      user.stripeCustomerId = customerId;
      await putUser(env, uid, user);
      
      // Rapid sequence: checkout → subscription → active → payment fail → recover
      
      // 1. Checkout session
      const session = {
        id: 'cs_rapid',
        customer: customerId,
        subscription: subscriptionId,
        amount_total: 600,
        metadata: { uid },
        total_details: { breakdown: { discounts: [] } }
      };
      
      await handleCheckoutSessionCompleted(c, session, analytics);
      
      // 2. Subscription created (active, no trial)
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'active',
        trial_end: null,
        discount: null
      };
      
      await handleSubscriptionCreated(c, subscription, analytics);
      
      // 3. Payment fails immediately
      const failedInvoice = {
        id: 'inv_rapid_fail',
        customer: customerId,
        subscription: subscriptionId,
        amount_due: 600,
        currency: 'usd'
      };
      
      await handlePaymentFailed(c, failedInvoice, analytics);
      
      // 4. Payment succeeds (quick recovery)
      const succeededInvoice = {
        id: 'inv_rapid_success',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: 600,
        currency: 'usd'
      };
      
      await handlePaymentSucceeded(c, succeededInvoice, analytics);
      
      // 5. Subscription updated to active
      const activeSubscription = {
        id: subscriptionId,
        customer: customerId,
        status: 'active',
        trial_end: null,
        discount: null
      };
      
      await handleSubscriptionUpdated(c, activeSubscription, analytics);
      
      // Verify final state is correct
      const updatedUser = await getUser(env, uid);
      expect(updatedUser.subscriptionStatus).toBe('active');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.subscription.lastPaymentAt).toBeDefined();
    });
  });
});