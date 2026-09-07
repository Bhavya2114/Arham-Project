import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Phase 3 — GST End-to-End Behavior & Profitability Verification', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  // Helper to create a supplier
  const createSupplier = async (name: string) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        mobile: `98${timestamp.toString().slice(-8)}`,
        gstNumber: '27AABCS1429B1Z1',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // Helper to create a customer
  const createCustomer = async (name: string) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        businessName: `${name} Business`,
        mobile: `97${timestamp.toString().slice(-8)}`,
        type: 'WHOLESALE',
        address: '100 Marine Drive, Mumbai',
        status: 'ACTIVE',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // Helper to create a product
  const createProduct = async (name: string, initialCost: number = 0) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        sku: `SKU-${timestamp}-${Math.floor(Math.random() * 1000)}`,
        category: 'Electrical Supplies',
        costPrice: initialCost,
        unitPrice: initialCost * 1.5,
        currentStock: 100,
        minStockQuantity: 5,
        location: 'Rack E1',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // Helper to create a project
  const createProject = async (name: string, budget: number, customerId: string) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-VERIFY-${timestamp}`,
        name,
        budget,
        customer: customerId,
        siteAddress: 'Andheri East, Mumbai',
        startDate: new Date().toISOString().split('T')[0],
        status: 'IN_PROGRESS',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // =========================================================================
  // TASK 2 & TASK 15.1: VERIFY PURCHASE -> PRODUCT COST
  // =========================================================================
  it('Task 2 & 15.1: Purchase Price = ₹1,000, Qty = 10, GST = 18% -> Product.costPrice MUST become ₹1,000', async () => {
    const supplierId = await createSupplier('Task 2 Supplier');
    const productId = await createProduct('Task 2 Wire', 500);

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-T2-${Date.now()}`,
        items: [
          {
            productId,
            purchasePrice: 1000,
            quantity: 10,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const purchase = purchaseRes.body.data;

    // Taxable purchase amount = ₹10,000
    expect(purchase.subtotal).toBe(10000);
    // GST = ₹1,800
    expect(purchase.taxAmount).toBe(1800);
    // Supplier bill total = ₹11,800
    expect(purchase.totalAmount).toBe(11800);

    // Product.costPrice MUST become ₹1,000 (NOT ₹1,180, NOT ₹11,800, NOT ₹10,000)
    const prodRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.status).toBe(200);
    expect(prodRes.body.data.costPrice).toBe(1000);
    expect(prodRes.body.data.costPrice).not.toBe(1180);
    expect(prodRes.body.data.costPrice).not.toBe(11800);
    expect(prodRes.body.data.costPrice).not.toBe(10000);
  });

  // =========================================================================
  // TASK 3 & TASK 15.2-15.3: VERIFY PURCHASE -> MATERIAL CONSUMPTION
  // =========================================================================
  it('Task 3 & 15.2-15.3: Consume Qty = 2 -> actualCostPrice = ₹1,000, actualCostTotal = ₹2,000', async () => {
    const supplierId = await createSupplier('Task 3 Supplier');
    const customerId = await createCustomer('Task 3 Customer');
    const productId = await createProduct('Task 3 Switch', 0);
    const projectId = await createProject('Task 3 Project', 50000, customerId);

    // Purchase 10 units at ₹1,000 + 18% GST
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 1000,
            quantity: 10,
            taxRate: 18,
          },
        ],
      });

    // Consume 2 units
    const mcRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 2,
        notes: 'Task 3 consumption',
      });

    expect(mcRes.status).toBe(201);
    const mc = mcRes.body.data;

    // actualCostPrice must be ₹1,000 (tax-exclusive)
    expect(mc.actualCostPrice).toBe(1000);
    expect(mc.actualCostPrice).not.toBe(1180);

    // actualCostTotal must be ₹2,000 (2 * ₹1,000)
    expect(mc.actualCostTotal).toBe(2000);
    expect(mc.actualCostTotal).not.toBe(2360);
    expect(mc.actualCostTotal).not.toBe(11800);
  });

  // =========================================================================
  // TASK 4 & TASK 15.4: VERIFY PROJECT PROFITABILITY (Budget vs Actual Cost)
  // =========================================================================
  it('Task 4 & 15.4: Budget = ₹50,000, Material = ₹2,000, Expenses = ₹1,000 -> Cost = ₹3,000, Profit = ₹47,000, Margin = 94%', async () => {
    const supplierId = await createSupplier('Task 4 Supplier');
    const customerId = await createCustomer('Task 4 Customer');
    const productId = await createProduct('Task 4 Cable', 0);
    const projectId = await createProject('Task 4 Profitability Project', 50000, customerId);

    // 1. Purchase: 2 units at ₹1,000 with 18% GST (Taxable = ₹2,000, GST = ₹360, Total = ₹2,360)
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 1000,
            quantity: 2,
            taxRate: 18,
          },
        ],
      });
    expect(purchaseRes.status).toBe(201);
    expect(purchaseRes.body.data.taxAmount).toBe(360); // Purchase GST = ₹360

    // 2. Consume 2 units -> Material Cost = ₹2,000
    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 2,
      });

    // 3. Project Expense -> ₹1,000
    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        category: 'TRANSPORT',
        amount: 1000,
        description: 'Site transport expense',
      });

    // 4. Verify Project Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    expect(prof.projectBudget).toBe(50000);
    expect(prof.totalMaterialCost).toBe(2000);
    expect(prof.totalProjectExpenses).toBe(1000);
    expect(prof.actualProjectCost).toBe(3000);
    expect(prof.projectProfit).toBe(47000);
    expect(prof.projectMargin).toBe(94);

    // Crucial check: Purchase GST (₹360) MUST NOT be included in actualProjectCost or reduce projectProfit
    expect(prof.actualProjectCost).not.toBe(3360);
    expect(prof.projectProfit).not.toBe(46640);
  });

  // =========================================================================
  // TASK 5 & TASK 15.5: VERIFY CUSTOMER INVOICE GST
  // =========================================================================
  it('Task 5 & 15.5: Customer Invoice Taxable = ₹10,000, GST = ₹1,800 -> Zero impact on project budget, cost, or profit', async () => {
    const customerId = await createCustomer('Task 5 Customer');
    const projectId = await createProject('Task 5 Invoice Project', 50000, customerId);

    // Create Customer Project Invoice: Taxable ₹10,000 + 18% GST (₹1,800) = ₹11,800
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        invoiceNumber: `PINV-T5-${Date.now()}`,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Phase 1 Consultation and Design',
            quantity: 1,
            rate: 10000,
            gstRate: 18,
          },
        ],
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBe(10000);
    expect(invRes.body.data.taxAmount).toBe(1800);
    expect(invRes.body.data.grandTotal).toBe(11800);

    // Verify Project Profitability: zero cost incurred yet
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // Budget MUST remain ₹50,000 (NOT ₹51,800, NOT ₹61,800)
    expect(prof.projectBudget).toBe(50000);
    expect(prof.actualProjectCost).toBe(0);
    // Profit MUST remain ₹50,000 (NOT increased by ₹1,800, NOT decreased by ₹1,800)
    expect(prof.projectProfit).toBe(50000);
    expect(prof.projectMargin).toBe(100);

    // Invoicing tracked independently
    expect(prof.totalInvoiced).toBe(11800);
  });

  // =========================================================================
  // TASK 6 & TASK 15.9: REPRODUCE ORIGINAL BUG SCENARIO
  // =========================================================================
  it('Task 6 & 15.9: Original Bug Scenario (Budget = ₹50,000, Material Cost = ₹3,462, Invoice = ₹4,085.16) -> Profit = ₹46,538, Margin ≈ 93.08%', async () => {
    const supplierId = await createSupplier('Finolex Supplier');
    const customerId = await createCustomer('Finolex Project Customer');
    const productId = await createProduct('FINOLEX CAT 6 LITE', 0);
    const projectId = await createProject('CAT 6 Installation Site', 50000, customerId);

    // 1. Purchase: 1,220 units of FINOLEX CAT 6 LITE at ₹34.62 tax-exclusive price with 18% GST
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `FCC/26-27/2199-${Date.now()}`,
        items: [
          {
            productId,
            purchasePrice: 34.62,
            quantity: 1220,
            taxRate: 18,
          },
        ],
      });
    expect(purchaseRes.status).toBe(201);

    // 2. Consume 100 units on project: 100 * ₹34.62 = ₹3,462.00
    const mcRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 100,
      });
    expect(mcRes.status).toBe(201);
    expect(mcRes.body.data.actualCostPrice).toBe(34.62);
    expect(mcRes.body.data.actualCostTotal).toBeCloseTo(3462.0, 2);

    // 3. Customer Invoice issued matching material cost + 18% Output GST:
    // Subtotal = ₹3,462.00, GST = ₹623.16, Grand Total = ₹4,085.16
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        invoiceNumber: `PINV-2026-0002-${Date.now()}`,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Network Cabling Material Supply & Setup',
            quantity: 100,
            rate: 34.62,
            gstRate: 18,
          },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBeCloseTo(3462.0, 2);
    expect(invRes.body.data.taxAmount).toBeCloseTo(623.16, 2);
    expect(invRes.body.data.grandTotal).toBeCloseTo(4085.16, 2);

    // 4. Verify Project Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // Expected authoritative values:
    expect(prof.projectBudget).toBe(50000);
    expect(prof.totalMaterialCost).toBeCloseTo(3462.0, 2);
    expect(prof.actualProjectCost).toBeCloseTo(3462.0, 2);
    expect(prof.projectProfit).toBeCloseTo(46538.0, 2);
    expect(prof.projectMargin).toBeCloseTo(93.08, 1);

    // CRITICAL: Must NOT report old bug figures
    expect(prof.projectProfit).not.toBeCloseTo(623.16, 1); // Not invoice GST
    expect(prof.projectProfit).not.toBeCloseTo(4085.16 - 3462.0, 1); // Not (Invoice Grand Total - Cost)
  });

  // =========================================================================
  // TASK 7 & TASK 15.6: VERIFY INVOICE PAYMENT
  // =========================================================================
  it('Task 7 & 15.6: Full Invoice Payment of ₹11,800 clears balance without altering project profitability', async () => {
    const customerId = await createCustomer('Task 7 Customer');
    const projectId = await createProject('Task 7 Payment Project', 80000, customerId);

    // 1. Create Invoice: ₹10,000 + ₹1,800 GST = ₹11,800
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        invoiceNumber: `PINV-T7-${Date.now()}`,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Milestone 1 Billing',
            quantity: 1,
            rate: 10000,
            gstRate: 18,
          },
        ],
      });
    const invoiceId = invRes.body.data.id;

    // 2. Record Payment: ₹11,800
    const pmtRes = await request(app)
      .post('/api/project-invoice-payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice: invoiceId,
        amount: 11800,
        paymentMode: 'BANK_TRANSFER',
        paymentDate: new Date().toISOString().split('T')[0],
      });
    expect(pmtRes.status).toBe(201);

    // 3. Verify Project Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // Cash-flow tracking
    expect(prof.totalInvoiced).toBe(11800);
    expect(prof.totalReceived).toBe(11800);
    expect(prof.outstanding).toBe(0);

    // Operational profitability remains solely Budget - Cost
    expect(prof.projectBudget).toBe(80000);
    expect(prof.actualProjectCost).toBe(0);
    expect(prof.projectProfit).toBe(80000);
    expect(prof.projectMargin).toBe(100);
  });

  // =========================================================================
  // TASK 8 & TASK 15.7: VERIFY DIFFERENT GST RATES
  // =========================================================================
  it('Task 8 & 15.7: Mixed GST rates (5% and 18%) calculate subtotal ₹3,000, GST ₹410, total ₹3,410', async () => {
    const supplierId = await createSupplier('Mixed GST Supplier');
    const prod5Id = await createProduct('Product 5 Percent', 0);
    const prod18Id = await createProduct('Product 18 Percent', 0);

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-MIX-${Date.now()}`,
        items: [
          {
            productId: prod5Id,
            purchasePrice: 1000,
            quantity: 1,
            taxRate: 5,
          },
          {
            productId: prod18Id,
            purchasePrice: 2000,
            quantity: 1,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const p = purchaseRes.body.data;

    // Subtotal = 1000 + 2000 = 3000
    expect(p.subtotal).toBe(3000);
    // GST = 50 + 360 = 410
    expect(p.taxAmount).toBe(410);
    // Total = 3000 + 410 = 3410
    expect(p.totalAmount).toBe(3410);

    // Product 1 costPrice = 1000, Product 2 costPrice = 2000 (strictly tax-exclusive)
    const p1Check = await request(app).get(`/api/products/${prod5Id}`).set('Authorization', `Bearer ${adminToken}`);
    const p2Check = await request(app).get(`/api/products/${prod18Id}`).set('Authorization', `Bearer ${adminToken}`);

    expect(p1Check.body.data.costPrice).toBe(1000);
    expect(p2Check.body.data.costPrice).toBe(2000);
  });

  // =========================================================================
  // TASK 9 & TASK 15.8: VERIFY OCR GST BREAKDOWN PRESERVATION
  // =========================================================================
  it('Task 9 & 15.8: Preserves explicit OCR GST breakdown without fabricating missing values', async () => {
    const supplierId = await createSupplier('OCR Inter-State Vendor');
    const productId = await createProduct('OCR Raw Item', 0);

    // Inter-state invoice with explicit IGST only (cgst = 0, sgst = 0, igst = 360)
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `OCR-IGST-${Date.now()}`,
        cgst: 0,
        sgst: 0,
        igst: 360,
        items: [
          {
            productId,
            purchasePrice: 2000,
            quantity: 1,
            taxRate: 18,
            taxAmount: 360,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const p = purchaseRes.body.data;

    expect(p.items[0].taxAmount).toBe(360);
    expect(p.cgst).toBe(0);
    expect(p.sgst).toBe(0);
    expect(p.igst).toBe(360);

    // Ensure Product.costPrice remains 2000 (OCR GST is NOT material cost)
    const prodCheck = await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(prodCheck.body.data.costPrice).toBe(2000);
  });

  // =========================================================================
  // TASK 10 & TASK 15.10: VERIFY GST ROUNDING
  // =========================================================================
  it('Task 10 & 15.10: Decimal purchase price (₹34.62 × 1,220 at 18%) does not create duplicate GST or mismatch', async () => {
    const supplierId = await createSupplier('Decimal Rounding Supplier');
    const productId = await createProduct('Decimal Cable', 0);

    // 34.62 * 1220 = 42,236.40 base. 18% GST = 7,602.552. Total = 49,838.952
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `DEC-INV-${Date.now()}`,
        items: [
          {
            productId,
            purchasePrice: 34.62,
            quantity: 1220,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const p = purchaseRes.body.data;

    expect(p.subtotal).toBeCloseTo(42236.40, 2);
    expect(p.taxAmount).toBeCloseTo(7602.55, 1);
    expect(p.totalAmount).toBeCloseTo(49838.95, 1);

    // Subtotal + TaxAmount equals TotalAmount
    expect(Math.abs(p.totalAmount - (p.subtotal + p.taxAmount))).toBeLessThan(0.01);
  });
});
