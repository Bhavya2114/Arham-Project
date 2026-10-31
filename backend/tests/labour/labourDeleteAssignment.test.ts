import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

// A stint added by mistake can be deleted: it stays in history as deleted but stops counting
describe('Delete a labour project stint', () => {
  let adminToken: string;
  let projectId: string;
  let workerId: string;
  const runId = Date.now();

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    const customer = await createTestCustomer({
      name: `Delete Stint Cust ${runId}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: `Delete Stint ${runId}`,
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Ahilya Nagar',
    });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-DEL-STINT-${runId}`,
        name: 'Delete Stint Project',
        customer: customer._id.toString(),
        siteAddress: 'Ahilya Nagar',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 100000,
      });
    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;

    const workerRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Delete Stint Worker ${runId}`,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        address: 'Ahilya Nagar',
        dailyWage: 1000,
      });
    expect(workerRes.status).toBe(201);
    workerId = workerRes.body.data.id;

    const assignRes = await request(app)
      .post(`/api/projects/${projectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: workerId, startDate: '2026-09-01' });
    expect(assignRes.status).toBe(200);
  });

  it('keeps the deleted stint in history but stops counting it', async () => {
    const before = await request(app)
      .get(`/api/labours/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const row = before.body.data.projectHistory.find((h: any) => h.isActive);
    expect(row.assignmentId).toBeDefined();

    const res = await request(app)
      .delete(`/api/labours/${workerId}/assignments/${row.assignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
    expect(res.body.data.earnedDays).toBe(0);
    expect(res.body.data.totalEarned).toBe(0);

    const deleted = res.body.data.projectHistory.find((h: any) => h.assignmentId === row.assignmentId);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedAt).toBeDefined();
    expect(deleted.earnedDays).toBeGreaterThan(0);
  });

  it('no longer lists the worker on the project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.find((l: any) => l.id === workerId)).toBeUndefined();
  });

  it('lets the worker be assigned again from the original start date', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: workerId, startDate: '2026-09-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});
