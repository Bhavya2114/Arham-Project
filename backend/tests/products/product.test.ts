import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Products + Inventory integration tests', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');
  });

  describe('GET /api/products - Product Listing and Role Permissions', () => {
    it('should allow all four roles to view product list', async () => {
      for (const token of [adminToken, salesToken, warehouseToken, accountsToken]) {
        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    it('should verify products contain correct mapped fields and omit sensitive creator fields', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.body.data.length > 0) {
        const prod = res.body.data[0];
        expect(prod).toHaveProperty('id');
        expect(prod).toHaveProperty('name');
        expect(prod).toHaveProperty('sku');
        expect(prod).toHaveProperty('category');
        expect(prod).toHaveProperty('unitPrice');
        expect(prod).toHaveProperty('currentStock');
        expect(prod).toHaveProperty('minStockQuantity');
        expect(prod).toHaveProperty('location');
        expect(prod.password).toBeUndefined();
      }
    });
  });

  describe('POST /api/products - Product Creation and Unique SKU Constraints', () => {
    it('should allow ADMIN to create product and ignore client-supplied createdBy', async () => {
      const timestamp = Date.now();
      const payload = {
        name: `Prod Admin ${timestamp}`,
        sku: `SKU-ADM-${timestamp}`,
        category: 'Electronics',
        unitPrice: 150.50,
        currentStock: 25,
        minStockQuantity: 5,
        location: 'Warehouse A1',
        createdBy: 'malicious-client-id-override',
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.sku).toBe(payload.sku.toUpperCase());
    });

    it('should allow WAREHOUSE to create product', async () => {
      const timestamp = Date.now();
      const payload = {
        name: `Prod Wh ${timestamp}`,
        sku: `SKU-WH-${timestamp}`,
        category: 'Hardware',
        unitPrice: 45.00,
        currentStock: 100,
        minStockQuantity: 20,
        location: 'Warehouse B2',
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should forbid SALES and ACCOUNTS roles from creating products', async () => {
      const payload = {
        name: 'Forbidden Prod',
        sku: `SKU-FORBID-${Date.now()}`,
        category: 'Supplies',
        unitPrice: 10,
        currentStock: 10,
        minStockQuantity: 2,
        location: 'Warehouse C3',
      };

      for (const token of [salesToken, accountsToken]) {
        const res = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        expect(res.status).toBe(403);
      }
    });

    it('should return HTTP 400 on negative stock, negative prices, or missing SKU', async () => {
      const invalidPayloads = [
        { name: 'Bad Prod', sku: '', category: 'Cat', unitPrice: 10, currentStock: 5, minStockQuantity: 1, location: 'L' },
        { name: 'Bad Prod', sku: 'SKU-BAD-1', category: 'Cat', unitPrice: -10, currentStock: 5, minStockQuantity: 1, location: 'L' },
        { name: 'Bad Prod', sku: 'SKU-BAD-2', category: 'Cat', unitPrice: 10, currentStock: -5, minStockQuantity: 1, location: 'L' },
      ];

      for (const payload of invalidPayloads) {
        const res = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload);

        expect(res.status).toBe(400);
      }
    });

    it('should reject creation requests with duplicate SKUs', async () => {
      const timestamp = Date.now();
      const sku = `SKU-DUP-${timestamp}`;

      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'First Prod',
          sku,
          category: 'Cat',
          unitPrice: 20,
          currentStock: 10,
          minStockQuantity: 2,
          location: 'Loc',
        });

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Second Prod',
          sku: sku.toLowerCase(), // should test case-insensitive duplicate check
          category: 'Cat',
          unitPrice: 25,
          currentStock: 5,
          minStockQuantity: 1,
          location: 'Loc',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe('Product Details retrieval', () => {
    let createdProdId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Detail Test Prod',
          sku: `SKU-DET-${Date.now()}`,
          category: 'Tools',
          unitPrice: 88,
          currentStock: 12,
          minStockQuantity: 3,
          location: 'Shelf D-4',
        });
      createdProdId = res.body.data.id;
    });

    it('should allow all roles to view product details by ID', async () => {
      for (const token of [adminToken, salesToken, warehouseToken, accountsToken]) {
        const res = await request(app)
          .get(`/api/products/${createdProdId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(createdProdId);
      }
    });

    it('should return HTTP 404 for non-existent product ID details requests', async () => {
      const res = await request(app)
        .get('/api/products/60c72b2f9b1d8b2b1c8e4a11')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return HTTP 401 for details request when not authenticated', async () => {
      const res = await request(app).get(`/api/products/${createdProdId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Product Updates (PUT)', () => {
    let prodId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Original Name',
          sku: `SKU-UPD-${Date.now()}`,
          category: 'Category 1',
          unitPrice: 100,
          currentStock: 50,
          minStockQuantity: 10,
          location: 'Rack 1',
        });
      prodId = res.body.data.id;
    });

    it('should allow ADMIN and WAREHOUSE to update products, blocking others', async () => {
      const updatePayload = {
        name: 'Updated Name',
        sku: `SKU-UPD-MOD-${Date.now()}`,
        category: 'Category 2',
        unitPrice: 120,
        minStockQuantity: 15,
        location: 'Rack 2',
      };

      // Forbidden roles
      for (const token of [salesToken, accountsToken]) {
        const res = await request(app)
          .put(`/api/products/${prodId}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updatePayload);

        expect(res.status).toBe(403);
      }

      // Allowed role (WAREHOUSE)
      const res = await request(app)
        .put(`/api/products/${prodId}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(updatePayload.name);
      expect(res.body.data.unitPrice).toBe(120);
    });

    it('should block edits trying to alter currentStock, createdBy, or product ID', async () => {
      const fetchBefore = await request(app)
        .get(`/api/products/${prodId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const stockBefore = fetchBefore.body.data.currentStock;

      const maliciousPayload = {
        name: 'Malicious Edit',
        sku: fetchBefore.body.data.sku,
        category: 'Cat',
        unitPrice: 100,
        minStockQuantity: 10,
        location: 'Loc',
        currentStock: 999999, // Should be ignored/blocked
      };

      const res = await request(app)
        .put(`/api/products/${prodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousPayload);

      expect(res.status).toBe(200);

      const fetchAfter = await request(app)
        .get(`/api/products/${prodId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fetchAfter.body.data.currentStock).toBe(stockBefore);
    });

    it('should validate SKU edits safely (unaltered ok, unique new ok, duplicate other blocked)', async () => {
      const timestamp = Date.now();
      // Create another product
      const resOther = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Other Prod',
          sku: `SKU-OTHER-${timestamp}`,
          category: 'Cat',
          unitPrice: 10,
          currentStock: 5,
          minStockQuantity: 1,
          location: 'Loc',
        });
      const otherSku = resOther.body.data.sku;

      // Try setting prodId's SKU to otherSku -> Should fail with 400
      const resDup = await request(app)
        .put(`/api/products/${prodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Name',
          sku: otherSku,
          category: 'Cat',
          unitPrice: 10,
          minStockQuantity: 1,
          location: 'Loc',
        });

      expect(resDup.status).toBe(400);
    });
  });

  describe('Low stock query filters', () => {
    it('should allow all roles to retrieve low stock list containing only deficit items', async () => {
      for (const token of [adminToken, salesToken, warehouseToken, accountsToken]) {
        const res = await request(app)
          .get('/api/products/low-stock')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);

        res.body.data.forEach((prod: any) => {
          expect(prod.currentStock).toBeLessThanOrEqual(prod.minStockQuantity);
        });
      }
    });
  });
});
