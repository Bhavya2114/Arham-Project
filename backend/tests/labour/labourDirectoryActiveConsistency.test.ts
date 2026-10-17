import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour Directory & Workforce Ledger Data Consistency (10 Required Cases)', () => {
  let adminToken: string;
  let customerId: string;
  let projectAId: string;
  let projectBId: string;
  const runId = Date.now();

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // 1. Create a Customer fixture
    const customer = await createTestCustomer({
      name: `Consistency Customer ${runId}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: `Consistency Infra ${runId}`,
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Pune MIDC',
    });
    customerId = customer._id.toString();

    // 2. Create Project A (started 2026-09-01)
    const pARes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-CONS-A-${runId}`,
        name: 'Project Alpha Consistency',
        customer: customerId,
        siteAddress: 'Baner, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 5000000,
      });
    expect(pARes.status).toBe(201);
    projectAId = pARes.body.data.id;

    // 3. Create Project B (started 2026-09-10)
    const pBRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-CONS-B-${runId}`,
        name: 'Project Beta Consistency',
        customer: customerId,
        siteAddress: 'Hinjawadi, Pune',
        startDate: '2026-09-10',
        status: 'IN_PROGRESS',
        budget: 4000000,
      });
    expect(pBRes.status).toBe(201);
    projectBId = pBRes.body.data.id;
  });

  // =========================================================================
  // TEST 1: Create labour with one start date, assign it to a project with a
  // different valid assignment start date. Verify Labour Directory uses the
  // ACTIVE project assignment start date.
  // =========================================================================
  let test1WorkerId: string;
  it('TEST 1: Labour Directory uses the ACTIVE project assignment start date rather than master startDate', async () => {
    // Create worker
    const createRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test1 Worker ${runId}`,
        address: 'Pune',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 500,
      });
    expect(createRes.status).toBe(201);
    test1WorkerId = createRes.body.data.id;

    // Assign worker to Project A with assignment startDate = 2026-09-15
    const assignRes = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: test1WorkerId,
        startDate: '2026-09-15',
      });
    expect(assignRes.status).toBe(200);

    // Verify Labour Directory GET /api/labours
    const dirRes = await request(app)
      .get('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const workerInDir = dirRes.body.data.find((l: any) => l.id === test1WorkerId);
    expect(workerInDir).toBeDefined();
    expect(workerInDir.status).toBe('ACTIVE');
    expect(new Date(workerInDir.startDate).toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(workerInDir.projectId).toBe(projectAId);
  });

  // =========================================================================
  // TEST 2: Verify Total Earned is calculated from the ACTIVE assignment start
  // date, not the old master labour startDate.
  // =========================================================================
  it('TEST 2: Total Earned is calculated from the ACTIVE assignment start date', async () => {
    const dirRes = await request(app)
      .get(`/api/labours/${test1WorkerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const worker = dirRes.body.data;

    // Assignment date was 2026-09-15, daily wage = 500
    // Total Earned must equal earnedDays * 500
    expect(worker.earnedDays).toBeGreaterThanOrEqual(18); // Sep 15 to Oct 3 is 19 days
    expect(worker.totalEarned).toBe(worker.earnedDays * 500);
  });

  // =========================================================================
  // TEST 3: Verify Project Workforce Ledger and Labour Directory return the same
  // Total Earned for the same active assignment.
  // =========================================================================
  it('TEST 3: Project Workforce Ledger and Labour Directory return the same Total Earned for the same active assignment', async () => {
    // 1. Directory
    const dirRes = await request(app)
      .get(`/api/labours/${test1WorkerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const dirWorker = dirRes.body.data;

    // 2. Project Workforce Ledger
    const projRes = await request(app)
      .get(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(projRes.status).toBe(200);
    const projWorker = projRes.body.data.find((l: any) => l.id === test1WorkerId);
    expect(projWorker).toBeDefined();

    // Financial consistency
    expect(dirWorker.totalEarned).toBe(projWorker.totalEarned);
    expect(dirWorker.earnedDays).toBe(projWorker.earnedDays);
    expect(new Date(dirWorker.startDate).toISOString()).toBe(new Date(projWorker.startDate).toISOString());
    expect(dirWorker.status).toBe(projWorker.status);
    expect(dirWorker.dailyWage).toBe(projWorker.dailyWage);
  });

  // =========================================================================
  // TEST 4: Worker has a historical STOPPED assignment and a newer ACTIVE
  // assignment. Verify Labour Directory uses the newer ACTIVE assignment.
  // =========================================================================
  let test4WorkerId: string;
  it('TEST 4: Worker with historical STOPPED assignment and newer ACTIVE assignment uses the ACTIVE assignment in directory', async () => {
    // Create worker
    const createRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Multi Assignment Worker ${runId}`,
        address: 'Pune',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 600,
      });
    expect(createRes.status).toBe(201);
    test4WorkerId = createRes.body.data.id;

    // 1. Assign to Project A (2026-09-05)
    await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: test4WorkerId,
        startDate: '2026-09-05',
      });

    // 2. Stop from Project A
    await request(app)
      .patch(`/api/labours/${test4WorkerId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`);

    // 3. Assign to Project B (2026-09-25)
    const assignB = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: test4WorkerId,
        startDate: '2026-09-25',
      });
    expect(assignB.status).toBe(200);

    // Verify Labour Directory shows Project B, start date 2026-09-25, and earnings from 2026-09-25 onward
    const dirRes = await request(app)
      .get(`/api/labours/${test4WorkerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const worker = dirRes.body.data;

    expect(worker.status).toBe('ACTIVE');
    expect(worker.projectId).toBe(projectBId);
    expect(worker.project?.name).toBe('Project Beta Consistency');
    expect(new Date(worker.startDate).toISOString().slice(0, 10)).toBe('2026-09-25');

    // Project B ledger accurately calculates Project B earnings
    const ledgerBRes = await request(app)
      .get(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const ledgerBWorker = ledgerBRes.body.data.find((l: any) => l.id === test4WorkerId);
    expect(ledgerBWorker).toBeDefined();
    expect(ledgerBWorker.earnedDays).toBeGreaterThan(0);
    expect(ledgerBWorker.totalEarned).toBe(ledgerBWorker.earnedDays * 600);

    // Master Directory cumulative earnings include active Project B earnings
    expect(worker.totalEarned).toBeGreaterThanOrEqual(ledgerBWorker.totalEarned);
    expect(worker.earnedDays).toBeGreaterThanOrEqual(ledgerBWorker.earnedDays);
  });

  // =========================================================================
  // TEST 5: Worker has only historical STOPPED assignments and no active assignment.
  // Verify Labour Directory does not incorrectly treat the stopped assignment as current.
  // =========================================================================
  let test5WorkerId: string;
  it('TEST 5: Worker with only historical STOPPED assignments is not treated as currently assigned', async () => {
    const createRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Stopped Only Worker ${runId}`,
        address: 'Pune',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 700,
      });
    expect(createRes.status).toBe(201);
    test5WorkerId = createRes.body.data.id;

    // Assign to Project A
    await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: test5WorkerId,
        startDate: '2026-09-10',
      });

    // Stop
    await request(app)
      .patch(`/api/labours/${test5WorkerId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Verify Labour Directory
    const dirRes = await request(app)
      .get(`/api/labours/${test5WorkerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const worker = dirRes.body.data;

    expect(worker.status).toBe('INACTIVE');
    expect(worker.projectId).toBeUndefined();
    expect(worker.project).toBeUndefined();
    expect(worker.startDate).toBeNull();
  });

  // =========================================================================
  // TEST 6: Verify INACTIVE workers do not inherit a previous project's
  // current project / start date.
  // =========================================================================
  it('TEST 6: INACTIVE workers do not inherit a previous project or start date in Labour Directory', async () => {
    const dirRes = await request(app)
      .get('/api/labours?status=INACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);

    const stoppedWorker = dirRes.body.data.find((l: any) => l.id === test5WorkerId);
    expect(stoppedWorker).toBeDefined();
    expect(stoppedWorker.status).toBe('INACTIVE');
    expect(stoppedWorker.project).toBeUndefined();
    expect(stoppedWorker.projectId).toBeUndefined();
    expect(stoppedWorker.startDate).toBeNull();
  });

  // =========================================================================
  // TEST 7: Verify Total Paid and Balance remain correct after the mapping fix.
  // =========================================================================
  it('TEST 7: Total Paid and Balance remain correct after mapping fix', async () => {
    // Record payment against test1WorkerId
    const payRes = await request(app)
      .post('/api/labour-payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: test1WorkerId,
        amount: 2000,
        paymentDate: '2026-09-20',
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Mid-month wage disbursement',
      });
    expect(payRes.status).toBe(201);

    // Verify in Labour Directory
    const dirRes = await request(app)
      .get(`/api/labours/${test1WorkerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const dirWorker = dirRes.body.data;

    expect(dirWorker.totalPaid).toBe(2000);
    expect(dirWorker.balance).toBe(dirWorker.totalEarned - 2000);

    // Verify in Project Workforce Ledger
    const projRes = await request(app)
      .get(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(projRes.status).toBe(200);
    const projWorker = projRes.body.data.find((l: any) => l.id === test1WorkerId);

    expect(projWorker.totalPaid).toBe(2000);
    expect(projWorker.balance).toBe(projWorker.totalEarned - 2000);
    expect(dirWorker.balance).toBe(projWorker.balance);
  });

  // =========================================================================
  // TEST 8: Verify existing Project Labour financial calculations remain unchanged.
  // =========================================================================
  it('TEST 8: Existing Project Labour financial calculations remain exact', async () => {
    const projRes = await request(app)
      .get(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(projRes.status).toBe(200);

    for (const worker of projRes.body.data) {
      expect(worker.totalEarned).toBe(worker.earnedDays * worker.dailyWage);
      expect(worker.balance).toBe(Math.round((worker.totalEarned - worker.totalPaid) * 100) / 100);
    }
  });

  // =========================================================================
  // TEST 9: Verify existing assignment start-date validation remains:
  // Project Start Date <= Assignment Start Date <= Today
  // =========================================================================
  it('TEST 9: Enforces Project Start Date <= Assignment Start Date <= Today', async () => {
    const workerRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Date Validation Worker ${runId}`,
        address: 'Pune',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 450,
      });
    expect(workerRes.status).toBe(201);
    const valWorkerId = workerRes.body.data.id;

    // Before project start date (projectB started on 2026-09-10) -> Must reject
    const earlyRes = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: valWorkerId,
        startDate: '2026-09-09',
      });
    expect(earlyRes.status).toBe(400);
    expect(earlyRes.body.message).toMatch(/cannot be earlier than project's start date/i);

    // In the future -> Must reject
    const futureRes = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: valWorkerId,
        startDate: '2099-01-01',
      });
    expect(futureRes.status).toBe(400);
    expect(futureRes.body.message).toMatch(/cannot be in the future/i);

    // Valid range -> Must accept
    const validRes = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: valWorkerId,
        startDate: '2026-09-10',
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.status).toBe('ACTIVE');
  });

  // =========================================================================
  // TEST 10: Verify Dashboard/project integration is not broken by the response change.
  // =========================================================================
  it('TEST 10: Dashboard labour integration aggregates totalEarned and counts accurately', async () => {
    const dashRes = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);
    const { labour } = dashRes.body.data;

    expect(labour).toBeDefined();
    expect(typeof labour.totalLabour).toBe('number');
    expect(typeof labour.activeLabour).toBe('number');
    expect(typeof labour.inactiveLabour).toBe('number');
    expect(typeof labour.totalEarned).toBe('number');
    expect(typeof labour.totalPaid).toBe('number');
    expect(typeof labour.balance).toBe('number');
    expect(labour.balance).toBe(Math.round((labour.totalEarned - labour.totalPaid) * 100) / 100);

    // Verify individual labours sum matches dashboard metrics
    const dirRes = await request(app)
      .get('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const allLabours = dirRes.body.data;

    const sumEarned = allLabours.reduce((sum: number, l: any) => sum + (l.totalEarned || 0), 0);
    expect(Math.round(labour.totalEarned * 100) / 100).toBe(Math.round(sumEarned * 100) / 100);
  });
});
