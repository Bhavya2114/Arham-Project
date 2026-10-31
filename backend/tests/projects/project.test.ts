import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Projects API integration tests (Phase 7.1)', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;
  let customerId: string;
  let createdProjectId: string;
  let createdProjectCode: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');

    // Create a customer fixture for testing projects
    const customer = await createTestCustomer({
      name: 'ABC Developers',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `abc_${Date.now()}@abcdev.com`,
      businessName: 'ABC Developers Pvt Ltd',
      gstNumber: '27ABCDE1234F1Z5',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'MG Road, Pune',
    });
    customerId = customer._id.toString();
  });

  describe('POST /api/projects - Create Project', () => {
    it('should create a valid project with ADMIN role', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: 'PRJ-2026-001',
          name: 'XYZ Building Construction',
          customer: customerId,
          siteAddress: 'Baner, Pune, Maharashtra',
          startDate: '2026-06-01',
          expectedEndDate: '2026-12-31',
          status: 'PLANNING',
          budget: 5000000,
          notes: 'Phase 1 construction project',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.projectCode).toMatch(/^PRJ-\d{4}-\d{3,}$/);
      expect(res.body.data.name).toBe('XYZ Building Construction');
      expect(res.body.data.customer.name).toBe('ABC Developers');
      expect(res.body.data.budget).toBe(5000000);

      createdProjectId = res.body.data.id;
      createdProjectCode = res.body.data.projectCode;
    });

    it('should create a valid project with SALES role', async () => {
      const code = `PRJ-S-${Date.now()}`;
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          projectCode: code,
          name: 'PMRDA Bridge Extension',
          customer: customerId,
          siteAddress: 'Hinjewadi, Pune',
          startDate: '2026-07-01',
          status: 'IN_PROGRESS',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.projectCode).toMatch(/^PRJ-\d{4}-\d{3,}$/);
    });

    it('should create a valid project without customer', async () => {
      const code = `PRJ-NOCUST-${Date.now()}`;
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: code,
          name: 'Direct Contractor Site',
          siteAddress: 'Baner, Pune',
          startDate: '2026-08-01',
          budget: 2500000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.projectCode).toMatch(/^PRJ-\d{4}-\d{3,}$/);
    });

    it('should forbid WAREHOUSE and ACCOUNTS from creating projects', async () => {
      const resW = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          projectCode: 'PRJ-FAIL-W',
          name: 'Unauthorized Project',
          customer: customerId,
          siteAddress: 'Test Address',
          startDate: '2026-06-01',
        });
      expect(resW.status).toBe(403);

      const resA = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          projectCode: 'PRJ-FAIL-A',
          name: 'Unauthorized Project',
          customer: customerId,
          siteAddress: 'Test Address',
          startDate: '2026-06-01',
        });
      expect(resA.status).toBe(403);
    });

    it('should return 401 when request is unauthorized', async () => {
      const res = await request(app).post('/api/projects').send({
        projectCode: 'PRJ-NOAUTH',
        name: 'No Auth Project',
        customer: customerId,
        siteAddress: 'Test Address',
        startDate: '2026-06-01',
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: 'PRJ-MISSING',
        });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    it('should return 404 when referenced customer does not exist', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: 'PRJ-BAD-CUST',
          name: 'Bad Cust Project',
          customer: '60c72b2f9b1d8b2b1c8e4a11',
          siteAddress: 'Test Address',
          startDate: '2026-06-01',
        });
      expect(res.status).toBe(404);
    });

    it('should ignore a client-sent project code and generate a fresh one', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: createdProjectCode,
          name: 'Duplicate Code Project',
          customer: customerId,
          siteAddress: 'Test Address',
          startDate: '2026-06-01',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.projectCode).not.toBe(createdProjectCode);
      expect(res.body.data.projectCode).toMatch(/^PRJ-\d{4}-\d{3,}$/);
    });

    it('should return 400 when budget is negative', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: 'PRJ-NEG-BUDGET',
          name: 'Negative Budget Project',
          customer: customerId,
          siteAddress: 'Test Address',
          startDate: '2026-06-01',
          budget: -500,
        });
      expect(res.status).toBe(400);
    });

    it('should return 400 when expectedEndDate is before startDate', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: 'PRJ-BAD-DATES',
          name: 'Bad Dates Project',
          customer: customerId,
          siteAddress: 'Test Address',
          startDate: '2026-06-01',
          expectedEndDate: '2026-01-01',
        });
      expect(res.status).toBe(400);
      expect(res.body.details[0].message).toMatch(/cannot be before/i);
    });
  });

  describe('GET /api/projects - List Projects', () => {
    it('should allow all authenticated roles to list projects', async () => {
      const resAdmin = await request(app).get('/api/projects').set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(Array.isArray(resAdmin.body.data)).toBe(true);

      const resWarehouse = await request(app).get('/api/projects').set('Authorization', `Bearer ${warehouseToken}`);
      expect(resWarehouse.status).toBe(200);

      const resAccounts = await request(app).get('/api/projects').set('Authorization', `Bearer ${accountsToken}`);
      expect(resAccounts.status).toBe(200);
    });

    it('should filter projects by status and search query', async () => {
      const res = await request(app)
        .get('/api/projects?status=PLANNING&search=XYZ')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.map((p: any) => p.projectCode)).toContain(createdProjectCode);
    });
  });

  describe('GET /api/projects/:id - Get Single Project', () => {
    it('should retrieve project details with populated customer info', async () => {
      const res = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdProjectId);
      expect(res.body.data.customer).toHaveProperty('name', 'ABC Developers');
    });

    it('should return 404 for non-existent project ID', async () => {
      const res = await request(app)
        .get('/api/projects/60c72b2f9b1d8b2b1c8e4a11')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id - Update Project', () => {
    it('should update project details with ADMIN or SALES role', async () => {
      const res = await request(app)
        .put(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'XYZ Commercial Complex',
          status: 'IN_PROGRESS',
          budget: 6500000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('XYZ Commercial Complex');
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.budget).toBe(6500000);
    });
  });

  describe('DELETE /api/projects/:id - Delete Project', () => {
    it('should forbid non-ADMIN roles from deleting projects', async () => {
      const res = await request(app)
        .delete(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow ADMIN to delete project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const verifyRes = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(verifyRes.status).toBe(404);
    });
  });
});
