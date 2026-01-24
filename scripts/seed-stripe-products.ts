import Stripe from 'stripe';

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', 'development');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.secret) {
    throw new Error('Stripe connection not found');
  }

  return connectionSettings.settings.secret;
}

async function createProducts() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: '2025-11-17.clover' });

  console.log('Creating subscription products...');

  const existingProducts = await stripe.products.search({ query: "name:'Premium Suite'" });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist. Skipping creation.');
    return;
  }

  const premiumProduct = await stripe.products.create({
    name: 'Premium Suite',
    description: 'All 6 modules including Recipe Costing, Tip Payout, Cash Deposit, Coffee Ordering, Equipment Maintenance, and Admin Tasks. Up to 5 locations.',
    metadata: {
      plan_id: 'premium',
      max_locations: '5',
      modules: 'recipe-costing,tip-payout,cash-deposit,bulk-ordering,equipment-maintenance,admin-tasks'
    }
  });

  const premiumMonthlyPrice = await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 9999,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { billing_period: 'monthly' }
  });

  const premiumAnnualPrice = await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 99999,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { billing_period: 'annual' }
  });

  console.log('Created Premium Suite product:', premiumProduct.id);
  console.log('  Monthly price:', premiumMonthlyPrice.id, '$99.99/mo');
  console.log('  Annual price:', premiumAnnualPrice.id, '$999.99/yr');

  const testEvalProduct = await stripe.products.create({
    name: 'Test & Eval',
    description: 'Full-featured access for testing and evaluation. All modules included. Up to 3 locations.',
    metadata: {
      plan_id: 'test_eval',
      max_locations: '3',
      modules: 'recipe-costing,tip-payout,cash-deposit,bulk-ordering,equipment-maintenance,admin-tasks'
    }
  });

  const testEvalPrice = await stripe.prices.create({
    product: testEvalProduct.id,
    unit_amount: 4999,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { billing_period: 'monthly' }
  });

  console.log('Created Test & Eval product:', testEvalProduct.id);
  console.log('  Monthly price:', testEvalPrice.id, '$49.99/mo');

  // Recipe Cost Manager - $19.99/mo
  const recipeCostProduct = await stripe.products.create({
    name: 'Recipe Cost Manager',
    description: 'Track ingredients, create recipes, and calculate precise food costs.',
    metadata: {
      plan_id: 'alacarte',
      module_id: 'recipe-costing'
    }
  });

  const recipeCostPrice = await stripe.prices.create({
    product: recipeCostProduct.id,
    unit_amount: 1999,
    currency: 'usd',
    recurring: { interval: 'month' }
  });

  console.log('Created Recipe Cost Manager module:', recipeCostProduct.id, '$19.99/mo');

  const tipPayoutProduct = await stripe.products.create({
    name: 'Tip Payout Calculator',
    description: 'Calculate and distribute employee tips efficiently.',
    metadata: {
      plan_id: 'alacarte',
      module_id: 'tip-payout'
    }
  });

  const tipPayoutPrice = await stripe.prices.create({
    product: tipPayoutProduct.id,
    unit_amount: 1999,
    currency: 'usd',
    recurring: { interval: 'month' }
  });

  console.log('Created Tip Payout module:', tipPayoutProduct.id, '$19.99/mo');

  const cashDepositProduct = await stripe.products.create({
    name: 'Cash Deposit Record',
    description: 'Track cash deposits and reconciliation.',
    metadata: {
      plan_id: 'alacarte',
      module_id: 'cash-deposit'
    }
  });

  const cashDepositPrice = await stripe.prices.create({
    product: cashDepositProduct.id,
    unit_amount: 1999,
    currency: 'usd',
    recurring: { interval: 'month' }
  });

  console.log('Created Cash Deposit module:', cashDepositProduct.id, '$19.99/mo');

  const coffeeOrderProduct = await stripe.products.create({
    name: 'Bulk Coffee Ordering',
    description: 'Manage wholesale coffee orders efficiently.',
    metadata: {
      plan_id: 'alacarte',
      module_id: 'bulk-ordering'
    }
  });

  const coffeeOrderPrice = await stripe.prices.create({
    product: coffeeOrderProduct.id,
    unit_amount: 1999,
    currency: 'usd',
    recurring: { interval: 'month' }
  });

  console.log('Created Coffee Ordering module:', coffeeOrderProduct.id, '$19.99/mo');

  const equipmentProduct = await stripe.products.create({
    name: 'Equipment Maintenance',
    description: 'Schedule and track equipment upkeep.',
    metadata: {
      plan_id: 'alacarte',
      module_id: 'equipment-maintenance'
    }
  });

  const equipmentPrice = await stripe.prices.create({
    product: equipmentProduct.id,
    unit_amount: 1999,
    currency: 'usd',
    recurring: { interval: 'month' }
  });

  console.log('Created Equipment Maintenance module:', equipmentProduct.id, '$19.99/mo');

  const adminTasksProduct = await stripe.products.create({
    name: 'Administrative Tasks',
    description: 'Comprehensive task management and delegation.',
    metadata: {
      plan_id: 'alacarte',
      module_id: 'admin-tasks'
    }
  });

  const adminTasksPrice = await stripe.prices.create({
    product: adminTasksProduct.id,
    unit_amount: 1999,
    currency: 'usd',
    recurring: { interval: 'month' }
  });

  console.log('Created Admin Tasks module:', adminTasksProduct.id, '$19.99/mo');

  console.log('\nAll products created successfully!');
}

createProducts().catch(console.error);
