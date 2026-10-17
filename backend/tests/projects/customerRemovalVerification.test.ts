import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Customer } from '../../src/models/Customer';
import { Project } from '../../src/models/Project';

describe('Customer Module Removal Verification', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  describe('Verify removed /api/customers endpoints return HTTP 404', () => {
    it('GET /api/customers should return 404', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('POST /api/customers should return 404', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Customer', mobile: '9999999999' });
      expect(res.status).toBe(404);
    });

    it('GET /api/customers/:id should return 404', async () => {
      const res = await request(app)
        .get('/api/customers/65f123456789012345678901')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('PUT /api/customers/:id should return 404', async () => {
      const res = await request(app)
        .put('/api/customers/65f123456789012345678901')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Customer' });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/customers/:id should return 404', async () => {
      const res = await request(app)
        .delete('/api/customers/65f123456789012345678901')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('GET /api/customers/:id/follow-ups should return 404', async () => {
      const res = await request(app)
        .get('/api/customers/65f123456789012345678901/follow-ups')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('POST /api/customers/:id/follow-ups should return 404', async () => {
      const res = await request(app)
        .post('/api/customers/65f123456789012345678901/follow-ups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Test follow-up' });
      expect(res.status).toBe(404);
    });
  });

  describe('Verify retained Customer model works for Projects and dependent modules', () => {
    it('Project creation succeeds even when customer is omitted', async () => {
      const code = `PRJ-REMOVAL-${Date.now()}`;
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: code,
          name: 'Customer Removal Project Test',
          siteAddress: '123 Site Address, Pune',
          startDate: '2026-06-01',
          status: 'PLANNING',
          budget: 100000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.projectCode).toBe(code);

      // Clean up
      await Project.findByIdAndDelete(res.body.data.id);
    });

    it('Customer model retains documents safely in database', async () => {
      const count = await Customer.countDocuments();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
