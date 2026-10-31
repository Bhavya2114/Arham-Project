import { randomUUID } from 'crypto';
import { unzipSync } from 'fflate';
import { getBackupConfig } from '../config/backup';

/**
 * "Back up now": starts the GitHub Actions backup (mongodump .gz -> Google Drive) in the
 * backup repo and hands back the same .gz, which the workflow also attaches to its run
 * as the "arham-backup" artifact.
 */

const GITHUB_API = 'https://api.github.com';
const ARTIFACT_NAME = 'arham-backup';
const START_COOLDOWN_MS = 60 * 1000;
const LAST_CACHE_MS = 60 * 1000;

export type BackupState = 'queued' | 'running' | 'done' | 'failed';

let lastStartedAt = 0;
let lastBackupCache: { at: number; value: string | null } | null = null;

// Tests only
export const resetBackupState = (): void => {
  lastStartedAt = 0;
  lastBackupCache = null;
};

const httpError = (statusCode: number, message: string): Error =>
  Object.assign(new Error(message), { statusCode });

const requireConfig = () => {
  const config = getBackupConfig();
  if (!config.token) throw httpError(503, 'Backup is not set up on the server yet');
  return config;
};

const isRedirect = (status: number) => status >= 300 && status < 400;

const github = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const { token } = requireConfig();
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok && !isRedirect(res.status)) {
    throw httpError(502, `GitHub request failed (${res.status})`);
  }
  return res;
};

const workflowPath = () => {
  const { repo, workflow } = requireConfig();
  return `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}`;
};

// YYYY-MM-DD on the Indian calendar
const istDay = (val: string | number | Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(val));

const runTitle = (requestId: string) => `App backup ${requestId}`;

const findRun = async (requestId: string): Promise<any | null> => {
  const res = await github(`${workflowPath()}/runs?event=workflow_dispatch&per_page=20`);
  const body: any = await res.json();
  return (body.workflow_runs || []).find((r: any) => r.display_title === runTitle(requestId)) || null;
};

// includeExpired: an expired file still proves the backup happened
const findArtifact = async (runId: number, includeExpired = false): Promise<any | null> => {
  const { repo } = requireConfig();
  const res = await github(`/repos/${repo}/actions/runs/${runId}/artifacts`);
  const body: any = await res.json();
  return (body.artifacts || []).find((a: any) => a.name === ARTIFACT_NAME && (includeExpired || !a.expired)) || null;
};

export const startBackup = async (): Promise<{ requestId: string; startedAt: string }> => {
  requireConfig();
  if (Date.now() - lastStartedAt < START_COOLDOWN_MS) {
    throw httpError(409, 'A backup was started less than a minute ago. Please wait for it to finish.');
  }
  // One backup a day (IST), counting the scheduled ones too
  const { lastBackupAt } = await getLastBackup();
  if (lastBackupAt && istDay(lastBackupAt) === istDay(Date.now())) {
    throw httpError(409, 'Already backed up today');
  }
  const requestId = randomUUID();
  await github(`${workflowPath()}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: { force: 'true', request_id: requestId } }),
  });
  lastStartedAt = Date.now();
  return { requestId, startedAt: new Date(lastStartedAt).toISOString() };
};

export const getBackupStatus = async (
  requestId: string
): Promise<{ state: BackupState; runUrl?: string; reason?: string }> => {
  const run = await findRun(requestId);
  if (!run) return { state: 'queued' };
  const runUrl = run.html_url;
  if (run.status !== 'completed') {
    return { state: run.status === 'in_progress' ? 'running' : 'queued', runUrl };
  }
  if (run.conclusion !== 'success') {
    return { state: 'failed', runUrl, reason: `Backup run ${run.conclusion || 'failed'}` };
  }
  const artifact = await findArtifact(run.id);
  if (!artifact) return { state: 'failed', runUrl, reason: 'Backup finished but no file was attached' };
  lastBackupCache = null;
  return { state: 'done', runUrl };
};

export const downloadBackup = async (requestId: string): Promise<{ fileName: string; data: Buffer }> => {
  const run = await findRun(requestId);
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
    throw httpError(409, 'This backup is not ready yet');
  }
  const artifact = await findArtifact(run.id);
  if (!artifact) throw httpError(404, 'Backup file not found');

  // GitHub answers with a redirect to short-lived storage; that host gets no token
  const { repo } = requireConfig();
  const zipRes = await github(`/repos/${repo}/actions/artifacts/${artifact.id}/zip`, { redirect: 'manual' });
  let zipBytes: ArrayBuffer;
  const location = zipRes.headers.get('location');
  if (isRedirect(zipRes.status) && location) {
    const fileRes = await fetch(location);
    if (!fileRes.ok) throw httpError(502, `Backup file download failed (${fileRes.status})`);
    zipBytes = await fileRes.arrayBuffer();
  } else {
    zipBytes = await zipRes.arrayBuffer();
  }

  const files = unzipSync(new Uint8Array(zipBytes));
  const names = Object.keys(files).filter((n) => !n.endsWith('/'));
  const name = names.find((n) => n.endsWith('.gz')) || names[0];
  if (!name) throw httpError(502, 'Backup file was empty');
  return { fileName: name.split('/').pop() as string, data: Buffer.from(files[name]) };
};

export const getLastBackup = async (): Promise<{ lastBackupAt: string | null }> => {
  if (lastBackupCache && Date.now() - lastBackupCache.at < LAST_CACHE_MS) {
    return { lastBackupAt: lastBackupCache.value };
  }
  // Scheduled runs that skip (nothing changed) also end in success, but leave no backup
  // file, so only runs with the "arham-backup" artifact count
  const res = await github(`${workflowPath()}/runs?status=success&per_page=10`);
  const body: any = await res.json();
  let value: string | null = null;
  for (const run of body.workflow_runs || []) {
    if (await findArtifact(run.id, true)) {
      value = run.updated_at || null;
      break;
    }
  }
  lastBackupCache = { at: Date.now(), value };
  return { lastBackupAt: value };
};
