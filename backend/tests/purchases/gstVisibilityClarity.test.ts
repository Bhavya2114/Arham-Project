import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Phase 4 — GST Visibility & Financial UI Clarity Verification Tests', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

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

  const createCustomer = async (name: string) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        businessName: `${name} Ltd`,
        mobile: `97${timestamp.toString().slice(-8)}`,
        type: 'WHOLESALE',
        address: '100 Business Park, Mumbai',
        status: 'ACTIVE',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  const createProduct = async (name: string, initialCost: number = 0) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        sku: `SKU-${timestamp}-${Math.floor(Math.random() * 1000)}`,
        category: 'Hardware',
        costPrice: initialCost,
        unitPrice: initialCost * 1.5,
        currentStock: 100,
        minStockQuantity: 5,
        location: 'Aisle 1',
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  const createProject = async (name: string, budget: number, customerId: string) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        projectCode: `PRJ-${timestamp.toString().slice(-6)}`,
        customer: customerId,
        siteAddress: '202 Marine Lines, Mumbai',
        budget,
        status: 'IN_PROGRESS',
        startDate: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  // Point 1, 2, 3: Purchase Taxable Value, GST breakdown, and Supplier Total
  it('Verifies 1, 2, 3: Purchase taxable value excludes GST, GST is stored/returned separately, and supplier total includes GST', async () => {
    const supplierId = await createSupplier('Vis Clarity Supplier 1');
    const productId = await createProduct('Vis Clarity Cable', 0);

    const purchasePayload = {
      supplierId,
      invoiceNumber: `INV-VIS-${Date.now()}`,
      invoiceDate: new Date().toISOString(),
      cgst: 450,
      sgst: 450,
      items: [
        {
          productId,
          purchasePrice: 500, // base price
          quantity: 10,       // taxable = 5,000
          taxRate: 18,        // GST = 900
          taxAmount: 900,
          unit: 'Mtr',
        },
      ],
    };

    const createRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(purchasePayload);

    expect(createRes.status).toBe(201);
    const pData = createRes.body.data;

    // 1. Purchase taxable value excludes GST
    expect(pData.subtotal).toBe(5000);
    expect(pData.items[0].subtotal).toBe(5000);
    expect(pData.items[0].purchasePrice).toBe(500);

    // 2. Purchase GST is stored and returned separately
    expect(pData.taxAmount).toBe(900);
    expect(pData.items[0].taxAmount).toBe(900);
    expect(pData.cgst).toBe(450);
    expect(pData.sgst).toBe(450);

    // 3. Purchase supplier total includes GST
    expect(pData.totalAmount).toBe(5900);
    expect(pData.grandTotal).toBe(5900);

    // Product cost price strictly updated to GST-exclusive purchase price
    const prodRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.status).toBe(200);
    expect(prodRes.body.data.costPrice).toBe(500);
  });

  // Point 4, 5, 6, 7: Project Material Cost, Actual Cost, Profit, and Margin
  it('Verifies 4, 5, 6, 7: Project material cost excludes GST, actual cost excludes GST, project profit excludes GST, margin excludes GST', async () => {
    const customerId = await createCustomer('Vis Customer Profit');
    const supplierId = await createSupplier('Vis Supplier Profit');
    const productId = await createProduct('Vis Conduit Pipe', 0);

    // Purchase 10 @ ₹1,000 with 18% GST (Taxable ₹10,000, GST ₹1,800, Total ₹11,800)
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-PRJ-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        items: [
          {
            productId,
            purchasePrice: 1000,
            quantity: 10,
            taxRate: 18,
            taxAmount: 1800,
            unit: 'Pcs',
          },
        ],
      });

    // Create project with Budget = ₹50,000 (GST-exclusive)
    const projectId = await createProject('Vis Profitability Project', 50000, customerId);

    // Issue 3 units to project (Cost basis: 3 * 1000 = 3000)
    const issueRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 3,
        billingPrice: 1500,
      });
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.actualCostPrice).toBe(1000);
    expect(issueRes.body.data.actualCostTotal).toBe(3000);

    // Add Project Expense: ₹1,500
    const expRes = await request(app)
      .post('/api/project-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        category: 'TRANSPORT',
        description: 'Site transport for pipes',
        amount: 1500,
      });
    expect(expRes.status).toBe(201);

    // Fetch Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // 4. Project material cost excludes GST: exactly ₹3,000 (not ₹3,540)
    expect(prof.totalMaterialCost).toBe(3000);

    // 5. Project actual cost excludes GST: 3,000 (Material) + 1,500 (Expense) = 4,500
    expect(prof.actualProjectCost).toBe(4500);

    // 6. Project profit excludes GST: 50,000 - 4,500 = 45,500
    expect(prof.projectProfit).toBe(45500);

    // 7. Project margin excludes GST: (45,500 / 50,000) * 100 = 91%
    expect(prof.projectMargin).toBe(91);
  });

  // Point 8, 9, 10, 11: Customer Invoice Output GST, Grand Total, and Profitability Isolation
  it('Verifies 8, 9, 10, 11: Customer Invoice Output GST is separate, Grand Total includes GST, and Invoice & Payments have ZERO effect on project profit', async () => {
    const customerId = await createCustomer('Vis Customer Invoice');
    const supplierId = await createSupplier('Vis Supplier Invoice');
    const productId = await createProduct('Vis Switch Panel', 0);

    // Purchase 5 @ ₹2,000 (Taxable ₹10,000, GST ₹1,800, Total ₹11,800)
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-SW-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        items: [
          {
            productId,
            purchasePrice: 2000,
            quantity: 5,
            taxRate: 18,
            taxAmount: 1800,
            unit: 'Pcs',
          },
        ],
      });

    // Create project with Budget = ₹40,000
    const projectId = await createProject('Vis Invoice Isolation Project', 40000, customerId);

    // Consume 2 units: actual cost = 2 * 2000 = 4000
    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 2,
        billingPrice: 3000,
      });

    // Initial profitability check
    const profBefore = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profBefore.body.data.actualProjectCost).toBe(4000);
    expect(profBefore.body.data.projectProfit).toBe(36000);
    expect(profBefore.body.data.projectMargin).toBe(90);

    // Create Customer Invoice: Taxable ₹10,000 with 18% GST (GST ₹1,800, Grand Total ₹11,800)
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Phase 1 Installation Service',
            quantity: 1,
            rate: 10000,
            gstRate: 18,
          },
        ],
      });

    expect(invRes.status).toBe(201);
    const invoice = invRes.body.data;

    // 8. Customer invoice Output GST is displayed/returned separately
    expect(invoice.taxableAmount).toBe(10000);
    expect(invoice.taxAmount).toBe(1800);

    // 9. Customer invoice Grand Total includes GST
    expect(invoice.grandTotal).toBe(11800);

    // 10. Invoice GST does NOT affect project profit
    const profAfterInvoice = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profAfterInvoice.body.data.totalMaterialCost).toBe(4000);
    expect(profAfterInvoice.body.data.actualProjectCost).toBe(4000);
    expect(profAfterInvoice.body.data.projectProfit).toBe(36000);
    expect(profAfterInvoice.body.data.projectMargin).toBe(90);
    expect(profAfterInvoice.body.data.totalInvoiced).toBe(11800);

    // 11. Customer invoice payment does NOT affect project profit
    const payRes = await request(app)
      .post('/api/project-invoice-payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice: invoice.id,
        amount: 11800,
        paymentMode: 'BANK_TRANSFER',
        notes: 'Full payment received',
      });
    expect(payRes.status).toBe(201);

    const profAfterPayment = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profAfterPayment.body.data.totalMaterialCost).toBe(4000);
    expect(profAfterPayment.body.data.actualProjectCost).toBe(4000);
    expect(profAfterPayment.body.data.projectProfit).toBe(36000);
    expect(profAfterPayment.body.data.projectMargin).toBe(90);
    expect(profAfterPayment.body.data.totalReceived).toBe(11800);
    expect(profAfterPayment.body.data.outstanding).toBe(0);
  });

  // Point 12: Negative project profit remains negative
  it('Verifies 12: Negative project profit remains accurately negative and is not clamped to zero', async () => {
    const customerId = await createCustomer('Vis Customer Overbudget');
    const supplierId = await createSupplier('Vis Supplier Overbudget');
    const productId = await createProduct('Vis Heavy Generator', 0);

    // Purchase 2 @ ₹6,000 (Taxable ₹12,000, 18% GST ₹2,160, Total ₹14,160)
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-GEN-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        items: [
          {
            productId,
            purchasePrice: 6000,
            quantity: 2,
            taxRate: 18,
            taxAmount: 2160,
            unit: 'Pcs',
          },
        ],
      });

    // Create project with small Budget = ₹10,000
    const projectId = await createProject('Vis Overbudget Project', 10000, customerId);

    // Issue 2 generators: actual cost = 2 * 6,000 = 12,000
    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 2,
        billingPrice: 7000,
      });

    // Check profitability: Budget ₹10,000, Cost ₹12,000 -> Profit = -₹2,000, Margin = -20%
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    expect(prof.projectBudget).toBe(10000);
    expect(prof.actualProjectCost).toBe(12000);
    expect(prof.projectProfit).toBe(-2000); // exactly negative, not clamped to 0
    expect(prof.projectMargin).toBe(-20);   // exactly -20%, not clamped to 0
  });

  // Phase 4.1: Material Cost and Project Profitability verification
  it('Phase 4.1: Verifies material consumption cost (10 @ ₹4,403.70 = ₹44,037) and project profit (₹5,963 / 11.93%)', async () => {
    const customerId = await createCustomer('Phase 4.1 Customer');
    const supplierId = await createSupplier('Phase 4.1 Supplier');
    const productId = await createProduct('Phase 4.1 Heavy Cable', 0);

    // Purchase 10 @ ₹4,403.70 (Taxable ₹44,037, 18% GST ₹7,926.66, Total ₹51,963.66)
    await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-41-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        items: [
          {
            productId,
            purchasePrice: 4403.70,
            quantity: 10,
            taxRate: 18,
            taxAmount: 7926.66,
            unit: 'Mtr',
          },
        ],
      });

    // Create project with Budget = ₹50,000 (GST-Exclusive)
    const projectId = await createProject('Phase 4.1 Execution Project', 50000, customerId);

    // Issue all 10 units to project
    const mcRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 10,
      });

    expect(mcRes.status).toBe(201);
    expect(mcRes.body.data.actualCostPrice).toBe(4403.7);
    expect(mcRes.body.data.actualCostTotal).toBe(44037);

    // Fetch Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // Budget = ₹50,000
    expect(prof.projectBudget).toBe(50000);
    // Material Cost = ₹44,037
    expect(prof.totalMaterialCost).toBe(44037);
    // Expenses = ₹0, Labour = ₹0
    expect(prof.totalProjectExpenses).toBe(0);
    expect(prof.totalLabourCost).toBe(0);
    // Actual Cost = ₹44,037
    expect(prof.actualProjectCost).toBe(44037);
    // Profit = ₹50,000 - ₹44,037 = ₹5,963
    expect(prof.projectProfit).toBe(5963);
    // Margin = (5,963 / 50,000) * 100 = 11.93%
    expect(prof.projectMargin).toBe(11.93);
  });
});
