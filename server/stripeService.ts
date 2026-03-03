import { getUncachableStripeClient } from './stripeClient';

export class StripeService {
  async createCustomer(email: string, tenantId: string, tenantName: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { tenantId, tenantName },
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    tenantId: string,
    quantity: number = 1
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId },
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.products.retrieve(productId);
    } catch {
      return null;
    }
  }

  async listProducts(active = true, limit = 20) {
    const stripe = await getUncachableStripeClient();
    const result = await stripe.products.list({ active, limit });
    return result.data;
  }

  async listProductsWithPrices(active = true, limit = 20) {
    const stripe = await getUncachableStripeClient();
    const [products, prices] = await Promise.all([
      stripe.products.list({ active, limit }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    return products.data.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      metadata: product.metadata,
      prices: prices.data
        .filter(price => price.product === product.id)
        .map(price => ({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          active: price.active,
          metadata: price.metadata,
        })),
    }));
  }

  async getPrice(priceId: string) {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.prices.retrieve(priceId);
    } catch {
      return null;
    }
  }

  async listPrices(active = true, limit = 20) {
    const stripe = await getUncachableStripeClient();
    const result = await stripe.prices.list({ active, limit });
    return result.data;
  }

  async getSubscription(subscriptionId: string) {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch {
      return null;
    }
  }

  async getSubscriptionDetails(subscriptionId: string) {
    const stripe = await getUncachableStripeClient();
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'latest_invoice', 'items.data.price.product'],
      });

      const pm = subscription.default_payment_method;
      const paymentMethod = pm && typeof pm === 'object' && 'card' in pm ? {
        brand: pm.card?.brand || null,
        last4: pm.card?.last4 || null,
        exp_month: pm.card?.exp_month || null,
        exp_year: pm.card?.exp_year || null,
      } : null;

      const items = subscription.items?.data?.map((item) => ({
        product_name: typeof item.price?.product === 'object' && item.price.product && 'name' in item.price.product ? (item.price.product as any).name : null,
        price_amount: item.price?.unit_amount || 0,
        currency: item.price?.currency || 'usd',
        interval: item.price?.recurring?.interval || null,
      })) || [];

      // In Stripe v20+, current_period is on the latest invoice, not the subscription
      const latestInvoice = subscription.latest_invoice;
      const invoiceObj = latestInvoice && typeof latestInvoice === 'object' ? latestInvoice : null;

      return {
        id: subscription.id,
        status: subscription.status,
        billing_cycle_anchor: subscription.billing_cycle_anchor,
        current_period_end: invoiceObj?.period_end || null,
        current_period_start: invoiceObj?.period_start || null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancel_at: subscription.cancel_at,
        canceled_at: subscription.canceled_at,
        payment_method: paymentMethod,
        items,
      };
    } catch {
      return null;
    }
  }

  async getUpcomingInvoice(customerId: string) {
    const stripe = await getUncachableStripeClient();
    try {
      const invoice = await stripe.invoices.createPreview({ customer: customerId });
      return {
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        next_payment_attempt: invoice.next_payment_attempt,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        lines: invoice.lines?.data?.map((line) => ({
          description: line.description,
          amount: line.amount,
        })) || [],
      };
    } catch {
      return null;
    }
  }

  async createCoupon(percentOff: number, duration: 'once' | 'repeating' | 'forever', metadata?: Record<string, string>) {
    const stripe = await getUncachableStripeClient();
    return await stripe.coupons.create({
      percent_off: percentOff,
      duration,
      duration_in_months: duration === 'repeating' ? 1 : undefined,
      metadata,
    });
  }

  async applySubscriptionDiscount(subscriptionId: string, couponId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.subscriptions.update(subscriptionId, {
      discounts: [{ coupon: couponId }],
    });
  }

  // ── Reseller Invoicing ──────────────────────────────────────────────

  async createResellerCustomer(email: string, resellerId: string, resellerName: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name: resellerName,
      metadata: { resellerId, type: 'reseller' },
    });
  }

  async createResellerInvoice(
    customerId: string,
    lineItems: Array<{ description: string; amount: number; quantity: number }>,
    metadata: Record<string, string>,
    daysUntilDue: number = 30
  ) {
    const stripe = await getUncachableStripeClient();

    // Create an invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      metadata,
      payment_settings: {
        payment_method_types: ['ach_debit', 'card', 'us_bank_account'],
      },
    });

    // Add line items
    for (const item of lineItems) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        description: item.description,
        amount: item.amount, // in cents
        quantity: item.quantity,
        currency: 'usd',
      });
    }

    return invoice;
  }

  async sendInvoice(invoiceId: string) {
    const stripe = await getUncachableStripeClient();
    // Finalize then send
    const finalized = await stripe.invoices.finalizeInvoice(invoiceId);
    const sent = await stripe.invoices.sendInvoice(finalized.id);
    return sent;
  }

  async markInvoicePaidOutOfBand(invoiceId: string) {
    const stripe = await getUncachableStripeClient();
    // Finalize first if still draft
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === 'draft') {
      await stripe.invoices.finalizeInvoice(invoiceId);
    }
    return await stripe.invoices.pay(invoiceId, { paid_out_of_band: true });
  }

  async voidInvoice(invoiceId: string) {
    const stripe = await getUncachableStripeClient();
    // Must be finalized (open) to void — finalize if draft
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === 'draft') {
      await stripe.invoices.finalizeInvoice(invoiceId);
    }
    return await stripe.invoices.voidInvoice(invoiceId);
  }

  async getInvoice(invoiceId: string) {
    const stripe = await getUncachableStripeClient();
    try {
      return await stripe.invoices.retrieve(invoiceId);
    } catch {
      return null;
    }
  }
}

export const stripeService = new StripeService();
