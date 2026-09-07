import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';

describe('Phase 2 — Purchase Flow Cost Price & Stock Integration Tests (No Selling Price Dependency)', () => {
  let adminToken: string;
  let supplierId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const timestamp = Date.now();
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Cost Price Test Supplier ${timestamp}`, mobile: `98${timestamp.toString().slice(-8)}` });

    supplierId = supRes.body.data.id;
  });

  it('Test 1 — Purchase for existing product WITHOUT sellingPrice updates costPrice and stock', async () => {
    const timestamp = Date.now();
    const sku = `PROD-COST-EX-${timestamp}`;

    // 1. Create initial product with costPrice = 40
    const initialProdRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Existing Material ${timestamp}`,
        sku: sku,
        category: 'General',
        costPrice: 40,
        unitPrice: 40,
        currentStock: 10,
      });

    expect(initialProdRes.status).toBe(201);
    const productId = initialProdRes.body.data.id;

    // 2. Start purchase with supplier bill costPrice / purchasePrice = 65, quantity = 5, NO sellingPrice
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-COST1-${timestamp}`,
        items: [
          {
            productId,
            purchasePrice: 65,
            quantity: 5,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    expect(purchaseRes.body.data.items[0].purchasePrice).toBe(65);
    expect(purchaseRes.body.data.items[0].quantity).toBe(5);

    // 3. Verify Product document in MongoDB has costPrice = 65 and stock = 15
    const updatedProdInDb = await Product.findById(productId);
    expect(updatedProdInDb?.costPrice).toBe(65);
    expect(updatedProdInDb?.currentStock).toBe(15);
  });

  it('Test 2 — Purchase creating a NEW product WITHOUT sellingPrice persists material costPrice and stock', async () => {
    const timestamp = Date.now();
    const newProdName = `New Direct Cable ${timestamp}`;

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-NEW-${timestamp}`,
        items: [
          {
            newProduct: {
              name: newProdName,
              unit: 'Roll',
              costPrice: 1200,
              gstRate: 18,
            },
            purchasePrice: 1200,
            quantity: 8,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);

    // Verify newly created product in MongoDB
    const createdProd = await Product.findOne({ name: newProdName });
    expect(createdProd).toBeDefined();
    expect(createdProd?.costPrice).toBe(1200);
    expect(createdProd?.currentStock).toBe(8);
  });
});
