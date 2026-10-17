import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour Table Creation Order (Oldest Created -> Newest Created)', () => {
  let adminToken: string;
  let activeProjectId: string;

  const runId = `Ord${Date.now()}`;
  const cityPune = `Pune_${runId}`;
  const cityMumbai = `Mumbai_${runId}`;

  let labourAId: string;
  let labourBId: string;
  let labourCId: string;
  let labourDId: string;
  let labourEId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // Create a customer fixture
    const customer = await createTestCustomer({
      name: `Customer ${runId}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'Order Infra',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Pune MIDC',
    });
    const customerId = customer._id.toString();

    // Create an active project
    const prjRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-${runId}`,
        name: 'Creation Order Verification Site',
        customer: customerId,
        siteAddress: 'Baner, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
        budget: 5000000,
      });
    expect(prjRes.status).toBe(201);
    activeProjectId = prjRes.body.data.id;
  });

  // Section 10: New Labour Test
  it('10. should maintain oldest -> newest order when creating labours A, B, C, then D at position 4', async () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Create Labour A
    const resA = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${runId} WorkerA`,
        address: cityPune,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 800,
      });
    expect(resA.status).toBe(201);
    labourAId = resA.body.data.id;

    await sleep(25);

    // Create Labour B
    const resB = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${runId} WorkerB`,
        address: cityPune,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 850,
      });
    expect(resB.status).toBe(201);
    labourBId = resB.body.data.id;

    await sleep(25);

    // Create Labour C
    const resC = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${runId} WorkerC`,
        address: cityMumbai,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 900,
      });
    expect(resC.status).toBe(201);
    labourCId = resC.body.data.id;

    // Fetch labours filtered by search runId
    const listRes1 = await request(app)
      .get(`/api/labours?search=${runId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes1.status).toBe(200);
    const ids1 = listRes1.body.data.map((l: any) => l.id);
    expect(ids1).toEqual([labourAId, labourBId, labourCId]);

    await sleep(25);

    // Create Labour D
    const resD = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${runId} WorkerD`,
        address: cityPune,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 950,
      });
    expect(resD.status).toBe(201);
    labourDId = resD.body.data.id;

    // Fetch labours again: D must be at position 4 (index 3)
    const listRes2 = await request(app)
      .get(`/api/labours?search=${runId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes2.status).toBe(200);
    const ids2 = listRes2.body.data.map((l: any) => l.id);
    expect(ids2).toEqual([labourAId, labourBId, labourCId, labourDId]);
    expect(ids2[3]).toBe(labourDId);
  });

  // Section 11: Edit Order Test
  it('11. should preserve creation order when editing Labour B (updatedAt must not alter order)', async () => {
    // Edit Labour B
    const editRes = await request(app)
      .put(`/api/labours/${labourBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${runId} WorkerB Edited`,
        dailyWage: 1200,
      });
    expect(editRes.status).toBe(200);

    // Fetch list again: order must remain A, B, C, D
    const listRes = await request(app)
      .get(`/api/labours?search=${runId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((l: any) => l.id);
    expect(ids).toEqual([labourAId, labourBId, labourCId, labourDId]);
  });

  // Section 12: Status Order Test
  it('12. should preserve creation order regardless of status (STOPPED, ACTIVE, INACTIVE)', async () => {
    // Assign A to project so we can stop it
    await request(app)
      .post(`/api/projects/${activeProjectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: labourAId });

    // Stop A -> A is STOPPED
    const stopRes = await request(app)
      .patch(`/api/labours/${labourAId}/stop`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.status).toBe('INACTIVE');

    // Assign B to project -> B is ACTIVE
    const assignBRes = await request(app)
      .post(`/api/projects/${activeProjectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: labourBId });
    expect(assignBRes.status).toBe(200);
    expect(assignBRes.body.data.status).toBe('ACTIVE');

    // C remains INACTIVE (unassigned)

    // Assign D to project -> D is ACTIVE
    const assignDRes = await request(app)
      .post(`/api/projects/${activeProjectId}/labours`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labourId: labourDId });
    expect(assignDRes.status).toBe(200);
    expect(assignDRes.body.data.status).toBe('ACTIVE');

    // Fetch list: statuses are STOPPED, ACTIVE, INACTIVE, ACTIVE
    // Order MUST remain [A, B, C, D]
    const listRes = await request(app)
      .get(`/api/labours?search=${runId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((l: any) => l.id);
    expect(ids).toEqual([labourAId, labourBId, labourCId, labourDId]);
  });

  // Section 13: Filter Order Test
  it('13. should preserve relative creation order when filtered', async () => {
    // Create Labour E
    const resE = await request(app)
      .post('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${runId} WorkerE`,
        address: cityPune,
        mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        dailyWage: 1000,
      });
    expect(resE.status).toBe(201);
    labourEId = resE.body.data.id;

    // Filter by location: cityPune
    // Labour A, B, D, E are in cityPune; Labour C is in cityMumbai
    const filterRes = await request(app)
      .get(`/api/labours?location=${cityPune}&search=${runId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(filterRes.status).toBe(200);
    const filteredIds = filterRes.body.data.map((l: any) => l.id);
    expect(filteredIds).toEqual([labourAId, labourBId, labourDId, labourEId]);

    // Filter by status: ACTIVE (B and D are active)
    const activeFilterRes = await request(app)
      .get(`/api/labours?status=ACTIVE&search=${runId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activeFilterRes.status).toBe(200);
    const activeIds = activeFilterRes.body.data.map((l: any) => l.id);
    expect(activeIds).toEqual([labourBId, labourDId]);
  });
});
