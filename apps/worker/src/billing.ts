// Billing module for Stripe integration
export interface BillingConfig {
  stripeSecretKey: string;
  stripePriceId: string;
  stripeWebhookSecret: string;
  publicBaseUrl: string;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: any;
  };
}

