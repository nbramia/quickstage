export type Bindings = {
  KV_USERS: any; // KVNamespace (Workers type at runtime)
  KV_SNAPS: any; // KVNamespace
  R2_SNAPSHOTS: any; // R2Bucket
  COMMENTS_DO: any; // DurableObjectNamespace
  SESSION_HMAC_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  PUBLIC_BASE_URL: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  RP_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID: string;
  STRIPE_WEBHOOK_SECRET: string;
};


