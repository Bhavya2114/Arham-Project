import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';

describe('Project Expenses API integration tests (Phase 7.3)', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;
  let customerId: string;
  let planningProjectId: string;
  let completedProjectId: string;
  let cancelledProjectId: string;
  let productId: string;
  let initialStock: number;
  let createdExpenseId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // 1. Create Customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Shree Construction Co',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `shree_${Date.now()}@const.com`,
        businessName: 'Shree Const Pvt Ltd',
        type: 'WHOLESALE',
        status: 'LEAD',
        address: 'Pune HQ',
      });

    if (custRes.status !== 201) {
      console.error('Customer Creation Failed in projectExpense.test.ts:', custRes.body);
    }
    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;

    // 2. Create Projects (Planning, Completed, Cancelled)
    const p1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `EXP-PRJ-1-${Date.now()}`,
        name: 'Commercial Complex Site A',
        customer: customerId,
        siteAddress: 'Viman Nagar, Pune',
        startDate: '2026-06-01',
        status: 'PLANNING',
      });
    expect(p1.status).toBe(201);
    planningProjectId = p1.body.data.id;

    const p2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `EXP-PRJ-2-${Date.now()}`,
        name: 'Finished Warehousing Facility',
        customer: customerId,
        siteAddress: 'Chakan, Pune',
        startDate: '2026-01-01',
        status: 'COMPLETED',
      });
    expect(p2.status).toBe(201);
    completedProjectId = p2.body.data.id;

    const p3 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `EXP-PRJ-3-${Date.now()}`,
        name: 'Cancelled Villa Project',
        customer: customerId,
        siteAddress: 'Lonavala, Pune',
        startDate: '2026-01-01',
        status: 'CANCELLED',
      });
    expect(p3.status).toBe(201);
    cancelledProjectId = p3.body.data.id;

    // 3. Create a Product to verify Inventory Isolation
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Steel TMT Bars 12mm',
        sku: `STL-${Date.now()}`,
        category: 'Construction Material',
        costPrice: 500,
        unitPrice: 600,
        gstRate: 18,
        currentStock: 250,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
    initialStock = prodRes.body.data.currentStock;
  });

  describe('POST /api/project-expenses - Create Project Expense', () => {
    it('should allow ACCOUNTS role to record a valid project expense', async () => {
      const res = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          project: planningProjectId,
          category: 'TRANSPORT',
          description: 'Sand truck transportation from supplier',
          amount: 15000,
          vendorName: 'ABC Logistics Pvt Ltd',
          billNumber: 'TR-2026-99',
          notes: 'Freight charges paid for batch 1 delivery',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.category).toBe('TRANSPORT');
      expect(res.body.data.description).toBe('Sand truck transportation from supplier');
      expect(res.body.data.amount).toBe(15000);
      expect(res.body.data.vendorName).toBe('ABC Logistics Pvt Ltd');
      expect(res.body.data.billNumber).toBe('TR-2026-99');

      createdExpenseId = res.body.data.id;
    });

    it('INVENTORY ISOLATION: should verify creating an expense does NOT alter Product.currentStock', async () => {
      // Create another expense
      const res = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          category: 'LABOUR',
          description: 'Electrician & Mason weekly labour payout',
          amount: 30000,
        });

      expect(res.status).toBe(201);

      // Verify product stock remains exactly at initialStock (250)
      const prodCheck = await Product.findById(productId);
      expect(prodCheck?.currentStock).toBe(initialStock);
    });

    it('should accumulate project expense totals accurately', async () => {
      const res = await request(app)
        .get(`/api/projects/${planningProjectId}/expenses`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);

      const totalExpense = res.body.data.reduce((sum: number, e: any) => sum + e.amount, 0);
      expect(totalExpense).toBe(45000); // 15000 + 30000
    });

    it('should reject expense creation for COMPLETED project (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: completedProjectId,
          category: 'SITE_EXPENSE',
          description: 'Post-completion cleanup',
          amount: 2000,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/COMPLETED/i);
    });

    it('should reject expense creation for CANCELLED project (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: cancelledProjectId,
          category: 'SITE_EXPENSE',
          description: 'Cancellation fee',
          amount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CANCELLED/i);
    });

    it('should return 400 when amount is zero or negative', async () => {
      const resZ = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          category: 'MISCELLANEOUS',
          description: 'Test zero',
          amount: 0,
        });
      expect(resZ.status).toBe(400);

      const resN = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          category: 'MISCELLANEOUS',
          description: 'Test negative',
          amount: -100,
        });
      expect(resN.status).toBe(400);
    });

    it('should return 400 when category is invalid', async () => {
      const res = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          category: 'INVALID_CATEGORY',
          description: 'Invalid category test',
          amount: 1000,
        });
      expect(res.status).toBe(400);
    });

    it('should return 400 when description is missing', async () => {
      const res = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          category: 'OTHER',
          amount: 1000,
        });
      expect(res.status).toBe(400);
    });

    it('should forbid SALES and WAREHOUSE roles from creating expenses', async () => {
      const resS = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          project: planningProjectId,
          category: 'OTHER',
          description: 'Sales expense attempt',
          amount: 500,
        });
      expect(resS.status).toBe(403);

      const resW = await request(app)
        .post('/api/project-expenses')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          project: planningProjectId,
          category: 'OTHER',
          description: 'Warehouse expense attempt',
          amount: 500,
        });
      expect(resW.status).toBe(403);
    });
  });

  describe('GET /api/project-expenses & GET /api/projects/:id/expenses', () => {
    it('should allow all authenticated roles to list expenses and filter by category', async () => {
      const resAll = await request(app)
        .get('/api/project-expenses')
        .set('Authorization', `Bearer ${salesToken}`);
      expect(resAll.status).toBe(200);
      expect(Array.isArray(resAll.body.data)).toBe(true);

      const resFilter = await request(app)
        .get('/api/project-expenses?category=TRANSPORT')
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(resFilter.status).toBe(200);
      expect(resFilter.body.data.every((e: any) => e.category === 'TRANSPORT')).toBe(true);
    });

    it('should retrieve a single expense by ID', async () => {
      const res = await request(app)
        .get(`/api/project-expenses/${createdExpenseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdExpenseId);
      expect(res.body.data.amount).toBe(15000);
    });

    it('should return 404 for non-existent expense ID', async () => {
      const res = await request(app)
        .get('/api/project-expenses/60c72b2f9b1d8b2b1c8e4a11')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
