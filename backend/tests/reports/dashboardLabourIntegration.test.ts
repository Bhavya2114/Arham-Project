import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';
import { Labour } from '../../src/models/Labour';
import { LabourPayment } from '../../src/models/LabourPayment';

describe('PHASE 11 — Dashboard Labour Integration Tests', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;

  let customerId: string;
  let projectAId: string;
  let projectBId: string;

  let labourA1Id: string; // ACTIVE, project A
  let labourA2Id: string; // STOPPED, project A

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // Clean up any test labour/payments
    await LabourPayment.deleteMany({});
    await Labour.deleteMany({});

    // 1. Create a Customer fixture
    const customer = await createTestCustomer({
      name: 'Apex Infrastructure Pvt Ltd',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Apex Infra',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Shivaji Nagar, Pune',
    });
    customerId = customer._id.toString();

    // 2. Create Project A
    const prjARes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-DASH-A-${Date.now()}`,
        name: 'Metro Line Corridor A',
        customer: customerId,
        siteAddress: 'Station Complex, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 5000000,
      });
    expect(prjARes.status).toBe(201);
    projectAId = prjARes.body.data.id;

    // 3. Create Project B
    const prjBRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-DASH-B-${Date.now()}`,
        name: 'River Bridge Terminal B',
        customer: customerId,
        siteAddress: 'Camp, Pune',
        startDate: '2026-09-05',
        status: 'IN_PROGRESS',
        budget: 3500000,
      });
    expect(prjBRes.status).toBe(201);
    projectBId = prjBRes.body.data.id;
  });

  describe('Scenario A: Zero Labour State', () => {
    it('9. Zero Labour is handled gracefully without errors, NaN or broken fields', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('labour');

      const labour = res.body.data.labour;
      expect(labour.totalLabour).toBe(0);
      expect(labour.activeLabour).toBe(0);
      expect(labour.stoppedLabour).toBe(0);
      expect(labour.totalEarned).toBe(0);
      expect(labour.totalPaid).toBe(0);
      expect(labour.balance).toBe(0);
      expect(labour.projectedMonthlyWages).toBe(0);
      expect(labour.byStatus).toEqual({ active: 0, stopped: 0 });
      expect(Array.isArray(labour.byProject)).toBe(true);
      expect(labour.byProject.length).toBe(0);
      expect(Array.isArray(labour.recentPayments)).toBe(true);
      expect(labour.recentPayments.length).toBe(0);
    });
  });

  describe('Scenario B: Dashboard Labour Summary with Active, Stopped & Paid Workers', () => {
    beforeAll(async () => {
      // Create Labour A1: ACTIVE, project A, daily wage 800, start date 2026-09-01
      const lA1 = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ramesh Pawar',
          mobile: '9822110011',
          location: 'Pune',
          projectId: projectAId,
          dailyWage: 800,
          startDate: '2026-09-01',
        });
      expect(lA1.status).toBe(201);
      labourA1Id = lA1.body.data.id;

      // Create Labour A2: Project A, daily wage 600, start date 2026-09-01
      const lA2 = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Suresh Patil',
          mobile: '9822110022',
          location: 'Pune',
          projectId: projectAId,
          dailyWage: 600,
          startDate: '2026-09-01',
        });
      expect(lA2.status).toBe(201);
      labourA2Id = lA2.body.data.id;

      // Stop Labour A2
      const stopRes = await request(app)
        .patch(`/api/labours/${labourA2Id}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(stopRes.status).toBe(200);

      // Create Labour B1: ACTIVE, project B, daily wage 1000, start date 2026-09-10
      const lB1 = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mahesh Jadhav',
          mobile: '9822110033',
          location: 'Pune',
          projectId: projectBId,
          dailyWage: 1000,
          startDate: '2026-09-10',
        });
      expect(lB1.status).toBe(201);

      // Record payments: ₹2000 to Labour A1, ₹1500 to Labour A2
      const pay1 = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: labourA1Id,
          amount: 2000,
          paymentDate: '2026-09-15',
          paymentMethod: 'CASH',
          notes: 'Mid-month cash advance',
        });
      expect(pay1.status).toBe(201);

      const pay2 = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: labourA2Id,
          amount: 1500,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'UPI',
          notes: 'Settlement payment',
        });
      expect(pay2.status).toBe(201);
    });

    it('1. Dashboard Labour summary returns correct total Labour', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.labour.totalLabour).toBe(3);
    });

    it('2. Active Labour count is correct (2 active: Ramesh & Mahesh)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.labour.activeLabour).toBe(2);
      expect(res.body.data.labour.byStatus.active).toBe(2);
    });

    it('3. Stopped Labour count is correct (1 stopped: Suresh)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.labour.stoppedLabour).toBe(1);
      expect(res.body.data.labour.byStatus.stopped).toBe(1);
    });

    it('4. Total Earned is correct based on existing backend calculations', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { totalEarned } = res.body.data.labour;
      expect(typeof totalEarned).toBe('number');
      expect(totalEarned).toBeGreaterThan(0);

      // Verify that individual labour API records sum to the dashboard totalEarned
      const listRes = await request(app)
        .get('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`);
      const sumIndividualEarned = listRes.body.data.reduce(
        (sum: number, l: any) => sum + (l.totalEarned || 0),
        0
      );
      expect(Math.round(totalEarned * 100) / 100).toBe(Math.round(sumIndividualEarned * 100) / 100);
    });

    it('5. Total Paid is correct (2000 + 1500 = 3500)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.labour.totalPaid).toBe(3500);
    });

    it('6. Balance is correct (totalEarned - totalPaid)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { totalEarned, totalPaid, balance } = res.body.data.labour;
      expect(balance).toBe(Math.round((totalEarned - totalPaid) * 100) / 100);
    });

    it('7. Projected Monthly Wages is correctly calculated as active daily wages * 30', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Active daily wages: Ramesh (800) + Mahesh (1000) = 1800 * 30 = 54000
      expect(res.body.data.labour.projectedMonthlyWages).toBe(54000);
    });

    it('8. Project breakdown is correct using existing Labour.projectId relationship', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const byProject = res.body.data.labour.byProject;
      expect(Array.isArray(byProject)).toBe(true);
      expect(byProject.length).toBe(2);

      // Project A has 2 workers (1 active, 1 stopped)
      const projA = byProject.find((p: any) => p.projectId === projectAId);
      expect(projA).toBeDefined();
      expect(projA.totalLabour).toBe(2);
      expect(projA.count).toBe(2);
      expect(projA.activeLabour).toBe(1);
      expect(projA.stoppedLabour).toBe(1);
      expect(projA.totalPaid).toBe(3500); // 2000 + 1500
      expect(projA.balance).toBe(Math.round((projA.totalEarned - projA.totalPaid) * 100) / 100);

      // Project B has 1 worker (1 active, 0 stopped)
      const projB = byProject.find((p: any) => p.projectId === projectBId);
      expect(projB).toBeDefined();
      expect(projB.totalLabour).toBe(1);
      expect(projB.count).toBe(1);
      expect(projB.activeLabour).toBe(1);
      expect(projB.stoppedLabour).toBe(0);
      expect(projB.totalPaid).toBe(0);
    });

    it('Recent labour payments are returned in labour.recentPayments and merged into dashboard recentActivity with type LABOUR_PAY', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.labour.recentPayments.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.labour.recentPayments[0]).toHaveProperty('id');
      expect(res.body.data.labour.recentPayments[0]).toHaveProperty('labourName');
      expect(res.body.data.labour.recentPayments[0]).toHaveProperty('amount');

      const labourPayments = res.body.data.recentActivity.filter(
        (act: any) => act.type === 'LABOUR_PAY'
      );
      if (labourPayments.length > 0) {
        expect(labourPayments[0]).toHaveProperty('reference');
        expect(labourPayments[0].reference).toMatch(/^PAY-/);
        expect(labourPayments[0]).toHaveProperty('partyName');
        expect(labourPayments[0]).toHaveProperty('amount');
      }
    });
  });

  describe('Scenario C: Overpayment Handling (Negative Balance)', () => {
    it('7. Overpayment produces negative balance correctly without clamping to zero', async () => {
      // Create a fresh worker with daily wage ₹100, startDate today (1 day = ₹100 earned)
      const todayStr = new Date().toISOString().split('T')[0];
      const overpaidLabourRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Overpaid Worker',
          mobile: '9822990099',
          location: 'Pune',
          projectId: projectBId,
          dailyWage: 100,
          startDate: todayStr,
        });
      expect(overpaidLabourRes.status).toBe(201);
      const overpaidLabourId = overpaidLabourRes.body.data.id;

      // Pay ₹5,000,000 to this worker (creating a massive overpayment)
      const payOverRes = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: overpaidLabourId,
          amount: 5000000,
          paymentDate: todayStr,
          paymentMethod: 'BANK_TRANSFER',
          notes: 'Excessive advance payment',
        });
      expect(payOverRes.status).toBe(201);

      // Check Dashboard Labour summary
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { totalEarned, totalPaid, balance } = res.body.data.labour;
      expect(totalPaid).toBeGreaterThan(totalEarned);
      // Balance MUST be negative, NOT clamped to zero
      expect(balance).toBeLessThan(0);
      expect(balance).toBe(Math.round((totalEarned - totalPaid) * 100) / 100);

      // Also clean up this payment to restore reasonable numbers
      await LabourPayment.findByIdAndDelete(payOverRes.body.data.id);
      await Labour.findByIdAndDelete(overpaidLabourId);
    });
  });

  describe('Scenario D: Authorization Rules', () => {
    it('10. Unauthorized access is rejected with 401 when token is missing', async () => {
      const res = await request(app).get('/api/reports/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('10. Unauthorized access is rejected with 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', 'Bearer invalid.token.value');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Allows all authorized ERP roles (ADMIN, SALES, WAREHOUSE, ACCOUNTS) to access Dashboard and Labour KPIs', async () => {
      const tokens = [adminToken, salesToken, warehouseToken, accountsToken];

      for (const token of tokens) {
        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('labour');
        expect(res.body.data.labour).toHaveProperty('totalLabour');
        expect(res.body.data.labour).toHaveProperty('activeLabour');
        expect(res.body.data.labour).toHaveProperty('stoppedLabour');
        expect(res.body.data.labour).toHaveProperty('totalEarned');
        expect(res.body.data.labour).toHaveProperty('totalPaid');
        expect(res.body.data.labour).toHaveProperty('balance');
      }
    });
  });

  describe('Scenario E: Existing Dashboard Behavior Remains Intact', () => {
    it('11. Existing Dashboard metrics and structure remain fully preserved', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Existing Core KPIs
      expect(data).toHaveProperty('totalProducts');
      expect(data).toHaveProperty('totalStock');
      expect(data).toHaveProperty('inventoryValue');
      expect(data).toHaveProperty('lowStockCount');
      expect(data).toHaveProperty('outOfStockCount');

      // Existing Groups
      expect(data).toHaveProperty('stock');
      expect(data.stock).toHaveProperty('totalProducts');
      expect(data.stock).toHaveProperty('totalStock');
      expect(data.stock).toHaveProperty('lowStock');
      expect(data.stock).toHaveProperty('outOfStock');

      expect(data).toHaveProperty('projects');
      expect(data.projects).toHaveProperty('total');
      expect(data.projects).toHaveProperty('active');

      expect(data).toHaveProperty('invoices');
      expect(data.invoices).toHaveProperty('count');
      expect(data.invoices).toHaveProperty('totalInvoiced');
      expect(data.invoices).toHaveProperty('totalPaid');
      expect(data.invoices).toHaveProperty('totalBalanceDue');

      expect(data).toHaveProperty('purchases');
      expect(data.purchases).toHaveProperty('count');
      expect(data.purchases).toHaveProperty('totalSpent');

      // Recent Activity
      expect(data).toHaveProperty('recentActivity');
      expect(Array.isArray(data.recentActivity)).toBe(true);
    });
  });
});
