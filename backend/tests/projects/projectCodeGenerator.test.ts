import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Project } from '../../src/models/Project';
import { computeNextProjectCode } from '../../src/services/project.service';

describe('Project code generator', () => {
  describe('computeNextProjectCode', () => {
    it('continues the sequence after the highest code of the year', () => {
      expect(computeNextProjectCode(['PRJ-2026-001', 'PRJ-2026-002'], 2026)).toBe('PRJ-2026-003');
    });

    it('starts at 001 in a new year', () => {
      expect(computeNextProjectCode(['PRJ-2026-001', 'PRJ-2026-002'], 2027)).toBe('PRJ-2027-001');
      expect(computeNextProjectCode([], 2026)).toBe('PRJ-2026-001');
    });

    it('ignores codes that do not follow the pattern', () => {
      expect(
        computeNextProjectCode(['PRJ-2026-002', 'PRJ-S-1780000000000', 'PRJ-2026-ABC', 'XPRJ-2026-900', 'PRJ-2026-900X'], 2026)
      ).toBe('PRJ-2026-003');
    });

    it('uses the highest number even when codes are out of order or have gaps', () => {
      expect(computeNextProjectCode(['PRJ-2026-007', 'PRJ-2026-002'], 2026)).toBe('PRJ-2026-008');
    });

    it('goes past 999 without breaking', () => {
      expect(computeNextProjectCode(['PRJ-2026-999'], 2026)).toBe('PRJ-2026-1000');
    });
  });

  describe('API', () => {
    let adminToken: string;
    let warehouseToken: string;
    const year = new Date().getFullYear();
    const createdIds: string[] = [];
    // Other suites create projects in parallel against the same database, so codes can move on between calls
    const num = (code: string) => Number(code.split('-').pop());

    beforeAll(async () => {
      adminToken = await getAuthToken('ADMIN');
      warehouseToken = await getAuthToken('WAREHOUSE');
    });

    afterAll(async () => {
      await Project.deleteMany({ _id: { $in: createdIds } });
    });

    it('GET /api/projects/next-code returns the code the next project will get', async () => {
      const preview = await request(app)
        .get('/api/projects/next-code')
        .set('Authorization', `Bearer ${warehouseToken}`);
      expect(preview.status).toBe(200);
      expect(preview.body.data.projectCode).toMatch(new RegExp(`^PRJ-${year}-\\d{3,}$`));

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: 'CLIENT-SENT-CODE',
          name: 'Generated Code Project',
          siteAddress: 'Baner, Pune',
          startDate: '2026-06-01',
        });
      expect(res.status).toBe(201);
      createdIds.push(res.body.data.id);
      // The code sent by the client is ignored; the assigned one is the previewed code (or a later one)
      expect(res.body.data.projectCode).toMatch(new RegExp(`^PRJ-${year}-\\d{3,}$`));
      expect(num(res.body.data.projectCode)).toBeGreaterThanOrEqual(num(preview.body.data.projectCode));
    });

    it('gives consecutive projects consecutive codes', async () => {
      const create = () =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Sequential Code Project', siteAddress: 'Baner, Pune', startDate: '2026-06-01' });

      const first = await create();
      const second = await create();
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      createdIds.push(first.body.data.id, second.body.data.id);

      expect(num(second.body.data.projectCode)).toBeGreaterThan(num(first.body.data.projectCode));
    });

    it('retries with the next code when two projects are created at the same moment', async () => {
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Parallel Code Project', siteAddress: 'Baner, Pune', startDate: '2026-06-01' })
        )
      );
      for (const r of results) {
        expect(r.status).toBe(201);
        createdIds.push(r.body.data.id);
      }
      const codes = results.map((r) => r.body.data.projectCode);
      expect(new Set(codes).size).toBe(3);
    });
  });
});
