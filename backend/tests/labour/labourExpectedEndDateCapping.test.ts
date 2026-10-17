import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { calculateLabourEarned } from '../../src/services/labour.service';

describe('Labour Expected End Date Capping Tests', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  // =========================================================================
  // UNIT TESTS: calculateLabourEarned Business Rules
  // =========================================================================
  describe('Unit Tests: calculateLabourEarned with expectedEndDate capping', () => {
    it('USER EXACT SCENARIO: start = 01/09/2026, expectedEnd = 01/10/2026, today = 11/10/2026, wage = ₹1,000 -> 31 days, ₹31,000', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 1000,
        status: 'ACTIVE',
        stoppedAt: null,
        expectedEndDate: '2026-10-01',
      };
      // referenceDate is today (11/10/2026)
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(31);
      expect(result.totalEarned).toBe(31000);
    });

    it('Scenario 1: Active worker with expectedEndDate in the past stops at expectedEndDate', () => {
      const labour = {
        startDate: '2026-08-01',
        dailyWage: 800,
        status: 'ACTIVE',
        stoppedAt: null,
        expectedEndDate: '2026-08-15',
      };
      // Aug 1 to Aug 15 inclusive = 15 days
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(15);
      expect(result.totalEarned).toBe(15 * 800);
    });

    it('Scenario 2: Active worker with expectedEndDate in the future calculates through referenceDate (today)', () => {
      const labour = {
        startDate: '2026-10-01',
        dailyWage: 500,
        status: 'ACTIVE',
        stoppedAt: null,
        expectedEndDate: '2026-10-31',
      };
      // Oct 1 to Oct 11 inclusive = 11 days (expectedEnd is 31, so caps at today 11)
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(11);
      expect(result.totalEarned).toBe(11 * 500);
    });

    it('Scenario 3: Worker stopped before the expected end date stops at worker stoppedAt date', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 1000,
        status: 'STOPPED',
        stoppedAt: '2026-09-15',
        expectedEndDate: '2026-10-01',
      };
      // Sep 1 to Sep 15 inclusive = 15 days
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(15);
      expect(result.totalEarned).toBe(15000);
    });

    it('Scenario 5: Project without expected end date calculates through referenceDate', () => {
      const labour = {
        startDate: '2026-10-01',
        dailyWage: 600,
        status: 'ACTIVE',
        stoppedAt: null,
        expectedEndDate: null,
      };
      // Oct 1 to Oct 11 inclusive = 11 days
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(11);
      expect(result.totalEarned).toBe(11 * 600);
    });

    it('Scenario 6: Assignment start date later than the effective end date returns 0 days and ₹0', () => {
      const labour = {
        startDate: '2026-10-05',
        dailyWage: 1000,
        status: 'ACTIVE',
        stoppedAt: null,
        expectedEndDate: '2026-10-01',
      };
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(0);
      expect(result.totalEarned).toBe(0);
    });

    it('Scenario 7: Same-day assignment start and end returns 1 day and daily wage', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 750,
        status: 'ACTIVE',
        stoppedAt: null,
        expectedEndDate: '2026-09-01',
      };
      const result = calculateLabourEarned(labour, '2026-10-11');
      expect(result.earnedDays).toBe(1);
      expect(result.totalEarned).toBe(750);
    });

    it('Explicit cappingEndDate parameter overrides labour.expectedEndDate when provided', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 1000,
        status: 'ACTIVE',
      };
      const result = calculateLabourEarned(labour, '2026-10-11', true, '2026-10-01');
      expect(result.earnedDays).toBe(31);
      expect(result.totalEarned).toBe(31000);
    });
  });

  // =========================================================================
  // INTEGRATION TESTS: Project & Labour API Endpoints
  // =========================================================================
  describe('Integration Tests: Project Workforce Ledger, Directory & Dashboard Consistency', () => {
    let projectId: string;
    let workerId: string;

    beforeAll(async () => {
      // Create Project with expectedEndDate in past
      const pRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-CAP-${Date.now()}`,
          name: 'End Date Capping Project',
          siteAddress: 'Baner, Pune',
          startDate: '2026-09-01',
          expectedEndDate: '2026-10-01',
          status: 'IN_PROGRESS',
          budget: 500000,
        });
      expect(pRes.status).toBe(201);
      projectId = pRes.body.data.id;

      // Create Labour worker
      const lRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ramesh Pawar',
          mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          location: 'Pune',
          dailyWage: 1000,
        });
      expect(lRes.status).toBe(201);
      workerId = lRes.body.data.id;

      // Assign worker to project starting 01/09/2026
      const assignRes = await request(app)
        .post(`/api/projects/${projectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          startDate: '2026-09-01',
        });
      expect(assignRes.status).toBe(200);
    });

    it('Scenario 8: Labour Directory and Project Workforce Ledger return consistent capped totals (31 days, ₹31,000)', async () => {
      // 1. Fetch Project Workforce Ledger: GET /api/projects/:projectId/labours
      const ledgerRes = await request(app)
        .get(`/api/projects/${projectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ledgerRes.status).toBe(200);
      const ledgerWorker = ledgerRes.body.data.find((l: any) => l.id === workerId);
      expect(ledgerWorker).toBeDefined();
      expect(ledgerWorker.earnedDays).toBe(31);
      expect(ledgerWorker.totalEarned).toBe(31000);

      // 2. Fetch Master Labour Directory: GET /api/labours
      const dirRes = await request(app)
        .get('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dirRes.status).toBe(200);
      const dirWorker = dirRes.body.data.find((l: any) => l.id === workerId);
      expect(dirWorker).toBeDefined();
      expect(dirWorker.earnedDays).toBe(31);
      expect(dirWorker.totalEarned).toBe(31000);

      // 3. Fetch Single Labour Details: GET /api/labours/:id
      const singleRes = await request(app)
        .get(`/api/labours/${workerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.data.earnedDays).toBe(31);
      expect(singleRes.body.data.totalEarned).toBe(31000);
    });

    it('Balance recalculates from corrected earnings and preserves totalPaid', async () => {
      // Record a payment of ₹10,000
      const payRes = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          amount: 10000,
          paymentDate: '2026-09-20',
          paymentMethod: 'CASH',
          notes: 'Advance payout',
        });
      expect(payRes.status).toBe(201);

      // Verify single worker response: totalEarned = 31000, totalPaid = 10000, balance = 21000
      const singleRes = await request(app)
        .get(`/api/labours/${workerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.data.totalEarned).toBe(31000);
      expect(singleRes.body.data.totalPaid).toBe(10000);
      expect(singleRes.body.data.balance).toBe(21000);
    });

    it('Scenario 9: Dashboard labour metrics respect the same end-date cap', async () => {
      const dashRes = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dashRes.status).toBe(200);

      const byProj = dashRes.body.data.labour.byProject.find((p: any) => p.projectId === projectId);
      expect(byProj).toBeDefined();
      expect(byProj.totalEarned).toBe(31000);
      expect(byProj.totalPaid).toBe(10000);
      expect(byProj.balance).toBe(21000);
    });

    it('Scenario 10: Project completion does not record an incorrect later stop date', async () => {
      // Mark project as COMPLETED
      const completeRes = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' });
      expect(completeRes.status).toBe(200);

      // Verify worker stoppedAt is capped at expectedEndDate (2026-10-01), NOT current date
      const singleRes = await request(app)
        .get(`/api/labours/${workerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.data.status).toBe('INACTIVE');
      expect(singleRes.body.data.stoppedAt).toBeDefined();

      const stoppedDateStr = new Date(singleRes.body.data.stoppedAt).toISOString().split('T')[0];
      expect(stoppedDateStr).toBe('2026-10-01');

      // Earnings remain 31 days and ₹31,000
      expect(singleRes.body.data.totalEarned).toBe(31000);
      expect(singleRes.body.data.balance).toBe(21000);
    });

    it('Scenario 4: Project completed before expected end date stops at actual completion date', async () => {
      // Create project with expected end date in far future (2027-12-31)
      const pRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-EARLY-${Date.now()}`,
          name: 'Early Completion Project',
          siteAddress: 'Hinjewadi, Pune',
          startDate: '2026-09-01',
          expectedEndDate: '2027-12-31',
          status: 'IN_PROGRESS',
        });
      expect(pRes.status).toBe(201);
      const earlyProjId = pRes.body.data.id;

      // Create worker
      const lRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Suresh More',
          mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          location: 'Pune',
          dailyWage: 800,
        });
      expect(lRes.status).toBe(201);
      const earlyWorkerId = lRes.body.data.id;

      // Assign worker
      await request(app)
        .post(`/api/projects/${earlyProjId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ labourId: earlyWorkerId, startDate: '2026-09-01' });

      // Complete project today
      await request(app)
        .put(`/api/projects/${earlyProjId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' });

      // Worker should have stoppedAt roughly now, NOT 2027-12-31
      const getWorker = await request(app)
        .get(`/api/labours/${earlyWorkerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getWorker.status).toBe(200);

      const stoppedDate = new Date(getWorker.body.data.stoppedAt);
      const todayYear = new Date().getFullYear();
      expect(stoppedDate.getFullYear()).toBe(todayYear);
      expect(stoppedDate.getFullYear()).not.toBe(2027);
    });
  });

  // =========================================================================
  // FOCUSED REGRESSION TESTS: Assignment Date Validation Against Expected End Date
  // =========================================================================
  describe('Assignment Date Validation Against Project Expected End Date', () => {
    let testProjectWithEndId: string;
    let testProjectWithoutEndId: string;
    let availableWorker1Id: string;
    let availableWorker2Id: string;
    let availableWorker3Id: string;
    let availableWorker4Id: string;

    beforeAll(async () => {
      // 1. Project with expectedEndDate: 2026-10-01 (start: 2026-09-01)
      const p1Res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-VAL-${Date.now()}-1`,
          name: 'Validation Project With End',
          siteAddress: 'Aundh, Pune',
          startDate: '2026-09-01',
          expectedEndDate: '2026-10-01',
          status: 'IN_PROGRESS',
        });
      expect(p1Res.status).toBe(201);
      testProjectWithEndId = p1Res.body.data.id;

      // 2. Project without expectedEndDate
      const p2Res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-VAL-${Date.now()}-2`,
          name: 'Validation Project No End',
          siteAddress: 'Kothrud, Pune',
          startDate: '2026-09-01',
          status: 'IN_PROGRESS',
        });
      expect(p2Res.status).toBe(201);
      testProjectWithoutEndId = p2Res.body.data.id;

      // Create test workers
      const makeWorker = async (name: string) => {
        const res = await request(app)
          .post('/api/labours')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name,
            mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
            location: 'Pune',
            dailyWage: 1000,
          });
        expect(res.status).toBe(201);
        return res.body.data.id;
      };

      availableWorker1Id = await makeWorker('Worker After End');
      availableWorker2Id = await makeWorker('Worker On End');
      availableWorker3Id = await makeWorker('Worker Before End');
      availableWorker4Id = await makeWorker('Worker No End');
    });

    it('1. Rejecting assignment after the expected completion date', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectWithEndId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: availableWorker1Id,
          startDate: '2026-10-11',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Start date cannot be after project's expected completion date");
    });

    it('2. Accepting assignment on the expected completion date', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectWithEndId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: availableWorker2Id,
          startDate: '2026-10-01',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3. Accepting assignment before the expected completion date', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectWithEndId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: availableWorker3Id,
          startDate: '2026-09-15',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4. Handling projects without an expected completion date', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectWithoutEndId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: availableWorker4Id,
          startDate: '2026-10-05',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('5. Rejecting invalid dates during initial labour creation', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Direct Assign Worker',
          mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          location: 'Pune',
          dailyWage: 1000,
          projectId: testProjectWithEndId,
          startDate: '2026-10-11',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Start date cannot be after project's expected completion date");
    });
  });
});
