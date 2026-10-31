import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

// A worker who returns to a project must not get days that were already counted
describe('Labour re-assignment cannot overlap days already worked', () => {
  let adminToken: string;
  let projectId: string;
  let workerId: string;
  const runId = Date.now();

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    const customer = await createTestCustomer({
      name: `Overlap Cust ${runId}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: `Overlap ${runId}`,
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Panvel',
    });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-OVERLAP-${runId}`,
        name: 'Overlap Project',
        customer: customer._id.toString(),
        siteAddress: 'Panvel',
        startDate: '2026-08-29',
        status: 'IN_PROGRESS',
        budget: 100000,
      });
    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;

    const workerRes = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Overlap Worker ${runId}`, mobile: '9876543210', address: 'Panvel', dailyWage: 900 });
    expect(workerRes.status).toBe(201);
    workerId = workerRes.body.data.id;

    const assignRes = await request(app)
      .post(`/api/projects/${projectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: workerId, startDate: '2026-08-29' });
    expect(assignRes.status).toBe(200);

    const stopRes = await request(app)
      .patch(`/api/labours/${workerId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stopDate: '2026-09-08' });
    expect(stopRes.status).toBe(200);
  });

  it('rejects a start date before the last day already worked', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: workerId, startDate: '2026-08-29' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already worked till 08 Sep 2026/);
  });

  it('allows returning to the same project from the last worked day onward', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: workerId, startDate: '2026-09-10' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});
