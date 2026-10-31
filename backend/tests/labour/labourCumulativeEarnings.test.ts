import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Labour } from '../../src/models/Labour';

// Dates are relative to today so the test does not expire on a fixed calendar day.
// Project 1 spans 31 days and ended a month ago; project 2 started 30 days ago and runs 30 more days.
const daysFromToday = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const P1_START = daysFromToday(-61);
const P1_END = daysFromToday(-31);
const P2_START = daysFromToday(-30);
const P2_END = daysFromToday(30);
const PAYMENT_DATE = daysFromToday(-50);

describe('Labour Cumulative Earnings Across Multiple Projects', () => {
  let adminToken: string;
  let project1Id: string;
  let project2Id: string;
  let workerId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // 1. Create Project 1 (PRJ-SEQ-1): 31 days, P1_START to P1_END
    const p1Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-SEQ1-${Date.now()}`,
        name: 'Sequential Project 1',
        siteAddress: 'Baner, Pune',
        startDate: P1_START,
        expectedEndDate: P1_END,
        status: 'IN_PROGRESS',
      });
    expect(p1Res.status).toBe(201);
    project1Id = p1Res.body.data.id;

    // 2. Create Project 2 (PRJ-SEQ-2): P2_START to P2_END (today is inside it)
    const p2Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-SEQ2-${Date.now()}`,
        name: 'Sequential Project 2',
        siteAddress: 'Kothrud, Pune',
        startDate: P2_START,
        expectedEndDate: P2_END,
        status: 'IN_PROGRESS',
      });
    expect(p2Res.status).toBe(201);
    project2Id = p2Res.body.data.id;

    // 3. Create Worker with ₹1,000 daily wage
    const lRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Worker Cumulative Test',
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        location: 'Pune',
        dailyWage: 1000,
      });
    expect(lRes.status).toBe(201);
    workerId = lRes.body.data.id;

    // 4. Assign Worker to Project 1 on its start date
    const assign1Res = await request(app)
      .post(`/api/projects/${project1Id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
        startDate: P1_START,
      });
    expect(assign1Res.status).toBe(200);

    // 5. Stop Worker on Project 1
    const stopRes = await request(app)
      .patch(`/api/labours/${workerId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stopRes.status).toBe(200);

    // 6. Assign Worker to Project 2 (ACTIVE) with start date today
    const assign2Res = await request(app)
      .post(`/api/projects/${project2Id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
      });
    expect(assign2Res.status).toBe(200);
  });

  it('1 & 4. Worker assigned to two projects sequentially accumulates earnings while current assignment is ACTIVE', async () => {
    // Project 1 (P1_START to P1_END capped) = 31 days * ₹1000 = ₹31,000
    // Project 2 (assigned today = 1 day) = 1 day * ₹1000 = ₹1,000
    // Cumulative = 32 days, ₹32,000
    const res = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.earnedDays).toBe(32);
    expect(res.body.data.totalEarned).toBe(32000);
    expect(res.body.data.balance).toBe(32000);
  });

  it('2. Master Labour Directory returns cumulative total for active worker', async () => {
    const res = await request(app)
      .get('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const worker = res.body.data.find((l: any) => l.id === workerId);
    expect(worker).toBeDefined();
    expect(worker.status).toBe('ACTIVE');
    expect(worker.earnedDays).toBe(32);
    expect(worker.totalEarned).toBe(32000);
    expect(worker.balance).toBe(32000);
  });

  it('3 & 5. Each project Workforce Ledger displays only its own earnings and respects expectedEndDate capping', async () => {
    // Project 1 Workforce Ledger: only Project 1 earnings (31 days, ₹31,000)
    const ledger1Res = await request(app)
      .get(`/api/projects/${project1Id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledger1Res.status).toBe(200);
    const workerInP1 = ledger1Res.body.data.find((l: any) => l.id === workerId);
    expect(workerInP1).toBeDefined();
    expect(workerInP1.earnedDays).toBe(31);
    expect(workerInP1.totalEarned).toBe(31000);
    expect(workerInP1.projectAssignmentStatus).toBe('STOPPED');

    // Project 2 Workforce Ledger: only Project 2 earnings (1 day, ₹1,000)
    const ledger2Res = await request(app)
      .get(`/api/projects/${project2Id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledger2Res.status).toBe(200);
    const workerInP2 = ledger2Res.body.data.find((l: any) => l.id === workerId);
    expect(workerInP2).toBeDefined();
    expect(workerInP2.earnedDays).toBe(1);
    expect(workerInP2.totalEarned).toBe(1000);
    expect(workerInP2.projectAssignmentStatus).toBe('ACTIVE');
  });

  it('6. Cumulative payment balance: ₹32,000 earned minus ₹10,000 paid = ₹22,000 balance', async () => {
    const payRes = await request(app)
      .post('/api/labour-payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        labourId: workerId,
        amount: 10000,
        paymentDate: PAYMENT_DATE,
        paymentMethod: 'CASH',
        notes: 'Mid-month settlement',
      });
    expect(payRes.status).toBe(201);

    // Check Worker Profile
    const profileRes = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.totalEarned).toBe(32000);
    expect(profileRes.body.data.totalPaid).toBe(10000);
    expect(profileRes.body.data.balance).toBe(22000);

    // Check Labour Directory
    const dirRes = await request(app)
      .get('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    const worker = dirRes.body.data.find((l: any) => l.id === workerId);
    expect(worker.totalEarned).toBe(32000);
    expect(worker.totalPaid).toBe(10000);
    expect(worker.balance).toBe(22000);
  });

  it('7. Dashboard totals include historical assignments and attribute expenses to correct projects', async () => {
    const dashRes = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);

    const byProj = dashRes.body.data.labour.byProject;
    const p1Group = byProj.find((p: any) => p.projectId === project1Id);
    const p2Group = byProj.find((p: any) => p.projectId === project2Id);

    // Project 1 must have at least ₹31,000 earned
    expect(p1Group).toBeDefined();
    expect(p1Group.totalEarned).toBeGreaterThanOrEqual(31000);

    // Project 2 must have at least ₹1,000 earned
    expect(p2Group).toBeDefined();
    expect(p2Group.totalEarned).toBeGreaterThanOrEqual(1000);
  });

  it('8. Legacy worker without projectAssignments array still calculates correctly', async () => {
    // Create legacy labour record directly in MongoDB without projectAssignments
    const legacyLabour = await Labour.create({
      name: 'Legacy Labour Worker',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Nagpur',
      dailyWage: 800,
      startDate: new Date('2026-10-01'),
      assignmentStartDate: new Date('2026-10-01'),
      status: 'ACTIVE',
      projectAssignments: [],
      assignedProjects: [],
      projectId: null,
    });

    const res = await request(app)
      .get(`/api/labours/${legacyLabour._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.earnedDays).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalEarned).toBeGreaterThanOrEqual(800);
  });

  it('9. No duplicate earnings are introduced when multiple assignments exist on same worker', async () => {
    const res = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // Exact sum must equal 32,000 (31,000 + 1,000)
    expect(res.body.data.totalEarned).toBe(32000);
    expect(res.body.data.earnedDays).toBe(32);
  });
});
