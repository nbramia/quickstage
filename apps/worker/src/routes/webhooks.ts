import Stripe from 'stripe';
import { getAnalyticsManager } from '../worker-utils';
import {
  handleCheckoutSessionCompleted,
  handleCustomerCreated,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleCustomerDeleted,
  handlePaymentSucceeded,
  handlePaymentFailed
} from '../stripe';

// Webhook route handlers
export async function handleStripeWebhook(c: any) {
  try {
    // Check if Stripe secret key is available
    if (!c.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Check if Stripe webhook secret is available
    if (!c.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    const sig = c.req.header('stripe-signature');
    const rawBody = await c.req.text();
    
    if (!sig) {
      console.error('No Stripe signature found');
      return c.json({ error: 'no_signature' }, 400);
    }
    
    let event: any;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        sig,
        c.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return c.json({ error: 'bad_signature' }, 400);
    }
    
    console.log(`Processing Stripe webhook: ${event.type}`);
    
    // Handle various Stripe webhook events
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Handling checkout.session.completed event');
        await handleCheckoutSessionCompleted(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'customer.created':
        console.log('Handling customer.created event');
        await handleCustomerCreated(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'customer.subscription.created':
        console.log('Handling customer.subscription.created event');
        await handleSubscriptionCreated(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'customer.subscription.updated':
        console.log('Handling customer.subscription.updated event');
        await handleSubscriptionUpdated(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'customer.subscription.deleted':
        console.log('Handling customer.subscription.deleted event');
        await handleSubscriptionDeleted(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'customer.deleted':
        console.log('Handling customer.deleted event');
        await handleCustomerDeleted(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'invoice.payment_succeeded':
        console.log('Handling invoice.payment_succeeded event');
        await handlePaymentSucceeded(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'invoice.payment_failed':
        console.log('Handling invoice.payment_failed event');
        await handlePaymentFailed(c, event.data.object, getAnalyticsManager(c));
        break;
        
      case 'customer.updated':
        console.log('Handling customer.updated event');
        // Customer updates don't require immediate action
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
        console.log('Event data:', JSON.stringify(event.data, null, 2));
    }
    
    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Track analytics event for webhook processing error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'stripe_webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for webhook error:', analyticsError);
    }
    
    return c.json({ error: 'webhook_processing_failed' }, 500);
  }
}