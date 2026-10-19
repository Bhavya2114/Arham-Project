import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/api';
import { getLabours } from '../utils/labourService';
import { LuArrowRight, LuCheckCircle } from 'react-icons/lu';
import { toApiDateFormat, formatDateShortMonth } from '../utils/dateUtils';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const daysBetween = (fromKey, toKey) =>
  Math.round((new Date(`${toKey}T00:00:00`) - new Date(`${fromKey}T00:00:00`)) / 86400000);

const rupees = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

const shortDate = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

// Labour payments come as "Ravi (UPI)"; show the name and the method separately
const splitPartyName = (name) => {
  const m = String(name || '').match(/^(.*) \(([A-Z_]+)\)$/);
  return m ? { name: m[1], method: m[2].charAt(0) + m[2].slice(1).toLowerCase() } : { name, method: '' };
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Three requests at once: totals, project list (for overdue + names), workers (for balances)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sumRes, projRes, labourList] = await Promise.all([
          axiosInstance.get('/reports/dashboard'),
          axiosInstance.get('/projects'),
          getLabours(),
        ]);
        setSummary(sumRes.data.data);
        setProjects(projRes.data.data || []);
        setLabours(labourList || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError('Could not load the dashboard. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // The page itself never scrolls: the bottom row gets the height that is left and its boxes scroll inside
  const bottomRef = useRef(null);
  const [bottomHeight, setBottomHeight] = useState(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = bottomRef.current;
      if (!el) return;
      if (window.innerWidth < 1024) {
        setBottomHeight(null);
        return;
      }
      const main = el.closest('main');
      const mainBottom = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = el.getBoundingClientRect().top + (main ? main.scrollTop : 0);
      setBottomHeight(Math.max(320, Math.floor(mainBottom - top - mainPad)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [loading, error]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FFB82E]/20 border-t-[#FFB82E]"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  const today = todayKey();
  const formattedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Projects
  const ongoing = projects.filter((p) => p.status === 'IN_PROGRESS');
  const endKey = (p) => toApiDateFormat(p.expectedEndDate);
  const overdue = ongoing.filter((p) => endKey(p) && endKey(p) < today);

  // Workers: who is on which site, and who is owed or overpaid
  const workersOnSite = {};
  labours.forEach((l) => {
    const pid = l.project?.id || l.projectId;
    if (l.status === 'ACTIVE' && pid) workersOnSite[pid] = (workersOnSite[pid] || 0) + 1;
  });
  const owed = labours.filter((l) => Number(l.balance) > 0);
  const wagesToPay = owed.reduce((acc, l) => acc + Number(l.balance), 0);
  const overpaid = labours.filter((l) => Number(l.balance) < 0);

  // Labour still to pay per project, from the dashboard totals
  const labourByProject = {};
  (summary?.labour?.byProject || []).forEach((row) => {
    labourByProject[row.projectId] = Number(row.balance || 0);
  });

  // Things that need attention today, worst first
  const attention = [
    ...overdue.map((p) => {
      const days = daysBetween(endKey(p), today);
      return {
        key: `od-${p.id || p._id}`,
        tone: 'red',
        text: (
          <>
            <span className="text-slate-900">{p.name}</span> is overdue by {days} {days === 1 ? 'day' : 'days'}
          </>
        ),
        to: `/projects/${p.id || p._id}`,
      };
    }),
    ...overpaid.map((l) => ({
      key: `op-${l.id || l._id}`,
      tone: 'amber',
      text: (
        <>
          <span className="text-slate-900">{l.name}</span> was paid {rupees(Math.abs(l.balance))} more than earned
        </>
      ),
      to: `/labour/${l.id || l._id}`,
    })),
  ];

  const recentActivity = (summary?.recentActivity || []).filter((a) => a.type !== 'INVOICE');

  const cards = [
    {
      label: 'Ongoing projects',
      value: ongoing.length,
      sub: overdue.length > 0 ? `${overdue.length} overdue` : `${projects.length} projects in total`,
      subCls: overdue.length > 0 ? 'text-[#FCA5A5]' : 'text-gray-400',
      to: '/projects',
    },
    {
      label: 'Stock value',
      value: rupees(summary?.inventoryValue),
      sub: `${summary?.totalProducts || 0} products at cost price`,
      subCls: 'text-gray-400',
      to: '/stock',
    },
    {
      label: 'Wages to pay',
      value: rupees(wagesToPay),
      sub: owed.length > 0 ? `${owed.length} ${owed.length === 1 ? 'worker' : 'workers'} waiting` : 'All wages are paid',
      subCls: 'text-gray-400',
      to: '/labour',
      valueCls: wagesToPay > 0 ? 'text-[#FFB82E]' : 'text-slate-900',
    },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{formattedDate}</p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-400/30 text-red-300 rounded-xl text-sm">{error}</div>
      )}

      {/* Three cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-[#FFB82E]/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{c.label}</span>
              <LuArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FFB82E]" />
            </div>
            <div className={`text-2xl font-semibold mt-1 ${c.valueCls || 'text-slate-900'}`}>{c.value}</div>
            <div className={`text-xs mt-0.5 ${c.subCls}`}>{c.sub}</div>
          </Link>
        ))}
      </div>

      {/* Bottom row: attention + ongoing projects on the left, recent activity on the right */}
      <div
        ref={bottomRef}
        className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start"
      >
        <div className="flex flex-col gap-5 min-h-0" style={bottomHeight ? { maxHeight: bottomHeight } : undefined}>
          {/* Needs attention */}
          <div className="bg-white border border-gray-200 rounded-2xl shrink-0">
            <div className="px-5 py-3.5 flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-slate-900">Needs attention</h3>
              {attention.length > 0 && (
                <span className="px-2 py-0.5 rounded-md border border-red-400/30 bg-red-500/10 text-red-300 text-[11px]">
                  {attention.length}
                </span>
              )}
            </div>
            {attention.length === 0 ? (
              <div className="px-5 pb-4 flex items-center gap-2 text-sm text-emerald-400">
                <LuCheckCircle /> All good today
              </div>
            ) : (
              <div className="border-t border-gray-100 max-h-[9.5rem] overflow-y-auto divide-y divide-gray-100">
                {attention.map((a) => (
                  <Link
                    key={a.key}
                    to={a.to}
                    className="group flex items-center gap-3 px-5 py-2.5 text-xs text-gray-400 hover:bg-[#FFB82E]/[0.04] transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.tone === 'red' ? 'bg-red-400' : 'bg-[#FFB82E]'}`}></span>
                    <span className="flex-1 min-w-0 truncate">{a.text}</span>
                    <LuArrowRight className="shrink-0 text-gray-400 group-hover:text-[#FFB82E] transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Ongoing projects */}
          <div className="bg-white border border-gray-200 rounded-2xl flex flex-col flex-1 min-h-0">
            <div className="px-5 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-slate-900">Ongoing projects</h3>
              <Link to="/projects" className="text-xs text-gray-400 hover:text-[#FFB82E] transition-colors">
                View all
              </Link>
            </div>
            {ongoing.length === 0 ? (
              <p className="px-5 pb-4 text-sm text-gray-400">No ongoing projects.</p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto border-t border-gray-100 rounded-b-2xl">
                <table className="w-full table-fixed text-left text-xs text-gray-600">
                  <thead className="sticky top-0 z-10 bg-white text-gray-400 text-[11px] font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                    <tr>
                      <th className="pl-5 pr-2 py-2.5">Project</th>
                      <th className="px-2 py-2.5 w-[84px] text-right">On site</th>
                      <th className="px-2 py-2.5 w-[112px] text-right">Labour to pay</th>
                      <th className="pl-2 pr-5 py-2.5 w-[104px] text-right">Ends</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ongoing.map((p) => {
                      const id = p.id || p._id;
                      const isLate = endKey(p) && endKey(p) < today;
                      const toPay = Math.max(0, labourByProject[id] || 0);
                      const onSite = workersOnSite[id] || 0;
                      return (
                        <tr
                          key={id}
                          onClick={() => navigate(`/projects/${id}`)}
                          className="hover:bg-[#FFB82E]/[0.04] transition-colors cursor-pointer"
                        >
                          <td className="pl-5 pr-2 py-2.5">
                            <div className="text-slate-900 truncate">{p.name}</div>
                            <div className="text-[11px] text-gray-400 truncate">{p.projectCode}</div>
                          </td>
                          <td className="px-2 py-2.5 text-right text-slate-900">{onSite}</td>
                          <td className="px-2 py-2.5 text-right text-slate-900 whitespace-nowrap">{rupees(toPay)}</td>
                          <td className={`pl-2 pr-5 py-2.5 text-right whitespace-nowrap ${isLate ? 'text-[#FCA5A5]' : 'text-gray-400'}`}>
                            {p.expectedEndDate ? formatDateShortMonth(p.expectedEndDate, '-') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col min-h-0" style={bottomHeight ? { maxHeight: bottomHeight } : undefined}>
          <div className="px-5 py-3.5 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
          </div>
          {recentActivity.length === 0 ? (
            <p className="px-5 pb-4 text-sm text-gray-400">Nothing yet.</p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto border-t border-gray-100 divide-y divide-gray-100 rounded-b-2xl">
              {recentActivity.map((a) => {
                const isPurchase = a.type === 'PURCHASE';
                const party = isPurchase
                  ? { name: a.partyName && a.partyName !== 'Supplier' ? a.partyName : 'Unknown supplier', method: '' }
                  : splitPartyName(a.partyName);
                return (
                  <Link
                    key={`${a.type}-${a.id}`}
                    to={isPurchase ? '/purchases' : '/labour'}
                    className="flex items-center gap-3 px-5 py-3 text-xs hover:bg-[#FFB82E]/[0.04] transition-colors"
                  >
                    <span
                      className={`w-[72px] shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-medium inline-flex items-center justify-center gap-1 ${
                        isPurchase
                          ? 'border-sky-400/40 bg-sky-500/10 text-sky-300'
                          : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {isPurchase ? 'Purchase' : 'Wages'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${party.name === 'Unknown supplier' ? 'text-gray-400' : 'text-slate-900'}`}>
                        {party.name}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {[isPurchase ? `Bill ${a.reference}` : party.method, shortDate(a.date)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="text-slate-900 shrink-0 text-right">{rupees(a.amount)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
