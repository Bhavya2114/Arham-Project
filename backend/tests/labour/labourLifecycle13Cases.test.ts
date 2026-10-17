import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour Status / Lifecycle Across ERP (13 Required Cases)', () => {
  let adminToken: string;
  let customerId: string;
  let projectAId: string;
  let projectBId: string;
  let workerId: string;
  const runId = Date.now();

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // 1. Create a Customer fixture
    const customer = await createTestCustomer({
      name: `Lifecycle Cust ${runId}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: `Infra Life ${runId}`,
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Pune MIDC',
    });
    customerId = customer._id.toString();

    // 2. Create Project A (started on 2026-09-01)
    const pARes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFECYCLE-A-${runId}`,
        name: 'Project Alpha Lifecycle',
        customer: customerId,
        siteAddress: 'Baner, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 5000000,
      });
    expect(pARes.status).toBe(201);
    projectAId = pARes.body.data.id;

    // 3. Create Project B (started on 2026-09-10)
    const pBRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFECYCLE-B-${runId}`,
        name: 'Project Beta Lifecycle',
        customer: customerId,
        siteAddress: 'Hinjawadi, Pune',
        startDate: '2026-09-10',
        status: 'IN_PROGRESS',
        budget: 4000000,
      });
    expect(pBRes.status).toBe(201);
    projectBId = pBRes.body.data.id;
  });

  // ==================================================
  // TEST 1: New labour: Expected = INACTIVE
  // ==================================================
  it('TEST 1: New labour created in directory has status = INACTIVE and is unassigned', async () => {
    const createRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Rahul Lifecycle ${runId}`,
        address: 'Pune',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 800,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    workerId = createRes.body.data.id;

    expect(createRes.body.data.status).toBe('INACTIVE');
    expect(createRes.body.data.projectId).toBeUndefined();
    expect(createRes.body.data.stoppedAt).toBeNull();
  });

  // ==================================================
  // TEST 2: New INACTIVE labour appears in Assign Labour dropdown
  // ==================================================
  it('TEST 2: New INACTIVE labour appears in Assign Labour query/dropdown', async () => {
    const listRes = await request(app)
      .get('/api/labours?status=INACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const worker = listRes.body.data.find((l: any) => l.id === workerId);
    expect(worker).toBeDefined();
    expect(worker.status).toBe('INACTIVE');
  });

  // ==================================================
  // TEST 3: Assign INACTIVE labour to Project A: Expected = ACTIVE / WORKING
  // ==================================================
  it('TEST 3: Assign INACTIVE labour to Project A -> labour becomes ACTIVE / WORKING', async () => {
    const assignRes = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
        startDate: '2026-09-01',
      });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.id).toBe(workerId);
    expect(assignRes.body.data.status).toBe('ACTIVE');
    expect(assignRes.body.data.projectId).toBe(projectAId);

    // Verify master directory record also reflects ACTIVE
    const dirRes = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dirRes.status).toBe(200);
    expect(dirRes.body.data.status).toBe('ACTIVE');
    expect(dirRes.body.data.projectId).toBe(projectAId);
  });

  // ==================================================
  // TEST 4: ACTIVE labour does not appear in Assign Labour dropdown
  // ==================================================
  it('TEST 4: ACTIVE labour does NOT appear in Assign Labour eligible list', async () => {
    const listRes = await request(app)
      .get('/api/labours?status=INACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const worker = listRes.body.data.find((l: any) => l.id === workerId);
    expect(worker).toBeUndefined(); // Active worker is NOT available in Assign dropdown
  });

  // ==================================================
  // TEST 5: Backend rejects assigning an ACTIVE labour to another project
  // ==================================================
  it('TEST 5: Backend rejects assigning an ACTIVE labour to another project (HTTP 400)', async () => {
    const attemptRes = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
        startDate: '2026-09-15',
      });

    expect(attemptRes.status).toBe(400);
    expect(attemptRes.body.success).toBe(false);
    expect(attemptRes.body.message).toMatch(/active on another project|cannot be assigned/i);
  });

  // ==================================================
  // TEST 6: Stop/complete the labour's active project assignment: Expected Labour status = INACTIVE
  // ==================================================
  it('TEST 6: Stop/complete active project assignment -> master Labour status becomes INACTIVE', async () => {
    const stopRes = await request(app)
      .patch(`/api/labours/${workerId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.status).toBe('INACTIVE');
    expect(stopRes.body.data.stoppedAt).not.toBeNull();

    // Verify master directory record is INACTIVE
    const masterRes = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(masterRes.status).toBe(200);
    expect(masterRes.body.data.status).toBe('INACTIVE');
  });

  // ==================================================
  // TEST 7: After becoming INACTIVE, labour appears again in Assign Labour dropdown
  // ==================================================
  it('TEST 7: After becoming INACTIVE, labour appears again in Assign Labour dropdown', async () => {
    const listRes = await request(app)
      .get('/api/labours?status=INACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const worker = listRes.body.data.find((l: any) => l.id === workerId);
    expect(worker).toBeDefined();
    expect(worker.status).toBe('INACTIVE');
  });

  // ==================================================
  // TEST 8: Historical stopped project assignments remain intact
  // ==================================================
  it('TEST 8: Historical stopped project assignments remain intact on Project A ledger', async () => {
    const projectLaboursRes = await request(app)
      .get(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(projectLaboursRes.status).toBe(200);
    const assignment = projectLaboursRes.body.data.find((l: any) => l.id === workerId);
    expect(assignment).toBeDefined();
    expect(assignment.status).toBe('STOPPED');
    expect(assignment.stoppedAt).not.toBeNull();
    expect(assignment.projectId).toBe(projectAId);
    expect(assignment.totalEarned).toBeGreaterThan(0);
  });

  // ==================================================
  // TEST 9: Labour with only historical stopped assignments is INACTIVE
  // ==================================================
  it('TEST 9: Labour with only historical stopped assignments has master directory status = INACTIVE', async () => {
    const masterRes = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(masterRes.status).toBe(200);
    expect(masterRes.body.data.status).toBe('INACTIVE');
  });

  // ==================================================
  // TEST 10: Labour with one active project assignment is ACTIVE
  // ==================================================
  it('TEST 10: Labour assigned to Project B becomes ACTIVE while Project A remains historical STOPPED', async () => {
    const assignBRes = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
        startDate: '2026-09-12',
      });

    expect(assignBRes.status).toBe(200);
    expect(assignBRes.body.data.status).toBe('ACTIVE');
    expect(assignBRes.body.data.projectId).toBe(projectBId);

    // Master directory status is ACTIVE
    const masterRes = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(masterRes.body.data.status).toBe('ACTIVE');

    // Project A still retains historical STOPPED assignment
    const projARes = await request(app)
      .get(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const histA = projARes.body.data.find((l: any) => l.id === workerId);
    expect(histA).toBeDefined();
    expect(histA.status).toBe('STOPPED');

    // Project B has current ACTIVE assignment
    const projBRes = await request(app)
      .get(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const currB = projBRes.body.data.find((l: any) => l.id === workerId);
    expect(currB).toBeDefined();
    expect(currB.status).toBe('ACTIVE');
  });

  // ==================================================
  // TEST 11: Labour status filter contains only All, Active/Working, Inactive (NOT STOPPED)
  // ==================================================
  it('TEST 11: Labour status filter contains only All, Active, Inactive and does NOT return STOPPED in directory', async () => {
    // 1. All labours
    const allRes = await request(app)
      .get('/api/labours?status=ALL')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allRes.status).toBe(200);
    const directoryStatuses = allRes.body.data.map((l: any) => l.status);
    expect(directoryStatuses).not.toContain('STOPPED');
    directoryStatuses.forEach((st: string) => {
      expect(['ACTIVE', 'INACTIVE']).toContain(st);
    });

    // 2. Active labours
    const activeRes = await request(app)
      .get('/api/labours?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(activeRes.status).toBe(200);
    activeRes.body.data.forEach((l: any) => {
      expect(l.status).toBe('ACTIVE');
    });

    // 3. Inactive labours
    const inactiveRes = await request(app)
      .get('/api/labours?status=INACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inactiveRes.status).toBe(200);
    inactiveRes.body.data.forEach((l: any) => {
      expect(l.status).toBe('INACTIVE');
    });
  });

  // ==================================================
  // TEST 12: Existing Project Labour financial calculations remain correct
  // ==================================================
  it('TEST 12: Existing Project Labour financial calculations remain exact', async () => {
    const projBRes = await request(app)
      .get(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(projBRes.status).toBe(200);
    const workerB = projBRes.body.data.find((l: any) => l.id === workerId);
    expect(workerB).toBeDefined();
    expect(workerB.earnedDays).toBeGreaterThanOrEqual(1);
    expect(workerB.totalEarned).toBe(workerB.earnedDays * workerB.dailyWage);

    // Record a payment against the worker
    const payRes = await request(app)
      .post('/api/labour-payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
        amount: 500,
        paymentDate: '2026-09-15',
        paymentMethod: 'CASH',
        notes: 'Financial test payment',
      });
    expect(payRes.status).toBe(201);

    // Verify balance recalculation
    const afterPayRes = await request(app)
      .get(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const workerAfterPay = afterPayRes.body.data.find((l: any) => l.id === workerId);
    expect(workerAfterPay.totalPaid).toBe(500);
    expect(workerAfterPay.balance).toBe(workerAfterPay.totalEarned - 500);
  });

  // ==================================================
  // TEST 13: Project assignment start-date behavior: Project Start Date <= Assignment Start Date <= Today
  // ==================================================
  it('TEST 13: Project assignment start-date behavior enforces: Project Start Date <= Assignment Start Date <= Today', async () => {
    // Create a new unassigned worker
    const newWorkerRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Date Rule Worker ${runId}`,
        address: 'Pune',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 750,
      });
    expect(newWorkerRes.status).toBe(201);
    const newWorkerId = newWorkerRes.body.data.id;

    // 1. Assignment before Project Start Date (projectA started on 2026-09-01) -> MUST REJECT
    const beforeRes = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: newWorkerId,
        startDate: '2026-08-31',
      });
    expect(beforeRes.status).toBe(400);
    expect(beforeRes.body.message).toMatch(/cannot be earlier than project's start date/i);

    // 2. Assignment in the future -> MUST REJECT
    const futureRes = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: newWorkerId,
        startDate: '2099-01-01',
      });
    expect(futureRes.status).toBe(400);
    expect(futureRes.body.message).toMatch(/cannot be in the future/i);

    // 3. Assignment exactly on Project Start Date -> MUST ACCEPT
    const exactStartRes = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: newWorkerId,
        startDate: '2026-09-01',
      });
    expect(exactStartRes.status).toBe(200);
    expect(exactStartRes.body.data.status).toBe('ACTIVE');
  });
});
