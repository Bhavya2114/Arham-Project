import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Sales & Billing API integration tests (Phase 7.3.1.1 Price & GST Fix)', () => {
  let adminToken: string;
  let customerId: string;
  let productId: string;
  let product2Id: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const timestamp = Date.now();
    // Create a customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 7.3.1.1 Test Customer',
        mobile: `98${timestamp.toString().slice(-8)}`,
        type: 'RETAIL',
        address: '456 POS Street',
        status: 'ACTIVE',
        businessName: 'POS Retail',
      });
    customerId = custRes.body.data.id;

    // Create Product 1: Master Selling Price = 100, Master GST Rate = 18%, Stock = 30
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'POS Test Product 1',
        sku: `POS-P1-${timestamp}`,
        category: 'Test Category',
        costPrice: 50,
        unitPrice: 100,
        gstRate: 18,
        currentStock: 30,
        minStockQuantity: 5,
        location: 'Rack P1',
      });
    productId = prodRes.body.data.id;

    // Create Product 2: Master Selling Price = 40, Master GST Rate = 12%, Stock = 20
    const prod2Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'POS Test Product 2',
        sku: `POS-P2-${timestamp}`,
        category: 'Test Category',
        costPrice: 20,
        unitPrice: 40,
        gstRate: 12,
        currentStock: 20,
        minStockQuantity: 5,
        location: 'Rack P2',
      });
    product2Id = prod2Res.body.data.id;
  });

  it('Test B & C — Enter custom transaction selling price without overwriting Product.sellingPrice', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            sellingPrice: 120,
            gstRate: 18,
            quantity: 2,
          },
        ],
        paymentMode: 'CASH',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items[0].sellingPrice).toBe(120);

    // Verify Product Master sellingPrice / unitPrice remains 100
    const prodCheck = await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(prodCheck.body.data.unitPrice).toBe(100);
  });

  it('Test D — Custom transaction GST rate (18% -> 5%) without modifying Product master GST', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            sellingPrice: 100,
            gstRate: 5, // Custom GST 5%
            quantity: 2,
          },
        ],
      });

    expect(res.status).toBe(201);
    const item = res.body.data.items[0];
    expect(item.gstRate).toBe(5);
    expect(item.gstAmount).toBe(10); // (200 * 5%) = 10
    expect(res.body.data.subtotal).toBe(200);
    expect(res.body.data.totalGst).toBe(10);
    expect(res.body.data.grandTotal).toBe(210);

    // Master product GST rate should still be 18
    const prodCheck = await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(prodCheck.body.data.gstRate).toBe(18);
  });

  it('Test E — Financial math (120 x 2 @ 18% GST -> Subtotal 240, GST 43.20, Grand Total 283.20)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            sellingPrice: 120,
            gstRate: 18,
            quantity: 2,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(240);
    expect(res.body.data.totalGst).toBe(43.20);
    expect(res.body.data.grandTotal).toBe(283.20);
  });

  it('Test F — Zero GST transaction (100 x 2 @ 0% GST -> Subtotal 200, GST 0, Grand Total 200)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            sellingPrice: 100,
            gstRate: 0, // Zero GST
            quantity: 2,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(200);
    expect(res.body.data.totalGst).toBe(0);
    expect(res.body.data.grandTotal).toBe(200);
  });

  it('Test G — Invalid selling price (<= 0) blocks sale creation', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            sellingPrice: 0, // 0 is invalid
            quantity: 1,
          },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('Test H — Negative GST rate blocks sale creation', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            sellingPrice: 100,
            gstRate: -5, // Negative GST is invalid
            quantity: 1,
          },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('Test I — Independent cart line items with custom price and GST', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          { productId: productId, sellingPrice: 120, gstRate: 5, quantity: 1 },
          { productId: product2Id, sellingPrice: 50, gstRate: 18, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items.length).toBe(2);

    const item1 = res.body.data.items.find((i: any) => i.productId === productId);
    const item2 = res.body.data.items.find((i: any) => i.productId === product2Id);

    expect(item1.sellingPrice).toBe(120);
    expect(item1.gstRate).toBe(5);

    expect(item2.sellingPrice).toBe(50);
    expect(item2.gstRate).toBe(18);

    // Subtotal: 120 + 100 = 220
    // GST: (120 * 0.05 = 6) + (100 * 0.18 = 18) = 24
    // Grand Total: 244
    expect(res.body.data.subtotal).toBe(220);
    expect(res.body.data.totalGst).toBe(24);
    expect(res.body.data.grandTotal).toBe(244);
  });

  it('Test J — Stock deduction executes correctly after valid custom price/GST sale', async () => {
    const stockBefore = (await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`)).body.data.currentStock;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        items: [
          { productId: productId, sellingPrice: 99, gstRate: 12, quantity: 3 },
        ],
      });

    expect(res.status).toBe(201);

    const stockAfter = (await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`)).body.data.currentStock;
    expect(stockAfter).toBe(stockBefore - 3);
  });
});
