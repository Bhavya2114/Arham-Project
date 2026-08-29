import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/apiError';
import {
  FaBuilding,
  FaPlus,
  FaSearch,
  FaFilter,
  FaEye,
  FaEdit,
  FaTrash,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaRupeeSign
} from 'react-icons/fa';

const STATUS_BADGES = {
  PLANNING: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ON_HOLD: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-purple-100 text-purple-800 border-purple-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const Projects = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;

      const res = await axiosInstance.get('/projects', { params });
      setProjects(res.data.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(getErrorMessage(err, 'Failed to load construction projects.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"?`)) return;

    try {
      await axiosInstance.delete(`/projects/${id}`);
      toast.success(`Project "${name}" deleted successfully.`);
      fetchProjects();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete project.'));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-base shadow-sm">
              <FaBuilding />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Construction Projects</h2>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            Manage construction project sites, client allocations, and timelines.
          </p>
        </div>

        <Link
          to="/projects/new"
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs self-start sm:self-auto"
        >
          <FaPlus />
          <span>+ Add New Project</span>
        </Link>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search by code, project name, site..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 focus:bg-white"
          />
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
            <FaFilter className="text-gray-400" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 bg-gray-50/50 text-slate-800 font-bold"
          >
            <option value="">All Statuses</option>
            <option value="PLANNING">Planning</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
            {projects.length} Projects Total
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
            <Link
              to="/projects/new"
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center space-x-2"
            >
              <FaPlus />
              <span>Create Project</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Project Name</th>
                  <th className="px-6 py-3.5">Client / Customer</th>
                  <th className="px-6 py-3.5">Site Location</th>
                  <th className="px-6 py-3.5">Timeline</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Budget</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {projects.map((p) => {
                  const startDateStr = p.startDate ? new Date(p.startDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
                  const endDateStr = p.expectedEndDate ? new Date(p.expectedEndDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ongoing';
                  const badgeStyle = STATUS_BADGES[p.status] || 'bg-gray-100 text-gray-800 border-gray-200';

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-emerald-700">{p.projectCode}</td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-slate-900 block">{p.name}</span>
                        {p.notes && <span className="text-[11px] text-gray-400 truncate max-w-xs block">{p.notes}</span>}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">
                        {p.customer?.name ? (
                          <div>
                            <div className="font-extrabold text-slate-900">{p.customer.name}</div>
                            {p.customer.businessName && <div className="text-[10px] text-gray-400 font-normal">{p.customer.businessName}</div>}
                          </div>
                        ) : (
                          <span className="italic text-gray-400">Unspecified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        <div className="flex items-center space-x-1.5">
                          <FaMapMarkerAlt className="text-gray-400 flex-shrink-0 text-xs" />
                          <span className="truncate max-w-[180px]">{p.siteAddress}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <FaCalendarAlt className="text-gray-400 text-[10px]" />
                          <span>{startDateStr}</span>
                          <span>-</span>
                          <span>{endDateStr}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg border ${badgeStyle}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">
                        {p.budget !== undefined && p.budget !== null ? (
                          <span className="inline-flex items-center">
                            <FaRupeeSign className="text-xs text-gray-400 mr-0.5" />
                            {Number(p.budget).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/projects/${p.id}`)}
                            title="View Details"
                            className="p-2 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg transition-colors"
                          >
                            <FaEye className="text-xs" />
                          </button>
                          <button
                            onClick={() => navigate(`/projects/${p.id}/edit`)}
                            title="Edit Project"
                            className="p-2 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-lg transition-colors"
                          >
                            <FaEdit className="text-xs" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            title="Delete Project"
                            className="p-2 bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-gray-600 rounded-lg transition-colors"
                          >
                            <FaTrash className="text-xs" />
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
    </div>
  );
};

export default Projects;
