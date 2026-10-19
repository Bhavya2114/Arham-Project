import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Project } from '../../src/models/Project';
import { Customer } from '../../src/models/Customer';
import { Labour } from '../../src/models/Labour';
import { LabourPayment } from '../../src/models/LabourPayment';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour Payment API & Financial Calculation Tests (Phase 7)', () => {
  let adminToken: string;
  let accountsToken: string;
  let salesToken: string;
  let warehouseToken: string;

  let testCustomerId: string;
  let testProjectId: string;
  let activeLabourId: string;
  let stoppedLabourId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    accountsToken = await getAuthToken('ACCOUNTS');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');

    // Customer fixture
    const customer = await createTestCustomer({
      name: 'Payment Test Customer',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Labour Contracting Pvt Ltd',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Shivajinagar, Pune',
    });
    testCustomerId = customer._id.toString();

    // Project setup
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-PAY-${Date.now()}`,
        name: 'Payment Integration Project',
        customer: testCustomerId,
        siteAddress: 'Baner, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    testProjectId = projectRes.body.data.id;

    // Active Labour setup (created on 2026-09-21, daily wage 800)
    const activeDoc = await Labour.create({
      name: 'Ramesh Pawar',
      mobile: '9822001122',
      location: 'Pune',
      projectId: new mongoose.Types.ObjectId(testProjectId),
      dailyWage: 800,
      startDate: new Date('2026-09-21'),
      status: 'ACTIVE',
      stoppedAt: null,
    });
    activeLabourId = activeDoc._id.toString();

    // Stopped Labour setup (startDate: 2026-09-01, stoppedAt: 2026-09-10 = 10 days, dailyWage 500 = 5000 earned)
    const stoppedDoc = await Labour.create({
      name: 'Santosh Shinde',
      mobile: '9833002233',
      location: 'Pune',
      projectId: new mongoose.Types.ObjectId(testProjectId),
      dailyWage: 500,
      startDate: new Date('2026-09-01'),
      status: 'STOPPED',
      stoppedAt: new Date('2026-09-10T18:00:00.000Z'),
    });
    stoppedLabourId = stoppedDoc._id.toString();
  });

  afterAll(async () => {
    await LabourPayment.deleteMany({
      labourId: { $in: [activeLabourId, stoppedLabourId] },
    });
    await Labour.deleteMany({ _id: { $in: [activeLabourId, stoppedLabourId] } });
    await Project.findByIdAndDelete(testProjectId);
    if (testCustomerId) {
      await Customer.findByIdAndDelete(testCustomerId);
    }
  });

  // ==================================================
  // 1. CREATE PAYMENT TESTS
  // ==================================================
  describe('POST /api/labour-payments - Create Payment', () => {
    it('1. should allow ADMIN to create payment for ACTIVE labour', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: activeLabourId,
          amount: 2400,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
          notes: 'Weekly cash advance',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.amount).toBe(2400);
      expect(res.body.data.paymentMethod).toBe('CASH');
      expect(res.body.data.notes).toBe('Weekly cash advance');
      expect(res.body.data.labourId).toBe(activeLabourId);
      expect(res.body.data.createdBy).toBeDefined();

      // Clean up for other isolated tests
      await LabourPayment.findByIdAndDelete(res.body.data.id);
    });

    it('2. should allow ACCOUNTS role to create payment', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          labourId: activeLabourId,
          amount: 1600,
          paymentDate: '2026-09-30',
          paymentMethod: 'UPI',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(1600);
      expect(res.body.data.paymentMethod).toBe('UPI');

      await LabourPayment.findByIdAndDelete(res.body.data.id);
    });

    it('3. should allow payment for a STOPPED labour', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: stoppedLabourId,
          amount: 3000,
          paymentDate: '2026-09-30',
          paymentMethod: 'BANK_TRANSFER',
          notes: 'Final settlement payment',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(3000);
      expect(res.body.data.paymentMethod).toBe('BANK_TRANSFER');

      await LabourPayment.findByIdAndDelete(res.body.data.id);
    });

    it('4. should reject payment creation for non-existent labour with 404', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: nonExistentId,
          amount: 1000,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/labour not found/i);
    });

    it('5. should reject unauthorized roles (SALES, WAREHOUSE) with 403', async () => {
      const resSales = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          labourId: activeLabourId,
          amount: 1000,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
        });
      expect(resSales.status).toBe(403);

      const resWarehouse = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          labourId: activeLabourId,
          amount: 1000,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
        });
      expect(resWarehouse.status).toBe(403);
    });

    it('6. should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .send({
          labourId: activeLabourId,
          amount: 1000,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
        });
      expect(res.status).toBe(401);
    });

    it('7. should reject zero amount', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: activeLabourId,
          amount: 0,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
        });
      expect(res.status).toBe(400);
    });

    it('8. should reject negative amount', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: activeLabourId,
          amount: -500,
          paymentDate: '2026-09-30',
          paymentMethod: 'CASH',
        });
      expect(res.status).toBe(400);
    });

    it('9. should reject invalid payment method', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: activeLabourId,
          amount: 1000,
          paymentDate: '2026-09-30',
          paymentMethod: 'BITCOIN',
        });
      expect(res.status).toBe(400);
    });

    it('10. should reject invalid payment date format', async () => {
      const res = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: activeLabourId,
          amount: 1000,
          paymentDate: 'not-a-date',
          paymentMethod: 'CASH',
        });
      expect(res.status).toBe(400);
    });
  });

  // ==================================================
  // 2. GET / LIST PAYMENTS & NESTED ENDPOINT
  // ==================================================
  describe('GET /api/labour-payments & /api/labours/:labourId/payments', () => {
    let paymentId: string;

    beforeAll(async () => {
      const p = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: activeLabourId,
          amount: 1500,
          paymentDate: '2026-09-28',
          paymentMethod: 'UPI',
          notes: 'Test query payment',
        });
      paymentId = p.body.data.id;
    });

    afterAll(async () => {
      if (paymentId) {
        await LabourPayment.findByIdAndDelete(paymentId);
      }
    });

    it('should list payments with all authenticated roles', async () => {
      const res = await request(app)
        .get('/api/labour-payments')
        .set('Authorization', `Bearer ${warehouseToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter payments by labourId', async () => {
      const res = await request(app)
        .get(`/api/labour-payments?labourId=${activeLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const allBelong = res.body.data.every(
        (p: any) => p.labourId === activeLabourId || p.labour?.id === activeLabourId
      );
      expect(allBelong).toBe(true);
    });

    it('should retrieve single payment details by ID', async () => {
      const res = await request(app)
        .get(`/api/labour-payments/${paymentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paymentId);
      expect(res.body.data.amount).toBe(1500);
      expect(res.body.data.paymentMethod).toBe('UPI');
    });

    it('should retrieve payments via nested endpoint /api/labours/:labourId/payments', async () => {
      const res = await request(app)
        .get(`/api/labours/${activeLabourId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((p: any) => p.id === paymentId)).toBe(true);
    });

    it('should return 404 for nested endpoint if labour does not exist', async () => {
      const nonExistent = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/labours/${nonExistent}/payments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================================================
  // 3. UPDATE & DELETE PAYMENTS
  // ==================================================
  describe('PUT & DELETE /api/labour-payments/:id', () => {
    let paymentToModifyId: string;

    beforeEach(async () => {
      const p = await LabourPayment.create({
        labourId: new mongoose.Types.ObjectId(activeLabourId),
        amount: 2000,
        paymentDate: new Date('2026-09-25'),
        paymentMethod: 'CASH',
        notes: 'Initial note',
        createdBy: new mongoose.Types.ObjectId(),
      });
      paymentToModifyId = p._id.toString();
    });

    afterEach(async () => {
      await LabourPayment.findByIdAndDelete(paymentToModifyId);
    });

    it('should update payment amount, method, and notes', async () => {
      const res = await request(app)
        .put(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 2500,
          paymentMethod: 'BANK_TRANSFER',
          notes: 'Updated note with wire reference',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(2500);
      expect(res.body.data.paymentMethod).toBe('BANK_TRANSFER');
      expect(res.body.data.notes).toBe('Updated note with wire reference');
    });

    it('should delete a payment', async () => {
      const res = await request(app)
        .delete(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Deleted payments are kept for history, marked as deleted
      const check = await LabourPayment.findById(paymentToModifyId);
      expect(check).not.toBeNull();
      expect(check!.isDeleted).toBe(true);
      expect(check!.deletedAt).toBeInstanceOf(Date);
    });

    it('should keep a deleted payment in the labour payment history, marked as deleted', async () => {
      await request(app)
        .delete(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/labours/${activeLabourId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const deleted = res.body.data.find((p: any) => p.id === paymentToModifyId);
      expect(deleted).toBeDefined();
      expect(deleted.isDeleted).toBe(true);
      expect(deleted.amount).toBe(2000);
    });

    it('should leave deleted payments out of the general payments list', async () => {
      await request(app)
        .delete(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/labour-payments')
        .query({ labourId: activeLabourId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.find((p: any) => p.id === paymentToModifyId)).toBeUndefined();
    });

    it('should not allow editing or re-deleting a deleted payment', async () => {
      await request(app)
        .delete(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const edit = await request(app)
        .put(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 999 });
      expect(edit.status).toBe(400);

      const again = await request(app)
        .delete(`/api/labour-payments/${paymentToModifyId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(again.status).toBe(404);
    });
  });

  // ==================================================
  // 4. FINANCIAL CALCULATION & OVERPAYMENT TESTS (Section 26)
  // ==================================================
  describe('Financial Calculations (Cases 1 - 7)', () => {
    let calcLabourId: string;

    beforeEach(async () => {
      // Create a dedicated labour: startDate 2026-09-01, stoppedAt 2026-09-10 (10 days @ 800 = 8000 earned)
      const doc = await Labour.create({
        name: 'Financial Audit Worker',
        mobile: '9844556677',
        location: 'Pune',
        projectId: new mongoose.Types.ObjectId(testProjectId),
        dailyWage: 800,
        startDate: new Date('2026-09-01'),
        status: 'STOPPED',
        stoppedAt: new Date('2026-09-10T12:00:00.000Z'),
      });
      calcLabourId = doc._id.toString();
    });

    afterEach(async () => {
      await LabourPayment.deleteMany({ labourId: calcLabourId });
      await Labour.findByIdAndDelete(calcLabourId);
    });

    // Case 1: earned = 8000, payments = [] -> totalPaid = 0, balance = 8000
    it('Case 1: earned = 8000, payments = [] -> totalPaid = 0, balance = 8000', async () => {
      const res = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.earnedDays).toBe(10);
      expect(res.body.data.totalEarned).toBe(8000);
      expect(res.body.data.totalPaid).toBe(0);
      expect(res.body.data.balance).toBe(8000);
    });

    // Case 2: earned = 8000, payments = [3000] -> totalPaid = 3000, balance = 5000
    it('Case 2: earned = 8000, payments = [3000] -> totalPaid = 3000, balance = 5000', async () => {
      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 3000,
          paymentDate: '2026-09-05',
          paymentMethod: 'CASH',
        });

      const res = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEarned).toBe(8000);
      expect(res.body.data.totalPaid).toBe(3000);
      expect(res.body.data.balance).toBe(5000);
    });

    // Case 3: earned = 8000, payments = [3000, 2000] -> totalPaid = 5000, balance = 3000
    it('Case 3: earned = 8000, payments = [3000, 2000] -> totalPaid = 5000, balance = 3000', async () => {
      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 3000,
          paymentDate: '2026-09-05',
          paymentMethod: 'CASH',
        });

      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 2000,
          paymentDate: '2026-09-08',
          paymentMethod: 'UPI',
        });

      const res = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEarned).toBe(8000);
      expect(res.body.data.totalPaid).toBe(5000);
      expect(res.body.data.balance).toBe(3000);
    });

    // Case 4: earned = 8000, payments = [8000] -> totalPaid = 8000, balance = 0
    it('Case 4: earned = 8000, payments = [8000] -> totalPaid = 8000, balance = 0', async () => {
      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 8000,
          paymentDate: '2026-09-10',
          paymentMethod: 'BANK_TRANSFER',
        });

      const res = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEarned).toBe(8000);
      expect(res.body.data.totalPaid).toBe(8000);
      expect(res.body.data.balance).toBe(0);
    });

    // Case 5: Overpayment: earned = 8000, payments = [5000, 5000] -> totalPaid = 10000, balance = -2000
    it('Case 5: Overpayment: earned = 8000, payments = [5000, 5000] -> totalPaid = 10000, balance = -2000', async () => {
      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 5000,
          paymentDate: '2026-09-05',
          paymentMethod: 'CASH',
        });

      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 5000,
          paymentDate: '2026-09-10',
          paymentMethod: 'CASH',
        });

      const res = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalEarned).toBe(8000);
      expect(res.body.data.totalPaid).toBe(10000);
      expect(res.body.data.balance).toBe(-2000); // Unclamped negative balance!
    });

    // Case 6: Delete one payment and verify Total Paid and Balance are recalculated
    it('Case 6: Delete one payment and verify Total Paid and Balance are recalculated', async () => {
      await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 3000,
          paymentDate: '2026-09-05',
          paymentMethod: 'CASH',
        });

      const p2 = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 2000,
          paymentDate: '2026-09-08',
          paymentMethod: 'UPI',
        });

      // Verify before deletion: totalPaid = 5000, balance = 3000
      let check = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.body.data.totalPaid).toBe(5000);
      expect(check.body.data.balance).toBe(3000);

      // Delete payment 2 (2000)
      await request(app)
        .delete(`/api/labour-payments/${p2.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify after deletion: totalPaid = 3000, balance = 5000
      check = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.body.data.totalPaid).toBe(3000);
      expect(check.body.data.balance).toBe(5000);
    });

    // Case 7: Edit one payment and verify Total Paid and Balance are recalculated
    it('Case 7: Edit one payment and verify Total Paid and Balance are recalculated', async () => {
      const p = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: calcLabourId,
          amount: 3000,
          paymentDate: '2026-09-05',
          paymentMethod: 'CASH',
        });

      // Verify initial state
      let check = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.body.data.totalPaid).toBe(3000);
      expect(check.body.data.balance).toBe(5000);

      // Edit payment from 3000 to 4500
      await request(app)
        .put(`/api/labour-payments/${p.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 4500 });

      // Verify recalculated state: totalPaid = 4500, balance = 3500
      check = await request(app)
        .get(`/api/labours/${calcLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.body.data.totalPaid).toBe(4500);
      expect(check.body.data.balance).toBe(3500);
    });
  });
});
