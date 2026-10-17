import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';
import { MaterialConsumption } from '../../src/models/MaterialConsumption';
import { PROJECT_GST_RATE, PROJECT_GST_MULTIPLIER, roundToTwo } from '../../src/constants/projectGst.constants';

describe('Project GST and Budget Calculation Logic Integration Tests (Fixed 18% Business Rule)', () => {
  let adminToken: string;
  let customerId: string;
  let supplierId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // 1. Create Supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'National Infra Suppliers Pvt Ltd',
        contactPerson: 'Suresh Patel',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `infra_gst_${Date.now()}@supplier.com`,
        gstNumber: '27AABCS1429B1ZB',
        address: 'Andheri East, Mumbai',
      });
    expect(supRes.status).toBe(201);
    supplierId = supRes.body.data.id;

    // 2. Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Metro Infrastructure Corp',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `metro_${Date.now()}@infra.com`,
      businessName: 'Metro Infra Ltd',
      gstNumber: '27AAAAA0000A1Z5',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Bandra West, Mumbai',
    });
    customerId = customer._id.toString();
  });

  // Helper to create product with explicit costPrice and gstRate
  const createProduct = async (name: string, costPrice: number, gstRate = 18, stock = 1000) => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        sku: `SKU-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        category: 'Construction Materials',
        costPrice,
        gstRate,
        currentStock: stock,
        minStockQuantity: 5,
        location: 'Main Store',
        unit: 'pcs',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // Helper to create project
  const createProject = async (name: string, budget: number) => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-GST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name,
        customer: customerId,
        siteAddress: 'Site 101, Navi Mumbai',
        startDate: '2026-09-01',
        budget,
        status: 'IN_PROGRESS',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  describe('Scenario A: Purchase, Partial Issue, Proportional 18% GST & Strict Claimable Scope', () => {
    it('Purchase: Taxable ₹10,000 + GST ₹1,800 = ₹11,800. Issue 50%: Cost ₹5,000, Input GST ₹900, Issued Value ₹5,900', async () => {
      // 1. Create Product with initial stock 0
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TMT Steel Bars 12mm',
          sku: `TMT-${Date.now()}`,
          category: 'Steel',
          costPrice: 1000,
          gstRate: 18,
          currentStock: 0,
          unit: 'bundles',
        });
      expect(prodRes.status).toBe(201);
      const prodId = prodRes.body.data.id;

      // 2. Create Purchase Invoice: 10 bundles @ ₹1,000 = ₹10,000, GST 18% = ₹1,800, Total = ₹11,800
      const purchRes = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId,
          cgst: 900,
          sgst: 900,
          igst: 0,
          items: [
            {
              productId: prodId,
              purchasePrice: 1000,
              quantity: 10,
              taxRate: 18,
              taxAmount: 1800,
            },
          ],
        });
      expect(purchRes.status).toBe(201);
      expect(purchRes.body.data.subtotal).toBe(10000);
      expect(purchRes.body.data.taxAmount).toBe(1800);
      expect(purchRes.body.data.totalAmount).toBe(11800);

      // 3. Create Project with Budget = ₹50,000 (Excl. GST)
      const pId = await createProject('Metro Station Phase 1', 50000);

      // 4. Issue ONLY 50% (5 bundles out of 10) to the Project
      const issueRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: pId,
          product: prodId,
          quantity: 5,
        });

      expect(issueRes.status).toBe(201);
      const mc = issueRes.body.data;
      expect(mc.quantity).toBe(5);
      expect(mc.actualCostPrice).toBe(1000);
      expect(mc.actualCostTotal).toBe(5000); // 5 * 1000 = ₹5,000
      expect(mc.gstRate).toBe(PROJECT_GST_RATE);
      expect(mc.inputGst).toBe(roundToTwo(5000 * PROJECT_GST_MULTIPLIER)); // 5000 * 18% = ₹900
      expect(mc.issuedMaterialValueIncludingGST).toBe(5900); // 5000 + 900 = ₹5,900
      expect(mc.supplierInvoiceTotal).toBe(5900); // backward-compatible alias

      // 5. Query Project Profitability / Financial Overview
      const profRes = await request(app)
        .get(`/api/projects/${pId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(profRes.status).toBe(200);
      const prof = profRes.body.data;

      // Budget check (Excl. GST)
      expect(prof.projectBudget).toBe(50000);
      expect(prof.totalMaterialCost).toBe(5000);
      expect(prof.totalProjectExpenses).toBe(0);
      expect(prof.totalLabourCost).toBe(0);
      expect(prof.actualProjectCost).toBe(5000);

      // Remaining Budget = 50,000 - 5,000 = 45,000 (NOT deducting GST)
      expect(prof.remainingBudget).toBe(45000);
      expect(prof.projectProfit).toBe(45000);

      // GST Isolation & Reference checks:
      // Claimable GST must strictly be the issued GST (₹900), not depending on purchase invoice lookups
      expect(prof.inputGstIssuedMaterials).toBe(900);
      expect(prof.totalInputGstClaimable).toBe(900);
      expect(prof.inputGstPurchasedMaterials).toBeNull();
      expect(prof.issuedMaterialValueIncludingGST).toBe(5900);
      expect(prof.missingGstCount).toBe(0);
    });
  });

  describe('Scenario B: Fixed 18% Business Rule Deterministic Scenario Verification', () => {
    it('Project Budget ₹60,000, Material Cost Excl. GST ₹51,131.85, GST @ 18% ₹9,203.73 -> Cost ₹51,131.85, Remaining Budget ₹8,868.15', async () => {
      // Product costPrice = 51,131.85
      // 51,131.85 * 0.18 = 9,203.733 -> 9,203.73
      const prodId = await createProduct('Structural Truss Assembly', 51131.85);

      const pId = await createProject('Deterministic Prompt Project', 60000);

      // Issue 1 unit
      const issueRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: pId,
          product: prodId,
          quantity: 1,
        });

      expect(issueRes.status).toBe(201);
      expect(issueRes.body.data.actualCostTotal).toBe(51131.85);
      expect(issueRes.body.data.gstRate).toBe(PROJECT_GST_RATE);
      expect(issueRes.body.data.inputGst).toBe(9203.73);
      expect(issueRes.body.data.issuedMaterialValueIncludingGST).toBe(60335.58);

      const profRes = await request(app)
        .get(`/api/projects/${pId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(profRes.status).toBe(200);
      const prof = profRes.body.data;

      // Project Budget — Excl. GST ₹60,000.00
      expect(prof.projectBudget).toBe(60000);

      // Material Cost — Excl. GST ₹51,131.85
      expect(prof.totalMaterialCost).toBe(51131.85);

      // Project Expenses ₹0.00, Labour Cost ₹0.00
      expect(prof.totalProjectExpenses).toBe(0);
      expect(prof.totalLabourCost).toBe(0);

      // Total Project Cost — Excl. GST ₹51,131.85
      expect(prof.actualProjectCost).toBe(51131.85);

      // Remaining Budget ₹8,868.15 (60,000 - 51,131.85 = 8,868.15)
      expect(prof.remainingBudget).toBe(8868.15);

      // Separate GST Section: Input GST @ 18% ₹9,203.73
      expect(prof.inputGstIssuedMaterials).toBe(9203.73);
      expect(prof.totalInputGstClaimable).toBe(9203.73);
      expect(prof.issuedMaterialValueIncludingGST).toBe(60335.58);
    });
  });

  describe('Scenario C: Fixed 18% GST Applied Automatically on All Material Consumptions', () => {
    it('applies fixed 18% GST when issuing material even if product has gstRate 0 or undefined', async () => {
      // Create product with 0 gstRate
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zero GST Item',
          sku: `ZERO-${Date.now()}`,
          category: 'Misc',
          costPrice: 500,
          gstRate: 0,
          currentStock: 100,
        });
      expect(prodRes.status).toBe(201);
      const prodId = prodRes.body.data.id;

      const pId = await createProject('Zero GST Project', 10000);

      const issueRes = await request(app)
        .post('/api/material-consumptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: pId,
          product: prodId,
          quantity: 2,
        });

      // Fixed 18% GST rule automatically applied:
      // actualCostTotal = 1000, gstRate = 18, inputGst = 180, issuedMaterialValueIncludingGST = 1180
      expect(issueRes.status).toBe(201);
      expect(issueRes.body.data.actualCostTotal).toBe(1000);
      expect(issueRes.body.data.gstRate).toBe(PROJECT_GST_RATE);
      expect(issueRes.body.data.inputGst).toBe(180);
      expect(issueRes.body.data.issuedMaterialValueIncludingGST).toBe(1180);
    });
  });

  describe('Scenario D: Backend Response Calculation Dynamically Enforces 18% Rule on All Records', () => {
    it('dynamically calculates fixed 18% GST from actualCostTotal even if old stored record had missing or incorrect GST values', async () => {
      const pId = await createProject('Legacy Enforce Project', 20000);

      // Create product
      const prodId = await createProduct('Legacy Pipe', 200, 5);

      // 1. Insert legacy consumption omitting gstRate, inputGst, issuedMaterialValueIncludingGST
      const legacyMc1 = new MaterialConsumption({
        project: new mongoose.Types.ObjectId(pId),
        product: new mongoose.Types.ObjectId(prodId),
        productName: 'Legacy Pipe 1',
        sku: 'LEGACY-001',
        quantity: 10,
        unit: 'pcs',
        actualCostPrice: 200,
        billingPrice: 0,
        actualCostTotal: 2000,
        billingTotal: 0,
        issueDate: new Date(),
        issuedBy: new mongoose.Types.ObjectId(),
        // intentionally omit GST fields
      });
      await legacyMc1.save();

      // 2. Insert legacy consumption with old / incorrect stored values (e.g. gstRate: 5, inputGst: 10)
      const legacyMc2 = new MaterialConsumption({
        project: new mongoose.Types.ObjectId(pId),
        product: new mongoose.Types.ObjectId(prodId),
        productName: 'Legacy Pipe 2',
        sku: 'LEGACY-002',
        quantity: 5,
        unit: 'pcs',
        actualCostPrice: 300,
        billingPrice: 0,
        actualCostTotal: 1500,
        billingTotal: 0,
        issueDate: new Date(),
        issuedBy: new mongoose.Types.ObjectId(),
        gstRate: 5,
        inputGst: 10,
        issuedMaterialValueIncludingGST: 1510,
      });
      await legacyMc2.save();

      // Fetch material consumptions via API
      const listRes = await request(app)
        .get(`/api/projects/${pId}/material-consumptions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      const items = listRes.body.data;
      expect(items.length).toBe(2);

      const item1 = items.find((i: any) => i.sku === 'LEGACY-001');
      expect(item1).toBeDefined();
      // Enforced fixed 18% calculation from actualCostTotal (2000):
      expect(item1.gstRate).toBe(PROJECT_GST_RATE);
      expect(item1.inputGst).toBe(360); // 2000 * 0.18 = 360
      expect(item1.issuedMaterialValueIncludingGST).toBe(2360); // 2000 + 360 = 2360

      const item2 = items.find((i: any) => i.sku === 'LEGACY-002');
      expect(item2).toBeDefined();
      // Overrides old stored 5% / ₹10 with the fixed 18% rule from actualCostTotal (1500):
      expect(item2.gstRate).toBe(PROJECT_GST_RATE);
      expect(item2.inputGst).toBe(270); // 1500 * 0.18 = 270
      expect(item2.issuedMaterialValueIncludingGST).toBe(1770); // 1500 + 270 = 1770

      // Verify Project Profitability endpoint
      const profRes = await request(app)
        .get(`/api/projects/${pId}/profitability`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(profRes.status).toBe(200);
      const prof = profRes.body.data;
      // Total material cost excl GST = 2000 + 1500 = 3500
      expect(prof.totalMaterialCost).toBe(3500);
      expect(prof.remainingBudget).toBe(20000 - 3500);
      // Total input GST = 360 + 270 = 630
      expect(prof.inputGstIssuedMaterials).toBe(630);
      expect(prof.totalInputGstClaimable).toBe(630);
      expect(prof.issuedMaterialValueIncludingGST).toBe(3500 + 630);
    });
  });
});
