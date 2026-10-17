import axiosInstance from './api';

/**
 * Fetch list of labour records with optional query filters (search, status, projectId).
 * @param {Object} params - Query params { search, status, projectId }
 * @returns {Promise<Array>} List of labour objects
 */
export const getLabours = async (params = {}) => {
  const cleanParams = {};
  if (params.search && params.search.trim()) {
    cleanParams.search = params.search.trim();
  }
  if (params.status && params.status.trim()) {
    cleanParams.status = params.status.trim();
  }
  if (params.projectId && params.projectId.trim()) {
    cleanParams.projectId = params.projectId.trim();
  }
  if (params.location && params.location.trim()) {
    cleanParams.location = params.location.trim();
  }

  const res = await axiosInstance.get('/labours', {
    params: cleanParams,
    signal: params.signal,
  });
  return res.data?.data || [];
};

/**
 * Fetch single labour details by ID.
 * @param {string} id - Labour ID
 * @returns {Promise<Object>} Labour details
 */
export const getLabourById = async (id) => {
  const res = await axiosInstance.get(`/labours/${id}`);
  return res.data?.data;
};

/**
 * Create a new labour master record.
 * @param {Object} payload - { name, mobile, address, dailyWage }
 * @returns {Promise<Object>} Created labour object
 */
export const createLabour = async (payload) => {
  const res = await axiosInstance.post('/labours', payload);
  return res.data?.data;
};

/**
 * Assign an existing labour worker to a project.
 * @param {string} projectId - Target Project ID
 * @param {string} labourId - Existing Labour ID
 * @param {string} [startDate] - Optional Assignment Start Date (YYYY-MM-DD)
 * @returns {Promise<Object>} Assigned labour object
 */
export const assignLabourToProject = async (projectId, labourId, startDate) => {
  const payload = { labourId };
  if (startDate) {
    payload.startDate = startDate;
  }
  const res = await axiosInstance.post(`/projects/${projectId}/labours`, payload);
  return res.data?.data;
};

/**
 * Update an existing labour worker.
 * @param {string} id - Labour ID
 * @param {Object} payload - { name, mobile, location, projectId, dailyWage, startDate }
 * @returns {Promise<Object>} Updated labour object
 */
export const updateLabour = async (id, payload) => {
  const res = await axiosInstance.put(`/labours/${id}`, payload);
  return res.data?.data;
};

/**
 * Stop an active labour worker.
 * @param {string} id - Labour ID
 * @returns {Promise<Object>} Updated labour object
 */
export const stopLabour = async (id) => {
  const res = await axiosInstance.patch(`/labours/${id}/stop`);
  return res.data?.data;
};
