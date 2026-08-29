import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Purchases API integration tests', () => {
  let adminToken: string;
  let supplierId: string;
  let productId: string;
  let productSku: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const timestamp = Date.now();
    productSku = `PUR-TEST-${timestamp}`;

    // Create a supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Purchase Test Supplier', mobile: `99${timestamp.toString().slice(-8)}` });
    supplierId = supRes.body.data.id;

    // Create a product
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Purchase Test Prod',
        sku: productSku,
        category: 'Test Category',
        unitPrice: 100,
        currentStock: 10,
        minStockQuantity: 5,
        location: 'Rack P1',
      });
    productId = prodRes.body.data.id;
  });

  it('should create a purchase entry, auto-increment stock, and calculate subtotal/GST/grandTotal', async () => {
    const initialStockRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const stockBefore = initialStockRes.body.data.currentStock;

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 1000,
            quantity: 2,
            taxRate: 18,
          },
        ],
        notes: 'Bulk purchase test for financial accuracy',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.purchaseNumber).toBeDefined();
    expect(res.body.data.items.length).toBe(1);

    const item = res.body.data.items[0];
    expect(item.productName).toBe('Purchase Test Prod');
    expect(item.sku).toBe(productSku);
    expect(item.purchasePrice).toBe(1000);
    expect(item.quantity).toBe(2);
    expect(item.taxRate).toBe(18);
    expect(item.totalCost).toBe(2360); // 2000 + 360 GST
    expect(item.lineTotal).toBe(2360);

    // Verify subtotal, taxAmount, totalAmount, grandTotal, totalGst
    expect(res.body.data.subtotal).toBe(2000);
    expect(res.body.data.taxAmount).toBe(360);
    expect(res.body.data.totalGst).toBe(360);
    expect(res.body.data.totalAmount).toBe(2360);
    expect(res.body.data.grandTotal).toBe(2360);

    // Verify stock increased by 2
    const stockAfterRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stockAfterRes.body.data.currentStock).toBe(stockBefore + 2);
    expect(stockAfterRes.body.data.costPrice).toBe(1000);
  });

  it('should list all purchases with populated product names and totals', async () => {
    const res = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const lastPurchase = res.body.data[0];
    expect(lastPurchase.grandTotal).toBeGreaterThan(0);
    expect(lastPurchase.totalAmount).toBeGreaterThan(0);
    expect(lastPurchase.items[0].productName).toBeDefined();
    expect(lastPurchase.items[0].productName).not.toMatch(/^[0-9a-fA-F]{24}$/); // Not raw hex ObjectId
  });

  it('should reject purchase with non-existent supplier ID', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId: '60c72b2f9b1d8b2b1c8e4a11',
        items: [{ productId, purchasePrice: 50, quantity: 5 }],
      });

    expect(res.status).toBe(404);
  });

  it('should reject purchase with invalid quantity (zero or negative)', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [{ productId, purchasePrice: 50, quantity: 0 }],
      });

    expect(res.status).toBe(400);
  });
});
