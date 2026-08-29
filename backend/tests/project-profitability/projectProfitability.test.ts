import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';
import { ProjectExpense } from '../../src/models/ProjectExpense';
import { ProjectInvoice } from '../../src/models/ProjectInvoice';

describe('Project Profitability & Analytics API integration tests (Phase 7.6)', () => {
  let adminToken: string;
  let salesToken: string;
  let accountsToken: string;
  let customerId: string;
  let projectId: string;
  let productId: string;
  let emptyProjectId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    accountsToken = await getAuthToken('ACCOUNTS');

    // 1. Create Customer & Projects
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Godrej Properties Ltd',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `godrej_${Date.now()}@realestate.com`,
        businessName: 'Godrej Real Estate',
        gstNumber: '27GODREJ1234F1Z1',
        type: 'WHOLESALE',
        status: 'ACTIVE',
        address: 'Vikhroli, Mumbai',
      });
    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PROF-PRJ-${Date.now()}`,
        name: 'Godrej Horizon Tower',
        customer: customerId,
        siteAddress: 'Vikhroli, Mumbai',
        startDate: '2026-08-01',
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.data.id;

    const emptyProjRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `EMPTY-PRJ-${Date.now()}`,
        name: 'Zero Activity Site',
        customer: customerId,
        siteAddress: 'Thane, Mumbai',
        startDate: '2026-08-01',
        status: 'PLANNING',
      });
    expect(emptyProjRes.status).toBe(201);
    emptyProjectId = emptyProjRes.body.data.id;

    // 2. Create Product (costPrice = 2000, sellingPrice = 2500)
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cement UltraTech 50kg',
        sku: `CEM-${Date.now()}`,
        category: 'Building Material',
        costPrice: 2000,
        unitPrice: 2500,
        sellingPrice: 2500,
        gstRate: 18,
        currentStock: 500,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;

    // 3. Record Material Consumption: 20 bags (Actual Cost Total = 40,000, Billing Total = 50,000)
    const matRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 20,
        billingPrice: 2500, // Billing Total = 50,000; Actual Cost Total = 40,000
      });
    expect(matRes.status).toBe(201);

    // 4. Record Project Expense: Transport = 20,000
    const expRes = await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        category: 'TRANSPORT',
        description: 'Cement heavy haulage freight',
        amount: 20000,
      });
    expect(expRes.status).toBe(201);

    // Total Actual Cost = 40,000 (Materials) + 20,000 (Expenses) = 60,000

    // 5. Create Project Invoice: Subtotal = 100,000 (No GST / No discount for easy test math)
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Phase 1 Structural Work',
            rate: 100000,
            gstRate: 0,
          },
        ],
      });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.data.id;

    // 6. Record Payment: 40,000
    const pmtRes = await request(app)
      .post('/api/project-invoice-payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({
        invoice: invoiceId,
        amount: 40000,
        paymentMode: 'BANK_TRANSFER',
        transactionReference: 'RTGS100200300',
      });
    expect(pmtRes.status).toBe(201);
  });

  describe('GET /api/projects/:projectId/profitability - Single Project Analytics', () => {
    it('should calculate exact gross profit (40,000) and gross margin (40%) correctly', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('revenue', 100000);
      expect(res.body.data).toHaveProperty('totalMaterialCost', 40000); // Uses actual cost (20 * 2000), NOT billing price (50,000)
      expect(res.body.data).toHaveProperty('totalProjectExpenses', 20000);
      expect(res.body.data).toHaveProperty('totalProjectCost', 60000);
      expect(res.body.data).toHaveProperty('grossProfit', 40000); // 100,000 - 60,000 = 40,000
      expect(res.body.data).toHaveProperty('grossMargin', 40); // (40,000 / 100,000) * 100 = 40%
      expect(res.body.data).toHaveProperty('totalReceived', 40000);
      expect(res.body.data).toHaveProperty('outstanding', 60000); // 100,000 - 40,000 = 60,000
    });

    it('should handle zero-activity project cleanly without division by zero errors', async () => {
      const res = await request(app)
        .get(`/api/projects/${emptyProjectId}/profitability`)
        .set('Authorization', `Bearer ${accountsToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue).toBe(0);
      expect(res.body.data.totalProjectCost).toBe(0);
      expect(res.body.data.grossProfit).toBe(0);
      expect(res.body.data.grossMargin).toBe(0); // Safely returns 0 without NaN/Infinity
    });

    it('ISOLATION & READ-ONLY: profitability report must NOT alter any database models or stock', async () => {
      const prod = await Product.findById(productId);
      expect(prod?.currentStock).toBe(480); // Intact!

      const expCount = await ProjectExpense.countDocuments({ project: projectId });
      expect(expCount).toBe(1); // Intact!

      const invCount = await ProjectInvoice.countDocuments({ project: projectId });
      expect(invCount).toBe(1); // Intact!
    });
  });

  describe('GET /api/reports/projects-profitability - Executive Management Report', () => {
    it('should allow authenticated users to retrieve global projects profitability report', async () => {
      const res = await request(app)
        .get('/api/reports/projects-profitability')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const target = res.body.data.find((p: any) => p.projectId === projectId);
      expect(target).toBeDefined();
      expect(target.grossProfit).toBe(40000);
      expect(target.grossMargin).toBe(40);
    });
  });
});
