import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Phase 4.2: Customer Billing Independence & Project Profitability Isolation', () => {
  let adminToken: string;
  let warehouseToken: string;
  let salesToken: string;
  let customerId: string;
  let projectId: string;
  let productId: string;
  let matConsumptionId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    warehouseToken = await getAuthToken('WAREHOUSE');
    salesToken = await getAuthToken('SALES');

    // 1. Create Customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 4.2 Client Corp',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `phase42_${Date.now()}@client.com`,
        businessName: 'Phase 4.2 Business',
        gstNumber: '27AAAAA0000A1Z5',
        type: 'WHOLESALE',
        status: 'ACTIVE',
        address: 'Nariman Point, Mumbai',
      });
    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;

    // 2. Create Project with Budget = ₹50,000 (Excl. GST)
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-42-${Date.now()}`,
        name: 'Phase 4.2 Commercial Tower',
        customer: customerId,
        siteAddress: 'Nariman Point, Mumbai',
        budget: 50000,
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.data.id;

    // 3. Create Product with Procurement Cost = ₹4,403.70, Stock = 50
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'High Tensile Steel Rods',
        sku: `HTS-${Date.now()}`,
        category: 'Raw Materials',
        costPrice: 4403.7,
        gstRate: 18,
        currentStock: 50,
        minStockQuantity: 5,
        location: 'Store A',
        unit: 'pcs',
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
  });

  describe('Part A — Material Issue Cost-Centricity', () => {
    it('issues 10 units: actualCostPrice = ₹4,403.70, actualCostTotal = ₹44,037.00, billingPrice is NOT defaulted to cost price', async () => {
      // Issue 10 units WITHOUT providing billingPrice in the payload
      const issueRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          project: projectId,
          product: productId,
          quantity: 10,
          notes: 'Issued 10 units for structural frame',
        });

      expect(issueRes.status).toBe(201);
      expect(issueRes.body.data.quantity).toBe(10);
      expect(issueRes.body.data.actualCostPrice).toBe(4403.7);
      expect(issueRes.body.data.actualCostTotal).toBe(44037);

      // Verify billingPrice is NOT automatically set to costPrice (₹4,403.70)
      expect(issueRes.body.data.billingPrice).toBe(0);
      expect(issueRes.body.data.billingTotal).toBe(0);

      matConsumptionId = issueRes.body.data.id;
    });
  });

  describe('Part B — Customer Invoicing with Explicit Billing Rate', () => {
    it('creates invoice for 10 units at explicitly entered customer billing rate = ₹5,000', async () => {
      // Billed at ₹5,000 per unit (independent of procurement cost ₹4,403.70)
      const invRes = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          project: projectId,
          items: [
            {
              type: 'MATERIAL',
              sourceType: 'MATERIAL_CONSUMPTION',
              sourceId: matConsumptionId,
              description: 'High Tensile Steel Rods',
              product: productId,
              quantity: 10,
              unit: 'pcs',
              rate: 5000,
              gstRate: 18,
            },
          ],
        });

      expect(invRes.status).toBe(201);
      // Taxable value: 10 * 5,000 = 50,000
      expect(invRes.body.data.subtotal).toBe(50000);
      expect(invRes.body.data.taxableAmount).toBe(50000);
      // GST @ 18%: 50,000 * 0.18 = 9,000
      expect(invRes.body.data.taxAmount).toBe(9000);
      // Grand total: 50,000 + 9,000 = 59,000
      expect(invRes.body.data.grandTotal).toBe(59000);
    });
  });

  describe('Part C — Project Profitability Independence', () => {
    it('verifies operational project profit remains ₹5,963 and margin remains 11.93% regardless of invoice amount', async () => {
      const profRes = await request(app)
        .get(`/api/projects/${projectId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(profRes.status).toBe(200);
      // Project Budget = ₹50,000
      expect(profRes.body.data.projectBudget).toBe(50000);
      // Total Material Cost = ₹44,037 (from actualCostTotal)
      expect(profRes.body.data.totalMaterialCost).toBe(44037);
      expect(profRes.body.data.actualProjectCost).toBe(44037);

      // Project Profit = Budget - Actual Cost = 50,000 - 44,037 = 5,963
      expect(profRes.body.data.projectProfit).toBe(5963);
      // Project Margin = (5,963 / 50,000) * 100 = 11.926% -> 11.93%
      expect(profRes.body.data.projectMargin).toBe(11.93);

      // Customer Invoiced amount is tracked independently and did NOT contaminate operational profit
      expect(profRes.body.data.totalInvoiced).toBe(59000);
    });
  });

  describe('Part D — Validation of Line Item Rate', () => {
    it('rejects invoice creation if rate is negative (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          project: projectId,
          items: [
            {
              type: 'SERVICE',
              sourceType: 'MANUAL',
              description: 'Invalid Negative Charge',
              quantity: 1,
              rate: -500,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/validation failed/i);
      expect(JSON.stringify(res.body)).toMatch(/rate cannot be negative/i);
    });
  });

  describe('Part E — Historical Compatibility', () => {
    it('preserves compatibility for historical records where billingPrice was explicitly stored', async () => {
      // Create a historical consumption record directly or via API with billingPrice: 6000
      const histRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: projectId,
          product: productId,
          quantity: 5,
          billingPrice: 6000,
        });

      expect(histRes.status).toBe(201);
      expect(histRes.body.data.billingPrice).toBe(6000);
      expect(histRes.body.data.billingTotal).toBe(30000);
      expect(histRes.body.data.actualCostPrice).toBe(4403.7);
      expect(histRes.body.data.actualCostTotal).toBe(22018.5);
    });
  });
});
