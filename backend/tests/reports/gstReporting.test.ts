import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';
import { Purchase } from '../../src/models/Purchase';
import { ProjectInvoice } from '../../src/models/ProjectInvoice';

describe('Phase 5: GST / ITC Reporting & Profitability Isolation Integration Tests', () => {
  let adminToken: string;
  let supplierId: string;
  let customerId: string;
  let projectId: string;
  let productId: string;
  let deterministicPurchaseId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // 1. Create Supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 5 GST Industrial Supplies',
        contactPerson: 'Rajesh Kumar',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `gst_phase5_${Date.now()}@supplier.com`,
        gstNumber: '27AABCS1429B1ZB',
        address: 'MIDC Andheri, Mumbai',
      });
    expect(supRes.status).toBe(201);
    supplierId = supRes.body.data.id;

    // 2. Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Phase 5 Infrastructure Client',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `client_phase5_${Date.now()}@infra.com`,
      businessName: 'Phase 5 Infra Ltd',
      gstNumber: '27AAAAA0000A1Z5',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Bandra Kurla Complex, Mumbai',
    });
    customerId = customer._id.toString();

    // 3. Create Project with Budget = ₹2,000 (Excl. GST)
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-P5-${Date.now()}`,
        name: 'Phase 5 Test Facility',
        customer: customerId,
        siteAddress: 'Bandra Kurla Complex, Mumbai',
        budget: 2000,
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.data.id;

    // 4. Create Product with Procurement Cost = ₹1,000 (Excl. GST)
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Deterministic Test Component',
        sku: `DTC-${Date.now()}`,
        category: 'Raw Materials',
        costPrice: 1000,
        gstRate: 18,
        currentStock: 10,
        minStockQuantity: 1,
        location: 'Section A',
        unit: 'pcs',
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
  });

  it('Step 11 Deterministic Scenario: Purchase creation with 18% Input GST', async () => {
    // Taxable Value = ₹1,000, GST 18% = ₹180 (CGST ₹90, SGST ₹90), Supplier Total = ₹1,180
    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
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
        notes: 'Deterministic scenario purchase',
      });

    expect(purchaseRes.status).toBe(201);
    deterministicPurchaseId = purchaseRes.body.data.id;

    // Verify stored purchase
    const p = purchaseRes.body.data;
    expect(p.subtotal).toBe(1000);
    expect(p.taxAmount).toBe(180);
    expect(p.cgst).toBe(90);
    expect(p.sgst).toBe(90);
    expect(p.igst).toBe(0);
    expect(p.totalAmount).toBe(1180);
  });

  it('Step 4 & 10: GST Reporting endpoint returns separate Input GST and preserved CGST/SGST/IGST breakdown', async () => {
    const reportRes = await request(app)
      .get('/api/reports/gst-summary?range=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const data = reportRes.body.data;

    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('purchaseTransactions');
    expect(data).toHaveProperty('outputTransactions');

    // Input GST summary checks
    expect(data.summary.taxablePurchases).toBeGreaterThanOrEqual(1000);
    expect(data.summary.inputGst).toBeGreaterThanOrEqual(180);
    expect(data.summary.supplierTotal).toBeGreaterThanOrEqual(1180);
    expect(data.summary.cgstTotal).toBeGreaterThanOrEqual(90);
    expect(data.summary.sgstTotal).toBeGreaterThanOrEqual(90);

    // Find the deterministic purchase in transaction list
    const foundPurchase = data.purchaseTransactions.find((pt: any) => pt.id === deterministicPurchaseId);
    expect(foundPurchase).toBeDefined();
    expect(foundPurchase.taxableAmount).toBe(1000);
    expect(foundPurchase.cgst).toBe(90);
    expect(foundPurchase.sgst).toBe(90);
    expect(foundPurchase.igst).toBe(0);
    expect(foundPurchase.inputGst).toBe(180);
    expect(foundPurchase.totalAmount).toBe(1180);
    expect(foundPurchase.hasBreakdown).toBe(true);
  });

  it('Step 4 & 10: Legacy purchase without breakdown displays total Input GST and does NOT fabricate CGST/SGST/IGST', async () => {
    // Create a legacy purchase directly via model without cgst, sgst, igst fields
    const legacyDoc = new Purchase({
      purchaseNumber: `LEGACY-PUR-${Date.now()}`,
      supplier: new mongoose.Types.ObjectId(supplierId),
      purchaseDate: new Date(),
      items: [
        {
          product: new mongoose.Types.ObjectId(productId),
          productName: 'Deterministic Test Component',
          sku: 'DTC-LEGACY',
          purchasePrice: 500,
          quantity: 1,
          taxRate: 12,
          taxAmount: 60,
          totalCost: 560,
        },
      ],
      subtotal: 500,
      taxAmount: 60,
      // intentionally omit cgst, sgst, igst
      totalAmount: 560,
      createdBy: new mongoose.Types.ObjectId(),
    });
    const legacyPurchase = await legacyDoc.save();

    const reportRes = await request(app)
      .get('/api/reports/gst-summary?range=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const data = reportRes.body.data;

    const legacyTx = data.purchaseTransactions.find((pt: any) => pt.id === legacyPurchase._id.toString());
    expect(legacyTx).toBeDefined();
    expect(legacyTx.taxableAmount).toBe(500);
    expect(legacyTx.inputGst).toBe(60);
    expect(legacyTx.totalAmount).toBe(560);
    // Crucial: Must NOT fabricate CGST/SGST/IGST
    expect(legacyTx.hasBreakdown).toBe(false);
    expect(legacyTx.cgst).toBeNull();
    expect(legacyTx.sgst).toBeNull();
    expect(legacyTx.igst).toBeNull();
  });

  it('Step 5, 6 & 11: Material consumption uses GST-exclusive actual cost and leaves project profitability intact', async () => {
    // Issue 1 unit of product (procurement cost = ₹1,000) to Project
    const issueRes = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        product: productId,
        quantity: 1,
        consumptionDate: new Date().toISOString(),
        notes: 'Deterministic scenario material consumption',
      });

    expect(issueRes.status).toBe(201);
    const mc = issueRes.body.data;
    // Material cost MUST be GST-exclusive ₹1,000, NOT ₹1,180
    expect(mc.actualCostPrice).toBe(1000);
    expect(mc.actualCostTotal).toBe(1000);

    // Verify Project Profitability
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;

    // Budget = ₹2,000 (Excl. GST)
    expect(prof.projectBudget).toBe(2000);
    // Actual Cost = ₹1,000 (Material Cost Excl. GST)
    expect(prof.totalMaterialCost).toBe(1000);
    expect(prof.totalProjectExpenses).toBe(0);
    expect(prof.actualProjectCost).toBe(1000);
    // Project Profit = 2000 - 1000 = 1000
    expect(prof.projectProfit).toBe(1000);
    // Project Margin = (1000 / 2000) * 100 = 50%
    expect(prof.projectMargin).toBe(50);
  });

  it('Step 7, 10 & 11: Customer invoice Output GST is reported separately and does NOT alter project profitability', async () => {
    // Create Customer Invoice for Project: Taxable = ₹2,000, Output GST = ₹360 (18%), Grand Total = ₹2,360
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Project Milestone Billing',
            quantity: 1,
            rate: 2000,
            gstRate: 18,
          },
        ],
      });

    expect(invRes.status).toBe(201);
    const inv = invRes.body.data;
    expect(inv.taxableAmount).toBe(2000);
    expect(inv.taxAmount).toBe(360);
    expect(inv.grandTotal).toBe(2360);

    // Verify GST Summary has Output GST
    const reportRes = await request(app)
      .get('/api/reports/gst-summary?range=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const data = reportRes.body.data;
    expect(data.summary.taxableOutput).toBeGreaterThanOrEqual(2000);
    expect(data.summary.outputGst).toBeGreaterThanOrEqual(360);
    expect(data.summary.customerInvoiceTotal).toBeGreaterThanOrEqual(2360);

    // Verify project invoice appears in output transactions
    const foundInv = data.outputTransactions.find((ot: any) => ot.id === inv.id || ot.referenceNumber === inv.invoiceNumber);
    expect(foundInv).toBeDefined();
    expect(foundInv.taxableAmount).toBe(2000);
    expect(foundInv.outputGst).toBe(360);
    expect(foundInv.totalAmount).toBe(2360);

    // CRITICAL: Project Profitability MUST REMAIN UNCHANGED
    const profRes = await request(app)
      .get(`/api/projects/${projectId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;
    expect(prof.projectBudget).toBe(2000);
    expect(prof.actualProjectCost).toBe(1000);
    expect(prof.projectProfit).toBe(1000);
    expect(prof.projectMargin).toBe(50);
  });

  it('Step 3 & 10 (Phase 5.1): System does NOT automatically classify Input GST as eligible ITC & uses neutral GST Difference terminology', async () => {
    const reportRes = await request(app)
      .get('/api/reports/gst-summary?range=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const summary = reportRes.body.data.summary;

    // Explicitly verify ITC eligibility is NOT_DETERMINED
    expect(summary.itcEligibilityStatus).toBe('NOT_DETERMINED');
    // Verify neutral GST difference reporting
    expect(summary).toHaveProperty('gstDifference');
    expect(summary.gstDifference).toBe(summary.netGstPosition);
    // Verify required disclaimer and separation wording
    expect(summary.clarification).toContain('Output GST minus Input GST');
    expect(summary.clarification).toContain('This is a reporting difference only and does not determine legally payable tax or eligible ITC');
    expect(summary.clarification).toContain('Input GST is GST charged by suppliers');
    expect(summary.clarification).toContain('Output GST is GST collected from customers');
    expect(summary.clarification).toContain('Input tax credit eligibility is not determined automatically');
  });

  it('Step 10: Negative project profit remains negative and is not distorted by GST', async () => {
    // Create an overrun project: Budget = ₹500
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-OVERRUN-${Date.now()}`,
        name: 'Overrun Facility',
        customer: customerId,
        siteAddress: 'Mumbai Site',
        budget: 500,
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    const overrunProjId = projRes.body.data.id;

    // Issue 1 unit of ₹1,000 product
    await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: overrunProjId,
        product: productId,
        quantity: 1,
        consumptionDate: new Date().toISOString(),
      });

    const profRes = await request(app)
      .get(`/api/projects/${overrunProjId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profRes.status).toBe(200);
    const prof = profRes.body.data;
    expect(prof.projectBudget).toBe(500);
    expect(prof.actualProjectCost).toBe(1000);
    expect(prof.projectProfit).toBe(-500);
    expect(prof.projectMargin).toBe(-100);
  });

  it('Phase 6.1: Customer invoice GST reporting includes only finalized statuses (UNPAID, PARTIALLY_PAID, PAID) and excludes DRAFT and CANCELLED', async () => {
    // 1. Create a DRAFT invoice (must be excluded)
    const draftDoc = await ProjectInvoice.create({
      invoiceNumber: `INV-DRAFT-${Date.now()}`,
      project: new mongoose.Types.ObjectId(projectId),
      customer: new mongoose.Types.ObjectId(customerId),
      customerSnapshot: {
        name: 'Phase 5 Infrastructure Client',
        businessName: 'Phase 5 Infra Ltd',
        gstNumber: '27AAAAA0000A1Z5',
        mobile: '9876543210',
      },
      projectSnapshot: {
        name: 'Phase 5 Test Facility',
        projectCode: 'PRJ-P5-TEST',
        siteAddress: 'BKC, Mumbai',
      },
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      items: [
        {
          type: 'SERVICE',
          sourceType: 'MANUAL',
          description: 'Draft Milestone',
          quantity: 1,
          rate: 10000,
          amount: 10000,
          gstRate: 18,
          gstAmount: 1800,
          lineTotal: 11800,
        },
      ],
      subtotal: 10000,
      discount: 0,
      taxableAmount: 10000,
      taxAmount: 1800,
      grandTotal: 11800,
      status: 'DRAFT',
      amountPaid: 0,
      balanceDue: 11800,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // 2. Create a CANCELLED invoice (must be excluded)
    const cancelledDoc = await ProjectInvoice.create({
      invoiceNumber: `INV-CANCELLED-${Date.now()}`,
      project: new mongoose.Types.ObjectId(projectId),
      customer: new mongoose.Types.ObjectId(customerId),
      customerSnapshot: {
        name: 'Phase 5 Infrastructure Client',
        businessName: 'Phase 5 Infra Ltd',
        gstNumber: '27AAAAA0000A1Z5',
        mobile: '9876543210',
      },
      projectSnapshot: {
        name: 'Phase 5 Test Facility',
        projectCode: 'PRJ-P5-TEST',
        siteAddress: 'BKC, Mumbai',
      },
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      items: [
        {
          type: 'SERVICE',
          sourceType: 'MANUAL',
          description: 'Cancelled Milestone',
          quantity: 1,
          rate: 30000,
          amount: 30000,
          gstRate: 18,
          gstAmount: 5400,
          lineTotal: 35400,
        },
      ],
      subtotal: 30000,
      discount: 0,
      taxableAmount: 30000,
      taxAmount: 5400,
      grandTotal: 35400,
      status: 'CANCELLED',
      amountPaid: 0,
      balanceDue: 35400,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // 3. Create an UNPAID invoice (must be included)
    const unpaidDoc = await ProjectInvoice.create({
      invoiceNumber: `INV-UNPAID-${Date.now()}`,
      project: new mongoose.Types.ObjectId(projectId),
      customer: new mongoose.Types.ObjectId(customerId),
      customerSnapshot: {
        name: 'Phase 5 Infrastructure Client',
        businessName: 'Phase 5 Infra Ltd',
        gstNumber: '27AAAAA0000A1Z5',
        mobile: '9876543210',
      },
      projectSnapshot: {
        name: 'Phase 5 Test Facility',
        projectCode: 'PRJ-P5-TEST',
        siteAddress: 'BKC, Mumbai',
      },
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      items: [
        {
          type: 'SERVICE',
          sourceType: 'MANUAL',
          description: 'Unpaid Milestone',
          quantity: 1,
          rate: 20000,
          amount: 20000,
          gstRate: 18,
          gstAmount: 3600,
          lineTotal: 23600,
        },
      ],
      subtotal: 20000,
      discount: 0,
      taxableAmount: 20000,
      taxAmount: 3600,
      grandTotal: 23600,
      status: 'UNPAID',
      amountPaid: 0,
      balanceDue: 23600,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // 4. Create a PARTIALLY_PAID invoice (must be included)
    const partialDoc = await ProjectInvoice.create({
      invoiceNumber: `INV-PARTIAL-${Date.now()}`,
      project: new mongoose.Types.ObjectId(projectId),
      customer: new mongoose.Types.ObjectId(customerId),
      customerSnapshot: {
        name: 'Phase 5 Infrastructure Client',
        businessName: 'Phase 5 Infra Ltd',
        gstNumber: '27AAAAA0000A1Z5',
        mobile: '9876543210',
      },
      projectSnapshot: {
        name: 'Phase 5 Test Facility',
        projectCode: 'PRJ-P5-TEST',
        siteAddress: 'BKC, Mumbai',
      },
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      items: [
        {
          type: 'SERVICE',
          sourceType: 'MANUAL',
          description: 'Partial Milestone',
          quantity: 1,
          rate: 15000,
          amount: 15000,
          gstRate: 18,
          gstAmount: 2700,
          lineTotal: 17700,
        },
      ],
      subtotal: 15000,
      discount: 0,
      taxableAmount: 15000,
      taxAmount: 2700,
      grandTotal: 17700,
      status: 'PARTIALLY_PAID',
      amountPaid: 5000,
      balanceDue: 12700,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // 5. Create a PAID invoice (must be included)
    const paidDoc = await ProjectInvoice.create({
      invoiceNumber: `INV-PAID-${Date.now()}`,
      project: new mongoose.Types.ObjectId(projectId),
      customer: new mongoose.Types.ObjectId(customerId),
      customerSnapshot: {
        name: 'Phase 5 Infrastructure Client',
        businessName: 'Phase 5 Infra Ltd',
        gstNumber: '27AAAAA0000A1Z5',
        mobile: '9876543210',
      },
      projectSnapshot: {
        name: 'Phase 5 Test Facility',
        projectCode: 'PRJ-P5-TEST',
        siteAddress: 'BKC, Mumbai',
      },
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      items: [
        {
          type: 'SERVICE',
          sourceType: 'MANUAL',
          description: 'Paid Milestone',
          quantity: 1,
          rate: 5000,
          amount: 5000,
          gstRate: 18,
          gstAmount: 900,
          lineTotal: 5900,
        },
      ],
      subtotal: 5000,
      discount: 0,
      taxableAmount: 5000,
      taxAmount: 900,
      grandTotal: 5900,
      status: 'PAID',
      amountPaid: 5900,
      balanceDue: 0,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // 6. Fetch GST summary report
    const reportRes = await request(app)
      .get('/api/reports/gst-summary?range=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const data = reportRes.body.data;
    const refNumbers = data.outputTransactions.map((tx: any) => tx.referenceNumber);

    // Verify 1: DRAFT is excluded
    expect(refNumbers).not.toContain(draftDoc.invoiceNumber);

    // Verify 2: CANCELLED is excluded
    expect(refNumbers).not.toContain(cancelledDoc.invoiceNumber);

    // Verify 3: UNPAID is included
    expect(refNumbers).toContain(unpaidDoc.invoiceNumber);
    const unpaidTx = data.outputTransactions.find((tx: any) => tx.referenceNumber === unpaidDoc.invoiceNumber);
    expect(unpaidTx.taxableAmount).toBe(20000);
    expect(unpaidTx.outputGst).toBe(3600);
    expect(unpaidTx.totalAmount).toBe(23600);
    expect(unpaidTx.status).toBe('UNPAID');

    // Verify 4: PARTIALLY_PAID is included
    expect(refNumbers).toContain(partialDoc.invoiceNumber);
    const partialTx = data.outputTransactions.find((tx: any) => tx.referenceNumber === partialDoc.invoiceNumber);
    expect(partialTx.taxableAmount).toBe(15000);
    expect(partialTx.outputGst).toBe(2700);
    expect(partialTx.totalAmount).toBe(17700);
    expect(partialTx.status).toBe('PARTIALLY_PAID');

    // Verify 5: PAID is included
    expect(refNumbers).toContain(paidDoc.invoiceNumber);
    const paidTx = data.outputTransactions.find((tx: any) => tx.referenceNumber === paidDoc.invoiceNumber);
    expect(paidTx.taxableAmount).toBe(5000);
    expect(paidTx.outputGst).toBe(900);
    expect(paidTx.totalAmount).toBe(5900);
    expect(paidTx.status).toBe('PAID');

    // Verify 6: Output transactions consist exclusively of project invoices
    expect(data.outputTransactions.length).toBeGreaterThanOrEqual(3);
    data.outputTransactions.forEach((tx: any) => {
      expect(tx.type).toBe('PROJECT_INVOICE');
    });
  });
});

