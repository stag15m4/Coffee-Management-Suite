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

async function updatePrices() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: '2025-11-17.clover' });

  console.log('Updating product prices...\n');

  const products = await stripe.products.list({ limit: 100, active: true });

  for (const product of products.data) {
    const prices = await stripe.prices.list({ product: product.id, active: true });
    
    let newAmount: number | null = null;
    
    if (product.name === 'Cash Deposit Record') {
      newAmount = 999; // $9.99
    } else if (product.name === 'Bulk Coffee Ordering') {
      newAmount = 999; // $9.99
    }
    
    if (newAmount !== null) {
      for (const price of prices.data) {
        if (price.recurring?.interval === 'month') {
          await stripe.prices.update(price.id, { active: false });
          
          const newPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: newAmount,
            currency: 'usd',
            recurring: { interval: 'month' }
          });
          
          console.log(`Updated ${product.name}: $${(newAmount / 100).toFixed(2)}/mo (new price: ${newPrice.id})`);
        }
      }
    }
  }

  const existingRecipe = products.data.find(p => p.name === 'Recipe Cost Manager');
  
  if (!existingRecipe) {
    const recipeProduct = await stripe.products.create({
      name: 'Recipe Cost Manager',
      description: 'Track ingredients, create recipes, and calculate food costs.',
      metadata: {
        plan_id: 'alacarte',
        module_id: 'recipe-costing'
      }
    });

    const recipePrice = await stripe.prices.create({
      product: recipeProduct.id,
      unit_amount: 3999, // $39.99
      currency: 'usd',
      recurring: { interval: 'month' }
    });

    console.log(`Created Recipe Cost Manager: $39.99/mo (${recipePrice.id})`);
  } else {
    console.log('Recipe Cost Manager already exists, updating price...');
    const prices = await stripe.prices.list({ product: existingRecipe.id, active: true });
    
    for (const price of prices.data) {
      if (price.recurring?.interval === 'month') {
        await stripe.prices.update(price.id, { active: false });
      }
    }
    
    const newPrice = await stripe.prices.create({
      product: existingRecipe.id,
      unit_amount: 3999,
      currency: 'usd',
      recurring: { interval: 'month' }
    });
    
    console.log(`Updated Recipe Cost Manager: $39.99/mo (${newPrice.id})`);
  }

  console.log('\n--- UPDATED PRICING ---');
  console.log('Premium Suite: $99.99/mo, $999.99/yr');
  console.log('Recipe Cost Manager: $39.99/mo');
  console.log('Tip Payout Calculator: $19.99/mo');
  console.log('Equipment Maintenance: $19.99/mo');
  console.log('Administrative Tasks: $19.99/mo');
  console.log('Cash Deposit Record: $9.99/mo');
  console.log('Coffee Ordering: $9.99/mo');
  console.log('\nPrices updated successfully!');
}

updatePrices().catch(console.error);
