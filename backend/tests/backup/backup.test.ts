import request from 'supertest';
import { zipSync, strToU8 } from 'fflate';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { resetBackupState } from '../../src/services/backup.service';

const REQUEST_ID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c';
const RUNS_URL = 'https://api.github.com/repos/Bhavya2114/arham-db-backup/actions/workflows/backup.yml/runs';

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const run = (extra: any) => ({
  id: 77,
  display_title: `App backup ${REQUEST_ID}`,
  html_url: 'https://github.com/Bhavya2114/arham-db-backup/actions/runs/77',
  ...extra,
});

describe('Backup API (GitHub Actions backup)', () => {
  let adminToken: string;
  let salesToken: string;
  let fetchMock: jest.SpyInstance;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    salesToken = await getAuthToken('SALES');
  });

  beforeEach(() => {
    resetBackupState();
    process.env.GITHUB_BACKUP_TOKEN = 'test-token';
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    delete process.env.GITHUB_BACKUP_TOKEN;
  });

  // Answers GitHub calls by URL; anything else fails the test
  const github = (handler: (url: string, init?: RequestInit) => Response | undefined) => {
    fetchMock.mockImplementation(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const res = handler(url, init);
      if (!res) throw new Error(`Unexpected fetch ${url}`);
      return res;
    });
  };

  it('returns 503 when the backup token is not set', async () => {
    delete process.env.GITHUB_BACKUP_TOKEN;
    const res = await request(app).post('/api/backup').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Backup is not set up on the server yet');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only lets admins use backups', async () => {
    const res = await request(app).post('/api/backup').set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
    const last = await request(app).get('/api/backup/last').set('Authorization', `Bearer ${salesToken}`);
    expect(last.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts the workflow with force and a request id, and refuses a second start within a minute', async () => {
    github((url, init) => {
      if (url.startsWith(`${RUNS_URL}?status=success`)) return json({ workflow_runs: [{ updated_at: '2026-10-20T10:00:00Z' }] });
      if (url.endsWith('/actions/workflows/backup.yml/dispatches') && init?.method === 'POST') return new Response(null, { status: 204 });
      return undefined;
    });

    const res = await request(app).post('/api/backup').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(202);
    const { requestId, startedAt } = res.body.data;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(startedAt).toBeTruthy();

    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/dispatches'))!;
    expect(JSON.parse(init.body)).toEqual({ ref: 'main', inputs: { force: 'true', request_id: requestId } });
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers.Accept).toBe('application/vnd.github+json');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');

    const again = await request(app).post('/api/backup').set('Authorization', `Bearer ${adminToken}`);
    expect(again.status).toBe(409);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/dispatches'))).toHaveLength(1);
  });

  describe('one backup per day (IST)', () => {
    // 31 Oct 2026, 11:30 PM IST
    const NOW = Date.parse('2026-10-31T18:00:00Z');

    const withLastBackup = (updatedAt: string) =>
      github((url, init) => {
        if (url.startsWith(`${RUNS_URL}?status=success`)) return json({ workflow_runs: [{ updated_at: updatedAt }] });
        if (url.endsWith('/dispatches') && init?.method === 'POST') return new Response(null, { status: 204 });
        return undefined;
      });

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    it('refuses a second backup on the same IST day', async () => {
      withLastBackup('2026-10-31T17:22:00Z'); // 10:52 PM IST, same day
      const res = await request(app).post('/api/backup').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Already backed up today');
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/dispatches'))).toBe(false);
    });

    it('counts the day in IST, not UTC', async () => {
      withLastBackup('2026-10-30T19:00:00Z'); // 31 Oct 12:30 AM IST, same IST day though 30 Oct in UTC
      const res = await request(app).post('/api/backup').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
    });

    it('allows a backup when the last one was on an earlier IST day', async () => {
      withLastBackup('2026-10-30T18:00:00Z'); // 30 Oct 11:30 PM IST
      const res = await request(app).post('/api/backup').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(202);
    });
  });

  it('rejects an invalid request id', async () => {
    const res = await request(app).get('/api/backup/not-a-uuid/status').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the workflow run to queued / running / done / failed', async () => {
    const status = async () =>
      (await request(app).get(`/api/backup/${REQUEST_ID}/status`).set('Authorization', `Bearer ${adminToken}`)).body.data;

    github((url) => (url.startsWith(RUNS_URL) ? json({ workflow_runs: [] }) : undefined));
    expect((await status()).state).toBe('queued');

    github((url) => (url.startsWith(RUNS_URL) ? json({ workflow_runs: [run({ status: 'in_progress' })] }) : undefined));
    expect((await status()).state).toBe('running');

    github((url) =>
      url.startsWith(RUNS_URL) ? json({ workflow_runs: [run({ status: 'completed', conclusion: 'failure' })] }) : undefined
    );
    expect((await status()).state).toBe('failed');

    github((url) => {
      if (url.startsWith(RUNS_URL)) return json({ workflow_runs: [run({ status: 'completed', conclusion: 'success' })] });
      if (url.endsWith('/actions/runs/77/artifacts')) return json({ artifacts: [{ id: 9, name: 'arham-backup', expired: false }] });
      return undefined;
    });
    const done = await status();
    expect(done.state).toBe('done');
    expect(done.runUrl).toContain('/actions/runs/77');
  });

  it('downloads the .gz from the run artifact without sending the token to the storage host', async () => {
    const gz = 'fake-gzip-bytes';
    const zip = zipSync({ 'arham-backup-2026-10-31_1752.gz': strToU8(gz) });
    github((url) => {
      if (url.startsWith(RUNS_URL)) return json({ workflow_runs: [run({ status: 'completed', conclusion: 'success' })] });
      if (url.endsWith('/actions/runs/77/artifacts')) return json({ artifacts: [{ id: 9, name: 'arham-backup', expired: false }] });
      if (url.endsWith('/actions/artifacts/9/zip')) {
        return new Response(null, { status: 302, headers: { Location: 'https://storage.example.com/a.zip' } });
      }
      if (url === 'https://storage.example.com/a.zip') return new Response(zip, { status: 200 });
      return undefined;
    });

    const res = await request(app)
      .get(`/api/backup/${REQUEST_ID}/download`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/gzip');
    expect(res.headers['content-disposition']).toContain('arham-backup-2026-10-31_1752.gz');
    expect(res.body.toString()).toBe(gz);

    const storageCall = fetchMock.mock.calls.find(([u]) => String(u) === 'https://storage.example.com/a.zip');
    expect(storageCall?.[1]?.headers?.Authorization).toBeUndefined();
  });

  it('returns when the last successful backup finished', async () => {
    github((url) =>
      url.startsWith(`${RUNS_URL}?status=success`)
        ? json({ workflow_runs: [{ updated_at: '2026-10-31T17:22:00Z' }] })
        : undefined
    );
    const res = await request(app).get('/api/backup/last').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lastBackupAt).toBe('2026-10-31T17:22:00Z');
  });
});
