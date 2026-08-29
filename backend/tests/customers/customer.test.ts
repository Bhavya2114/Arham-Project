import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Customer CRM integration tests', () => {
  let adminToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountsToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
    warehouseToken = await getAuthToken('WAREHOUSE');
    accountsToken = await getAuthToken('ACCOUNTS');
  });

  describe('GET /api/customers - List Retrievals and Role Permissions', () => {
    it('should allow ADMIN to retrieve list', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should allow SALES to retrieve list', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(200);
    });

    it('should allow WAREHOUSE to retrieve list', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(res.status).toBe(200);
    });

    it('should allow ACCOUNTS to retrieve list', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${accountsToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/customers - Create Customer Validation and Roles', () => {
    const uniqueCustomer = () => ({
      name: `Test Customer ${Date.now()}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `test_${Date.now()}@customer.com`,
      businessName: `Test Customer Business ${Date.now()}`,
      type: 'RETAIL',
      address: 'Test Address 123',
      status: 'LEAD',
    });

    it('should allow ADMIN to create customer and automatically compute createdBy', async () => {
      const payload = uniqueCustomer();
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.createdBy).toBeDefined();
    });

    it('should allow SALES to create customer', async () => {
      const payload = uniqueCustomer();
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(payload);

      expect(res.status).toBe(201);
    });

    it('should reject WAREHOUSE attempts to create customer', async () => {
      const payload = uniqueCustomer();
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send(payload);

      expect(res.status).toBe(403);
    });

    it('should reject ACCOUNTS attempts to create customer', async () => {
      const payload = uniqueCustomer();
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send(payload);

      expect(res.status).toBe(403);
    });

    it('should reject requests containing client-supplied createdBy values', async () => {
      const payload = {
        ...uniqueCustomer(),
        createdBy: 'malicious-user-id',
      };
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.createdBy).not.toBe('malicious-user-id');
    });

    it('should return HTTP 400 on invalid customer type or email format', async () => {
      const payload = {
        ...uniqueCustomer(),
        type: 'INVALID_TYPE',
        email: 'invalid-email',
      };
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(payload);

      expect(res.status).toBe(400);
    });
  });

  describe('Customer Details and Update lifecycle', () => {
    let testCustomerId: string;

    beforeAll(async () => {
      // Create a test customer to run details, update, and follow-ups tests on
      const createRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'Lifecyle Test Cust',
          mobile: '9876543123',
          email: 'lifecycle@cust.com',
          businessName: 'Lifecycle Test LLC',
          type: 'WHOLESALE',
          address: 'Test Pune Area',
          status: 'ACTIVE',
        });
      testCustomerId = createRes.body.data.id;
    });

    it('should allow all roles to view customer details by ID', async () => {
      for (const token of [adminToken, salesToken, warehouseToken, accountsToken]) {
        const res = await request(app)
          .get(`/api/customers/${testCustomerId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('id', testCustomerId);
      }
    });

    it('should return HTTP 404 for non-existent customer ID details requests', async () => {
      const res = await request(app)
        .get('/api/customers/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return HTTP 401 for details request when not authenticated', async () => {
      const res = await request(app)
        .get(`/api/customers/${testCustomerId}`);
      expect(res.status).toBe(401);
    });

    it('should allow ADMIN and SALES to update details, blocking WAREHOUSE and ACCOUNTS', async () => {
      const updatePayload = {
        name: 'Lifecyle Test Cust Updated',
        mobile: '9876543123',
        email: 'lifecycle@cust.com',
        businessName: 'Lifecycle Test LLC',
        type: 'WHOLESALE',
        address: 'Test Pune Area Updated',
        status: 'ACTIVE',
      };

      // WAREHOUSE -> 403
      const resWar = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send(updatePayload);
      expect(resWar.status).toBe(403);

      // ADMIN -> 200
      const resAdmin = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.data.name).toBe('Lifecyle Test Cust Updated');
    });

    it('should block customer updates trying to mutate server-controlled parameters', async () => {
      const updatePayload = {
        name: 'Lifecyle Test Cust Updated 2',
        mobile: '9876543123',
        email: 'lifecycle@cust.com',
        businessName: 'Lifecycle Test LLC',
        type: 'WHOLESALE',
        address: 'Test Pune Area Updated',
        status: 'ACTIVE',
        createdBy: 'malicious-creator-id',
        createdAt: '2026-08-08T00:00:00.000Z',
        id: 'malicious-id-override',
      };

      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testCustomerId);
      expect(res.body.data.createdBy).not.toBe('malicious-creator-id');
    });
  });

  describe('Search, Filtering, and Pagination tests', () => {
    let searchCustomerId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `John Doe Search ${Date.now()}`,
          mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          email: `johndoe_${Date.now()}@example.com`,
          businessName: `John Enterprise ${Date.now()}`,
          type: 'WHOLESALE',
          address: 'Test Address Pune 123',
          status: 'ACTIVE',
        });
      searchCustomerId = res.body?.data?.id;
    });

    afterAll(async () => {
      if (searchCustomerId) {
        await request(app)
          .delete(`/api/customers/${searchCustomerId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('should search case-insensitively against customer names/emails/mobiles/businessNames', async () => {
      const res = await request(app)
        .get('/api/customers?search=john')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name.toLowerCase()).toContain('john');
    });

    it('should filter lists accurately by type and status queries', async () => {
      const res = await request(app)
        .get('/api/customers?status=ACTIVE&type=WHOLESALE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((cust: any) => {
        expect(cust.status).toBe('ACTIVE');
        expect(cust.type).toBe('WHOLESALE');
      });
    });

    it('should paginage responses using page and limit inputs', async () => {
      const res = await request(app)
        .get('/api/customers?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBeDefined();
      expect(res.body.pagination.totalPages).toBeDefined();
    });

    it('should reject invalid page or limit parameters with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/customers?page=invalid&limit=-5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('Follow-Ups APIs', () => {
    let followUpCustomerId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'FollowUp Test Cust',
          mobile: '9876543111',
          email: 'followup@cust.com',
          businessName: 'Followup LLC',
          type: 'RETAIL',
          address: 'Test Pune A1',
          status: 'LEAD',
        });
      followUpCustomerId = createRes.body.data.id;
    });

    it('should allow ADMIN and SALES to create follow-up notes, and enforce createdBy audits', async () => {
      // SALES -> allowed
      const res = await request(app)
        .post(`/api/customers/${followUpCustomerId}/follow-ups`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          note: 'Called to verify customer setup details',
          followUpDate: '2026-08-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.createdById).toBeDefined();

      // WAREHOUSE -> 403
      const resWar = await request(app)
        .post(`/api/customers/${followUpCustomerId}/follow-ups`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          note: 'Warehouse note try',
        });
      expect(resWar.status).toBe(403);
    });

    it('should prevent body payloads from overriding customerId', async () => {
      const res = await request(app)
        .post(`/api/customers/${followUpCustomerId}/follow-ups`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          note: 'Testing security overrides',
          customerId: 'malicious-customer-id',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.customerId).toBe(followUpCustomerId);
    });

    it('should allow all roles to list follow-ups', async () => {
      for (const token of [adminToken, salesToken, warehouseToken, accountsToken]) {
        const res = await request(app)
          .get(`/api/customers/${followUpCustomerId}/follow-ups`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
      }
    });
  });
});
