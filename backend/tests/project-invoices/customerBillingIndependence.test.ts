import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';
import { PROJECT_GST_RATE, PROJECT_GST_MULTIPLIER, roundToTwo, getFixedBillingRate } from '../../src/constants/projectGst.constants';

describe('Fixed 18% GST and Non-Editable Project Billing Integration Tests', () => {
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

    // 1. Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Phase 4.2 Client Corp',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `phase42_${Date.now()}@client.com`,
      businessName: 'Phase 4.2 Business',
      gstNumber: '27AAAAA0000A1Z5',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Nariman Point, Mumbai',
    });
    customerId = customer._id.toString();

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

  describe('Part A — Material Issue Fixed 18% Pricing Rule', () => {
    it('issues 10 units: actualCostPrice = ₹4,403.70, actualCostTotal = ₹44,037.00, billingPrice automatically equals dealer cost + 18% GST', async () => {
      // Issue 10 units
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
      const data = issueRes.body.data;
      expect(data.quantity).toBe(10);
      expect(data.actualCostPrice).toBe(4403.7);
      expect(data.actualCostTotal).toBe(44037);

      // Core Rule: Billing rate automatically equals material cost price including 18% GST
      const expectedBillingRate = getFixedBillingRate(4403.7); // roundToTwo(4403.7 * 1.18) = 5196.37
      expect(expectedBillingRate).toBe(5196.37);
      expect(data.billingPrice).toBe(5196.37);
      expect(data.billingTotal).toBe(51963.7);

      // Fixed 18% GST fields
      expect(data.gstRate).toBe(PROJECT_GST_RATE);
      expect(data.inputGst).toBe(roundToTwo(44037 * PROJECT_GST_MULTIPLIER));
      expect(data.issuedMaterialValueIncludingGST).toBe(roundToTwo(44037 + data.inputGst));

      matConsumptionId = data.id;
    });
  });

  describe('Part B — Backend Invoice Enforcement: Non-Editable Billing Rate', () => {
    it('overrides client-submitted custom billing rate and enforces dealer cost + 18% GST', async () => {
      // Client tries to submit arbitrary markup rate = ₹7,000
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
              rate: 7000, // Custom markup attempt - MUST BE OVERRIDDEN BY BACKEND
              gstRate: 18,
            },
          ],
        });

      expect(invRes.status).toBe(201);
      const inv = invRes.body.data;

      // Backend enforces fixedBillingRateIncludingGST = roundToTwo(4403.70 * 1.18) = 5196.37
      const item = inv.items[0];
      expect(item.rate).toBe(5196.37);
      expect(item.lineTotal).toBe(51963.66);
      expect(item.amount).toBe(51963.66);
      expect(item.gstAmount).toBe(0);
      expect(item.gstRate).toBe(0);

      // Financial totals check: Material billing rate is GST-inclusive; additional output GST is 0
      expect(inv.subtotal).toBe(51963.66);
      expect(inv.taxableAmount).toBe(51963.66);
      expect(inv.taxAmount).toBe(0);
      expect(inv.outputGst).toBe(0);
      expect(inv.grandTotal).toBe(51963.66);
    });
  });

  describe('Part C — Project Profitability and Budget Independence', () => {
    it('verifies operational project budget and cost remain strictly GST-exclusive regardless of invoice amount', async () => {
      const profRes = await request(app)
        .get(`/api/projects/${projectId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(profRes.status).toBe(200);
      const prof = profRes.body.data;

      // Project Budget = ₹50,000
      expect(prof.projectBudget).toBe(50000);
      // Total Material Cost = ₹44,037 (from actualCostTotal, GST-exclusive)
      expect(prof.totalMaterialCost).toBe(44037);
      expect(prof.actualProjectCost).toBe(44037);

      // Remaining Budget = Budget - Actual Cost = 50,000 - 44,037 = 5,963
      expect(prof.remainingBudget).toBe(5963);
      expect(prof.projectProfit).toBe(5963);
      expect(prof.projectMargin).toBe(11.93);

      // Invoiced amount tracked independently
      expect(prof.totalInvoiced).toBe(51963.66);
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

  describe('Part E — Override of Custom Billing Price on Material Consumption Creation', () => {
    it('overrides client-submitted billingPrice to strictly enforce dealer cost + 18% GST', async () => {
      // Client tries to submit custom billingPrice = 6000
      const histRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: projectId,
          product: productId,
          quantity: 5,
          billingPrice: 6000, // Custom billingPrice attempt
        });

      expect(histRes.status).toBe(201);
      // Overridden to dealer cost + 18% GST: 5196.37
      expect(histRes.body.data.billingPrice).toBe(5196.37);
      expect(histRes.body.data.billingTotal).toBe(25981.85);
      expect(histRes.body.data.actualCostPrice).toBe(4403.7);
      expect(histRes.body.data.actualCostTotal).toBe(22018.5);
    });
  });

  describe('Part F — Prevent Double GST Calculation: GST-Inclusive Invoicing & Pune2 Scenario', () => {
    it('creates invoice for 2 materials: PVC TAP and Cable, resulting in exact ₹60,689.58 with ₹0.00 output GST', async () => {
      // 1. Create dedicated test project
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-PUNE2-TEST-${Date.now()}`,
          name: 'Pune2 Verification Project',
          customer: customerId,
          siteAddress: 'Pune Site',
          budget: 60000,
          startDate: '2026-09-01',
          status: 'IN_PROGRESS',
        });
      const pId = projRes.body.data.id;

      // 2. Create Product 1: PVC TAP (Cost = ₹10.00)
      const tapProdRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'PVC TAP',
          sku: `TAP-${Date.now()}`,
          category: 'Plumbing',
          costPrice: 10,
          gstRate: 18,
          currentStock: 100,
          minStockQuantity: 5,
          location: 'Store B',
          unit: 'Pcs.',
        });
      const tapProdId = tapProdRes.body.data.id;

      // 3. Create Product 2: Cable (Cost = ₹4,648.35)
      const cableProdRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '1sq Mm FR PVC Insulated Cable',
          sku: `CABLE-${Date.now()}`,
          category: 'Electrical',
          costPrice: 4648.35,
          gstRate: 18,
          currentStock: 50,
          minStockQuantity: 2,
          location: 'Store C',
          unit: 'Coil',
        });
      const cableProdId = cableProdRes.body.data.id;

      // 4. Issue 30 Pcs of PVC TAP
      const tapIssueRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          project: pId,
          product: tapProdId,
          quantity: 30,
        });
      const tapMcId = tapIssueRes.body.data.id;
      expect(tapIssueRes.body.data.billingPrice).toBe(11.8);
      expect(tapIssueRes.body.data.billingTotal).toBe(354);
      expect(tapIssueRes.body.data.issuedMaterialValueIncludingGST).toBe(354);

      // 5. Issue 11 Coil of Cable
      const cableIssueRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          project: pId,
          product: cableProdId,
          quantity: 11,
        });
      const cableMcId = cableIssueRes.body.data.id;
      expect(cableIssueRes.body.data.billingPrice).toBe(5485.05);
      expect(cableIssueRes.body.data.actualCostTotal).toBe(51131.85);
      expect(cableIssueRes.body.data.issuedMaterialValueIncludingGST).toBe(60335.58);

      // 6. Create Project Invoice with both materials
      // Attempt client-side custom rate and custom GST rate override to ensure backend ignores them
      const invRes = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          project: pId,
          items: [
            {
              type: 'MATERIAL',
              sourceType: 'MATERIAL_CONSUMPTION',
              sourceId: tapMcId,
              description: 'PVC TAP (Covers 30 Pcs.)',
              product: tapProdId,
              quantity: 30,
              unit: 'Pcs.',
              rate: 999, // Should be ignored
              gstRate: 28, // Should be ignored
            },
            {
              type: 'MATERIAL',
              sourceType: 'MATERIAL_CONSUMPTION',
              sourceId: cableMcId,
              description: '1sq Mm FR PVC Insulated Cable (Covers 11 Coil)',
              product: cableProdId,
              quantity: 11,
              unit: 'Coil',
              rate: 9999, // Should be ignored
              gstRate: 28, // Should be ignored
            },
          ],
        });

      expect(invRes.status).toBe(201);
      const invoice = invRes.body.data;

      // Line 1: PVC TAP
      const item1 = invoice.items[0];
      expect(item1.rate).toBe(11.8);
      expect(item1.amount).toBe(354);
      expect(item1.gstAmount).toBe(0);
      expect(item1.gstRate).toBe(0);
      expect(item1.lineTotal).toBe(354);

      // Line 2: PVC Cable
      const item2 = invoice.items[1];
      expect(item2.rate).toBe(5485.05);
      expect(item2.amount).toBe(60335.58);
      expect(item2.gstAmount).toBe(0);
      expect(item2.gstRate).toBe(0);
      expect(item2.lineTotal).toBe(60335.58);

      // Core Verification: Subtotal = 60,689.58, Output GST = 0.00, Grand Total = 60,689.58
      expect(invoice.subtotal).toBe(60689.58);
      expect(invoice.taxableAmount).toBe(60689.58);
      expect(invoice.taxAmount).toBe(0);
      expect(invoice.outputGst).toBe(0);
      expect(invoice.grandTotal).toBe(60689.58);
      expect(invoice.balanceDue).toBe(60689.58);

      // 7. Verify Customer Payment does NOT alter GST or Grand Total
      const payRes = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice: invoice.id,
          amount: 20000,
          paymentMode: 'BANK_TRANSFER',
          referenceNumber: 'REF-TEST-20000',
        });
      expect(payRes.status).toBe(201);

      const refreshedInvRes = await request(app)
        .get(`/api/project-invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const refreshedInv = refreshedInvRes.body.data;
      expect(refreshedInv.subtotal).toBe(60689.58);
      expect(refreshedInv.outputGst).toBe(0);
      expect(refreshedInv.grandTotal).toBe(60689.58);
      expect(refreshedInv.amountPaid).toBe(20000);
      expect(refreshedInv.balanceDue).toBe(40689.58);

      // 8. Verify Project Budget and Project Cost remain GST-exclusive
      const profRes = await request(app)
        .get(`/api/projects/${pId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);
      const prof = profRes.body.data;
      expect(prof.projectBudget).toBe(60000);
      // Actual cost excl. GST = 300 + 51,131.85 = 51,431.85
      expect(prof.totalMaterialCost).toBe(51431.85);
      expect(prof.actualProjectCost).toBe(51431.85);
      // Remaining Budget = 60,000 - 51,431.85 = 8,568.15
      expect(prof.remainingBudget).toBe(8568.15);
      expect(prof.totalInvoiced).toBe(60689.58);
    });
  });
});
