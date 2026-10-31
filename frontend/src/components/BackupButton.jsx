import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuDatabaseBackup, LuLoader2 } from 'react-icons/lu';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import ConfirmationModal from './ConfirmationModal';

const POLL_MS = 5000;
const MAX_WAIT_MS = 6 * 60 * 1000;

// "31 Oct, 10:52 PM" in IST
const formatLastBackup = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')} ${get('month')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
};

// YYYY-MM-DD in IST, so "today" means the Indian calendar day
const istDay = (val) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(val));

const fileNameFrom = (disposition) => {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  return match ? match[1] : `arham-backup-${new Date().toISOString().slice(0, 10)}.gz`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Errors on a blob request come back as a Blob; read the server's message out of it
const blobErrorMessage = async (err, fallback) => {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.message) return parsed.message;
    } catch {
      // not JSON
    }
  }
  return getErrorMessage(err, fallback);
};

/**
 * Admin-only "Back up now": runs the GitHub Actions backup (to Google Drive) and downloads
 * the same .gz. Lives in the sidebar, which stays mounted, so it keeps going across pages.
 */
const BackupButton = () => {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const mounted = useRef(true);

  const loadLastBackup = async () => {
    try {
      const res = await axiosInstance.get('/backup/last');
      if (mounted.current) setLastBackupAt(res.data?.data?.lastBackupAt || null);
    } catch {
      // Line stays hidden when unknown
    }
  };

  useEffect(() => {
    mounted.current = true;
    loadLastBackup();
    return () => {
      mounted.current = false;
    };
  }, []);

  const runBackup = async () => {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const start = await axiosInstance.post('/backup');
      const { requestId } = start.data.data;

      const deadline = Date.now() + MAX_WAIT_MS;
      let status = { state: 'queued' };
      while (status.state !== 'done') {
        if (Date.now() > deadline) throw new Error('The backup is taking too long. Check Google Drive in a few minutes.');
        await sleep(POLL_MS);
        const res = await axiosInstance.get(`/backup/${requestId}/status`);
        status = res.data.data;
        if (status.state === 'failed') throw new Error(status.reason || 'The backup failed.');
      }

      const file = await axiosInstance.get(`/backup/${requestId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(file.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameFrom(file.headers['content-disposition']);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success('Backup saved to Google Drive and downloaded');
      loadLastBackup();
    } catch (err) {
      const reason = err?.response ? await blobErrorMessage(err, 'The backup failed.') : err?.message || 'The backup failed.';
      toast.error(`Backup failed: ${reason}`, 7000);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  // One backup a day: once today's is done the button stays off until tomorrow
  const backedUpToday = Boolean(lastBackupAt) && istDay(lastBackupAt) === istDay(Date.now());
  const lastLabel = !lastBackupAt
    ? ''
    : backedUpToday
    ? `Today, ${formatLastBackup(lastBackupAt).split(', ')[1]}`
    : formatLastBackup(lastBackupAt);

  return (
    <div className="mx-3 mb-2 px-2">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy || backedUpToday}
        title={backedUpToday ? 'Only one backup per day. Try again tomorrow.' : 'Back up now'}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#2A2B30] text-[13px] text-[#B8B4AC] hover:text-[#FFC14D] hover:border-[#FFB82E]/50 hover:bg-[#FFB82E]/10 transition-colors cursor-pointer focus:outline-none disabled:cursor-not-allowed disabled:hover:bg-transparent ${
          busy ? 'disabled:text-[#FFC14D] disabled:border-[#FFB82E]/40' : 'disabled:opacity-50 disabled:hover:text-[#B8B4AC] disabled:hover:border-[#2A2B30]'
        }`}
      >
        {busy ? <LuLoader2 className="text-base animate-spin" /> : <LuDatabaseBackup className="text-base" />}
        <span>{busy ? 'Backing up…' : backedUpToday ? 'Backed up today' : 'Back up now'}</span>
      </button>
      {lastLabel && <div className="mt-1 text-center text-[11px] text-[#75716A]">Last backup: {lastLabel}</div>}

      {/* Portal: the sidebar's transform would otherwise trap the pop-up inside it */}
      {createPortal(
        <ConfirmationModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={runBackup}
          title="Back up now?"
          message="A fresh backup goes to Google Drive and a copy downloads to this PC. It takes about 1–2 minutes."
          confirmText="Back up now"
          isDanger={false}
        />,
        document.body
      )}
    </div>
  );
};

export default BackupButton;
