import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour Lifecycle, Inactive State & Project Completion (Section 21 Tests)', () => {
  let adminToken: string;
  let customerId: string;
  let activeProject1Id: string;
  let activeProject5Id: string;
  let completedProjectId: string;
  let cancelledProjectId: string;
  let onHoldProjectId: string;

  let rajeshLabourId: string;
  let stopTestLabourId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Lifecycle Verification Customer',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Lifecycle Infra',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Pune MIDC',
    });
    customerId = customer._id.toString();

    // Create Active Project 1
    const p1Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFE-1-${Date.now()}`,
        name: 'Metro Line Project',
        customer: customerId,
        siteAddress: 'Station Road, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 5000000,
      });
    expect(p1Res.status).toBe(201);
    activeProject1Id = p1Res.body.data.id;

    // Create Active Project 5
    const p5Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFE-5-${Date.now()}`,
        name: 'Flyover Project 5',
        customer: customerId,
        siteAddress: 'Ring Road, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 4000000,
      });
    expect(p5Res.status).toBe(201);
    activeProject5Id = p5Res.body.data.id;

    // Create Completed Project
    const pCompRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFE-COMP-${Date.now()}`,
        name: 'Completed Highway',
        customer: customerId,
        siteAddress: 'Highway 4, Pune',
        startDate: '2026-01-01',
        status: 'COMPLETED',
        budget: 10000000,
      });
    expect(pCompRes.status).toBe(201);
    completedProjectId = pCompRes.body.data.id;

    // Create Cancelled Project
    const pCancRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFE-CANC-${Date.now()}`,
        name: 'Cancelled Commercial Mall',
        customer: customerId,
        siteAddress: 'Camp, Pune',
        startDate: '2026-01-01',
        status: 'CANCELLED',
        budget: 8000000,
      });
    expect(pCancRes.status).toBe(201);
    cancelledProjectId = pCancRes.body.data.id;

    // Create On-Hold Project
    const pOnHoldRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-LIFE-HOLD-${Date.now()}`,
        name: 'On-Hold Bridge',
        customer: customerId,
        siteAddress: 'Riverside, Pune',
        startDate: '2026-02-01',
        status: 'ON_HOLD',
        budget: 6000000,
      });
    expect(pOnHoldRes.status).toBe(201);
    onHoldProjectId = pOnHoldRes.body.data.id;
  });

  // ==================================================
  // 1. CREATION (Tests 1 - 7)
  // ==================================================
  describe('Creation Requirements (Tests 1 - 7)', () => {
    it('1-7. New unassigned Labour defaults to INACTIVE, projectId null, startDate null, stoppedAt null, earnedDays 0, totalEarned 0, projectedMonthly 0', async () => {
      // Check baseline dashboard projected wages
      const baseDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      const initialProjected = baseDash.body.data?.labour?.projectedMonthlyWages || 0;
      const initialActive = baseDash.body.data?.labour?.activeLabour || 0;
      const initialInactive = baseDash.body.data?.labour?.inactiveLabour || 0;

      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh',
          address: 'Kota',
          mobile: '9876543210',
          dailyWage: 1000,
        });

      expect(res.status).toBe(201);
      const data = res.body.data;
      rajeshLabourId = data.id;

      // 1. New Labour defaults to INACTIVE
      expect(data.status).toBe('INACTIVE');

      // 2. projectId = null
      expect(data.projectId).toBeFalsy();
      expect(data.project).toBeFalsy();

      // 3. startDate = null
      expect(data.startDate).toBeNull();

      // 4. stoppedAt = null
      expect(data.stoppedAt).toBeNull();

      // 5. Earned days = 0
      expect(data.earnedDays).toBe(0);

      // 6. Total earned = 0
      expect(data.totalEarned).toBe(0);

      // 7. Projected monthly wage contribution = 0
      const afterDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(afterDash.body.data.labour.projectedMonthlyWages).toBe(initialProjected); // Unchanged!
      expect(afterDash.body.data.labour.activeLabour).toBe(initialActive); // Unchanged!
      expect(afterDash.body.data.labour.inactiveLabour).toBe(initialInactive + 1); // Incremented!
    });
  });

  // ==================================================
  // 2. ASSIGNMENT (Tests 8 - 12)
  // ==================================================
  describe('Assignment Requirements (Tests 8 - 12)', () => {
    it('8-12. INACTIVE Labour assigned to ACTIVE Project becomes ACTIVE, projectId set, startDate generated, stoppedAt null, wage accumulation starts', async () => {
      const res = await request(app)
        .post(`/api/projects/${activeProject1Id}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: rajeshLabourId,
        });

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 8. INACTIVE Labour assigned to ACTIVE Project becomes ACTIVE
      expect(data.status).toBe('ACTIVE');

      // 9. projectId set
      expect(data.projectId).toBe(activeProject1Id);

      // 10. startDate generated by backend (today's date)
      expect(data.startDate).toBeDefined();
      const startDateStr = new Date(data.startDate).toISOString().slice(0, 10);
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      expect(startDateStr).toBe(todayStr);

      // 11. stoppedAt null
      expect(data.stoppedAt).toBeNull();

      // 12. Earned wage starts correctly (1 day on assignment date, ₹1,000)
      expect(data.earnedDays).toBe(1);
      expect(data.totalEarned).toBe(1000);
    });
  });

  // ==================================================
  // 3. INVALID ASSIGNMENT (Tests 13 - 16)
  // ==================================================
  describe('Invalid Assignment Requirements (Tests 13 - 16)', () => {
    let unassignedWorkerId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unassigned Test Worker',
          address: 'Pune',
          mobile: '9876543299',
          dailyWage: 800,
        });
      unassignedWorkerId = res.body.data.id;
    });

    it('13. Cannot assign to COMPLETED Project', async () => {
      const res = await request(app)
        .post(`/api/projects/${completedProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ labourId: unassignedWorkerId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/active project/i);
    });

    it('14. Cannot assign to CANCELLED Project', async () => {
      const res = await request(app)
        .post(`/api/projects/${cancelledProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ labourId: unassignedWorkerId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/active project/i);
    });

    it('15. Cannot assign to ON_HOLD Project', async () => {
      const res = await request(app)
        .post(`/api/projects/${onHoldProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ labourId: unassignedWorkerId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/active project/i);
    });

    it('16. Duplicate assignment rejected', async () => {
      const res = await request(app)
        .post(`/api/projects/${activeProject1Id}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ labourId: rajeshLabourId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already assigned to this project/i);
    });
  });

  // ==================================================
  // 4. PROJECT COMPLETION BEHAVIOR (Tests 17 - 22)
  // ==================================================
  describe('Project Completion Requirements (Tests 17 - 22)', () => {
    it('17-22. Completing project deactivates assigned labour, sets INACTIVE, unassigned in directory, updates dashboard, and preserves historical finances', async () => {
      // 1. Record a payment to test historical financial preservation
      const payRes = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: rajeshLabourId,
          amount: 400,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'CASH',
          notes: 'Advance wage payout before project completion',
        });
      expect(payRes.status).toBe(201);

      // Verify Dashboard before completion
      const preDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      const preActive = preDash.body.data.labour.activeLabour;
      const preProjected = preDash.body.data.labour.projectedMonthlyWages;

      // 2. Mark Project 1 as COMPLETED
      const updateProjectRes = await request(app)
        .put(`/api/projects/${activeProject1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' });
      expect(updateProjectRes.status).toBe(200);
      expect(updateProjectRes.body.data.status).toBe('COMPLETED');

      // 3. Fetch Rajesh Labour details
      const labourRes = await request(app)
        .get(`/api/labours/${rajeshLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(labourRes.status).toBe(200);
      const rajeshData = labourRes.body.data;

      // 17. Active Labour on completed Project is no longer ACTIVE
      expect(rajeshData.status).not.toBe('ACTIVE');

      // 18. Labour becomes INACTIVE
      expect(rajeshData.status).toBe('INACTIVE');

      // 19. Current assignment becomes Unassigned according to the implemented design
      expect(rajeshData.projectId).toBeFalsy();
      expect(rajeshData.project).toBeFalsy();

      // 20. Projected monthly wages no longer include that worker
      const postDash = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(postDash.body.data.labour.projectedMonthlyWages).toBe(preProjected - 1000 * 30);

      // 21. Active Labour count decreases
      expect(postDash.body.data.labour.activeLabour).toBe(preActive - 1);

      // 22. Historical financial data remains correct
      expect(rajeshData.totalEarned).toBe(1000);
      expect(rajeshData.totalPaid).toBe(400);
      expect(rajeshData.balance).toBe(600);

      // Verify Project Labour endpoint retains worker's historical record
      const prjLabourRes = await request(app)
        .get(`/api/projects/${activeProject1Id}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(prjLabourRes.status).toBe(200);
      const prjRajesh = prjLabourRes.body.data.find((l: any) => l.id === rajeshLabourId);
      expect(prjRajesh).toBeDefined();
      expect(prjRajesh.totalEarned).toBe(1000);
      expect(prjRajesh.totalPaid).toBe(400);
      expect(prjRajesh.balance).toBe(600);
    });
  });

  // ==================================================
  // 5. MANUAL STOP (Tests 23 - 25)
  // ==================================================
  describe('Manual Stop Requirements (Tests 23 - 25)', () => {
    beforeAll(async () => {
      // Create and assign worker to Project 5
      const createRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Stop Test Worker',
          address: 'Pune',
          mobile: '9876543288',
          dailyWage: 900,
        });
      stopTestLabourId = createRes.body.data.id;

      const assignRes = await request(app)
        .post(`/api/projects/${activeProject5Id}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ labourId: stopTestLabourId });
      expect(assignRes.status).toBe(200);
    });

    it('23-25. ACTIVE -> INACTIVE on stop, stoppedAt generated, assignment marked STOPPED', async () => {
      // 23. Stop labour: master status becomes INACTIVE
      const stopRes = await request(app)
        .patch(`/api/labours/${stopTestLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(stopRes.status).toBe(200);
      expect(stopRes.body.data.status).toBe('INACTIVE');

      // 24. stoppedAt still generated
      expect(stopRes.body.data.stoppedAt).not.toBeNull();

      // Now complete Project 5
      await request(app)
        .put(`/api/projects/${activeProject5Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' });

      // 25. Labour remains INACTIVE in directory
      const checkRes = await request(app)
        .get(`/api/labours/${stopTestLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.status).toBe('INACTIVE');

      // Assignment on Project 5 is STOPPED
      const projLaboursRes = await request(app)
        .get(`/api/projects/${activeProject5Id}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);
      const assigned = projLaboursRes.body.data.find((l: any) => l.id === stopTestLabourId);
      expect(assigned.status).toBe('STOPPED');
    });
  });
});
