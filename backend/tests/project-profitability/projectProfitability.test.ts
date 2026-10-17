import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Project Profitability Engine: Budget vs Actual Cost (Phase 4)', () => {
  let adminToken: string;
  let accountsToken: string;
  let customerId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    accountsToken = await getAuthToken('ACCOUNTS');

    // Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Godrej Properties Ltd',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `godrej_${Date.now()}@realestate.com`,
      businessName: 'Godrej Real Estate',
      gstNumber: '27GODREJ1234F1Z1',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Vikhroli, Mumbai',
    });
    customerId = customer._id.toString();
  });

  // Helper to create product
  const createProduct = async (name: string, costPrice: number) => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        sku: `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        category: 'Building Material',
        costPrice,
        gstRate: 18,
        currentStock: 1000,
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
        projectCode: `PRJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name,
        customer: customerId,
        siteAddress: 'Mumbai Site',
        startDate: '2026-09-01',
        budget,
        status: 'IN_PROGRESS',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // TEST 1: Budget = 50,000, Materials = 30,000, Expenses = 0, Labour = 0
  // Expected: Actual Cost = 30,000, Profit = 20,000, Margin = 40%
  it('TEST 1 — Budget = 50,000, Materials = 30,000, Expenses = 0 -> Profit = 20,000, Margin = 40%', async () => {
    const pId = await createProject('P1 Test', 50000);
    const prodId = await createProduct('Prod P1', 3000); // 10 units = 30,000 cost

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 10 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(50000);
    expect(res.body.data.totalMaterialCost).toBe(30000);
    expect(res.body.data.totalProjectExpenses).toBe(0);
    expect(res.body.data.actualProjectCost).toBe(30000);
    expect(res.body.data.projectProfit).toBe(20000);
    expect(res.body.data.projectMargin).toBe(40);
  });

  // TEST 2: Budget = 50,000, Materials = 30,000, Expenses = 5,000, Labour = 0
  // Expected: Actual Cost = 35,000, Profit = 15,000, Margin = 30%
  it('TEST 2 — Budget = 50,000, Materials = 30,000, Expenses = 5,000 -> Profit = 15,000, Margin = 30%', async () => {
    const pId = await createProject('P2 Test', 50000);
    const prodId = await createProduct('Prod P2', 3000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 10 });

    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, category: 'TRANSPORT', description: 'Logistics', amount: 5000 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(50000);
    expect(res.body.data.totalMaterialCost).toBe(30000);
    expect(res.body.data.totalProjectExpenses).toBe(5000);
    expect(res.body.data.actualProjectCost).toBe(35000);
    expect(res.body.data.projectProfit).toBe(15000);
    expect(res.body.data.projectMargin).toBe(30);
  });

  // TEST 3: Budget = 50,000, Materials = 30,000, Expenses = 5,000, Labour = 8,000
  // Expected: Actual Cost = 43,000, Profit = 7,000, Margin = 14%
  it('TEST 3 — Budget = 50,000, Materials = 30,000, Expenses = 5,000, Labour = 8,000 -> Profit = 7,000, Margin = 14%', async () => {
    const pId = await createProject('P3 Test', 50000);
    const prodId = await createProduct('Prod P3', 3000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 10 });

    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, category: 'TRANSPORT', description: 'Logistics', amount: 5000 });

    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, category: 'LABOUR', description: 'Masonry labour', amount: 8000 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(50000);
    expect(res.body.data.totalMaterialCost).toBe(30000);
    expect(res.body.data.totalProjectExpenses).toBe(13000);
    expect(res.body.data.actualProjectCost).toBe(43000);
    expect(res.body.data.projectProfit).toBe(7000);
    expect(res.body.data.projectMargin).toBe(14);
  });

  // TEST 4 — EXACT BUDGET: Budget = 50,000, Actual Cost = 50,000 -> Profit = 0, Margin = 0%
  it('TEST 4 — Exact Budget: Budget = 50,000, Actual Cost = 50,000 -> Profit = 0, Margin = 0%', async () => {
    const pId = await createProject('P4 Exact Budget', 50000);
    const prodId = await createProduct('Prod P4', 5000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 10 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(50000);
    expect(res.body.data.actualProjectCost).toBe(50000);
    expect(res.body.data.projectProfit).toBe(0);
    expect(res.body.data.projectMargin).toBe(0);
  });

  // TEST 5 — OVER BUDGET: Budget = 50,000, Actual Cost = 60,000 -> Profit = -10,000, Margin = -20%
  it('TEST 5 — Over Budget: Budget = 50,000, Actual Cost = 60,000 -> Profit = -10,000, Margin = -20%', async () => {
    const pId = await createProject('P5 Over Budget', 50000);
    const prodId = await createProduct('Prod P5', 6000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 10 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(50000);
    expect(res.body.data.actualProjectCost).toBe(60000);
    expect(res.body.data.projectProfit).toBe(-10000);
    expect(res.body.data.projectMargin).toBe(-20);
  });

  // TEST 6 — ZERO BUDGET: Budget = 0 -> Safe margin behavior (0) without division by zero
  it('TEST 6 — Zero Budget: Budget = 0 -> Safe margin behavior without division by zero', async () => {
    const pId = await createProject('P6 Zero Budget', 0);
    const prodId = await createProduct('Prod P6', 1000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 5 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(0);
    expect(res.body.data.actualProjectCost).toBe(5000);
    expect(res.body.data.projectProfit).toBe(-5000);
    expect(res.body.data.projectMargin).toBe(0);
  });

  // TEST 7 — INVOICE INDEPENDENCE: Invoiced and received amounts do NOT alter operational profit
  it('TEST 7 — Invoice & Payment Independence: Invoices & Payments do NOT alter operational profit', async () => {
    const pId = await createProject('P7 Invoice Independence', 50000);
    const prodId = await createProduct('Prod P7', 3000);

    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 10 }); // Cost = 30,000

    // Create Invoice for 50,000
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: pId,
        items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Milestone 1', rate: 50000, gstRate: 0 }],
      });
    const invId = invRes.body.data.id;

    // Record Partial Payment of 10,000
    await request(app)
      .post('/api/project-invoice-payments')
      .set('Authorization', `Bearer ${accountsToken}`)
      .send({ invoice: invId, amount: 10000, paymentMode: 'CASH' });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projectBudget).toBe(50000);
    expect(res.body.data.actualProjectCost).toBe(30000);
    expect(res.body.data.projectProfit).toBe(20000); // 50,000 - 30,000 = 20,000
    expect(res.body.data.projectMargin).toBe(40);
    expect(res.body.data.totalInvoiced).toBe(50000);
    expect(res.body.data.totalReceived).toBe(10000);
    expect(res.body.data.outstanding).toBe(40000);
  });

  // TEST 8 — MATERIAL COST: Uses actual cost (actualCostTotal), NOT selling price
  it('TEST 8 — Material Cost: Derived strictly from actual material costPrice data', async () => {
    const pId = await createProject('P8 Material Cost', 100000);
    const prodId = await createProduct('Prod P8', 400); // costPrice = 400

    // Issue 20 units with arbitrary billing price of 700 (billingTotal = 14,000)
    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, product: prodId, quantity: 20, billingPrice: 700 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Material cost should be 20 * 400 = 8,000 (NOT billingTotal 14,000)
    expect(res.body.data.totalMaterialCost).toBe(8000);
    expect(res.body.data.actualProjectCost).toBe(8000);
    expect(res.body.data.projectProfit).toBe(92000);
  });

  // TEST 9 & 10 — EXPENSES & LABOUR BREAKDOWN
  it('TEST 9 & 10 — Expenses & Labour Breakdown: Category expenses properly tracked', async () => {
    const pId = await createProject('P9 Breakdown', 100000);

    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, category: 'MACHINERY_RENTAL', description: 'Crane', amount: 15000 });

    await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: pId, category: 'LABOUR', description: 'Electrical sub-contract', amount: 12000 });

    const res = await request(app)
      .get(`/api/projects/${pId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalProjectExpenses).toBe(27000);
    expect(res.body.data.expenseCategoryBreakdown.MACHINERY_RENTAL).toBe(15000);
    expect(res.body.data.expenseCategoryBreakdown.LABOUR).toBe(12000);
    expect(res.body.data.actualProjectCost).toBe(27000);
    expect(res.body.data.projectProfit).toBe(73000);
    expect(res.body.data.projectMargin).toBe(73);
  });
});
