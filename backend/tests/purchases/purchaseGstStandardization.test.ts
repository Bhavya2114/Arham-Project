import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Phase 2 — GST Data Structure Standardization Tests', () => {
  let adminToken: string;
  let supplierId: string;
  let productId: string;
  let productSku: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const timestamp = Date.now();
    productSku = `PUR-GST-${timestamp}`;

    // 1. Create a supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 2 GST Supplier',
        mobile: `98${timestamp.toString().slice(-8)}`,
        gstNumber: '27AABCS1429B1Z1',
      });
    expect(supRes.status).toBe(201);
    supplierId = supRes.body.data.id;

    // 2. Create a product with initial costPrice = 500
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 2 GST Material Product',
        sku: productSku,
        category: 'Raw Materials',
        costPrice: 500,
        unitPrice: 800,
        currentStock: 20,
        minStockQuantity: 5,
        location: 'Warehouse A',
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
  });

  // Test 1, 2, 3, 4: Purchase line stores taxAmount, Purchase root stores cgst, sgst, igst
  it('1-4. should store line taxAmount and root cgst, sgst, igst when explicitly provided', async () => {
    // Purchase payload with intra-state GST (CGST = 90, SGST = 90, Total GST = 180 on base 1000)
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-GST-${Date.now()}`,
        cgst: 90,
        sgst: 90,
        igst: 0,
        items: [
          {
            productId,
            purchasePrice: 1000,
            quantity: 1,
            taxRate: 18,
            taxAmount: 180,
          },
        ],
        notes: 'GST breakdown test payload',
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data;

    // 1. Purchase line stores taxAmount
    expect(purchase.items[0].taxAmount).toBe(180);

    // 2. Purchase root stores cgst
    expect(purchase.cgst).toBe(90);

    // 3. Purchase root stores sgst
    expect(purchase.sgst).toBe(90);

    // 4. Purchase root stores igst
    expect(purchase.igst).toBe(0);

    // Subtotal and totals check
    expect(purchase.subtotal).toBe(1000);
    expect(purchase.taxAmount).toBe(180);
    expect(purchase.totalAmount).toBe(1180);
  });

  // Test 5: Existing purchase payload without new fields still works (backward compatibility)
  it('5. should seamlessly accept existing purchase payload without new GST fields', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 2000,
            quantity: 2,
            taxRate: 18,
          },
        ],
        notes: 'Legacy purchase creation payload without cgst/sgst/igst/taxAmount',
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data;

    expect(purchase.subtotal).toBe(4000);
    expect(purchase.taxAmount).toBe(720);
    expect(purchase.totalAmount).toBe(4720);
    expect(purchase.items[0].taxAmount).toBe(720); // auto-calculated
    expect(purchase.cgst).toBeUndefined();
    expect(purchase.sgst).toBeUndefined();
    expect(purchase.igst).toBeUndefined();
  });

  // Test 6 & 7: purchasePrice and Product.costPrice remain strictly tax-exclusive
  it('6-7. should keep purchasePrice and Product.costPrice strictly tax-exclusive', async () => {
    const exclusivePrice = 1500;
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: exclusivePrice,
            quantity: 3,
            taxRate: 18,
            taxAmount: 810, // 1500 * 3 * 18% = 810
          },
        ],
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data;

    // 6. purchasePrice is tax-exclusive
    expect(purchase.items[0].purchasePrice).toBe(exclusivePrice);

    // 7. Product.costPrice is updated to tax-exclusive purchasePrice
    const prodRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.status).toBe(200);
    expect(prodRes.body.data.costPrice).toBe(exclusivePrice);
  });

  // Test 8: totalCost remains tax-inclusive supplier line total
  it('8. should verify totalCost remains tax-inclusive supplier gross line total', async () => {
    const price = 400;
    const qty = 5;
    const base = price * qty; // 2000
    const tax = (base * 18) / 100; // 360
    const grossTotal = base + tax; // 2360

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: price,
            quantity: qty,
            taxRate: 18,
          },
        ],
      });

    expect(res.status).toBe(201);
    const item = res.body.data.items[0];
    expect(item.subtotal).toBe(base);
    expect(item.taxAmount).toBe(tax);
    expect(item.totalCost).toBe(grossTotal);
    expect(item.lineTotal).toBe(grossTotal);
  });

  // Test 9: GST is not counted twice when both taxRate and taxAmount are supplied
  it('9. should guarantee GST is not added twice into supplier line total or grand total', async () => {
    const price = 1000;
    const qty = 2;
    const base = price * qty; // 2000
    const gst18 = 360; // 18% of 2000

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: price,
            quantity: qty,
            taxRate: 18,
            taxAmount: gst18,
          },
        ],
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data;
    const item = purchase.items[0];

    // Verify subtotal is exactly base (2000), not base + gst
    expect(item.subtotal).toBe(base);
    expect(purchase.subtotal).toBe(base);

    // Line tax is exactly 360
    expect(item.taxAmount).toBe(360);
    expect(purchase.taxAmount).toBe(360);

    // Line gross total is exactly 2000 + 360 = 2360 (NOT 2000 + 360 + 360 = 2720)
    expect(item.totalCost).toBe(2360);
    expect(purchase.totalAmount).toBe(2360);
  });

  // Test 10: Project profitability remains unaffected by purchase GST
  it('10. should ensure project profitability formula uses tax-exclusive material cost and ignores purchase GST', async () => {
    // 1. Create a customer fixture
    const customer = await createTestCustomer({
      name: 'Profitability Test Customer',
      businessName: 'Profitability Business',
      mobile: `97${Date.now().toString().slice(-8)}`,
      type: 'WHOLESALE',
      address: '100 Profitability Lane, Mumbai',
      status: 'ACTIVE',
    });
    const customerId = customer._id.toString();

    // 2. Create a project with GST-exclusive budget = 50,000
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-P2-${Date.now()}`,
        name: 'Project GST Profitability Integrity Test',
        budget: 50000,
        customer: customerId,
        siteAddress: '100 Profitability Site, Mumbai',
        startDate: new Date().toISOString().split('T')[0],
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // 3. Consume material for this project: 10 units of product at current costPrice (1500 tax-exclusive)
    const mcRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 10,
        notes: 'Material consumed at tax-exclusive costPrice',
      });
    expect(mcRes.status).toBe(201);
    expect(mcRes.body.data.actualCostPrice).toBe(1000);
    expect(mcRes.body.data.actualCostTotal).toBe(10000); // 10 * 1000

    // 4. Fetch Project Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // Material Cost must be 10,000 (tax-exclusive)
    expect(prof.totalMaterialCost).toBe(10000);
    // Project Budget must be 50,000 (GST-exclusive)
    expect(prof.projectBudget).toBe(50000);
    // Actual Cost = Material (10000) + Expenses (0) + Labour (0) = 10000
    expect(prof.actualProjectCost).toBe(10000);
    // Profit = Budget (50000) - Actual Cost (10000) = 40000
    expect(prof.projectProfit).toBe(40000);
    // Margin = (40000 / 50000) * 100 = 80%
    expect(prof.projectMargin).toBe(80);
  });

  // Test 11: Customer invoice GST remains separate from project profitability
  it('11. should confirm project invoice GST remains untouched and does not alter project budget or profitability', async () => {
    // 1. Create a customer fixture
    const customer = await createTestCustomer({
      name: 'Invoice GST Test Customer',
      businessName: 'Invoice Test Corp',
      mobile: `96${Date.now().toString().slice(-8)}`,
      type: 'WHOLESALE',
      address: '200 Invoice Road, Pune',
      status: 'ACTIVE',
    });
    const customerId = customer._id.toString();

    // 2. Create project with budget = 100,000
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-INV-${Date.now()}`,
        name: 'Invoice GST Isolation Project',
        budget: 100000,
        customer: customerId,
        siteAddress: '200 Invoice Site, Pune',
        startDate: new Date().toISOString().split('T')[0],
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // 3. Create Project Invoice with GST: subtotal = 40,000, taxRate = 18%, taxAmount = 7,200, grandTotal = 47,200
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        invoiceNumber: `PRJ-INV-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Phase 1 Milestone Deliverable',
            quantity: 1,
            rate: 40000,
            gstRate: 18,
          },
        ],
      });
    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBe(40000);
    expect(invRes.body.data.taxAmount).toBe(7200);
    expect(invRes.body.data.grandTotal).toBe(47200);

    // 4. Verify Project Profitability still uses budget = 100,000 and is NOT mutated by invoice GST
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;
    expect(prof.projectBudget).toBe(100000);
    expect(prof.actualProjectCost).toBe(0);
    expect(prof.projectProfit).toBe(100000);
    expect(prof.projectMargin).toBe(100);
  });
});

