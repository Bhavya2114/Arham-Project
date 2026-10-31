/**
 * GitHub Actions backup settings. Read on every call so a token added on Render takes
 * effect without a code change. The token is never logged or sent to the frontend.
 */
export const getBackupConfig = () => ({
  token: (process.env.GITHUB_BACKUP_TOKEN || '').trim(),
  repo: (process.env.GITHUB_BACKUP_REPO || 'Bhavya2114/arham-db-backup').trim(),
  workflow: (process.env.GITHUB_BACKUP_WORKFLOW || 'backup.yml').trim(),
});
