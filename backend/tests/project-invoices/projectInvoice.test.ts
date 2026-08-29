import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';
import { Customer } from '../../src/models/Customer';
import { ProjectExpense } from '../../src/models/ProjectExpense';

describe('Project Invoices API integration tests (Phase 7.4)', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;
  let customerId: string;
  let planningProjectId: string;
  let otherProjectId: string;
  let cancelledProjectId: string;
  let productId: string;
  let matConsumptionId: string;
  let projectExpenseId: string;
  let createdInvoiceId: string;

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
        name: 'Reliance Infra Tech',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `rel_${Date.now()}@infra.com`,
        businessName: 'Reliance Infra Pvt Ltd',
        gstNumber: '27RELIA1234F1Z9',
        type: 'WHOLESALE',
        status: 'LEAD',
        address: 'BKC, Mumbai',
      });
    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;

    // 2. Create Projects (Planning, Other Project, Cancelled)
    const p1 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `INV-PRJ-1-${Date.now()}`,
        name: 'IT Park Tower A',
        customer: customerId,
        siteAddress: 'Hinjewadi Phase 3, Pune',
        startDate: '2026-06-01',
        status: 'PLANNING',
      });
    expect(p1.status).toBe(201);
    planningProjectId = p1.body.data.id;

    const p2 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `INV-PRJ-2-${Date.now()}`,
        name: 'Unrelated Site B',
        customer: customerId,
        siteAddress: 'Wakad, Pune',
        startDate: '2026-06-01',
        status: 'PLANNING',
      });
    expect(p2.status).toBe(201);
    otherProjectId = p2.body.data.id;

    const p3 = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `INV-PRJ-3-${Date.now()}`,
        name: 'Cancelled Commercial Mall',
        customer: customerId,
        siteAddress: 'Kalyani Nagar, Pune',
        startDate: '2026-01-01',
        status: 'CANCELLED',
      });
    expect(p3.status).toBe(201);
    cancelledProjectId = p3.body.data.id;

    // 3. Create Product & Material Consumption (100 units issued)
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Finolex Copper Wire 4.0sqmm',
        sku: `FIN-${Date.now()}`,
        category: 'Electrical Material',
        costPrice: 8000,
        unitPrice: 10000,
        sellingPrice: 10000,
        gstRate: 18,
        currentStock: 50,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;

    const matRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: planningProjectId,
        product: productId,
        quantity: 20, // 20 coils issued
        billingPrice: 10000,
      });
    expect(matRes.status).toBe(201);
    matConsumptionId = matRes.body.data.id;

    // 4. Create Project Expense (Transport Rs 15,000)
    const expRes = await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: planningProjectId,
        category: 'TRANSPORT',
        description: 'Wire coil freight transport to site',
        amount: 15000,
      });
    expect(expRes.status).toBe(201);
    projectExpenseId = expRes.body.data.id;
  });

  describe('POST /api/project-invoices - Create Project Invoice', () => {
    it('should create a valid project invoice with materials, expenses, and manual items', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          project: planningProjectId,
          discount: 5000,
          notes: 'First milestone billing for IT Park project',
          items: [
            {
              type: 'MATERIAL',
              sourceType: 'MATERIAL_CONSUMPTION',
              sourceId: matConsumptionId,
              description: 'Finolex Copper Wire 4.0sqmm',
              product: productId,
              quantity: 10, // Partial billing: 10 out of 20
              unit: 'Roll',
              rate: 10000,
              gstRate: 18,
            },
            {
              type: 'EXPENSE',
              sourceType: 'PROJECT_EXPENSE',
              sourceId: projectExpenseId,
              description: 'Site Freight Transport Charge',
              rate: 18000, // Actual cost was 15,000, billed at 18,000
              gstRate: 18,
            },
            {
              type: 'SERVICE',
              sourceType: 'MANUAL',
              description: 'Site Installation Supervision',
              rate: 20000,
              gstRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.invoiceNumber).toMatch(/^PINV-\d{4}-\d{4}$/);
      expect(res.body.data.customerSnapshot.name).toBe('Reliance Infra Tech');
      expect(res.body.data.projectSnapshot.name).toBe('IT Park Tower A');

      // Math verification:
      // Line 1 (Material): 10 * 10,000 = 100,000 | GST 18% = 18,000
      // Line 2 (Expense): 1 * 18,000 = 18,000 | GST 18% = 3,240
      // Line 3 (Manual Service): 1 * 20,000 = 20,000 | GST 18% = 3,600
      // Subtotal = 138,000
      // Discount = 5,000
      // Taxable = 133,000
      // Raw Tax = 24,840 | Tax Ratio = 133000 / 138000 = 0.963768...
      // Tax Amount = 24840 * (133000 / 138000) = 23940
      // Grand Total = 133,000 + 23,940 = 156,940
      expect(res.body.data.subtotal).toBe(138000);
      expect(res.body.data.discount).toBe(5000);
      expect(res.body.data.taxableAmount).toBe(133000);
      expect(res.body.data.grandTotal).toBe(156940);
      expect(res.body.data.amountPaid).toBe(0);
      expect(res.body.data.balanceDue).toBe(156940);

      createdInvoiceId = res.body.data.id;
    });

    it('INVENTORY ISOLATION: should verify creating an invoice does NOT modify Product.currentStock', async () => {
      // Current stock was reduced to 30 when material was issued (50 - 20)
      const prodCheck = await Product.findById(productId);
      expect(prodCheck?.currentStock).toBe(30);
    });

    it('EXPENSE ISOLATION: should verify creating an invoice does NOT modify ProjectExpense.amount actual cost', async () => {
      const expCheck = await ProjectExpense.findById(projectExpenseId);
      expect(expCheck?.amount).toBe(15000); // Actual cost remains 15,000
      expect(expCheck?.isBilled).toBe(true);
    });

    it('DUPLICATE BILLING: should prevent billing an already invoiced ProjectExpense (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          items: [
            {
              type: 'EXPENSE',
              sourceType: 'PROJECT_EXPENSE',
              sourceId: projectExpenseId,
              description: 'Duplicate Freight Charge',
              rate: 18000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already been invoiced/i);
    });

    it('PARTIAL BILLING & OVERBILLING: should prevent billing more than remaining unbilled material quantity (HTTP 400)', async () => {
      // 10 units out of 20 were billed in 1st invoice. Remaining unbilled = 10.
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          items: [
            {
              type: 'MATERIAL',
              sourceType: 'MATERIAL_CONSUMPTION',
              sourceId: matConsumptionId,
              description: 'Finolex Wire Overbill',
              quantity: 15, // Requested 15, available 10
              rate: 10000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Maximum remaining unbilled: 10/i);
    });

    it('HISTORICAL SNAPSHOT INTEGRITY: changing Customer or Product master in DB does NOT alter created invoice', async () => {
      // Mutate Customer and Product in DB
      await Customer.findByIdAndUpdate(customerId, { name: 'MUTATED CUSTOMER NAME' });
      await Product.findByIdAndUpdate(productId, { sellingPrice: 999999 });

      // Fetch created invoice
      const res = await request(app)
        .get(`/api/project-invoices/${createdInvoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerSnapshot.name).toBe('Reliance Infra Tech'); // Preserved!
      expect(res.body.data.items[0].rate).toBe(10000); // Preserved!
    });

    it('SOURCE CROSS-PROJECT PROTECTION: should reject billing material belonging to a different project', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: otherProjectId, // Using other project ID
          items: [
            {
              type: 'MATERIAL',
              sourceType: 'MATERIAL_CONSUMPTION',
              sourceId: matConsumptionId, // Belongs to planningProjectId
              description: 'Cross project test',
              quantity: 5,
              rate: 10000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/belongs to a different project/i);
    });

    it('should reject invoice creation for CANCELLED project (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: cancelledProjectId,
          items: [
            {
              type: 'SERVICE',
              sourceType: 'MANUAL',
              description: 'Cancelled project fee',
              rate: 5000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CANCELLED/i);
    });

    it('should return 400 when discount exceeds subtotal', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: planningProjectId,
          discount: 50000, // Subtotal is 20,000
          items: [
            {
              type: 'SERVICE',
              sourceType: 'MANUAL',
              description: 'Small service',
              rate: 20000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Discount cannot exceed/i);
    });

    it('should forbid WAREHOUSE role from creating project invoices', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          project: planningProjectId,
          items: [
            {
              type: 'SERVICE',
              sourceType: 'MANUAL',
              description: 'Warehouse invoice attempt',
              rate: 1000,
            },
          ],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/project-invoices & GET /api/projects/:id/invoices', () => {
    it('should allow all authenticated roles to list project invoices and filter by status', async () => {
      const resAll = await request(app)
        .get('/api/project-invoices')
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(resAll.status).toBe(200);
      expect(Array.isArray(resAll.body.data)).toBe(true);

      const resFilter = await request(app)
        .get('/api/project-invoices?status=UNPAID')
        .set('Authorization', `Bearer ${accountsToken}`);
      expect(resFilter.status).toBe(200);
      expect(resFilter.body.data.every((i: any) => i.status === 'UNPAID')).toBe(true);
    });

    it('should retrieve project invoices by project sub-route', async () => {
      const res = await request(app)
        .get(`/api/projects/${planningProjectId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });
});
