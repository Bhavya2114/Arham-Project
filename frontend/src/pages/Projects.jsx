import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import { formatDateRange, toApiDateFormat } from '../utils/dateUtils';
import ProjectFormModal from '../components/ProjectFormModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { getLabours } from '../utils/labourService';
import {
  FaBuilding,
  FaHardHat,
  FaCheckCircle,
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaArrowDown,
  FaArrowUp
} from 'react-icons/fa';

// Rectangular outlined badges, same style as the worker profile
const STATUS_BADGES = {
  PLANNING: { label: 'Planning', cls: 'bg-[#60A5FA]/10 text-[#93C5FD] border-[#60A5FA]/40' },
  IN_PROGRESS: { label: 'In progress', cls: 'bg-[#22C55E]/10 text-[#4ADE80] border-[#22C55E]/40' },
  ON_HOLD: { label: 'On hold', cls: 'bg-[#FFB82E]/10 text-[#FFC14D] border-[#FFB82E]/40' },
  COMPLETED: { label: 'Completed', cls: 'bg-[#A78BFA]/10 text-[#C4B5FD] border-[#A78BFA]/40' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-[#F87171]/10 text-[#FCA5A5] border-[#F87171]/40' },
};

const getBudget = (p) => (p.budget !== undefined && p.budget !== null ? Number(p.budget) : null);
const getEndDateKey = (p) => toApiDateFormat(p.expectedEndDate);

// Today as YYYY-MM-DD in local time, to compare with project end dates
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "pune" and "Pune" show the same way
const capitalise = (text) => (text ? text.trim().charAt(0).toUpperCase() + text.trim().slice(1) : '');

// "5 workers · 1 contractor on site"; null when nobody is on site
const onSiteLabel = ({ workers = 0, contractors = 0 } = {}) => {
  const parts = [];
  if (workers) parts.push(`${workers} ${workers === 1 ? 'worker' : 'workers'}`);
  if (contractors) parts.push(`${contractors} ${contractors === 1 ? 'contractor' : 'contractors'}`);
  return parts.length ? `${parts.join(' · ')} on site` : null;
};

const Projects = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Project being edited in the popup (null = creating a new one)
  const [editingProject, setEditingProject] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [sortDir, setSortDir] = useState('desc');
  // People on site per project id ({ workers, contractors }), for the "N workers on site" line
  const [workerCounts, setWorkerCounts] = useState({});
  // Project waiting for delete confirmation, and whether the delete is running
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await axiosInstance.get('/projects', { params });
      setProjects(res.data.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(getErrorMessage(err, 'Failed to load construction projects.'));
    } finally {
      setLoading(false);
    }
  };

  // Status is filtered on this page (not by the API) so the summary cards keep all counts
  useEffect(() => {
    fetchProjects();
  }, []);

  // One request for all active workers and contractors, counted per project here.
  // A contractor can be on several projects at once, so he counts on each of his active ones.
  useEffect(() => {
    getLabours({ status: 'ACTIVE' })
      .then((list) => {
        const counts = {};
        const add = (pid, key) => {
          if (!pid) return;
          counts[pid] = counts[pid] || { workers: 0, contractors: 0 };
          counts[pid][key] += 1;
        };
        (list || []).forEach((l) => {
          if (l.type === 'CONTRACTOR') {
            new Set((l.activeProjects || []).map((p) => p.id)).forEach((pid) => add(pid, 'contractors'));
          } else {
            add(l.project?.id || l.projectId, 'workers');
          }
        });
        setWorkerCounts(counts);
      })
      .catch(() => setWorkerCounts({}));
  }, []);

  // Clicking the active sort field flips its direction; a new field starts newest/highest first
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const isOverdue = (p) => p.status === 'IN_PROGRESS' && getEndDateKey(p) && getEndDateKey(p) < todayKey();

  const metrics = useMemo(() => {
    const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS');
    return {
      total: projects.length,
      inProgress: inProgress.length,
      completed: projects.filter((p) => p.status === 'COMPLETED').length,
      overdue: inProgress.filter(isOverdue).length,
      ongoingBudget: inProgress.reduce((acc, p) => acc + (getBudget(p) || 0), 0),
      ongoingWorkers: inProgress.reduce((acc, p) => acc + (workerCounts[p.id]?.workers || 0), 0),
      ongoingContractors: inProgress.reduce((acc, p) => acc + (workerCounts[p.id]?.contractors || 0), 0),
    };
  }, [projects, workerCounts]);

  const visibleProjects = useMemo(() => {
    if (statusFilter === 'OVERDUE') return projects.filter(isOverdue);
    if (statusFilter) return projects.filter((p) => p.status === statusFilter);
    return projects;
  }, [projects, statusFilter]);

  // Clicking a summary card filters by it; clicking the selected card again clears it
  const toggleStatusFilter = (value) => setStatusFilter((cur) => (cur === value ? '' : value));
  const cardRing = (selected) =>
    selected ? 'ring-2 ring-[#FFB82E]/60 border-transparent' : 'hover:border-[#FFB82E]/40';

  const sortedProjects = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...visibleProjects].sort((a, b) => {
      if (sortBy === 'budget' || sortBy === 'endDate') {
        // Projects with no budget / no end date always sit at the bottom
        const av = sortBy === 'budget' ? getBudget(a) : getEndDateKey(a) || null;
        const bv = sortBy === 'budget' ? getBudget(b) : getEndDateKey(b) || null;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        const cmp = sortBy === 'budget' ? av - bv : av.localeCompare(bv);
        return cmp * dir;
      }
      return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) * dir;
    });
  }, [visibleProjects, sortBy, sortDir]);

  const SortIcon = sortDir === 'desc' ? FaArrowDown : FaArrowUp;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const { id, name } = projectToDelete;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/projects/${id}`);
      toast.success(`Project "${name}" deleted successfully.`);
      setProjectToDelete(null);
      fetchProjects();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete project.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header: title + money on ongoing work, like the Labour header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Projects</h2>
          <p className="text-gray-500 text-sm mt-1">
            {metrics.ongoingBudget > 0 ? (
              <>
                <span className="text-[#FFC14D]">₹{metrics.ongoingBudget.toLocaleString('en-IN')}</span>
                {' budget on ongoing projects'}
              </>
            ) : (
              'No ongoing projects'
            )}
          </p>
        </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm whitespace-nowrap cursor-pointer"
          >
            <FaPlus className="text-xs" />
            <span>New project</span>
          </button>
      </div>

      {/* Summary cards (click to filter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cardRing(statusFilter === '')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total projects</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">{metrics.inProgress} in progress • {metrics.completed} completed</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shadow-inner">
              <FaBuilding />
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleStatusFilter('IN_PROGRESS')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cardRing(statusFilter === 'IN_PROGRESS')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">In progress</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{metrics.inProgress}</h3>
              <p className="text-xs font-semibold text-emerald-700/80 mt-1">
                {onSiteLabel({ workers: metrics.ongoingWorkers, contractors: metrics.ongoingContractors }) || '0 workers on site'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner">
              <FaHardHat />
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleStatusFilter('COMPLETED')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cardRing(statusFilter === 'COMPLETED')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#C4B5FD]">Completed</p>
              <h3 className="text-2xl font-black text-[#C4B5FD] mt-1">{metrics.completed}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Finished work</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-[#A78BFA]/10 text-[#C4B5FD] flex items-center justify-center text-lg shadow-inner">
              <FaCheckCircle />
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleStatusFilter('OVERDUE')}
          className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${cardRing(statusFilter === 'OVERDUE')}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#FCA5A5]">Overdue</p>
              <h3 className="text-2xl font-black text-[#FCA5A5] mt-1">{metrics.overdue}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">{metrics.overdue ? 'Past end date, still in progress' : 'All on schedule'}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-[#F87171]/10 text-[#FCA5A5] flex items-center justify-center text-lg shadow-inner">
              <FaExclamationTriangle />
            </div>
          </div>
        </button>
      </div>

      {/* Search, sort and count on one row */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-sm">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search code, name or site"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 bg-gray-50/50"
            />
          </form>
        <div className="flex items-center gap-3 lg:ml-auto flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-400 mr-1">Sort by</span>
          {[
            { field: 'newest', label: 'Newest' },
            { field: 'budget', label: 'Budget' },
            { field: 'endDate', label: 'End date' },
          ].map(({ field, label }) => (
            <button
              key={field}
              type="button"
              onClick={() => handleSort(field)}
              className={`px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                sortBy === field
                  ? 'bg-[#FFB82E]/10 border-[#FFB82E]/40 text-[#FFC14D]'
                  : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
              }`}
              title={sortBy === field ? 'Click to reverse order' : `Sort by ${label.toLowerCase()}`}
            >
              <span>{label}</span>
              {sortBy === field && <SortIcon className="text-[10px]" />}
            </button>
          ))}
        </div>
          <span className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 whitespace-nowrap">
            <span className="text-slate-900 font-semibold">{sortedProjects.length}</span> {sortedProjects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
            <p className="text-sm text-gray-400 font-medium">Loading project directory...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center space-x-3">
            <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              <FaBuilding />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">No construction projects found</h3>
              <p className="text-xs text-gray-500">Create your first construction project to manage client site deployments.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2 cursor-pointer"
            >
              <FaPlus />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Project</th>
                  <th className="px-6 py-3.5">Site Location</th>
                  <th className="px-6 py-3.5">Timeline</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Budget</th>
                  <th className="px-6 py-3.5 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {sortedProjects.map((p) => {
                  const timelineStr = formatDateRange(p.startDate, p.expectedEndDate, 'Ongoing');
                  const budget = getBudget(p);
                  const badge = STATUS_BADGES[p.status] || { label: p.status, cls: 'bg-[#908C84]/10 text-[#B8B4AC] border-[#908C84]/40' };
                  const isOngoing = p.status === 'IN_PROGRESS';
                  const endKey = getEndDateKey(p);
                  const isOverdue = isOngoing && endKey && endKey < todayKey();
                  const siteLabel = onSiteLabel(workerCounts[p.id]);

                  return (
                    // The whole row opens the project; Edit / Delete stop the click
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="hover:bg-[#FFB82E]/[0.05] transition-colors duration-150 cursor-pointer"
                    >
                      <td className="px-6 py-4 min-w-[180px]">
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5">
                          {p.projectCode}
                          {isOngoing && (
                            <span className={siteLabel ? 'text-[#4ADE80]' : ''}>
                              {' · '}
                              {siteLabel || 'No workers'}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        <div className="flex items-center space-x-1.5">
                          <FaMapMarkerAlt className="text-gray-400 flex-shrink-0 text-xs" />
                          <span className="truncate max-w-[180px]">{capitalise(p.siteAddress)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`whitespace-nowrap ${isOverdue ? 'text-[#FCA5A5]' : 'text-gray-500'}`}>{timelineStr}</span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded-md border text-[10px] bg-[#F87171]/10 text-[#FCA5A5] border-[#F87171]/40">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium rounded-md border ${badge.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {budget !== null ? (
                          `₹${budget.toLocaleString('en-IN')}`
                        ) : (
                          <span className="text-gray-300 font-normal">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {/* Plain icons get a box only on hover; clicks here don't open the project */}
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditingProject(p);
                              setIsModalOpen(true);
                            }}
                            title="Edit project"
                            className="p-2 rounded-lg text-[#75716A] hover:text-[#F4F1EA] hover:bg-[#2A2B30] transition-colors cursor-pointer"
                          >
                            <FaEdit className="text-sm" />
                          </button>
                          <button
                            onClick={() => setProjectToDelete(p)}
                            title="Delete project"
                            className="p-2 rounded-lg text-[#75716A] hover:text-[#FCA5A5] hover:bg-[#F87171]/10 transition-colors cursor-pointer"
                          >
                            <FaTrash className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Project Confirmation */}
      <ConfirmationModal
        isOpen={Boolean(projectToDelete)}
        onClose={() => !isDeleting && setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete project"
        confirmText="Delete project"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeleting}
        message={
          <div className="space-y-3">
            <p className="text-gray-800 text-sm">
              Delete <span className="font-semibold text-gray-900">{projectToDelete?.name}</span>?
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500">{projectToDelete?.projectCode}</span>
              <span className="text-gray-800">{capitalise(projectToDelete?.siteAddress)}</span>
            </div>
            <p className="text-xs text-gray-500">This can't be undone.</p>
          </div>
        }
      />

      {/* Project Creation Modal */}
      <ProjectFormModal
        isOpen={isModalOpen}
        project={editingProject}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        onSuccess={() => fetchProjects()}
      />
    </div>
  );
};

export default Projects;
