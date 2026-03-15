import Stripe from 'stripe';

function getSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return secretKey;
}

export async function getUncachableStripeClient() {
  const secretKey = getSecretKey();

  return new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
  });
}

export async function getStripeSecretKey() {
  return getSecretKey();
}

export async function getStripePublishableKey() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error('STRIPE_PUBLISHABLE_KEY environment variable is not set');
  }
  return publishableKey;
}
