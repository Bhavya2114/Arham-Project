import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';

describe('Product Default Selling Price Persistence Integration Tests', () => {
  let adminToken: string;
  let supplierId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const timestamp = Date.now();
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Selling Price Test Supplier ${timestamp}`, mobile: `98${timestamp.toString().slice(-8)}` });

    supplierId = supRes.body.data.id;
  });

  it('Test A & B — Edits to Default Selling Price during purchase persist to DB and load on subsequent fetch', async () => {
    const timestamp = Date.now();
    const sku = `PROD-SELL-AB-${timestamp}`;

    // 1. Create initial product with sellingPrice = 120
    const initialProdRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Product AB ${timestamp}`,
        sku: sku,
        category: 'General',
        costPrice: 40,
        unitPrice: 120,
        sellingPrice: 120,
      });

    expect(initialProdRes.status).toBe(201);
    const productId = initialProdRes.body.data.id;
    expect(initialProdRes.body.data.sellingPrice).toBe(120);

    // 2. Start purchase (Test A): user changes sellingPrice to 200 while purchasePrice is 50
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-AB1-${timestamp}`,
        items: [
          {
            productId,
            purchasePrice: 50,
            sellingPrice: 200,
            quantity: 5,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);

    // 3. Verify Product document in MongoDB is updated to 200
    const updatedProdInDb = await Product.findById(productId);
    expect(updatedProdInDb?.costPrice).toBe(50);
    expect(updatedProdInDb?.sellingPrice).toBe(200);

    // 4. Test B: Next purchase / GET /api/products fetches product -> sellingPrice automatically shows 200
    const getProdsRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    const fetchedProd = getProdsRes.body.data.find((p: any) => p.id === productId || p._id === productId);
    expect(fetchedProd).toBeDefined();
    expect(fetchedProd.sellingPrice).toBe(200);
  });

  it('Test C — Supplier bill purchase cost does NOT overwrite sellingPrice; user update to 250 persists', async () => {
    const timestamp = Date.now();
    const sku = `PROD-SELL-C-${timestamp}`;

    // 1. Create initial product with sellingPrice = 200
    const initialProdRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Product C ${timestamp}`,
        sku: sku,
        category: 'General',
        costPrice: 60,
        unitPrice: 200,
        sellingPrice: 200,
      });

    const productId = initialProdRes.body.data.id;

    // 2. Save purchase with supplier bill cost 80, but user updates sellingPrice to 250
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-C-${timestamp}`,
        items: [
          {
            productId,
            purchasePrice: 80, // Supplier bill cost price
            sellingPrice: 250, // User edited default selling price
            quantity: 10,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);

    // 3. Verify Product in DB has costPrice = 80 and sellingPrice = 250 (NOT 80)
    const dbProd = await Product.findById(productId);
    expect(dbProd?.costPrice).toBe(80);
    expect(dbProd?.sellingPrice).toBe(250);

    // 4. Subsequent fetch shows 250
    const getProdsRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    const fetchedProd = getProdsRes.body.data.find((p: any) => p.id === productId || p._id === productId);
    expect(fetchedProd.sellingPrice).toBe(250);
  });
});
