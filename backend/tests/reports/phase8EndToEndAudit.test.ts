import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';
import { Product } from '../../src/models/Product';
import { ProjectInvoice } from '../../src/models/ProjectInvoice';

describe('Phase 8: Comprehensive End-to-End GST & Profitability Integration System Audit', () => {
  let adminToken: string;
  let accountsToken: string;
  let supplierId: string;
  let customerId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    accountsToken = await getAuthToken('ACCOUNTS');

    // Supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 8 Audit Supplier',
        contactPerson: 'Audit Contact',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `p8_sup_${Date.now()}@supplier.com`,
        gstNumber: '27P8AUDIT1234Z1',
        address: 'Audit Warehouse, Mumbai',
      });
    expect(supRes.status).toBe(201);
    supplierId = supRes.body.data.id;

    // Customer fixture
    const customer = await createTestCustomer({
      name: 'Phase 8 Audit Client',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `p8_client_${Date.now()}@client.com`,
      businessName: 'Phase 8 Infra Corp',
      gstNumber: '27P8CLIENT5678Z2',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'BKC, Mumbai',
    });
    customerId = customer._id.toString();
  });

  // Helpers
  const createProduct = async (name: string, costPrice: number, gstRate = 18) => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        sku: `SKU-P8-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        category: 'Audit Material',
        costPrice,
        gstRate,
        currentStock: 10000,
        minStockQuantity: 1,
        location: 'Storage',
        unit: 'pcs',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  const createProject = async (name: string, budget: number) => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-P8-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name,
        customer: customerId,
        siteAddress: 'Audit Site, Mumbai',
        startDate: '2026-09-01',
        budget,
        status: 'IN_PROGRESS',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // ==========================================
  // LEVEL 1 — EASY TEST CASES
  // ==========================================

  it('EASY-01: Purchase without GST preserves GST-exclusive procurement and project cost', async () => {
    const prodId = await createProduct('EASY-01 Product', 10000, 0);
    const purRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [{ productId: prodId, purchasePrice: 10000, quantity: 1, taxRate: 0, taxAmount: 0 }],
      });
    expect(purRes.status).toBe(201);
    expect(purRes.body.data.subtotal).toBe(10000);
    expect(purRes.body.data.taxAmount).toBe(0);
    expect(purRes.body.data.totalAmount).toBe(10000);

    const prodCheck = await Product.findById(prodId);
    expect(prodCheck?.costPrice).toBe(10000);

    const projId = await createProject('EASY-01 Project', 20000);
    const issueRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: projId, product: prodId, quantity: 1 });
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.actualCostPrice).toBe(10000);
    expect(issueRes.body.data.actualCostTotal).toBe(10000);

    const profRes = await request(app)
      .get(`/api/projects/${projId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(10000);
  });

  it('EASY-02: Purchase with 18% GST preserves GST-exclusive costPrice', async () => {
    const prodId = await createProduct('EASY-02 Product', 10000, 18);
    const purRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        cgst: 900,
        sgst: 900,
        igst: 0,
        items: [{ productId: prodId, purchasePrice: 10000, quantity: 1, taxRate: 18, taxAmount: 1800 }],
      });
    expect(purRes.status).toBe(201);
    expect(purRes.body.data.subtotal).toBe(10000);
    expect(purRes.body.data.taxAmount).toBe(1800);
    expect(purRes.body.data.totalAmount).toBe(11800);

    const prodCheck = await Product.findById(prodId);
    expect(prodCheck?.costPrice).toBe(10000); // Excludes GST 1800
  });

  it('EASY-03: Simple Project Profitability: Budget 50k, Mat 10k, Exp 5k -> Actual 15k, Profit 35k, Margin 70%', async () => {
    const projId = await createProject('EASY-03 Project', 50000);
    const prodId = await createProduct('EASY-03 Product', 10000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: projId, product: prodId, quantity: 1 });

    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: projId, category: 'SITE_EXPENSE', description: 'Permits', amount: 5000 });

    const profRes = await request(app)
      .get(`/api/projects/${projId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.projectBudget).toBe(50000);
    expect(profRes.body.data.totalMaterialCost).toBe(10000);
    expect(profRes.body.data.totalProjectExpenses).toBe(5000);
    expect(profRes.body.data.actualProjectCost).toBe(15000);
    expect(profRes.body.data.projectProfit).toBe(35000);
    expect(profRes.body.data.projectMargin).toBe(70);
  });

  it('EASY-04: Simple Customer Invoice: Billing 20k @ 18% -> Taxable 20k, Output GST 3.6k, Total 23.6k (profit unaffected)', async () => {
    const projId = await createProject('EASY-04 Project', 50000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Consulting', rate: 20000, quantity: 1, gstRate: 18 }],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.taxableAmount).toBe(20000);
    expect(invRes.body.data.taxAmount).toBe(3600);
    expect(invRes.body.data.grandTotal).toBe(23600);

    const profRes = await request(app)
      .get(`/api/projects/${projId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.actualProjectCost).toBe(0);
    expect(profRes.body.data.projectProfit).toBe(50000);
  });

  it('EASY-05: Full Payment: Invoice 23.6k paid in full -> Paid 23.6k, Balance 0, status PAID (profit unaffected)', async () => {
    const projId = await createProject('EASY-05 Project', 50000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Billing', rate: 20000, quantity: 1, gstRate: 18 }],
      });
    const invId = invRes.body.data.id;

    const pmtRes = await request(app)
      .post('/api/project-invoice-payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({ invoice: invId, amount: 23600, paymentMode: 'BANK_TRANSFER' });
    expect(pmtRes.status).toBe(201);

    const invCheck = await ProjectInvoice.findById(invId);
    expect(invCheck?.amountPaid).toBe(23600);
    expect(invCheck?.balanceDue).toBe(0);
    expect(invCheck?.status).toBe('PAID');

    const profRes = await request(app)
      .get(`/api/projects/${projId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.projectProfit).toBe(50000);
  });

  // ==========================================
  // LEVEL 2 — MEDIUM TEST CASES
  // ==========================================

  it('MEDIUM-01: Mixed GST Rates: Line A 10k @ 18% (1800), Line B 5k @ 5% (250) -> Subtotal 15k, GST 2050, Total 17050', async () => {
    const projId = await createProject('MED-01 Project', 50000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [
          { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 1', rate: 10000, quantity: 1, gstRate: 18 },
          { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 2', rate: 5000, quantity: 1, gstRate: 5 },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBe(15000);
    expect(invRes.body.data.taxAmount).toBe(2050);
    expect(invRes.body.data.grandTotal).toBe(17050);
  });

  it('MEDIUM-02: Discount + GST: Subtotal 10k, Discount 1k, GST 18% -> Taxable 9k, GST 1620, Total 10620', async () => {
    const projId = await createProject('MED-02 Project', 50000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        discount: 1000,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Discounted Work', rate: 10000, quantity: 1, gstRate: 18 }],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBe(10000);
    expect(invRes.body.data.discount).toBe(1000);
    expect(invRes.body.data.taxableAmount).toBe(9000);
    expect(invRes.body.data.taxAmount).toBe(1620);
    expect(invRes.body.data.grandTotal).toBe(10620);
  });

  it('MEDIUM-03: Material Billing Independence: costPrice 4403.70, qty 10 (cost 44037) vs billing rate 5000 (taxable 50k, GST 9k, total 59k)', async () => {
    const projId = await createProject('MED-03 Project', 50000);
    const prodId = await createProduct('MED-03 Prod', 4403.70);

    const issueRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: projId, product: prodId, quantity: 10, billingPrice: 5000 });
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.actualCostPrice).toBe(4403.7);
    expect(issueRes.body.data.actualCostTotal).toBe(44037);

    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [
          {
            type: 'MATERIAL',
            sourceType: 'MATERIAL_CONSUMPTION',
            sourceId: issueRes.body.data.id,
            description: 'Material bill',
            rate: 5000,
            quantity: 10,
            gstRate: 18,
          },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.taxableAmount).toBe(51963.66);
    expect(invRes.body.data.taxAmount).toBe(0);
    expect(invRes.body.data.grandTotal).toBe(51963.66);

    const profRes = await request(app)
      .get(`/api/projects/${projId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(44037);
    expect(profRes.body.data.projectProfit).toBe(5963); // 50000 - 44037 = 5963
  });

  it('MEDIUM-04: Expense Billing Independence: Operational expense 1000 vs customer billing 1500 (cost remains 1000)', async () => {
    const projId = await createProject('MED-04 Project', 10000);
    const expRes = await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: projId, category: 'TRANSPORT', description: 'Logistics', amount: 1000 });
    expect(expRes.status).toBe(201);
    const expId = expRes.body.data.id;

    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [
          {
            type: 'EXPENSE',
            sourceType: 'PROJECT_EXPENSE',
            sourceId: expId,
            description: 'Logistics billed',
            rate: 1500,
            quantity: 1,
            gstRate: 18,
          },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.taxableAmount).toBe(1500);

    const profRes = await request(app)
      .get(`/api/projects/${projId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalProjectExpenses).toBe(1000); // NOT 1500!
    expect(profRes.body.data.actualProjectCost).toBe(1000);
    expect(profRes.body.data.projectProfit).toBe(9000);
  });

  it('MEDIUM-05: Partial Payment: Invoice 11.8k, Payment 5k -> Paid 5k, Balance 6.8k, status PARTIALLY_PAID (profit unaffected)', async () => {
    const projId = await createProject('MED-05 Project', 20000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Work', rate: 10000, quantity: 1, gstRate: 18 }],
      });
    const invId = invRes.body.data.id;

    await request(app)
      .post('/api/project-invoice-payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({ invoice: invId, amount: 5000, paymentMode: 'CASH' });

    const invCheck = await ProjectInvoice.findById(invId);
    expect(invCheck?.amountPaid).toBe(5000);
    expect(invCheck?.balanceDue).toBe(6800);
    expect(invCheck?.status).toBe('PARTIALLY_PAID');
  });

  it('MEDIUM-06: Zero GST Invoice: Invoice 10k @ 0% -> Taxable 10k, GST 0, Total 10k without NaN/Infinity', async () => {
    const projId = await createProject('MED-06 Project', 20000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Zero GST Work', rate: 10000, quantity: 1, gstRate: 0 }],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.taxableAmount).toBe(10000);
    expect(invRes.body.data.taxAmount).toBe(0);
    expect(invRes.body.data.grandTotal).toBe(10000);
    expect(isNaN(invRes.body.data.taxAmount)).toBe(false);
  });

  // ==========================================
  // LEVEL 3 — DIFFICULT TEST CASES
  // ==========================================

  it('DIFFICULT-01: Multiple Materials + Different Costs: A 10x100 (1k) + B 5x250 (1.25k) + C 2x1000 (2k) = 4,250 cost', async () => {
    const projId = await createProject('DIFF-01 Project', 10000);
    const prodA = await createProduct('Prod A', 100);
    const prodB = await createProduct('Prod B', 250);
    const prodC = await createProduct('Prod C', 1000);

    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodA, quantity: 10 });
    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodB, quantity: 5 });
    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodC, quantity: 2 });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(4250);
    expect(profRes.body.data.actualProjectCost).toBe(4250);
    expect(profRes.body.data.projectProfit).toBe(5750);
  });

  it('DIFFICULT-02: Multiple Materials with Custom Customer Rates: Cost 4250 vs Taxable Billing 6500 + GST 1170 = 7670', async () => {
    const projId = await createProject('DIFF-02 Project', 10000);
    const prodA = await createProduct('Prod A', 100);
    const prodB = await createProduct('Prod B', 250);
    const prodC = await createProduct('Prod C', 1000);

    const mcA = await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodA, quantity: 10 });
    const mcB = await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodB, quantity: 5 });
    const mcC = await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodC, quantity: 2 });

    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [
          { type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcA.body.data.id, description: 'Prod A billing', rate: 150, quantity: 10, gstRate: 18 },
          { type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcB.body.data.id, description: 'Prod B billing', rate: 400, quantity: 5, gstRate: 18 },
          { type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcC.body.data.id, description: 'Prod C billing', rate: 1500, quantity: 2, gstRate: 18 },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBe(5015);
    expect(invRes.body.data.taxAmount).toBe(0);
    expect(invRes.body.data.grandTotal).toBe(5015);

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(4250); // Operational cost unchanged
    expect(profRes.body.data.projectProfit).toBe(5750);
  });

  it('DIFFICULT-03: Mixed GST Invoice: Line A 10k @ 5% (500) + Line B 20k @ 18% (3600) + Line C 5k @ 0% (0) -> Total 39100', async () => {
    const projId = await createProject('DIFF-03 Project', 50000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        items: [
          { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item A', rate: 10000, quantity: 1, gstRate: 5 },
          { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item B', rate: 20000, quantity: 1, gstRate: 18 },
          { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item C', rate: 5000, quantity: 1, gstRate: 0 },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.taxableAmount).toBe(35000);
    expect(invRes.body.data.taxAmount).toBe(4100);
    expect(invRes.body.data.grandTotal).toBe(39100);
  });

  it('DIFFICULT-04: Large Discount: Subtotal 100k, Discount 25k, GST 18% -> Taxable 75k, GST 13.5k, Total 88.5k', async () => {
    const projId = await createProject('DIFF-04 Project', 100000);
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projId,
        discount: 25000,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Main Contract', rate: 100000, quantity: 1, gstRate: 18 }],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.taxableAmount).toBe(75000);
    expect(invRes.body.data.taxAmount).toBe(13500);
    expect(invRes.body.data.grandTotal).toBe(88500);
  });

  it('DIFFICULT-05: Negative Profit: Budget 50k, Mat 40k, Exp 20k -> Actual 60k, Profit -10k, Margin -20% (invoice does not change it)', async () => {
    const projId = await createProject('DIFF-05 Project', 50000);
    const prodId = await createProduct('DIFF-05 Prod', 40000);

    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodId, quantity: 1 });
    await request(app).post('/api/project-expenses').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, category: 'SITE_EXPENSE', description: 'Expenses', amount: 20000 });

    // Issue invoice with 18% GST
    await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Fee', rate: 70000, quantity: 1, gstRate: 18 }],
    });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.actualProjectCost).toBe(60000);
    expect(profRes.body.data.projectProfit).toBe(-10000);
    expect(profRes.body.data.projectMargin).toBe(-20);
  });

  it('DIFFICULT-06: Purchase GST vs Project Cost: Purchase 50k + 18% GST (supplier 59k) -> Project material cost is strictly 50k', async () => {
    const prodId = await createProduct('DIFF-06 Prod', 50000, 18);
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [{ productId: prodId, purchasePrice: 50000, quantity: 1, taxRate: 18, taxAmount: 9000 }],
      });

    const projId = await createProject('DIFF-06 Project', 100000);
    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodId, quantity: 1 });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(50000); // NOT 59,000!
    expect(profRes.body.data.projectProfit).toBe(50000);
  });

  // ==========================================
  // LEVEL 4 — VERY DIFFICULT TEST CASES
  // ==========================================

  it('VERY-DIFFICULT-01: Full End-to-End Project: Purchases 45k (excl GST) + Expenses 20k (incl Labour) -> Actual 65k, Profit 35k, Margin 35%', async () => {
    const projId = await createProject('VD-01 Project', 100000);

    const prod1 = await createProduct('VD1 Prod', 20000, 18);
    const prod2 = await createProduct('VD2 Prod', 15000, 5);
    const prod3 = await createProduct('VD3 Prod', 10000, 12);

    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prod1, quantity: 1 });
    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prod2, quantity: 1 });
    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prod3, quantity: 1 });

    await request(app).post('/api/project-expenses').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, category: 'TRANSPORT', description: 'Logistics', amount: 8000 });
    await request(app).post('/api/project-expenses').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, category: 'MACHINERY_RENTAL', description: 'Cranes', amount: 5000 });
    await request(app).post('/api/project-expenses').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, category: 'LABOUR', description: 'Civil crew', amount: 7000 });

    // Customer invoice
    await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Turnkey Bill', rate: 90000, quantity: 1, gstRate: 18 }],
    });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(45000);
    expect(profRes.body.data.totalProjectExpenses).toBe(20000);
    expect(profRes.body.data.actualProjectCost).toBe(65000);
    expect(profRes.body.data.projectProfit).toBe(35000);
    expect(profRes.body.data.projectMargin).toBe(35);
  });

  it('VERY-DIFFICULT-02: Invoice + Multiple Payments: 25k, 30k, 51.2k -> Total 106.2k, status PAID, Output GST 16.2k preserved', async () => {
    const projId = await createProject('VD-02 Project', 100000);
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Turnkey', rate: 90000, quantity: 1, gstRate: 18 }],
    });
    const invId = invRes.body.data.id;

    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({ invoice: invId, amount: 25000, paymentMode: 'BANK_TRANSFER' });
    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({ invoice: invId, amount: 30000, paymentMode: 'BANK_TRANSFER' });
    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({ invoice: invId, amount: 51200, paymentMode: 'BANK_TRANSFER' });

    const invCheck = await ProjectInvoice.findById(invId);
    expect(invCheck?.amountPaid).toBe(106200);
    expect(invCheck?.balanceDue).toBe(0);
    expect(invCheck?.status).toBe('PAID');

    // Verify Output GST remains 16,200 in reports
    const repRes = await request(app).get('/api/reports/gst-summary?range=all').set('Authorization', `Bearer ${adminToken}`);
    const foundInv = repRes.body.data.outputTransactions.find((t: any) => t.id === invId);
    expect(foundInv.outputGst).toBe(16200);
  });

  it('VERY-DIFFICULT-03: GST Report Cross-Layer Test: Input GST (1800+1000=2800), Output GST (5400+500=5900), Diff 3100 does NOT enter profit', async () => {
    const prodA = await createProduct('VD3 Prod A', 10000, 18);
    const prodB = await createProduct('VD3 Prod B', 20000, 5);

    await request(app).post('/api/purchases').set('Authorization', `Bearer ${adminToken}`).send({
      supplierId,
      items: [{ productId: prodA, purchasePrice: 10000, quantity: 1, taxRate: 18, taxAmount: 1800 }],
    });
    await request(app).post('/api/purchases').set('Authorization', `Bearer ${adminToken}`).send({
      supplierId,
      items: [{ productId: prodB, purchasePrice: 20000, quantity: 1, taxRate: 5, taxAmount: 1000 }],
    });

    const projId = await createProject('VD-03 Project', 100000);
    await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'A', rate: 30000, quantity: 1, gstRate: 18 }],
    });
    await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'B', rate: 10000, quantity: 1, gstRate: 5 }],
    });

    const repRes = await request(app).get('/api/reports/gst-summary?range=all').set('Authorization', `Bearer ${adminToken}`);
    expect(repRes.body.data.summary.itcEligibilityStatus).toBe('NOT_DETERMINED');

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.projectProfit).toBe(100000); // 3100 GST diff does NOT enter profit!
  });

  it('VERY-DIFFICULT-04: Draft / Cancelled / Paid GST Reporting: Excludes DRAFT and CANCELLED, includes UNPAID, PARTIALLY_PAID, PAID', async () => {
    const projId = await createProject('VD-04 Project', 100000);

    const makeInv = async (status: any, rate: number, invoiceNumber: string) => {
      return await ProjectInvoice.create({
        invoiceNumber,
        project: new mongoose.Types.ObjectId(projId),
        customer: new mongoose.Types.ObjectId(customerId),
        customerSnapshot: { name: 'Client', mobile: '9999999999' },
        projectSnapshot: { name: 'Proj', projectCode: 'P-VD4', siteAddress: 'Site' },
        dueDate: new Date(),
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Item', rate, amount: rate, gstRate: 18, gstAmount: rate * 0.18, lineTotal: rate * 1.18 }],
        subtotal: rate,
        discount: 0,
        taxableAmount: rate,
        taxAmount: rate * 0.18,
        grandTotal: rate * 1.18,
        status,
        amountPaid: status === 'PAID' ? rate * 1.18 : 0,
        balanceDue: status === 'PAID' ? 0 : rate * 1.18,
        createdBy: new mongoose.Types.ObjectId(),
      });
    };

    const draft = await makeInv('DRAFT', 10000, `VD4-DRAFT-${Date.now()}`);
    const cancelled = await makeInv('CANCELLED', 20000, `VD4-CANC-${Date.now()}`);
    const unpaid = await makeInv('UNPAID', 30000, `VD4-UNP-${Date.now()}`);

    const repRes = await request(app).get('/api/reports/gst-summary?range=all').set('Authorization', `Bearer ${adminToken}`);
    const refs = repRes.body.data.outputTransactions.map((t: any) => t.referenceNumber);

    expect(refs).not.toContain(draft.invoiceNumber);
    expect(refs).not.toContain(cancelled.invoiceNumber);
    expect(refs).toContain(unpaid.invoiceNumber);
  });

  it('VERY-DIFFICULT-05: Legacy compatibility: Invoice without optional fields renders safely', async () => {
    const projId = await createProject('VD-05 Project', 50000);
    const legacyDoc = await ProjectInvoice.create({
      invoiceNumber: `LEGACY-P8-${Date.now()}`,
      project: new mongoose.Types.ObjectId(projId),
      customer: new mongoose.Types.ObjectId(customerId),
      customerSnapshot: { name: 'Legacy Client', mobile: '9999999999' },
      projectSnapshot: { name: 'Legacy Proj', projectCode: 'LEG-1', siteAddress: 'Site' },
      dueDate: new Date(),
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Old Work', rate: 10000, amount: 10000, gstRate: 0, gstAmount: 0, lineTotal: 10000 }],
      subtotal: 10000,
      discount: 0,
      taxableAmount: 10000,
      taxAmount: 0,
      grandTotal: 10000,
      status: 'UNPAID',
      amountPaid: 0,
      balanceDue: 10000,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const res = await request(app).get(`/api/project-invoices/${legacyDoc._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.grandTotal).toBe(10000);
    expect(isNaN(res.body.data.taxAmount)).toBe(false);
  });

  // ==========================================
  // LEVEL 5 — EXTREME TEST CASES
  // ==========================================

  it('EXTREME-01: GST Isolation Stress Test: Layer independence across 10 purchases, mixed GST, invoices, payments', async () => {
    const projId = await createProject('EXT-01 Project', 200000);

    // 5 products across GST rates: 0, 5, 12, 18, 28
    const rates = [0, 5, 12, 18, 28];
    let expectedMaterialCost = 0;
    for (let i = 0; i < rates.length; i++) {
      const cost = (i + 1) * 1000; // 1000, 2000, 3000, 4000, 5000
      const pId = await createProduct(`EXT1 Prod ${rates[i]}%`, cost, rates[i]);
      await request(app).post('/api/purchases').set('Authorization', `Bearer ${adminToken}`).send({
        supplierId,
        items: [{ productId: pId, purchasePrice: cost, quantity: 1, taxRate: rates[i], taxAmount: cost * (rates[i] / 100) }],
      });
      await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: pId, quantity: 1 });
      expectedMaterialCost += cost;
    }

    expect(expectedMaterialCost).toBe(15000); // 1k + 2k + 3k + 4k + 5k

    await request(app).post('/api/project-expenses').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, category: 'LABOUR', description: 'Labour', amount: 5000 });

    const profBeforeInv = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profBeforeInv.body.data.actualProjectCost).toBe(20000); // 15k + 5k
    expect(profBeforeInv.body.data.projectProfit).toBe(180000); // 200k - 20k

    // Create huge customer invoice
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Turnkey Contract', rate: 300000, quantity: 1, gstRate: 28 }],
    });
    expect(invRes.body.data.grandTotal).toBe(384000);

    // Customer payment of 100k
    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({ invoice: invRes.body.data.id, amount: 100000, paymentMode: 'BANK_TRANSFER' });

    // Profitability MUST remain strictly 180,000!
    const profAfter = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profAfter.body.data.actualProjectCost).toBe(20000);
    expect(profAfter.body.data.projectProfit).toBe(180000);
    expect(profAfter.body.data.totalInvoiced).toBe(384000);
    expect(profAfter.body.data.totalReceived).toBe(100000);
    expect(profAfter.body.data.outstanding).toBe(284000);
  }, 120000);

  it('EXTREME-02: Same Material, Different Customer Billing Rates: 100 units @ 1000 cost (100k) billed in 2 invoices (160k total) -> cost remains 100k', async () => {
    const projId = await createProject('EXT-02 Project', 200000);
    const prodId = await createProduct('EXT-02 Prod', 1000);

    const mcRes = await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodId, quantity: 100 });
    const mcId = mcRes.body.data.id;

    // Invoice A: 50 units @ 1200
    await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcId, description: 'Batch 1', rate: 1200, quantity: 50, gstRate: 18 }],
    });

    // Invoice B: 50 units @ 2000
    await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcId, description: 'Batch 2', rate: 2000, quantity: 50, gstRate: 18 }],
    });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.totalMaterialCost).toBe(100000);
    expect(profRes.body.data.actualProjectCost).toBe(100000);
    expect(profRes.body.data.projectProfit).toBe(100000); // 200k - 100k
    expect(profRes.body.data.totalInvoiced).toBe(118000);
  });

  it('EXTREME-03: GST Rate Chaos: Fractional values with 5%, 12%, 18%, 28%, 0% calculate without NaN, Infinity or paisa leakage', async () => {
    const projId = await createProject('EXT-03 Project', 500000);
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 1', rate: 1234.56, quantity: 1, gstRate: 5 },
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 2', rate: 7891.23, quantity: 1, gstRate: 12 },
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 3', rate: 34567.89, quantity: 1, gstRate: 18 },
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 4', rate: 98765.43, quantity: 1, gstRate: 28 },
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'Item 5', rate: 10000.00, quantity: 1, gstRate: 0 },
      ],
    });

    expect(invRes.status).toBe(201);
    const data = invRes.body.data;
    expect(isNaN(data.subtotal)).toBe(false);
    expect(isNaN(data.taxAmount)).toBe(false);
    expect(isNaN(data.grandTotal)).toBe(false);

    // Subtotal = 1234.56 + 7891.23 + 34567.89 + 98765.43 + 10000 = 152459.11
    expect(data.subtotal).toBeCloseTo(152459.11, 2);

    // Expected GST:
    // 1234.56 * 0.05 = 61.728
    // 7891.23 * 0.12 = 946.9476
    // 34567.89 * 0.18 = 6222.2202
    // 98765.43 * 0.28 = 27654.3204
    // 10000 * 0 = 0
    // Total raw tax = 34885.2162
    expect(data.taxAmount).toBeCloseTo(34885.22, 1);
    expect(data.grandTotal).toBeCloseTo(data.subtotal + data.taxAmount, 2);
  });

  it('EXTREME-04: Discount + Mixed GST Rates: Subtotal 60k, Discount 13333.33 -> Proportional proration matches expected math', async () => {
    const projId = await createProject('EXT-04 Project', 100000);
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      discount: 13333.33,
      items: [
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'A', rate: 10000, quantity: 1, gstRate: 5 },
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'B', rate: 20000, quantity: 1, gstRate: 18 },
        { type: 'SERVICE', sourceType: 'MANUAL', description: 'C', rate: 30000, quantity: 1, gstRate: 28 },
      ],
    });

    expect(invRes.status).toBe(201);
    const data = invRes.body.data;
    expect(data.subtotal).toBe(60000);
    expect(data.discount).toBe(13333.33);
    expect(data.taxableAmount).toBeCloseTo(46666.67, 2);
    // Raw tax = 500 + 3600 + 8400 = 12500
    // Pro-rated tax = 12500 * (46666.67 / 60000) = 9722.22
    expect(data.taxAmount).toBeCloseTo(9722.22, 1);
    expect(data.grandTotal).toBeCloseTo(46666.67 + data.taxAmount, 1);
  });

  it('EXTREME-05: Negative Profit + Huge Invoice + Full Payment: Budget 50k, Cost 100k -> Profit remains -50k after 590k invoice & payment', async () => {
    const projId = await createProject('EXT-05 Project', 50000);
    const prodId = await createProduct('EXT-05 Prod', 100000);

    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodId, quantity: 1 });

    // Huge invoice: 500k + 18% GST = 590k
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Mega Invoice', rate: 500000, quantity: 1, gstRate: 18 }],
    });
    expect(invRes.body.data.grandTotal).toBe(590000);

    // Full payment
    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({
      invoice: invRes.body.data.id,
      amount: 590000,
      paymentMode: 'BANK_TRANSFER',
    });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.projectBudget).toBe(50000);
    expect(profRes.body.data.actualProjectCost).toBe(100000);
    expect(profRes.body.data.projectProfit).toBe(-50000); // Strict isolation!
    expect(profRes.body.data.projectMargin).toBe(-100);
  });

  it('EXTREME-06: GST Manipulation Isolation: Changing purchase/invoice GST or payments does NOT alter project profit (40k)', async () => {
    const projId = await createProject('EXT-06 Project', 100000);
    const prodId = await createProduct('EXT-06 Prod', 60000, 18);

    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodId, quantity: 1 });

    const profInitial = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profInitial.body.data.projectProfit).toBe(40000);

    // Invoice with 28% GST
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Bill', rate: 80000, quantity: 1, gstRate: 28 }],
    });

    // Payment of 50k
    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({
      invoice: invRes.body.data.id,
      amount: 50000,
      paymentMode: 'CASH',
    });

    const profAfter = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profAfter.body.data.projectProfit).toBe(40000); // 100k - 60k = 40k unchanged!
  });

  it('EXTREME-07: Boundary & Precision Stress: Sub-rupee and large amounts across 0%, 5%, 12%, 18%, 28% calculate safely', async () => {
    const projId = await createProject('EXT-07 Project', 5000000);
    const testRates = [0.01, 0.05, 0.10, 0.99, 1.01, 9.99, 10.01, 999.99, 10000.01, 99999.99];

    for (const rate of testRates) {
      const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
        project: projId,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: `Boundary ${rate}`, rate, quantity: 1, gstRate: 18 }],
      });
      expect(invRes.status).toBe(201);
      expect(isNaN(invRes.body.data.taxAmount)).toBe(false);
      expect(invRes.body.data.taxAmount).toBeGreaterThanOrEqual(0);
      expect(invRes.body.data.grandTotal).toBeGreaterThanOrEqual(rate);
    }
  });

  it('EXTREME-08: Overpayment Protection: Payment cannot exceed balanceDue', async () => {
    const projId = await createProject('EXT-08 Project', 50000);
    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Work', rate: 10000, quantity: 1, gstRate: 18 }],
    });
    const invId = invRes.body.data.id; // Grand total = 11,800

    // Payment 1: 6,000 -> succeeds
    const p1 = await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({
      invoice: invId,
      amount: 6000,
      paymentMode: 'CASH',
    });
    expect(p1.status).toBe(201);

    // Payment 2: 6,000 -> exceeds remaining 5,800 balance -> MUST return 400
    const p2 = await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({
      invoice: invId,
      amount: 6000,
      paymentMode: 'CASH',
    });
    expect(p2.status).toBe(400);
    expect(p2.body.message).toMatch(/cannot exceed outstanding balance/i);

    const invCheck = await ProjectInvoice.findById(invId);
    expect(invCheck?.amountPaid).toBe(6000);
    expect(invCheck?.balanceDue).toBe(5800);
  });

  it('EXTREME-09: Overbilling Material Protection: Cannot bill more than unbilled material quantity', async () => {
    const projId = await createProject('EXT-09 Project', 100000);
    const prodId = await createProduct('EXT-09 Prod', 500);

    const mcRes = await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      product: prodId,
      quantity: 100,
    });
    const mcId = mcRes.body.data.id;

    // Attempt to bill 101 units -> 400
    const overbillRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcId, description: 'Overbill attempt', rate: 800, quantity: 101, gstRate: 18 }],
    });
    expect(overbillRes.status).toBe(400);
    expect(overbillRes.body.message).toMatch(/Maximum remaining unbilled: 100/i);

    // Bill exact 100 units -> succeeds
    const validBillRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcId, description: 'Valid bill', rate: 800, quantity: 100, gstRate: 18 }],
    });
    expect(validBillRes.status).toBe(201);

    // Subsequent bill for 1 unit -> 400
    const subsequentRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'MATERIAL', sourceType: 'MATERIAL_CONSUMPTION', sourceId: mcId, description: 'Subsequent bill', rate: 800, quantity: 1, gstRate: 18 }],
    });
    expect(subsequentRes.status).toBe(400);
  });

  it('EXTREME-10: Zero Budget + Expenses + GST + Invoice: Budget 0, Cost 10k -> Profit -10k, Margin 0% (no div by zero)', async () => {
    const projId = await createProject('EXT-10 Zero Budget Project', 0);
    const prodId = await createProduct('EXT-10 Prod', 10000);

    await request(app).post('/api/material-consumptions').set('Authorization', `Bearer ${adminToken}`).send({ project: projId, product: prodId, quantity: 1 });

    const invRes = await request(app).post('/api/project-invoices').set('Authorization', `Bearer ${adminToken}`).send({
      project: projId,
      items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Bill', rate: 20000, quantity: 1, gstRate: 18 }],
    });
    expect(invRes.body.data.grandTotal).toBe(23600);

    await request(app).post('/api/project-invoice-payments').set('Authorization', `Bearer ${accountsToken}`).send({
      invoice: invRes.body.data.id,
      amount: 23600,
      paymentMode: 'UPI',
    });

    const profRes = await request(app).get(`/api/projects/${projId}/profitability`).set('Authorization', `Bearer ${adminToken}`);
    expect(profRes.body.data.projectBudget).toBe(0);
    expect(profRes.body.data.actualProjectCost).toBe(10000);
    expect(profRes.body.data.projectProfit).toBe(-10000);
    expect(profRes.body.data.projectMargin).toBe(0); // Safe 0%
    expect(profRes.body.data.totalInvoiced).toBe(23600);
    expect(profRes.body.data.totalReceived).toBe(23600);
    expect(profRes.body.data.outstanding).toBe(0);
  });
});
