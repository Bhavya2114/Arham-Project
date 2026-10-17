import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('PHASE 10: Project ↔ Labour Integration Tests', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;

  let customerId: string;
  let projectAId: string;
  let projectBId: string;
  let projectZeroLabourId: string;

  let labourA1Id: string; // Active on Project A
  let labourA2Id: string; // Stopped on Project A
  let labourB1Id: string; // Active on Project B

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Metro Infrastructure Ltd',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Metro Infra',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Shivajinagar, Pune',
    });
    customerId = customer._id.toString();

    // Create Project A
    const pARes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-A-${Date.now()}`,
        name: 'Metro Station Phase 1',
        customer: customerId,
        siteAddress: 'Station Road, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 10000000,
      });
    expect(pARes.status).toBe(201);
    projectAId = pARes.body.data.id;

    // Create Project B
    const pBRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-B-${Date.now()}`,
        name: 'Airport Cargo Terminal',
        customer: customerId,
        siteAddress: 'Lohegaon, Pune',
        startDate: '2026-09-05',
        status: 'IN_PROGRESS',
        budget: 8000000,
      });
    expect(pBRes.status).toBe(201);
    projectBId = pBRes.body.data.id;

    // Create Project with Zero Labour
    const pZeroRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-ZERO-${Date.now()}`,
        name: 'Empty Site Project',
        customer: customerId,
        siteAddress: 'Kothrud, Pune',
        startDate: '2026-09-10',
        status: 'PLANNING',
        budget: 500000,
      });
    expect(pZeroRes.status).toBe(201);
    projectZeroLabourId = pZeroRes.body.data.id;
  });

  describe('1. Labour Assignment & Creation for Project', () => {
    it('should assign and create an ACTIVE Labour worker to Project A', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Vikas Shinde',
          mobile: '9822001122',
          location: 'Pune',
          projectId: projectAId,
          dailyWage: 800,
          startDate: '2026-09-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Vikas Shinde');
      expect(res.body.data.projectId).toBe(projectAId);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.dailyWage).toBe(800);
      expect(res.body.data.project.name).toBe('Metro Station Phase 1');

      labourA1Id = res.body.data.id;
    });

    it('should create another Labour worker on Project A that will later be stopped', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Sunil Jadhav',
          mobile: '9822334455',
          location: 'Pune',
          projectId: projectAId,
          dailyWage: 750,
          startDate: '2026-09-01',
        });

      expect(res.status).toBe(201);
      labourA2Id = res.body.data.id;
    });

    it('should assign and create a Labour worker to Project B', async () => {
      const res = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'Pooja Patil',
          mobile: '9822998877',
          location: 'Mumbai',
          projectId: projectBId,
          dailyWage: 900,
          startDate: '2026-09-05',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.projectId).toBe(projectBId);
      labourB1Id = res.body.data.id;
    });
  });

  describe('2. Project Labour Retrieval & Separation', () => {
    it('should retrieve Project A labours using GET /api/labours?projectId=<id>', async () => {
      const res = await request(app)
        .get(`/api/labours?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);

      const ids = res.body.data.map((l: any) => l.id);
      expect(ids).toContain(labourA1Id);
      expect(ids).toContain(labourA2Id);
      expect(ids).not.toContain(labourB1Id);
    });

    it('should retrieve Project A labours using GET /api/projects/:projectId/labours', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectAId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      const ids = res.body.data.map((l: any) => l.id);
      expect(ids).toContain(labourA1Id);
      expect(ids).toContain(labourA2Id);
    });

    it('should ensure Project A does NOT return Labour assigned to Project B', async () => {
      const resA = await request(app)
        .get(`/api/labours?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${salesToken}`);

      const resB = await request(app)
        .get(`/api/labours?projectId=${projectBId}`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const aIds = resA.body.data.map((l: any) => l.id);
      const bIds = resB.body.data.map((l: any) => l.id);

      expect(aIds).not.toContain(labourB1Id);
      expect(bIds).toContain(labourB1Id);
      expect(bIds).not.toContain(labourA1Id);
      expect(bIds).not.toContain(labourA2Id);
    });

    it('should return an empty array for a project with zero labour', async () => {
      const resQuery = await request(app)
        .get(`/api/labours?projectId=${projectZeroLabourId}`)
        .set('Authorization', `Bearer ${accountsToken}`);

      expect(resQuery.status).toBe(200);
      expect(resQuery.body.data).toEqual([]);

      const resRoute = await request(app)
        .get(`/api/projects/${projectZeroLabourId}/labours`)
        .set('Authorization', `Bearer ${accountsToken}`);

      expect(resRoute.status).toBe(200);
      expect(resRoute.body.data).toEqual([]);
    });
  });

  describe('3. Lifecycle: Active and Stopped Labour in Project', () => {
    it('should verify active labour appears in project with status ACTIVE', async () => {
      const res = await request(app)
        .get(`/api/labours?projectId=${projectAId}&status=ACTIVE`)
        .set('Authorization', `Bearer ${warehouseToken}`);

      expect(res.status).toBe(200);
      const activeLabours = res.body.data;
      const worker = activeLabours.find((l: any) => l.id === labourA1Id);
      expect(worker).toBeDefined();
      expect(worker.status).toBe('ACTIVE');
      expect(worker.stoppedAt).toBeNull();
    });

    it('should stop labourA2 and verify it remains associated with Project A with status STOPPED', async () => {
      // Stop worker
      const stopRes = await request(app)
        .patch(`/api/labours/${labourA2Id}/stop`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(stopRes.status).toBe(200);
      expect(stopRes.body.data.status).toBe('INACTIVE');
      expect(stopRes.body.data.stoppedAt).toBeTruthy();

      // Retrieve Project A labours again
      const projectLaboursRes = await request(app)
        .get(`/api/labours?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(projectLaboursRes.status).toBe(200);
      const stoppedWorker = projectLaboursRes.body.data.find((l: any) => l.id === labourA2Id);
      expect(stoppedWorker).toBeDefined();
      expect(stoppedWorker.status).toBe('STOPPED');
      expect(stoppedWorker.stoppedAt).toBeTruthy();
      expect(stoppedWorker.projectId).toBe(projectAId);
      expect(stoppedWorker.project.name).toBe('Metro Station Phase 1');
    });
  });

  describe('4. Financial Fields & Payment Integration in Project Context', () => {
    it('should return correct derived financial fields (earnedDays, totalEarned, totalPaid, balance)', async () => {
      const res = await request(app)
        .get(`/api/labours?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const worker = res.body.data.find((l: any) => l.id === labourA1Id);

      expect(worker).toBeDefined();
      expect(worker.earnedDays).toBeGreaterThan(0);
      expect(worker.totalEarned).toBe(worker.earnedDays * worker.dailyWage);
      expect(worker.totalPaid).toBe(0);
      expect(worker.balance).toBe(worker.totalEarned);
    });

    it('should reflect recorded payments in totalPaid and balance when retrieved via project', async () => {
      // Record a payment of ₹2000 for labourA1
      const payRes = await request(app)
        .post('/api/labour-payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labourId: labourA1Id,
          amount: 2000,
          paymentDate: '2026-09-15',
          paymentMethod: 'CASH',
          notes: 'Advance site payment',
        });

      expect(payRes.status).toBe(201);

      // Verify via GET /api/labours?projectId=
      const res = await request(app)
        .get(`/api/labours?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const worker = res.body.data.find((l: any) => l.id === labourA1Id);
      expect(worker.totalPaid).toBe(2000);
      expect(worker.balance).toBe(worker.totalEarned - 2000);
    });
  });

  describe('5. Error Handling & Invalid Project ID', () => {
    it('should safely return empty array when query parameter projectId is invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/labours?projectId=invalid-format-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return 400 when route param projectId in /api/projects/:projectId/labours is invalid format', async () => {
      const res = await request(app)
        .get('/api/projects/not-an-objectid/labours')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid project ID');
    });

    it('should return 404 when route param projectId in /api/projects/:projectId/labours does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/projects/${fakeId}/labours`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Project not found');
    });
  });

  describe('6. Authorization Rules', () => {
    it('should reject unauthenticated requests to project labours', async () => {
      const res1 = await request(app).get(`/api/labours?projectId=${projectAId}`);
      expect(res1.status).toBe(401);

      const res2 = await request(app).get(`/api/projects/${projectAId}/labours`);
      expect(res2.status).toBe(401);
    });

    it('should allow WAREHOUSE and ACCOUNTS roles to view project labours', async () => {
      const resWh = await request(app)
        .get(`/api/projects/${projectAId}/labours`)
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(resWh.status).toBe(200);

      const resAcc = await request(app)
        .get(`/api/projects/${projectAId}/labours`)
        .set('Authorization', `Bearer ${accountsToken}`);
      expect(resAcc.status).toBe(200);
    });

    it('should forbid ACCOUNTS role from creating or stopping labour', async () => {
      const createRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          name: 'Unauthorized Worker',
          mobile: '9800000000',
          location: 'Pune',
          projectId: projectAId,
          dailyWage: 500,
          startDate: '2026-09-01',
        });
      expect(createRes.status).toBe(403);

      const stopRes = await request(app)
        .patch(`/api/labours/${labourA1Id}/stop`)
        .set('Authorization', `Bearer ${accountsToken}`);
      expect(stopRes.status).toBe(403);
    });
  });

  describe('7. Project Deletion Safety (No Cascading Destruction)', () => {
    it('should safely preserve Labour records if associated project is deleted', async () => {
      // Create a temporary project
      const tempProjectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: `PRJ-TEMP-${Date.now()}`,
          name: 'Temporary Demolition Site',
          customer: customerId,
          siteAddress: 'Hadapsar, Pune',
          startDate: '2026-09-01',
          status: 'PLANNING',
        });
      expect(tempProjectRes.status).toBe(201);
      const tempProjectId = tempProjectRes.body.data.id;

      // Assign a worker to this temporary project
      const tempWorkerRes = await request(app)
        .post('/api/labours')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Anand Shrestha',
          mobile: '9833445566',
          location: 'Pune',
          projectId: tempProjectId,
          dailyWage: 600,
          startDate: '2026-09-01',
        });
      expect(tempWorkerRes.status).toBe(201);
      const tempWorkerId = tempWorkerRes.body.data.id;

      // Delete the temporary project
      const delProjRes = await request(app)
        .delete(`/api/projects/${tempProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delProjRes.status).toBe(200);

      // Verify the Labour worker was NOT deleted and still exists with financial history
      const getWorkerRes = await request(app)
        .get(`/api/labours/${tempWorkerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getWorkerRes.status).toBe(200);
      expect(getWorkerRes.body.data.id).toBe(tempWorkerId);
      expect(getWorkerRes.body.data.name).toBe('Anand Shrestha');
      expect(getWorkerRes.body.data.dailyWage).toBe(600);
      expect(getWorkerRes.body.data.totalEarned).toBeGreaterThan(0);
      // Project reference gracefully resolved without crashing
      expect(getWorkerRes.body.data.project).toBeUndefined();
    });
  });
});
