import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

// A contractor is paid per project (area x rate), can be on many projects at once,
// and is active while at least one of his assignments is
describe('Contractors', () => {
  let adminToken: string;
  let customerId: string;
  let projectAId: string;
  let projectBId: string;
  let contractorId: string;
  const runId = Date.now();
  const mobile = () => `9${Math.floor(100000000 + Math.random() * 900000000)}`;

  const createProject = async (code: string, extra: Record<string, any> = {}) => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-CTR-${code}-${runId}`,
        name: `Contractor Project ${code}`,
        customer: customerId,
        siteAddress: 'Kota',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 1000000,
        ...extra,
      });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    const customer = await createTestCustomer({
      name: `Contractor Cust ${runId}`,
      mobile: mobile(),
      businessName: `Contractor Biz ${runId}`,
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Kota',
    });
    customerId = customer._id.toString();
    projectAId = await createProject('A');
    projectBId = await createProject('B');
  });

  it('creates a contractor without a daily wage', async () => {
    const res = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'CONTRACTOR', name: `Contractor ${runId}`, mobile: mobile(), address: 'Kota' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('CONTRACTOR');
    expect(res.body.data.status).toBe('INACTIVE');
    expect(res.body.data.totalEarned).toBe(0);
    contractorId = res.body.data.id;
  });

  it('still requires a daily wage for a normal worker', async () => {
    const res = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `No Wage ${runId}`, mobile: mobile(), address: 'Kota' });
    expect(res.status).toBe(400);
  });

  it('requires area and rate when assigning a contractor', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: contractorId, startDate: '2026-09-01' });
    expect(res.status).toBe(400);
  });

  it('counts the full contract amount from the assignment day', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: contractorId, startDate: '2026-09-01', areaSqFt: 10000, ratePerSqFt: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.contractAmount).toBe(200000);
    expect(res.body.data.totalEarned).toBe(200000);
  });

  it('does not allow the same contractor twice on the same project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: contractorId, startDate: '2026-09-02', areaSqFt: 100, ratePerSqFt: 10 });
    expect(res.status).toBe(400);
  });

  it('allows the contractor on a second project at the same time', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: contractorId, startDate: '2026-09-05', areaSqFt: 5000, ratePerSqFt: 15 });
    expect(res.status).toBe(200);

    const profile = await request(app)
      .get(`/api/labours/${contractorId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profile.body.data.status).toBe('ACTIVE');
    expect(profile.body.data.activeProjects).toHaveLength(2);
    expect(profile.body.data.totalEarned).toBe(275000);
  });

  it('lists the contractor on each project with that project amount', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectBId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const row = res.body.data.find((l: any) => l.id === contractorId);
    expect(row.type).toBe('CONTRACTOR');
    expect(row.areaSqFt).toBe(5000);
    expect(row.ratePerSqFt).toBe(15);
    expect(row.totalEarned).toBe(75000);
  });

  it('counts the contract amount in project labour cost', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectAId}/profitability`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalLabourCost).toBe(200000);
  });

  it('edits area and rate on one project and the amount follows', async () => {
    const list = await request(app)
      .get(`/api/projects/${projectAId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const row = list.body.data.find((l: any) => l.id === contractorId);

    const res = await request(app)
      .patch(`/api/labours/${contractorId}/assignments/${row.assignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ areaSqFt: 12000, ratePerSqFt: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.contractAmount).toBe(240000);
  });

  it('stops the contractor on one project only', async () => {
    const res = await request(app)
      .patch(`/api/labours/${contractorId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectId: projectAId });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.activeProjects).toHaveLength(1);
    expect(res.body.data.activeProjects[0].id).toBe(projectBId);
    // Stopping doesn't change what he is owed
    expect(res.body.data.totalEarned).toBe(315000);
  });

  it('becomes inactive when his last project is completed', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);

    const profile = await request(app)
      .get(`/api/labours/${contractorId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profile.body.data.status).toBe('INACTIVE');
    expect(profile.body.data.activeProjects).toHaveLength(0);
    expect(profile.body.data.totalEarned).toBe(315000);
  });

  it('is inactive after the project end date has passed', async () => {
    const pastProjectId = await createProject('PAST', {
      startDate: '2026-01-01',
      expectedEndDate: '2026-02-01',
    });
    const contractor = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'CONTRACTOR', name: `Past Contractor ${runId}`, mobile: mobile(), address: 'Kota' });
    const id = contractor.body.data.id;

    const assign = await request(app)
      .post(`/api/projects/${pastProjectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: id, startDate: '2026-01-10', areaSqFt: 1000, ratePerSqFt: 10 });
    expect(assign.status).toBe(200);

    const profile = await request(app)
      .get(`/api/labours/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profile.body.data.status).toBe('INACTIVE');
    expect(profile.body.data.totalEarned).toBe(10000);
  });
});
