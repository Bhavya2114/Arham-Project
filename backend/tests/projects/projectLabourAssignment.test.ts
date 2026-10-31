import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';
import { Labour } from '../../src/models/Labour';
import { calculateLabourEarned } from '../../src/services/labour.service';

describe('Project Labour Assignment & Automatic Start Date Flow', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;

  let customerId: string;
  let activeProjectAId: string;
  let activeProjectBId: string;
  let activeTodayProjectId: string;
  let completedProjectId: string;

  let masterLabourId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');

    // Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Assignment Flow Customer Ltd',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Assignment Infra',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Pune MIDC',
    });
    customerId = customer._id.toString();

    // Create Active Project A (started in past: 2026-09-01)
    const pARes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-ASSIGN-A-${Date.now()}`,
        name: 'Metro Corridor Assign Project',
        customer: customerId,
        siteAddress: 'Station Road, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 5000000,
      });
    expect(pARes.status).toBe(201);
    activeProjectAId = pARes.body.data.id;

    // Create Active Project B (started in past: 2026-09-05)
    const pBRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-ASSIGN-B-${Date.now()}`,
        name: 'Bridge Assign Project',
        customer: customerId,
        siteAddress: 'Camp, Pune',
        startDate: '2026-09-05',
        status: 'IN_PROGRESS',
        budget: 4000000,
      });
    expect(pBRes.status).toBe(201);
    activeProjectBId = pBRes.body.data.id;

    // Create Active Project starting today
    const todayStr = new Date().toISOString().slice(0, 10);
    const pTodayRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-ASSIGN-TODAY-${Date.now()}`,
        name: 'Today Active Assign Project',
        customer: customerId,
        siteAddress: 'Baner, Pune',
        startDate: todayStr,
        status: 'IN_PROGRESS',
        budget: 3000000,
      });
    expect(pTodayRes.status).toBe(201);
    activeTodayProjectId = pTodayRes.body.data.id;

    // Create Completed Project (Inactive)
    const pCompRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-ASSIGN-COMP-${Date.now()}`,
        name: 'Completed Highway Project',
        customer: customerId,
        siteAddress: 'Highway 4, Pune',
        startDate: '2026-01-01',
        status: 'COMPLETED',
        budget: 10000000,
      });
    expect(pCompRes.status).toBe(201);
    completedProjectId = pCompRes.body.data.id;
  });

  // ==================================================
  // GLOBAL LABOUR CREATION (MASTER DIRECTORY)
  // ==================================================

  describe('Global Labour Creation (Master Record)', () => {
    it('1-7. should create Labour without projectId, saving name, address, mobile, daily wage, and remaining unassigned', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          address: 'Kota',
          mobile: '9876543210',
          dailyWage: 1000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Rajesh Kumar');
      expect(res.body.data.address).toBe('Kota');
      expect(res.body.data.location).toBe('Kota');
      expect(res.body.data.mobile).toBe('9876543210');
      expect(res.body.data.dailyWage).toBe(1000);
      expect(res.body.data.projectId).toBeFalsy();
      expect(res.body.data.project).toBeFalsy();
      expect(res.body.data.startDate).toBeFalsy();

      masterLabourId = res.body.data.id;
    });

    it('8. should not accept user-supplied startDate for global labour creation', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Suresh Verma',
          address: 'Kota',
          mobile: '9876543219',
          dailyWage: 950,
          startDate: '2020-01-01', // User-supplied date must be ignored for unassigned master record
        });

      expect(res.status).toBe(201);
      expect(res.body.data.startDate).toBeFalsy();
      expect(res.body.data.projectId).toBeFalsy();
    });
  });

  // ==================================================
  // PROJECT ASSIGNMENT (ASSIGN EXISTING LABOUR TO PROJECT)
  // ==================================================

  describe('Project Labour Assignment Flow', () => {
    it('9-13. should assign existing Labour to ACTIVE Project, set auto startDate, status ACTIVE, and stoppedAt null', async () => {
      const res = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: masterLabourId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(masterLabourId);
      expect(res.body.data.projectId).toBe(activeProjectAId);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.stoppedAt).toBeNull();

      // Check automatically generated startDate equals today's date
      expect(res.body.data.startDate).toBeDefined();
      const labourStartDate = new Date(res.body.data.startDate).toISOString().slice(0, 10);
      const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      expect(labourStartDate).toBe(todayDate);
    });

    // ==================================================
    // LABOUR ASSIGNMENT START DATE RULES (CASES A - E)
    // Range allowed: project.startDate <= assignment.startDate <= today
    // ==================================================

    it('Case A: should allow assignment with today date when project starts today', async () => {
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case A Worker',
          address: 'Pune',
          mobile: '9876543201',
          dailyWage: 900,
        });
      const workerId = workerRes.body.data.id;
      const todayStr = new Date().toISOString().slice(0, 10);

      const assignRes = await request(app)
        .post(`/api/projects/${activeTodayProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          startDate: todayStr,
        });

      expect(assignRes.status).toBe(200);
      const assignedDate = new Date(assignRes.body.data.startDate).toISOString().slice(0, 10);
      expect(assignedDate).toBe(todayStr);
    });

    it('Case B: should allow project start date itself, a date between start and today, and today for past-started project', async () => {
      // activeProjectAId started on 2026-09-01
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Project start date itself (2026-09-01)
      const worker1Res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case B Worker 1',
          address: 'Pune',
          mobile: '9876543202',
          dailyWage: 900,
        });
      const worker1Id = worker1Res.body.data.id;

      const assign1Res = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: worker1Id,
          startDate: '2026-09-01',
        });
      expect(assign1Res.status).toBe(200);
      expect(new Date(assign1Res.body.data.startDate).toISOString().slice(0, 10)).toBe('2026-09-01');

      // 2. Date between project start and today (2026-09-15)
      const worker2Res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case B Worker 2',
          address: 'Pune',
          mobile: '9876543203',
          dailyWage: 900,
        });
      const worker2Id = worker2Res.body.data.id;

      const assign2Res = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: worker2Id,
          startDate: '2026-09-15',
        });
      expect(assign2Res.status).toBe(200);
      expect(new Date(assign2Res.body.data.startDate).toISOString().slice(0, 10)).toBe('2026-09-15');

      // 3. Today date
      const worker3Res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case B Worker 3',
          address: 'Pune',
          mobile: '9876543204',
          dailyWage: 900,
        });
      const worker3Id = worker3Res.body.data.id;

      const assign3Res = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: worker3Id,
          startDate: todayStr,
        });
      expect(assign3Res.status).toBe(200);
      expect(new Date(assign3Res.body.data.startDate).toISOString().slice(0, 10)).toBe(todayStr);
    });

    it('Case C: should reject assignment when startDate is before project startDate', async () => {
      // activeProjectAId started on 2026-09-01. Date 2026-08-31 must be rejected.
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case C Worker',
          address: 'Pune',
          mobile: '9876543205',
          dailyWage: 900,
        });
      const workerId = workerRes.body.data.id;

      const assignRes = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          startDate: '2026-08-31',
        });

      expect(assignRes.status).toBe(400);
      expect(assignRes.body.message).toMatch(/project.*start date/i);
    });

    it('Case D: should reject assignment when startDate is in the future', async () => {
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case D Worker',
          address: 'Pune',
          mobile: '9876543206',
          dailyWage: 900,
        });
      const workerId = workerRes.body.data.id;

      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
      const assignRes = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          startDate: futureDate,
        });

      expect(assignRes.status).toBe(400);
      expect(assignRes.body.message).toMatch(/future/i);
    });

    it('Case E: a returning worker cannot start before the last day already worked', async () => {
      // activeProjectAId started on 2026-09-01
      // activeProjectBId started on 2026-09-05
      // Worker on Project B from 2026-09-20, stopped on 2026-09-25
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Case E Worker',
          address: 'Surat',
          mobile: '9876543207',
          dailyWage: 950,
          projectId: activeProjectBId,
          startDate: '2026-09-20',
        });
      const workerId = workerRes.body.data.id;
      expect(new Date(workerRes.body.data.startDate).toISOString().slice(0, 10)).toBe('2026-09-20');

      const stopRes = await request(app)
        .patch(`/api/labours/${workerId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stopDate: '2026-09-25' });
      expect(stopRes.status).toBe(200);

      // 2026-09-05 is inside Project A's dates but goes back over days already paid on Project B
      const overlapRes = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          startDate: '2026-09-05',
        });
      expect(overlapRes.status).toBe(400);
      expect(overlapRes.body.message).toMatch(/already worked till 25 Sep 2026/);

      // Starting on the last worked day (moved between sites that day) is allowed
      const assignRes = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
          startDate: '2026-09-25',
        });

      expect(assignRes.status).toBe(200);
      const assignedDate = new Date(assignRes.body.data.startDate).toISOString().slice(0, 10);
      expect(assignedDate).toBe('2026-09-25');
    });

    it('15. should reject assignment of nonexistent Labour', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: nonExistentId,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Labour not found/i);
    });

    it('16. should reject assignment to nonexistent Project or invalid ID', async () => {
      // Invalid project ID format
      const invalidRes = await request(app)
        .post('/api/projects/invalid-id/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: masterLabourId,
        });
      expect(invalidRes.status).toBe(400);

      // Nonexistent project
      const nonExistentPrj = new mongoose.Types.ObjectId().toString();
      const nonExistentRes = await request(app)
        .post(`/api/projects/${nonExistentPrj}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: masterLabourId,
        });
      expect(nonExistentRes.status).toBe(404);
      expect(nonExistentRes.body.message).toMatch(/Project not found/i);
    });

    it('17. should reject assignment to an INACTIVE (COMPLETED/CANCELLED) Project', async () => {
      // Create fresh worker
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Kiran Joshi',
          address: 'Pune',
          mobile: '9876543233',
          dailyWage: 850,
        });
      const workerId = workerRes.body.data.id;

      // Attempt assignment to completed project
      const res = await request(app)
        .post(`/api/projects/${completedProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: workerId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/active project/i);
    });

    it('18. should reject duplicate assignment of the same Labour to the same Project', async () => {
      // masterLabourId is already assigned to activeProjectAId
      const res = await request(app)
        .post(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: masterLabourId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already assigned to this project/i);
    });
  });

  // ==================================================
  // REGRESSION VERIFICATION (EXISTING FEATURES PRESERVED)
  // ==================================================

  describe('Regression & Integration Verification', () => {
    it('should retrieve assigned worker in Project Labour list', async () => {
      const res = await request(app)
        .get(`/api/projects/${activeProjectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const worker = res.body.data.find((l: any) => l.id === masterLabourId);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('Rajesh Kumar');
    });

    it('should update worker name, address, mobile, dailyWage via Edit Labour', async () => {
      const res = await request(app)
        .put(`/api/labours/${masterLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh V. Kumar',
          address: 'Kota Central',
          mobile: '9876543210',
          dailyWage: 1100,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Rajesh V. Kumar');
      expect(res.body.data.address).toBe('Kota Central');
      expect(res.body.data.dailyWage).toBe(1100);
    });

    it('should calculate wages accurately starting from automatic startDate', async () => {
      const res = await request(app)
        .get(`/api/labours/${masterLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.earnedDays).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalEarned).toBe(res.body.data.earnedDays * res.body.data.dailyWage);
    });

    it('should stop worker and freeze wage calculation with backend-generated stoppedAt', async () => {
      const res = await request(app)
        .patch(`/api/labours/${masterLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');
      expect(res.body.data.stoppedAt).not.toBeNull();
    });

    it('should record payment against worker and calculate balance', async () => {
      const payRes = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: masterLabourId,
          amount: 500,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'UPI',
          notes: 'Settlement test',
        });

      expect(payRes.status).toBe(201);

      const labourRes = await request(app)
        .get(`/api/labours/${masterLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(labourRes.status).toBe(200);
      expect(labourRes.body.data.totalPaid).toBe(500);
      expect(labourRes.body.data.balance).toBe(labourRes.body.data.totalEarned - 500);
    });

    it('should reflect worker in Dashboard reports', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.labour).toBeDefined();
      expect(res.body.data.labour.totalLabour).toBeGreaterThanOrEqual(1);
    });

    it('should enforce role permissions (SALES allowed, WAREHOUSE forbidden)', async () => {
      // Create fresh worker
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pooja Patil',
          address: 'Pune',
          mobile: '9876543244',
          dailyWage: 900,
        });
      const workerId = workerRes.body.data.id;

      // SALES allowed
      const salesRes = await request(app)
        .post(`/api/projects/${activeProjectBId}/labours`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          labourId: workerId,
        });
      expect(salesRes.status).toBe(200);

      // Create another worker for warehouse test
      const worker2Res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Nitin Gore',
          address: 'Pune',
          mobile: '9876543255',
          dailyWage: 900,
        });
      const worker2Id = worker2Res.body.data.id;

      // WAREHOUSE forbidden
      const whRes = await request(app)
        .post(`/api/projects/${activeProjectBId}/labours`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          labourId: worker2Id,
        });
      expect(whRes.status).toBe(403);
    });
  });

  // ==================================================
  // PROJECT LABOUR ASSIGNMENT & EARNINGS ROOT CAUSE BUG AUDIT (TESTS 1 to 10)
  // ==================================================
  describe('Project-Specific Labour Assignment & Ledger Earnings Bug Fix (TESTS 1 to 10)', () => {
    let testProjectId: string;
    let testLabourId: string;
    let globalLabourId: string;

    beforeAll(async () => {
      // Create Project starting 27/09/2026
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-BUG-${Date.now()}`,
          name: 'Bug Audit Project',
          customer: customerId,
          siteAddress: 'Baner, Pune',
          startDate: '2026-09-27',
          status: 'IN_PROGRESS',
          budget: 500000,
        });
      expect(projRes.status).toBe(201);
      testProjectId = projRes.body.data.id;

      // Create Labour in directory with dailyWage = ₹500
      const labRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ashok Shinde',
          address: 'Pune',
          mobile: '9876543999',
          dailyWage: 500,
        });
      expect(labRes.status).toBe(201);
      testLabourId = labRes.body.data.id;
    });

    it('TEST 1: Project starts 27/09/2026. Assign labour with assignmentStartDate = 28/09/2026. Verify persisted project assignment date is 28/09/2026.', async () => {
      const assignRes = await request(app)
        .post(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: testLabourId,
          startDate: '2026-09-28',
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.success).toBe(true);

      // Verify in DB directly
      const doc = await Labour.findById(testLabourId).lean();
      expect(doc).toBeDefined();
      expect(doc?.assignmentStartDate).toBeDefined();
      const persistedIso = new Date(doc!.assignmentStartDate!).toISOString().slice(0, 10);
      expect(persistedIso).toBe('2026-09-28');
    });

    it("TEST 2: Verify ProjectDetails/project labour API returns 28/09/2026 rather than today's date.", async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const worker = res.body.data.find((l: any) => l.id === testLabourId);
      expect(worker).toBeDefined();

      const todayStr = new Date().toISOString().slice(0, 10);
      const returnedStart = new Date(worker.startDate).toISOString().slice(0, 10);
      const returnedAssignmentStart = new Date(worker.assignmentStartDate).toISOString().slice(0, 10);

      expect(returnedStart).toBe('2026-09-28');
      expect(returnedAssignmentStart).toBe('2026-09-28');
      if (todayStr !== '2026-09-28') {
        expect(returnedStart).not.toBe(todayStr);
      }
    });

    it('TEST 3: Active labour: assignmentStartDate = 28/09/2026, today = 02/10/2026, dailyWage = ₹500 -> earnedDays = 5, totalEarned = ₹2,500', () => {
      const calc = calculateLabourEarned(
        {
          assignmentStartDate: new Date('2026-09-28T00:00:00.000Z'),
          dailyWage: 500,
          status: 'ACTIVE',
        },
        new Date('2026-10-02T12:00:00.000Z'),
        true // isProjectContext
      );

      expect(calc.earnedDays).toBe(5);
      expect(calc.totalEarned).toBe(2500);
    });

    it("TEST 4: Verify the Labour's global/master startDate is NOT incorrectly replaced by the project assignment date.", async () => {
      // Create Labour worker with global startDate = 2026-09-20 (master directory)
      const workerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Master Worker Test 4',
          address: 'Mumbai',
          mobile: '9876543888',
          dailyWage: 600,
        });
      globalLabourId = workerRes.body.data.id;

      // Update labour to give them a master startDate = 2026-09-20
      await request(app)
        .put(`/api/labours/${globalLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: '2026-09-20',
        });

      // Verify master record has startDate = 2026-09-20
      const beforeDoc = await Labour.findById(globalLabourId).lean();
      expect(new Date(beforeDoc!.startDate!).toISOString().slice(0, 10)).toBe('2026-09-20');

      // Assign to Project (project starts 2026-09-27) with project assignment date 2026-09-28
      const assignRes = await request(app)
        .post(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: globalLabourId,
          startDate: '2026-09-28',
        });
      expect(assignRes.status).toBe(200);

      // Verify in DB directly: master startDate is preserved as 2026-09-20!
      const afterDoc = await Labour.findById(globalLabourId).lean();
      expect(new Date(afterDoc!.startDate!).toISOString().slice(0, 10)).toBe('2026-09-20');
      // While assignmentStartDate is 2026-09-28
      expect(new Date(afterDoc!.assignmentStartDate!).toISOString().slice(0, 10)).toBe('2026-09-28');

      // Check global labour API (/api/labours/:id) returns the active assignment startDate (2026-09-28)
      const globalGetRes = await request(app)
        .get(`/api/labours/${globalLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(new Date(globalGetRes.body.data.startDate).toISOString().slice(0, 10)).toBe('2026-09-28');
    });

    it('TEST 5: Project assignment date before project start date -> rejected.', async () => {
      // testProjectId startDate is 2026-09-27
      const freshLab = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Early Date Test Worker',
          address: 'Pune',
          mobile: '9876543777',
          dailyWage: 500,
        });

      const res = await request(app)
        .post(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: freshLab.body.data.id,
          startDate: '2026-09-26', // Before 2026-09-27
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/earlier than project.*start date/i);
    });

    it('TEST 6: Future assignment date -> rejected.', async () => {
      const freshLab = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Future Date Test Worker',
          address: 'Pune',
          mobile: '9876543776',
          dailyWage: 500,
        });

      const futureDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: freshLab.body.data.id,
          startDate: futureDate,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/future/i);
    });

    it('TEST 7: Assignment date equal to project start date -> accepted.', async () => {
      const freshLab = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Exact Project Start Worker',
          address: 'Pune',
          mobile: '9876543775',
          dailyWage: 500,
        });

      const res = await request(app)
        .post(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: freshLab.body.data.id,
          startDate: '2026-09-27', // Exactly equals project startDate
        });

      expect(res.status).toBe(200);
      expect(new Date(res.body.data.startDate).toISOString().slice(0, 10)).toBe('2026-09-27');
    });

    it('TEST 8: Assignment date equal to today -> accepted.', async () => {
      const freshLab = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Today Date Worker',
          address: 'Pune',
          mobile: '9876543774',
          dailyWage: 500,
        });

      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: freshLab.body.data.id,
          startDate: todayStr,
        });

      expect(res.status).toBe(200);
      expect(new Date(res.body.data.startDate).toISOString().slice(0, 10)).toBe(todayStr);
    });

    it('TEST 9: Stopped labour: assignmentStartDate = 28/09/2026, stoppedAt = 30/09/2026, dailyWage = ₹500 -> earnedDays = 3, totalEarned = ₹1,500', () => {
      const calc = calculateLabourEarned(
        {
          assignmentStartDate: new Date('2026-09-28T00:00:00.000Z'),
          stoppedAt: new Date('2026-09-30T18:00:00.000Z'),
          dailyWage: 500,
          status: 'STOPPED',
        },
        new Date('2026-10-02T12:00:00.000Z'),
        true // isProjectContext
      );

      expect(calc.earnedDays).toBe(3);
      expect(calc.totalEarned).toBe(1500);
    });

    it('TEST 10: If a labour has a different global startDate, verify the project-specific assignment date is still used for Project Labour earnings.', async () => {
      // In TEST 4, globalLabourId had master startDate = 2026-09-20 and project assignmentStartDate = 2026-09-28
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const worker = res.body.data.find((l: any) => l.id === globalLabourId);
      expect(worker).toBeDefined();

      // Project labour API returns project-specific start date:
      expect(new Date(worker.startDate).toISOString().slice(0, 10)).toBe('2026-09-28');
      expect(new Date(worker.assignmentStartDate).toISOString().slice(0, 10)).toBe('2026-09-28');

      // Verify that calculateLabourEarned for this worker in project context uses assignmentStartDate (2026-09-28), not global startDate (2026-09-20)
      const projectCalc = calculateLabourEarned(worker, new Date('2026-10-02T12:00:00.000Z'), true);
      expect(projectCalc.earnedDays).toBe(5); // 28, 29, 30 Sept, 1, 2 Oct = 5 days (NOT 13 days from 20/09)
      expect(projectCalc.totalEarned).toBe(5 * 600); // 3000
    });
  });
});
