import request from 'supertest';
import app from '../../src/app';
import { Labour } from '../../src/models/Labour';
import { Project } from '../../src/models/Project';
import { getAuthToken } from '../helpers/auth.helper';

describe('Labour Assignment Status After Project Expected Completion Date', () => {
  let adminToken: string;
  let pastProject: any;
  let todayProject: any;
  let futureProject: any;

  // Reference test dates
  // Past project: starts 2026-09-01, expectedEnd 2026-10-01
  // Today project: starts 2026-10-01, expectedEnd 2026-10-11
  // Future project: starts 2026-10-01, expectedEnd 2026-10-31

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const pPast = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-PAST-${Date.now()}`,
        name: 'Past Deadline Project',
        siteAddress: 'Pune',
        startDate: '2026-09-01',
        expectedEndDate: '2026-10-01',
        status: 'IN_PROGRESS',
      });
    pastProject = { _id: pPast.body.data.id };

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const futureStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(futureDate);

    const pToday = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-TODAY-${Date.now()}`,
        name: 'Today Deadline Project',
        siteAddress: 'Pune',
        startDate: '2026-10-01',
        expectedEndDate: todayStr,
        status: 'IN_PROGRESS',
      });
    todayProject = { _id: pToday.body.data.id };

    const pFut = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectCode: `PRJ-FUT-${Date.now()}`,
        name: 'Future Deadline Project',
        siteAddress: 'Pune',
        startDate: '2026-10-01',
        expectedEndDate: futureStr,
        status: 'IN_PROGRESS',
      });
    futureProject = { _id: pFut.body.data.id };
  });

  afterAll(async () => {
    if (pastProject?._id) {
      await Project.deleteMany({
        _id: { $in: [pastProject._id, todayProject?._id, futureProject?._id] },
      });
    }
  });

  it('1. An assignment whose expected end date is in the past is no longer ACTIVE', async () => {
    const worker = await Labour.create({
      name: 'Worker Expired Past',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: pastProject._id,
      startDate: new Date('2026-09-01'),
      assignmentStartDate: new Date('2026-09-01'),
      projectAssignments: [
        {
          projectId: pastProject._id,
          startDate: new Date('2026-09-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    // Project Workforce Ledger
    const ledgerRes = await request(app)
      .get(`/api/projects/${pastProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledgerRes.status).toBe(200);

    const workerInLedger = ledgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(workerInLedger).toBeDefined();
    expect(workerInLedger.status).toBe('STOPPED');
    expect(workerInLedger.projectAssignmentStatus).toBe('STOPPED');
    expect(workerInLedger.stoppedAt).toBeDefined();

    // Clean up
    await Labour.findByIdAndDelete(worker._id);
  });

  it('2. An assignment whose expected end date is today follows the existing inclusive completion-day rule', async () => {
    const worker = await Labour.create({
      name: 'Worker Deadline Today',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: todayProject._id,
      startDate: new Date('2026-10-01'),
      assignmentStartDate: new Date('2026-10-01'),
      projectAssignments: [
        {
          projectId: todayProject._id,
          startDate: new Date('2026-10-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    const ledgerRes = await request(app)
      .get(`/api/projects/${todayProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledgerRes.status).toBe(200);

    const workerInLedger = ledgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(workerInLedger).toBeDefined();
    expect(workerInLedger.status).toBe('ACTIVE');
    expect(workerInLedger.projectAssignmentStatus).toBe('ACTIVE');
    expect(workerInLedger.stoppedAt).toBeNull();

    // Directory
    const dirRes = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.data.status).toBe('ACTIVE');

    await Labour.findByIdAndDelete(worker._id);
  });

  it('3. An assignment whose expected end date is in the future remains ACTIVE', async () => {
    const worker = await Labour.create({
      name: 'Worker Future Deadline',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: futureProject._id,
      startDate: new Date('2026-10-01'),
      assignmentStartDate: new Date('2026-10-01'),
      projectAssignments: [
        {
          projectId: futureProject._id,
          startDate: new Date('2026-10-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    const dirRes = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.data.status).toBe('ACTIVE');

    const ledgerRes = await request(app)
      .get(`/api/projects/${futureProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledgerRes.status).toBe(200);

    const workerInLedger = ledgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(workerInLedger).toBeDefined();
    expect(workerInLedger.status).toBe('ACTIVE');

    await Labour.findByIdAndDelete(worker._id);
  });

  it('4. A worker with one expired assignment and one active assignment remains ACTIVE overall', async () => {
    const worker = await Labour.create({
      name: 'Worker Mixed Assignments',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: futureProject._id,
      startDate: new Date('2026-09-01'),
      assignmentStartDate: new Date('2026-10-01'),
      projectAssignments: [
        {
          projectId: pastProject._id,
          startDate: new Date('2026-09-01'),
          stoppedAt: new Date('2026-10-01'),
          status: 'STOPPED',
        },
        {
          projectId: futureProject._id,
          startDate: new Date('2026-10-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    // Master directory returns overall ACTIVE
    const dirRes = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.data.status).toBe('ACTIVE');
    expect(dirRes.body.data.projectId).toBe(futureProject._id.toString());

    // Past project ledger returns STOPPED
    const pastLedgerRes = await request(app)
      .get(`/api/projects/${pastProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const pastInLedger = pastLedgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(pastInLedger).toBeDefined();
    expect(pastInLedger.status).toBe('STOPPED');

    // Future project ledger returns ACTIVE
    const futureLedgerRes = await request(app)
      .get(`/api/projects/${futureProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const futureInLedger = futureLedgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(futureInLedger).toBeDefined();
    expect(futureInLedger.status).toBe('ACTIVE');

    await Labour.findByIdAndDelete(worker._id);
  });

  it('5. A worker with only expired assignments becomes INACTIVE overall', async () => {
    const worker = await Labour.create({
      name: 'Worker Only Expired',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: pastProject._id,
      startDate: new Date('2026-09-01'),
      assignmentStartDate: new Date('2026-09-01'),
      projectAssignments: [
        {
          projectId: pastProject._id,
          startDate: new Date('2026-09-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    // Master Directory
    const dirRes = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    expect(dirRes.body.data.status).toBe('INACTIVE');
    expect(dirRes.body.data.projectId).toBeUndefined();

    // List in Master Directory
    const listRes = await request(app)
      .get('/api/labours')
      .set('Authorization', `Bearer ${adminToken}`);
    const inList = listRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(inList).toBeDefined();
    expect(inList.status).toBe('INACTIVE');

    await Labour.findByIdAndDelete(worker._id);
  });

  it('6. Historical earnings remain capped at the expected end date', async () => {
    const worker = await Labour.create({
      name: 'Worker Capped Earnings',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: pastProject._id,
      startDate: new Date('2026-09-01'),
      assignmentStartDate: new Date('2026-09-01'),
      projectAssignments: [
        {
          projectId: pastProject._id,
          startDate: new Date('2026-09-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    const dirRes = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.status).toBe(200);
    // 01/09/2026 to 01/10/2026 = 31 days inclusive = ₹31,000
    expect(dirRes.body.data.earnedDays).toBe(31);
    expect(dirRes.body.data.totalEarned).toBe(31000);

    const ledgerRes = await request(app)
      .get(`/api/projects/${pastProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const workerInLedger = ledgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(workerInLedger.earnedDays).toBe(31);
    expect(workerInLedger.totalEarned).toBe(31000);

    await Labour.findByIdAndDelete(worker._id);
  });

  it('7. Labour Directory and Project Workforce Ledger return consistent statuses', async () => {
    const worker = await Labour.create({
      name: 'Worker Consistent Status',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: pastProject._id,
      startDate: new Date('2026-09-01'),
      assignmentStartDate: new Date('2026-09-01'),
      projectAssignments: [
        {
          projectId: pastProject._id,
          startDate: new Date('2026-09-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    // In Directory: INACTIVE (since no active assignments)
    const dirRes = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dirRes.body.data.status).toBe('INACTIVE');

    // In Project Workforce Ledger: STOPPED (assignment stopped on deadline)
    const ledgerRes = await request(app)
      .get(`/api/projects/${pastProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const inLedger = ledgerRes.body.data.find((l: any) => l.id === worker._id.toString());
    expect(inLedger.status).toBe('STOPPED');
    expect(inLedger.projectAssignmentStatus).toBe('STOPPED');

    await Labour.findByIdAndDelete(worker._id);
  });

  it('8. Repeated requests do not repeatedly alter assignment history or stopped dates', async () => {
    const worker = await Labour.create({
      name: 'Worker Repeat Request',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      location: 'Pune',
      dailyWage: 1000,
      status: 'ACTIVE',
      projectId: pastProject._id,
      startDate: new Date('2026-09-01'),
      assignmentStartDate: new Date('2026-09-01'),
      projectAssignments: [
        {
          projectId: pastProject._id,
          startDate: new Date('2026-09-01'),
          stoppedAt: null,
          status: 'ACTIVE',
        },
      ],
    });

    // Call 1
    const res1 = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const status1 = res1.body.data.status;
    const earned1 = res1.body.data.totalEarned;

    // Call 2
    const res2 = await request(app)
      .get(`/api/labours/${worker._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const status2 = res2.body.data.status;
    const earned2 = res2.body.data.totalEarned;

    // Call 3 (Ledger)
    const res3 = await request(app)
      .get(`/api/projects/${pastProject._id}/labours`)
      .set('Authorization', `Bearer ${adminToken}`);
    const ledgerWorker = res3.body.data.find((l: any) => l.id === worker._id.toString());

    // Verify raw DB document did not have projectAssignments corrupted or altered
    const dbDoc = await Labour.findById(worker._id).lean();
    expect(dbDoc?.projectAssignments?.length).toBe(1);
    expect(status1).toBe(status2);
    expect(earned1).toBe(earned2);
    expect(ledgerWorker.totalEarned).toBe(31000);

    await Labour.findByIdAndDelete(worker._id);
  });
});
