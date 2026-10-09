import assert from 'node:assert/strict';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function request(path, { method = 'GET', token = null, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function run() {
  console.log(`[Verify] Probing ${BASE_URL} ...`);

  // 0. Health check
  const health = await request('/api/health');
  assert.equal(health.status, 200, 'Health endpoint should return 200');
  assert.equal(health.json.database, 'connected', 'Database must be connected');
  console.log('  [PASS] GET /api/health');

  // 1. Auth: Register (Institutional Kitchen), Login (Farmer, Buyer, Verifier), /me
  const regInst = await request('/api/auth/register', {
    method: 'POST',
    body: {
      full_name: 'Dhaka University Central Hall Kitchen',
      email: `inst_${Date.now()}@khamari.local`,
      phone: `+88016${Math.floor(10000000 + Math.random() * 89999999)}`,
      password: 'Password123!',
      role: 'INSTITUTION',
      organization_name: 'DU Central Mess Procurement',
      region: 'Dhaka - Shahbagh',
    },
  });
  assert.equal(regInst.status, 201);
  const instToken = regInst.json.data.token;

  const farmerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'rahim@khamari.local', password: 'Khamari@123' },
  });
  assert.equal(farmerLogin.status, 200);
  const farmerToken = farmerLogin.json.data.token;

  const buyerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'buyer1@khamari.local', password: 'Khamari@123' },
  });
  assert.equal(buyerLogin.status, 200);
  const buyerToken = buyerLogin.json.data.token;

  const verifierLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'verifier@khamari.local', password: 'Khamari@123' },
  });
  assert.equal(verifierLogin.status, 200);
  const verifierToken = verifierLogin.json.data.token;

  const me = await request('/api/auth/me', { token: buyerToken });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.user.role, 'BUYER');
  console.log('  [PASS] POST /api/auth/register, POST /api/auth/login, GET /api/auth/me');

  // 2. RBAC check: Buyer cannot publish Bazaar prices
  const forbiddenBazaar = await request('/api/bazaar-prices', {
    method: 'POST',
    token: buyerToken,
    body: {
      crop_category: 'Potato (Diamond)',
      bazaar_region: 'Bogura',
      min_price: 20,
      modal_price: 25,
      max_price: 30,
    },
  });
  assert.equal(forbiddenBazaar.status, 403);

  // 3. Bazaar Prices GET, GET /latest, POST
  const allPrices = await request('/api/bazaar-prices');
  assert.equal(allPrices.status, 200);
  assert.ok(allPrices.json.data.length >= 4);

  const latestPrices = await request('/api/bazaar-prices/latest');
  assert.equal(latestPrices.status, 200);
  assert.ok(latestPrices.json.data.length >= 4);

  const postPrice = await request('/api/bazaar-prices', {
    method: 'POST',
    token: verifierToken,
    body: {
      crop_category: 'Potato (Diamond)',
      bazaar_region: 'Bogura',
      unit: 'KG',
      min_price: 25,
      modal_price: 28,
      max_price: 31,
      market_notes: 'Verified morning wholesale update',
    },
  });
  assert.equal(postPrice.status, 201);
  console.log('  [PASS] GET /api/bazaar-prices, /latest, POST /api/bazaar-prices (+ RBAC 403)');

  // 4. Crops GET, GET /:id, POST, PATCH, price-preview, DELETE
  const cropsRes = await request('/api/crops');
  assert.equal(cropsRes.status, 200);
  assert.ok(cropsRes.json.data.length >= 4);

  const potatoCrop =
    cropsRes.json.data.find((c) => c.crop_category === 'Potato (Diamond)') ||
    cropsRes.json.data[0];

  const firstCropRes = await request(`/api/crops/${potatoCrop.id}`);
  assert.equal(firstCropRes.status, 200);
  assert.ok(firstCropRes.json.data.fair_price_indicator);

  const previewStd = await request(`/api/crops/${potatoCrop.id}/price-preview`, {
    method: 'POST',
    token: buyerToken,
    body: { quantity: 100 },
  });
  assert.equal(previewStd.status, 200);
  assert.equal(previewStd.json.data.strategyUsed, 'STANDARD_WHOLESALE');

  const previewBulk = await request(`/api/crops/${potatoCrop.id}/price-preview`, {
    method: 'POST',
    token: buyerToken,
    body: { quantity: 600 },
  });
  assert.equal(previewBulk.status, 200);
  assert.equal(previewBulk.json.data.strategyUsed, 'BULK_TIER_DISCOUNT');

  const previewInst = await request(`/api/crops/${potatoCrop.id}/price-preview`, {
    method: 'POST',
    token: instToken,
    body: { quantity: 600 },
  });
  assert.equal(previewInst.status, 200);
  assert.equal(previewInst.json.data.strategyUsed, 'INSTITUTIONAL_CONTRACT');

  const newCrop = await request('/api/crops', {
    method: 'POST',
    token: farmerToken,
    body: {
      title: 'Verification Test Potato Batch',
      crop_category: 'Potato (Diamond)',
      variety: 'Diamond',
      bazaar_region: 'Bogura',
      quantity_available: 800,
      min_order_quantity: 50,
      unit: 'KG',
      base_price_per_unit: 28,
      bulk_threshold_qty: 300,
      bulk_discount_pct: 5,
      harvest_date: new Date().toISOString().slice(0, 10),
    },
  });
  assert.equal(newCrop.status, 201);
  const createdCropId = newCrop.json.data.id;

  const patchCrop = await request(`/api/crops/${createdCropId}`, {
    method: 'PATCH',
    token: farmerToken,
    body: { base_price_per_unit: 28.5 },
  });
  assert.equal(patchCrop.status, 200);
  assert.equal(Number(patchCrop.json.data.base_price_per_unit), 28.5);
  console.log('  [PASS] GET, GET/:id, POST, PATCH /api/crops & Strategy price-preview');

  // 5. Negotiations: list, detail, start, counter-offer, message, respond
  const myNegs = await request('/api/negotiations', { token: buyerToken });
  assert.equal(myNegs.status, 200);
  assert.ok(myNegs.json.data.length >= 1);

  const negStart = await request('/api/negotiations', {
    method: 'POST',
    token: buyerToken,
    body: {
      crop_id: createdCropId,
      requested_quantity: 400,
      offered_unit_price: 27,
      initial_message: 'Can take 400 KG today at 27 BDT/KG.',
    },
  });
  assert.equal(negStart.status, 201);
  const negId = negStart.json.data.negotiation.id;

  const negDetail = await request(`/api/negotiations/${negId}`, { token: farmerToken });
  assert.equal(negDetail.status, 200);
  assert.equal(negDetail.json.data.messages.length, 1);

  const counter = await request(`/api/negotiations/${negId}/offer`, {
    method: 'POST',
    token: farmerToken,
    body: { offered_unit_price: 27.5, note: 'Meet halfway at 27.5 BDT/KG.' },
  });
  assert.equal(counter.status, 200);

  const msg = await request(`/api/negotiations/${negId}/messages`, {
    method: 'POST',
    token: buyerToken,
    body: { content: 'Deal! Confirming pickup truck now.' },
  });
  assert.equal(msg.status, 201);
  console.log('  [PASS] GET, POST, /offer, /messages /api/negotiations');

  // 6. Orders: from-negotiation, direct institutional order, list, detail, receipt, status update, stock guard
  const orderFromNeg = await request(`/api/orders/from-negotiation/${negId}`, {
    method: 'POST',
    token: buyerToken,
    body: { delivery_address: 'Karwan Bazar Shed 12, Dhaka' },
  });
  assert.equal(orderFromNeg.status, 201);
  const orderId = orderFromNeg.json.data.order.id;
  assert.equal(orderFromNeg.json.data.receipt.receiptType, 'BAZAAR_CERTIFIED');

  const directInstOrder = await request('/api/orders', {
    method: 'POST',
    token: instToken,
    body: {
      crop_id: createdCropId,
      quantity_ordered: 400,
      delivery_address: 'DU Central Mess Gate 2, Dhaka',
    },
  });
  assert.equal(directInstOrder.status, 201);
  assert.equal(directInstOrder.json.data.receipt.receiptType, 'INSTITUTIONAL_TAX');
  assert.equal(directInstOrder.json.data.order.pricing_strategy_used, 'INSTITUTIONAL_CONTRACT');

  // Remaining stock is now 0 -> crop status should be SOLD_OUT, next order should fail 409
  const oversellAttempt = await request('/api/orders', {
    method: 'POST',
    token: buyerToken,
    body: {
      crop_id: createdCropId,
      quantity_ordered: 50,
      delivery_address: 'Should Fail',
    },
  });
  assert.equal(oversellAttempt.status, 409);

  const myOrders = await request('/api/orders', { token: buyerToken });
  assert.equal(myOrders.status, 200);
  assert.ok(myOrders.json.data.length >= 1);

  const orderDetail = await request(`/api/orders/${orderId}`, { token: buyerToken });
  assert.equal(orderDetail.status, 200);

  const receiptRes = await request(`/api/orders/${orderId}/receipt`, {
    token: buyerToken,
  });
  assert.equal(receiptRes.status, 200);
  assert.ok(receiptRes.json.data.bazaarCorridorSnapshot);

  const patchOrder = await request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    token: farmerToken,
    body: { order_status: 'DISPATCHED' },
  });
  assert.equal(patchOrder.status, 200);
  assert.equal(patchOrder.json.data.order_status, 'DISPATCHED');

  // Archive test crop
  const delCrop = await request(`/api/crops/${createdCropId}`, {
    method: 'DELETE',
    token: farmerToken,
  });
  assert.equal(delCrop.status, 200);
  assert.equal(delCrop.json.data.status, 'ARCHIVED');

  console.log('  [PASS] POST /api/orders, /from-negotiation, GET /receipt, PATCH /status & ACID Stock Lock');
  console.log('[Verify] All backend API & design pattern checks PASSED!');
}

run().catch((err) => {
  console.error('[Verify] FAILED:', err);
  process.exit(1);
});
