import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';
import { ProjectInvoice } from '../../src/models/ProjectInvoice';

describe('Project Invoice Payments API integration tests (Phase 7.5)', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;
  let customerId: string;
  let projectId: string;
  let productId: string;
  let invoiceId: string;
  let cancelledInvoiceId: string;
  let createdPaymentId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // 1. Create Customer & Project
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'L&T Construction Ltd',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        email: `lt_${Date.now()}@const.com`,
        businessName: 'L&T Infrastructure',
        gstNumber: '27LTINF1234F1Z3',
        type: 'WHOLESALE',
        status: 'LEAD',
        address: 'Powai, Mumbai',
      });
    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PMT-PRJ-${Date.now()}`,
        name: 'Metro Flyover Line 3',
        customer: customerId,
        siteAddress: 'Andheri East, Mumbai',
        startDate: '2026-07-01',
        status: 'IN_PROGRESS',
      });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.data.id;

    // 2. Create Product
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Structural Steel Rebar 16mm',
        sku: `STL-${Date.now()}`,
        category: 'Construction Steel',
        costPrice: 50,
        unitPrice: 65,
        sellingPrice: 65,
        gstRate: 18,
        currentStock: 1000,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;

    // 3. Create Valid Invoice (Subtotal 100,000 | Tax 18,000 | Grand Total 118,000)
    const invRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Foundation Excavation & Piling',
            quantity: 1,
            rate: 100000,
            gstRate: 18,
          },
        ],
      });
    expect(invRes.status).toBe(201);
    invoiceId = invRes.body.data.id;
    expect(invRes.body.data.grandTotal).toBe(118000);
    expect(invRes.body.data.status).toBe('UNPAID');

    // 4. Create Cancelled Invoice for testing
    const invCancelledRes = await request(app)
      .post('/api/project-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project: projectId,
        items: [
          {
            type: 'SERVICE',
            sourceType: 'MANUAL',
            description: 'Cancelled Milestone Service',
            rate: 10000,
          },
        ],
      });
    expect(invCancelledRes.status).toBe(201);
    cancelledInvoiceId = invCancelledRes.body.data.id;
    // Manually mark cancelled in DB
    await ProjectInvoice.findByIdAndUpdate(cancelledInvoiceId, { status: 'CANCELLED' });
  });

  describe('POST /api/project-invoice-payments - Create Payment', () => {
    it('should allow ACCOUNTS role to record a valid partial payment and update invoice status to PARTIALLY_PAID', async () => {
      const res = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          invoice: invoiceId,
          amount: 50000,
          paymentMode: 'BANK_TRANSFER',
          transactionReference: 'UTR987654321',
          notes: 'Advance 1st instalment via RTGS',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.paymentNumber).toMatch(/^PAY-\d{4}-\d{4}$/);
      expect(res.body.data.amount).toBe(50000);
      expect(res.body.data.paymentMode).toBe('BANK_TRANSFER');
      expect(res.body.data.invoice.amountPaid).toBe(50000);
      expect(res.body.data.invoice.balanceDue).toBe(68000);
      expect(res.body.data.invoice.status).toBe('PARTIALLY_PAID');

      createdPaymentId = res.body.data.id;
    });

    it('OVERPAYMENT PROTECTION: should reject payment exceeding outstanding balance (HTTP 400)', async () => {
      // Remaining balance is 68,000. Attempt 70,000.
      const res = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice: invoiceId,
          amount: 70000,
          paymentMode: 'UPI',
          transactionReference: 'UPI-OVERPAY',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed outstanding balance/i);

      // Verify invoice balance remains unchanged (68,000)
      const invCheck = await ProjectInvoice.findById(invoiceId);
      expect(invCheck?.amountPaid).toBe(50000);
      expect(invCheck?.balanceDue).toBe(68000);
    });

    it('ISOLATION & INTEGRITY: payment creation must NOT modify Product stock, expenses, or invoice grandTotal', async () => {
      const prod = await Product.findById(productId);
      expect(prod?.currentStock).toBe(1000); // Intact!

      const inv = await ProjectInvoice.findById(invoiceId);
      expect(inv?.grandTotal).toBe(118000); // Intact!
      expect(inv?.items.length).toBe(1); // Intact!
    });

    it('should complete final payment and set invoice status to PAID with balanceDue = 0', async () => {
      // Remaining balance is 68,000. Pay exact 68,000.
      const res = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice: invoiceId,
          amount: 68000,
          paymentMode: 'UPI',
          transactionReference: 'UPI1122334455',
          notes: 'Final settlement payment',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(68000);
      expect(res.body.data.invoice.amountPaid).toBe(118000);
      expect(res.body.data.invoice.balanceDue).toBe(0);
      expect(res.body.data.invoice.status).toBe('PAID');
    });

    it('FULLY PAID PROTECTION: should reject recording payment against already fully paid invoice (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice: invoiceId,
          amount: 1000,
          paymentMode: 'CASH',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already fully paid/i);
    });

    it('CANCELLED PROTECTION: should reject payment for CANCELLED invoice (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice: cancelledInvoiceId,
          amount: 5000,
          paymentMode: 'CASH',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CANCELLED/i);
    });

    it('DECIMAL PRECISION: handles split decimal payments cleanly without floating point residue', async () => {
      // Create fresh decimal invoice: 10,000
      const decInvRes = await request(app)
        .post('/api/project-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project: projectId,
          items: [{ type: 'SERVICE', sourceType: 'MANUAL', description: 'Decimal Test', rate: 10000 }],
        });
      expect(decInvRes.status).toBe(201);
      const decInvId = decInvRes.body.data.id;

      // Payment 1: 3333.33
      const p1 = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ invoice: decInvId, amount: 3333.33, paymentMode: 'BANK_TRANSFER' });
      expect(p1.status).toBe(201);
      expect(p1.body.data.invoice.balanceDue).toBe(6666.67);

      // Payment 2: 6666.67
      const p2 = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ invoice: decInvId, amount: 6666.67, paymentMode: 'BANK_TRANSFER' });
      expect(p2.status).toBe(201);
      expect(p2.body.data.invoice.balanceDue).toBe(0);
      expect(p2.body.data.invoice.status).toBe('PAID');
    });

    it('should return 400 on zero or negative payment amount', async () => {
      const res = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice: invoiceId,
          amount: 0,
          paymentMode: 'CASH',
        });

      expect(res.status).toBe(400);
    });

    it('should forbid SALES and WAREHOUSE roles from creating payments', async () => {
      const resSales = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          invoice: invoiceId,
          amount: 100,
          paymentMode: 'CASH',
        });
      expect(resSales.status).toBe(403);

      const resWh = await request(app)
        .post('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          invoice: invoiceId,
          amount: 100,
          paymentMode: 'CASH',
        });
      expect(resWh.status).toBe(403);
    });
  });

  describe('GET /api/project-invoice-payments & GET /api/project-invoices/:id/payments', () => {
    it('should allow all authenticated roles to list payment records and filter by invoice', async () => {
      const res = await request(app)
        .get('/api/project-invoice-payments')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const resFilter = await request(app)
        .get(`/api/project-invoice-payments?invoice=${invoiceId}`)
        .set('Authorization', `Bearer ${warehouseToken}`);

      expect(resFilter.status).toBe(200);
      expect(resFilter.body.data.length).toBe(2);
    });

    it('should retrieve payment history via sub-route GET /api/project-invoices/:invoiceId/payments', async () => {
      const res = await request(app)
        .get(`/api/project-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0]).toHaveProperty('paymentNumber');
      expect(res.body.data[0]).toHaveProperty('receivedBy');
    });

    it('should retrieve single payment details by ID', async () => {
      const res = await request(app)
        .get(`/api/project-invoice-payments/${createdPaymentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdPaymentId);
    });
  });
});
