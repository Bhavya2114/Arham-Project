import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Project } from '../../src/models/Project';
import { Labour } from '../../src/models/Labour';
import { createTestCustomer } from '../helpers/customer.helper';

describe('Labour Search & Filter Refinement Integration Tests (Phase 9)', () => {
  let adminToken: string;

  let testProjectId1: string;
  let testProjectId2: string;

  let labour1Id: string; // Rajesh Kumar, 9876543210, Pune, Project 1, ACTIVE
  let labour2Id: string; // Suresh Sharma, 9123456780, Mumbai, Project 1, STOPPED
  let labour3Id: string; // Ramesh Patil, 9988776655, Pune, Project 2, ACTIVE
  let labour4Id: string; // Anita Desai, 9876000000, Nashik, Project 2, STOPPED

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // Create Customer fixture
    const customer = await createTestCustomer({
      name: 'Search Filter Customer',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      businessName: 'SF Corp',
      type: 'WHOLESALE',
      status: 'ACTIVE',
      address: 'Mumbai, Maharashtra',
    });
    const customerId = customer._id.toString();

    // Create Project 1 via API
    const p1Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-SF1-${Date.now()}`,
        name: 'Office Renovation Alpha',
        customer: customerId,
        siteAddress: 'Baner, Pune',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    testProjectId1 = p1Res.body.data.id;

    // Create Project 2 via API
    const p2Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-SF2-${Date.now()}`,
        name: 'Residential Tower Beta',
        customer: customerId,
        siteAddress: 'Andheri, Mumbai',
        startDate: '2026-09-01',
        status: 'IN_PROGRESS',
      });
    testProjectId2 = p2Res.body.data.id;

    // Clean up any pre-existing records with test names to avoid cross-suite interference
    await Labour.deleteMany({
      name: { $in: ['Rajesh Kumar', 'Suresh Sharma', 'Ramesh Patil', 'Anita Desai'] },
    });

    // Create 4 distinct Labour records for testing all combinations
    const l1 = await Labour.create({
      name: 'Rajesh Kumar',
      mobile: '9876543210',
      location: 'Pune',
      projectId: testProjectId1,
      dailyWage: 800,
      startDate: new Date('2026-09-01'),
      status: 'ACTIVE',
    });
    labour1Id = l1._id.toString();

    const l2 = await Labour.create({
      name: 'Suresh Sharma',
      mobile: '9123456780',
      location: 'Mumbai',
      projectId: testProjectId1,
      dailyWage: 750,
      startDate: new Date('2026-09-01'),
      status: 'STOPPED',
      stoppedAt: new Date('2026-09-10'),
    });
    labour2Id = l2._id.toString();

    const l3 = await Labour.create({
      name: 'Ramesh Patil',
      mobile: '9988776655',
      location: 'Pune',
      projectId: testProjectId2,
      dailyWage: 900,
      startDate: new Date('2026-09-01'),
      status: 'ACTIVE',
    });
    labour3Id = l3._id.toString();

    const l4 = await Labour.create({
      name: 'Anita Desai',
      mobile: '9876000000',
      location: 'Nashik',
      projectId: testProjectId2,
      dailyWage: 850,
      startDate: new Date('2026-09-01'),
      status: 'STOPPED',
      stoppedAt: new Date('2026-09-15'),
    });
    labour4Id = l4._id.toString();
  });

  afterAll(async () => {
    await Labour.deleteMany({
      _id: { $in: [labour1Id, labour2Id, labour3Id, labour4Id] },
    });
    await Project.deleteMany({
      _id: { $in: [testProjectId1, testProjectId2] },
    });
  });

  // 1. Search by labour name
  it('1. should search by full labour name', async () => {
    const res = await request(app)
      .get('/api/labours?search=Rajesh Kumar')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).not.toContain('Suresh Sharma');
  });

  // 2. Search by partial name
  it('2. should search by partial labour name', async () => {
    const res = await request(app)
      .get('/api/labours?search=raj')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).not.toContain('Suresh Sharma');
  });

  // 3. Search by mobile
  it('3. should search by exact mobile number', async () => {
    const res = await request(app)
      .get('/api/labours?search=9123456780')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Suresh Sharma');
    expect(names).not.toContain('Rajesh Kumar');
  });

  // 4. Search by partial mobile
  it('4. should search by partial mobile number', async () => {
    const res = await request(app)
      .get('/api/labours?search=9876')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((l: any) => l.name);
    // Matches Rajesh (9876543210) and Anita (9876000000)
    expect(names).toContain('Rajesh Kumar');
    expect(names).toContain('Anita Desai');
    expect(names).not.toContain('Suresh Sharma');
  });

  // 5. Search by location
  it('5. should search by location (e.g. Pune)', async () => {
    const res = await request(app)
      .get('/api/labours?search=pune')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).toContain('Ramesh Patil');
    expect(names).not.toContain('Suresh Sharma'); // Mumbai
    expect(names).not.toContain('Anita Desai'); // Nashik
  });

  // 6. Case-insensitive search
  it('6. should perform case-insensitive search', async () => {
    const resUpper = await request(app)
      .get('/api/labours?search=RAJESH')
      .set('Authorization', `Bearer ${adminToken}`);

    const resLower = await request(app)
      .get('/api/labours?search=rajesh')
      .set('Authorization', `Bearer ${adminToken}`);

    const resMixed = await request(app)
      .get('/api/labours?search=rAjEsH')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resUpper.status).toBe(200);
    expect(resLower.status).toBe(200);
    expect(resMixed.status).toBe(200);

    expect(resUpper.body.data.some((l: any) => l.name === 'Rajesh Kumar')).toBe(true);
    expect(resLower.body.data.some((l: any) => l.name === 'Rajesh Kumar')).toBe(true);
    expect(resMixed.body.data.some((l: any) => l.name === 'Rajesh Kumar')).toBe(true);
  });

  // 7. Project filter
  it('7. should filter by specific project ID', async () => {
    const res = await request(app)
      .get(`/api/labours?projectId=${testProjectId1}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const projectIds = res.body.data.map((l: any) => l.projectId);
    projectIds.forEach((pid: string) => {
      expect(pid).toBe(testProjectId1);
    });
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).toContain('Suresh Sharma');
    expect(names).not.toContain('Ramesh Patil');
    expect(names).not.toContain('Anita Desai');
  });

  // 8. Status ACTIVE filter
  it('8. should filter by ACTIVE status', async () => {
    const res = await request(app)
      .get('/api/labours?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const statuses = res.body.data.map((l: any) => l.status);
    statuses.forEach((st: string) => {
      expect(st).toBe('ACTIVE');
    });
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).toContain('Ramesh Patil');
    expect(names).not.toContain('Suresh Sharma');
    expect(names).not.toContain('Anita Desai');
  });

  // 9. Status INACTIVE filter
  it('9. should filter by INACTIVE status', async () => {
    const res = await request(app)
      .get('/api/labours?status=INACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const statuses = res.body.data.map((l: any) => l.status);
    statuses.forEach((st: string) => {
      expect(st).toBe('INACTIVE');
    });
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Suresh Sharma');
    expect(names).toContain('Anita Desai');
    expect(names).not.toContain('Rajesh Kumar');
    expect(names).not.toContain('Ramesh Patil');
  });

  // 10. Combined search + project filter
  it('10. should filter by both search query and project ID', async () => {
    // Both Rajesh and Ramesh are in Pune, but Rajesh is in Project 1 and Ramesh is in Project 2
    const res = await request(app)
      .get(`/api/labours?search=Pune&projectId=${testProjectId1}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).not.toContain('Ramesh Patil'); // In Project 2
    expect(names).not.toContain('Suresh Sharma'); // In Mumbai
  });

  // 11. Combined search + status filter
  it('11. should filter by both search query and status', async () => {
    // Both Rajesh and Suresh have "sh" in name, but Rajesh is ACTIVE and Suresh is STOPPED
    const res = await request(app)
      .get('/api/labours?search=sh&status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((l: any) => l.name);
    expect(names).toContain('Rajesh Kumar');
    expect(names).toContain('Ramesh Patil');
    expect(names).not.toContain('Suresh Sharma'); // STOPPED
  });

  // 12. Combined project + status + search filter
  it('12. should filter when all three (project + status + search) are applied', async () => {
    const res = await request(app)
      .get(`/api/labours?projectId=${testProjectId1}&status=ACTIVE&search=Rajesh`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Rajesh Kumar');
    expect(res.body.data[0].status).toBe('ACTIVE');
    expect(res.body.data[0].projectId).toBe(testProjectId1);
  });

  // 13. Invalid projectId
  it('13. should handle invalid projectId safely without throwing 500', async () => {
    const res = await request(app)
      .get('/api/labours?projectId=invalid-id-format')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // 14. Invalid status
  it('14. should handle invalid status safely without throwing 500', async () => {
    const res = await request(app)
      .get('/api/labours?status=UNKNOWN_STATUS')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // 15. Empty search
  it('15. should return all records when search query is empty', async () => {
    const res = await request(app)
      .get('/api/labours?search=')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
  });

  // 16. Whitespace search
  it('16. should treat whitespace-only search as empty and return records', async () => {
    const res = await request(app)
      .get('/api/labours?search=%20%20%20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
  });

  // 17. No matching results
  it('17. should return empty array when no worker matches criteria', async () => {
    const res = await request(app)
      .get('/api/labours?search=NonExistentWorkerXYZ999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
