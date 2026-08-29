import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';

describe('Material Consumption API integration tests (Phase 7.2)', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;
  let customerId: string;
  let planningProjectId: string;
  let completedProjectId: string;
  let cancelledProjectId: string;
  let productId: string;
  let createdMaterialId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // 1. Create a customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'PMRDA Infrastructure',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `pmrda_${Date.now()}@infra.com`,
        businessName: 'PMRDA Govt Infra',
        type: 'WHOLESALE',
        status: 'LEAD',
        address: 'Pune Infra HQ',
      });

    if (custRes.status !== 201) {
      console.error('Customer Creation Failed in materialConsumption.test.ts:', custRes.body);
    }
    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;

    // 2. Create Projects (Planning, Completed, Cancelled)
    const p1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `MC-PRJ-1-${Date.now()}`,
        name: 'Metro Line Extension',
        customer: customerId,
        siteAddress: 'Shivajinagar, Pune',
        startDate: '2026-06-01',
        status: 'PLANNING',
      });
    expect(p1.status).toBe(201);
    planningProjectId = p1.body.data.id;

    const p2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `MC-PRJ-2-${Date.now()}`,
        name: 'Finished Flyover',
        customer: customerId,
        siteAddress: 'Aundh, Pune',
        startDate: '2026-01-01',
        status: 'COMPLETED',
      });
    expect(p2.status).toBe(201);
    completedProjectId = p2.body.data.id;

    const p3 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `MC-PRJ-3-${Date.now()}`,
        name: 'Cancelled Road Project',
        customer: customerId,
        siteAddress: 'Kothrud, Pune',
        startDate: '2026-01-01',
        status: 'CANCELLED',
      });
    expect(p3.status).toBe(201);
    cancelledProjectId = p3.body.data.id;

    // 3. Create a Product with initial stock of 100
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'UltraTech Cement Bag 50kg',
        sku: `CEM-${Date.now()}`,
        category: 'Construction Material',
        costPrice: 350,
        unitPrice: 400,
        sellingPrice: 400,
        gstRate: 18,
        currentStock: 100,
        unit: 'Bag',
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
  });

  describe('POST /api/material-consumptions - Issue Material to Project', () => {
    it('should allow WAREHOUSE role to issue material to a project and deduct stock atomically', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 20,
          billingPrice: 400,
          notes: 'Batch 1 cement issued for site foundation',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.quantity).toBe(20);
      expect(res.body.data.actualCostPrice).toBe(350);
      expect(res.body.data.billingPrice).toBe(400);
      expect(res.body.data.actualCostTotal).toBe(7000); // 20 * 350
      expect(res.body.data.billingTotal).toBe(8000); // 20 * 400
      expect(res.body.data.unit).toBe('Bag');

      createdMaterialId = res.body.data.id;

      // Verify stock was reduced from 100 to 80
      const prodCheck = await Product.findById(productId);
      expect(prodCheck?.currentStock).toBe(80);
    });

    it('should accumulate multiple material issues correctly on inventory stock', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.quantity).toBe(30);

      // Verify stock was reduced from 80 to 50
      const prodCheck = await Product.findById(productId);
      expect(prodCheck?.currentStock).toBe(50);
    });

    it('should preserve historical actualCostPrice snapshot when product cost price is updated later', async () => {
      // Update product cost price from 350 to 380
      await Product.findByIdAndUpdate(productId, { costPrice: 380 });

      // Fetch previous material consumption record
      const res = await request(app)
        .get(`/api/material-consumptions/${createdMaterialId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.actualCostPrice).toBe(350);
      expect(res.body.data.actualCostTotal).toBe(7000);
    });

    it('should reject material issue when stock is insufficient (HTTP 409)', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 999, // Current stock is 50
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/insufficient stock/i);

      // Verify stock remains untouched at 50
      const prodCheck = await Product.findById(productId);
      expect(prodCheck?.currentStock).toBe(50);
    });

    it('should reject material issue for COMPLETED project (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: completedProjectId,
          product: productId,
          quantity: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/COMPLETED/i);
    });

    it('should reject material issue for CANCELLED project (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: cancelledProjectId,
          product: productId,
          quantity: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CANCELLED/i);
    });

    it('should return 400 when quantity is zero or negative', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 0,
        });
      expect(res.status).toBe(400);
    });

    it('should return 400 when billing price is negative', async () => {
      const res = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 5,
          billingPrice: -10,
        });
      expect(res.status).toBe(400);
    });

    it('should forbid SALES and ACCOUNTS roles from creating material consumption', async () => {
      const resS = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 5,
        });
      expect(resS.status).toBe(403);

      const resA = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          project: planningProjectId,
          product: productId,
          quantity: 5,
        });
      expect(resA.status).toBe(403);
    });
  });

  describe('GET /api/material-consumptions & GET /api/projects/:id/material-consumptions', () => {
    it('should allow all authenticated roles to view material consumption list', async () => {
      const resAdmin = await request(app)
        .get('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(Array.isArray(resAdmin.body.data)).toBe(true);

      const resSales = await request(app)
        .get('/api/material-consumptions')
        .set('Authorization', `Bearer ${salesToken}`);
      expect(resSales.status).toBe(200);
    });

    it('should retrieve material consumptions for a specific project via sub-route', async () => {
      const res = await request(app)
        .get(`/api/projects/${planningProjectId}/material-consumptions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2); // 20 + 30
    });
  });
});
