import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Project } from '../../src/models/Project';
import { Customer } from '../../src/models/Customer';
import { Labour } from '../../src/models/Labour';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour API Integration Tests (Phase 2)', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;

  let testCustomerId: string;
  let testProjectId1: string;
  let testProjectId2: string;
  let createdLabourId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // Create a customer fixture for project linkage
    const customer = await createTestCustomer({
      name: 'Labour Test Customer',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Labour Contracting Pvt Ltd',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Shivajinagar, Pune',
    });
    testCustomerId = customer._id.toString();

    // Create Project 1
    const project1Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-L1-${Date.now()}`,
        name: 'Office Renovation Project',
        customer: testCustomerId,
        siteAddress: 'Senapati Bapat Road, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    testProjectId1 = project1Res.body.data.id;

    // Create Project 2 (for project switch update test)
    const project2Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-L2-${Date.now()}`,
        name: 'Commercial Warehouse Phase 2',
        customer: testCustomerId,
        siteAddress: 'Chakan MIDC, Pune',
        startDate: '2026-10-01',
        status: 'IN_PROGRESS',
      });
    testProjectId2 = project2Res.body.data.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await Labour.deleteMany({ projectId: { $in: [testProjectId1, testProjectId2] } });
    await Project.deleteMany({ _id: { $in: [testProjectId1, testProjectId2] } });
    if (testCustomerId) {
      await Customer.findByIdAndDelete(testCustomerId);
    }
  });

  // ==========================================
  // CREATE TESTS (Requirements 1 - 13 + Auth)
  // ==========================================
  describe('POST /api/labours - Create Labour', () => {
    it('1. should successfully create valid labour with ADMIN role', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 800,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Rajesh Kumar');
      expect(res.body.data.mobile).toBe('9876543210');
      expect(res.body.data.location).toBe('Pune');
      expect(res.body.data.projectId).toBe(testProjectId1);
      expect(res.body.data.dailyWage).toBe(800);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.stoppedAt).toBeNull();
      expect(res.body.data.project).toBeDefined();
      expect(res.body.data.project.name).toBe('Office Renovation Project');

      createdLabourId = res.body.data.id;
    });

    it('should successfully create valid labour with SALES role', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'Suresh Patil',
          mobile: '9123456780',
          location: 'Pimpri',
          projectId: testProjectId1,
          dailyWage: 750,
          startDate: '2026-09-22',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Suresh Patil');
    });

    it('should forbid WAREHOUSE and ACCOUNTS roles from creating labour', async () => {
      const payload = {
        name: 'Unauthorized Worker',
        mobile: '9000000000',
        location: 'Pune',
        projectId: testProjectId1,
        dailyWage: 600,
        startDate: '2026-09-21',
      };

      const resWarehouse = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send(payload);
      expect(resWarehouse.status).toBe(403);

      const resAccounts = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send(payload);
      expect(resAccounts.status).toBe(403);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/labours')
        .send({
          name: 'No Auth Worker',
          mobile: '9000000000',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 600,
          startDate: '2026-09-21',
        });
      expect(res.status).toBe(401);
    });

    it('2. should reject when name is missing', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mobile: '9876543210',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 800,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors?.name || res.body.message).toBeDefined();
    });

    it('3. should reject when mobile is missing', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 800,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('4. should reject when location is missing', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          projectId: testProjectId1,
          dailyWage: 800,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('5. should allow creating labour without projectId (unassigned master record)', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Unassigned',
          mobile: '9876543210',
          location: 'Pune',
          dailyWage: 800,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.projectId).toBeFalsy();
      expect(res.body.data.project).toBeFalsy();
    });

    it('6. should reject when projectId is invalid format', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          projectId: 'invalid-object-id',
          dailyWage: 800,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('7. should reject when referenced project does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          projectId: nonExistentId,
          dailyWage: 800,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/project not found/i);
    });

    it('8. should reject when dailyWage is missing', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          projectId: testProjectId1,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('9. should reject when dailyWage is 0', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 0,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('10. should reject when dailyWage is negative', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: -500,
          startDate: '2026-09-21',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('11. should ignore client-supplied startDate on creation and keep unassigned startDate null', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar',
          mobile: '9876543210',
          location: 'Pune',
          dailyWage: 800,
          startDate: '2020-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.startDate).toBeNull();
    });

    it('12. should establish ACTIVE status even if client attempts to pass STOPPED on creation', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Status Test Worker',
          mobile: '9876543211',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 700,
          startDate: '2026-09-21',
          status: 'STOPPED',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('13. should establish stoppedAt = null on creation even if client passes a date', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'StoppedAt Test Worker',
          mobile: '9876543212',
          location: 'Pune',
          projectId: testProjectId1,
          dailyWage: 700,
          startDate: '2026-09-21',
          stoppedAt: '2026-09-25',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.stoppedAt).toBeNull();
    });
  });

  // ==========================================
  // GET TESTS (Requirements 14 - 17 + Auth)
  // ==========================================
  describe('GET /api/labours - List Labours', () => {
    it('14. should allow all authenticated roles to list labours', async () => {
      for (const token of [adminToken, salesToken, warehouseToken, accountsToken]) {
        const res = await request(app)
          .get('/api/labours')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        // Verify population of project details and calculated wages (Phase 6)
        const found = res.body.data.find((l: any) => l.id === createdLabourId);
        expect(found).toBeDefined();
        expect(found.project).toHaveProperty('name', 'Office Renovation Project');
        expect(found).toHaveProperty('earnedDays');
        expect(typeof found.earnedDays).toBe('number');
        expect(found).toHaveProperty('totalEarned');
        expect(typeof found.totalEarned).toBe('number');
      }
    });

    it('should filter labours by projectId, status, and search query', async () => {
      const resFilter = await request(app)
        .get(`/api/labours?projectId=${testProjectId1}&status=ACTIVE&search=Rajesh`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resFilter.status).toBe(200);
      expect(resFilter.body.data.length).toBeGreaterThan(0);
      expect(resFilter.body.data[0].name).toContain('Rajesh');
    });

    it('should return 401 when listing labours unauthenticated', async () => {
      const res = await request(app).get('/api/labours');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labours/:id - Single Labour Details', () => {
    it('15. should retrieve single labour details by valid ID with populated project and calculated wages', async () => {
      const res = await request(app)
        .get(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdLabourId);
      expect(res.body.data.name).toBe('Rajesh Kumar');
      expect(res.body.data.project).toHaveProperty('name', 'Office Renovation Project');
      expect(res.body.data.project).toHaveProperty('siteAddress', 'Senapati Bapat Road, Pune');
      // Phase 6 wage calculation assertions
      expect(res.body.data).toHaveProperty('earnedDays');
      expect(typeof res.body.data.earnedDays).toBe('number');
      expect(res.body.data.earnedDays).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('totalEarned');
      expect(typeof res.body.data.totalEarned).toBe('number');
      expect(res.body.data.totalEarned).toBe(res.body.data.earnedDays * res.body.data.dailyWage);
    });

    it('16. should return 404 for non-existent labour ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/labours/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/labour not found/i);
    });

    it('17. should return 400 for invalid labour ID format', async () => {
      const res = await request(app)
        .get('/api/labours/invalid-id-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // UPDATE TESTS (Requirements 18 - 26 + Auth)
  // ==========================================
  describe('PUT /api/labours/:id - Update Labour', () => {
    it('18. should update labour name', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Rajesh V. Kumar' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Rajesh V. Kumar');
    });

    it('19. should update labour mobile', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ mobile: '9988776655' });

      expect(res.status).toBe(200);
      expect(res.body.data.mobile).toBe('9988776655');
    });

    it('20. should update labour location', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ location: 'Kothrud, Pune' });

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBe('Kothrud, Pune');
    });

    it('21. should update labour project and populate new project info', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId: testProjectId2 });

      expect(res.status).toBe(200);
      expect(res.body.data.projectId).toBe(testProjectId2);
      expect(res.body.data.project.name).toBe('Commercial Warehouse Phase 2');
    });

    it('22. should update labour dailyWage', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dailyWage: 950 });

      expect(res.status).toBe(200);
      expect(res.body.data.dailyWage).toBe(950);
    });

    it('23. should update labour startDate', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ startDate: '2026-10-01' });

      expect(res.status).toBe(200);
      expect(new Date(res.body.data.startDate).toISOString().slice(0, 10)).toBe('2026-10-01');
    });

    it('24. should reject update with non-existent project', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId: nonExistentId });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/project not found/i);
    });

    it('24b. should reject update with invalid projectId format', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId: 'invalid-id' });

      expect(res.status).toBe(400);
    });

    it('25. should ignore/not modify status through normal update endpoint', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Kumar Reverified',
          status: 'STOPPED',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Rajesh Kumar Reverified');
      // Status must NOT have been changed to STOPPED
      expect(res.body.data.status).toBe('ACTIVE');

      // Verify in DB directly
      const dbDoc = await Labour.findById(createdLabourId);
      expect(dbDoc?.status).toBe('ACTIVE');
    });

    it('26. should ignore/not modify stoppedAt through normal update endpoint', async () => {
      const res = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stoppedAt: '2026-10-05T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.stoppedAt).toBeNull();

      // Verify in DB directly
      const dbDoc = await Labour.findById(createdLabourId);
      expect(dbDoc?.stoppedAt).toBeNull();
    });

    it('should forbid WAREHOUSE and ACCOUNTS roles from updating labour', async () => {
      const resW = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ name: 'Hacked Worker' });
      expect(resW.status).toBe(403);

      const resA = await request(app)
        .put(`/api/labours/${createdLabourId}`)
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({ name: 'Hacked Worker' });
      expect(resA.status).toBe(403);
    });

    it('should NOT reactivate a STOPPED labour when updated via normal PUT', async () => {
      // Create a stopped labour directly
      const stoppedLabour = await Labour.create({
        name: 'Pre-stopped Worker',
        mobile: '9811223344',
        location: 'Nashik',
        projectId: testProjectId1,
        dailyWage: 750,
        startDate: new Date('2026-09-01'),
        status: 'STOPPED',
        stoppedAt: new Date('2026-09-25T10:00:00.000Z'),
      });

      const res = await request(app)
        .put(`/api/labours/${stoppedLabour._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dailyWage: 950,
          location: 'Thane',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dailyWage).toBe(950);
      expect(res.body.data.location).toBe('Thane');
      expect(res.body.data.status).toBe('INACTIVE');
      expect(new Date(res.body.data.stoppedAt).toISOString()).toBe('2026-09-25T10:00:00.000Z');

      // Verify directly in DB
      const dbCheck = await Labour.findById(stoppedLabour._id);
      expect(dbCheck?.status).toBe('STOPPED');
      expect(dbCheck?.stoppedAt?.toISOString()).toBe('2026-09-25T10:00:00.000Z');
    });

    it('should NOT modify stoppedAt on a STOPPED labour when updated via normal PUT', async () => {
      const stoppedDate = new Date('2026-09-20T12:00:00.000Z');
      const stoppedLabour = await Labour.create({
        name: 'Worker With Fixed StoppedAt',
        mobile: '9822334455',
        location: 'Solapur',
        projectId: testProjectId1,
        dailyWage: 700,
        startDate: new Date('2026-09-01'),
        status: 'STOPPED',
        stoppedAt: stoppedDate,
      });

      const res = await request(app)
        .put(`/api/labours/${stoppedLabour._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Renamed Stopped Worker',
          stoppedAt: '2026-10-15T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed Stopped Worker');
      expect(res.body.data.status).toBe('INACTIVE');
      expect(new Date(res.body.data.stoppedAt).toISOString()).toBe(stoppedDate.toISOString());

      const dbCheck = await Labour.findById(stoppedLabour._id);
      expect(dbCheck?.stoppedAt?.toISOString()).toBe(stoppedDate.toISOString());
    });
  });

  // ==========================================
  // STOP LABOUR TESTS (Phase 5 - Step 16)
  // ==========================================
  describe('PATCH /api/labours/:id/stop - Stop Labour', () => {
    let activeLabourId: string;
    let salesActiveLabourId: string;

    beforeEach(async () => {
      const doc1 = await Labour.create({
        name: 'Worker To Stop Admin',
        mobile: '9765432101',
        location: 'Pune',
        projectId: testProjectId1,
        dailyWage: 800,
        startDate: new Date('2026-09-10'),
        status: 'ACTIVE',
        stoppedAt: null,
      });
      activeLabourId = doc1._id.toString();

      const doc2 = await Labour.create({
        name: 'Worker To Stop Sales',
        mobile: '9765432102',
        location: 'Pune',
        projectId: testProjectId1,
        dailyWage: 850,
        startDate: new Date('2026-09-10'),
        status: 'ACTIVE',
        stoppedAt: null,
      });
      salesActiveLabourId = doc2._id.toString();
    });

    it('1. should allow ACTIVE labour to be stopped with ADMIN role', async () => {
      const beforeTime = new Date(Date.now() - 1000);
      const res = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      const afterTime = new Date(Date.now() + 1000);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/stopped successfully/i);

      // 2. Status changed from ACTIVE to INACTIVE
      expect(res.body.data.status).toBe('INACTIVE');

      // 3. stoppedAt is set
      expect(res.body.data.stoppedAt).not.toBeNull();
      const stoppedAtDate = new Date(res.body.data.stoppedAt);
      expect(stoppedAtDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(stoppedAtDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());

      // DB check
      const dbDoc = await Labour.findById(activeLabourId);
      expect(dbDoc?.status).toBe('INACTIVE');
      expect(dbDoc?.stoppedAt).not.toBeNull();
    });

    it('should allow ACTIVE labour to be stopped with SALES role', async () => {
      const res = await request(app)
        .patch(`/api/labours/${salesActiveLabourId}/stop`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('INACTIVE');
      expect(res.body.data.stoppedAt).not.toBeNull();
    });

    it('4. stoppedAt is generated by backend and ignores client-provided value', async () => {
      const fakeClientDate = '2020-01-01T00:00:00.000Z';
      const beforeTime = new Date(Date.now() - 1000);

      const res = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stoppedAt: fakeClientDate });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');
      // Must not match fake client date
      expect(res.body.data.stoppedAt).not.toBe(fakeClientDate);
      const actualStopped = new Date(res.body.data.stoppedAt);
      expect(actualStopped.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });

    it('11. Stop endpoint does not require client-provided body', async () => {
      const res = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');
    });

    it('5. should return 404 when stopping non-existent labour', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/labours/${nonExistentId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('6. should return 400 when stopping with invalid labour ID format', async () => {
      const res = await request(app)
        .patch('/api/labours/invalid-id-format/stop')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid.*id/i);
    });

    it('7. should return 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`);

      expect(res.status).toBe(401);
    });

    it('8. should return 403 for unauthorized roles (WAREHOUSE, ACCOUNTS)', async () => {
      const resW = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(resW.status).toBe(403);

      const resA = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${accountsToken}`);
      expect(resA.status).toBe(403);
    });

    it('9. & 10. Already STOPPED labour cannot be stopped again and existing stoppedAt remains unchanged', async () => {
      // First stop the labour
      const firstStopRes = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(firstStopRes.status).toBe(200);
      const originalStoppedAt = firstStopRes.body.data.stoppedAt;
      expect(originalStoppedAt).not.toBeNull();

      // Second attempt to stop the same labour
      const secondStopRes = await request(app)
        .patch(`/api/labours/${activeLabourId}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondStopRes.status).toBe(400);
      expect(secondStopRes.body.success).toBe(false);
      expect(secondStopRes.body.message).toMatch(/already stopped|only active/i);

      // Verify in DB that status is still INACTIVE and stoppedAt was NOT changed
      const dbDoc = await Labour.findById(activeLabourId);
      expect(dbDoc?.status).toBe('INACTIVE');
      expect(dbDoc?.stoppedAt?.toISOString()).toBe(new Date(originalStoppedAt).toISOString());
    });
  });

  // ==========================================
  // DELETE TESTS (Requirement 27 + Auth)
  // ==========================================
  describe('DELETE /api/labours/:id - Delete Labour', () => {
    let labourToDeleteId: string;

    beforeEach(async () => {
      const labourDoc = await Labour.create({
        name: 'Temporary Worker for Deletion',
        mobile: '9900990099',
        location: 'Pune',
        projectId: testProjectId1,
        dailyWage: 600,
        startDate: new Date('2026-09-21'),
        status: 'ACTIVE',
        stoppedAt: null,
      });
      labourToDeleteId = labourDoc._id.toString();
    });

    it('27. should forbid non-ADMIN roles from deleting labour', async () => {
      const resSales = await request(app)
        .delete(`/api/labours/${labourToDeleteId}`)
        .set('Authorization', `Bearer ${salesToken}`);
      expect(resSales.status).toBe(403);

      const resWarehouse = await request(app)
        .delete(`/api/labours/${labourToDeleteId}`)
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(resWarehouse.status).toBe(403);

      const resAccounts = await request(app)
        .delete(`/api/labours/${labourToDeleteId}`)
        .set('Authorization', `Bearer ${accountsToken}`);
      expect(resAccounts.status).toBe(403);
    });

    it('27. should allow ADMIN to delete labour', async () => {
      const res = await request(app)
        .delete(`/api/labours/${labourToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted successfully/i);

      // Verify subsequent GET returns 404
      const verifyRes = await request(app)
        .get(`/api/labours/${labourToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(verifyRes.status).toBe(404);
    });

    it('should return 404 when deleting non-existent labour', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/labours/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 when deleting with invalid ID format', async () => {
      const res = await request(app)
        .delete('/api/labours/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });
});
