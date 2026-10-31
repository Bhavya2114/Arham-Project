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
 * Assign a contractor to a project with his contract for it (amount = area x rate).
 * @param {string} projectId - Target Project ID
 * @param {string} labourId - Contractor ID
 * @param {Object} contract - { areaSqFt, ratePerSqFt, startDate ('YYYY-MM-DD') }
 * @returns {Promise<Object>} Assigned contractor object
 */
export const assignContractorToProject = async (projectId, labourId, { areaSqFt, ratePerSqFt, startDate }) => {
  const payload = { labourId, areaSqFt, ratePerSqFt };
  if (startDate) {
    payload.startDate = startDate;
  }
  const res = await axiosInstance.post(`/projects/${projectId}/labours`, payload);
  return res.data?.data;
};

/**
 * Change a contractor's area / rate on one project.
 * @param {string} id - Contractor ID
 * @param {string} assignmentId - Project assignment ID
 * @param {Object} payload - { areaSqFt, ratePerSqFt }
 * @returns {Promise<Object>} Updated contractor (in that project's context)
 */
export const updateContractAssignment = async (id, assignmentId, payload) => {
  const res = await axiosInstance.patch(`/labours/${id}/assignments/${assignmentId}`, payload);
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
 * @param {string} [stopDate] - 'YYYY-MM-DD'
 * @param {string} [projectId] - For a contractor: the one project to stop him on
 * @returns {Promise<Object>} Updated labour object
 */
export const stopLabour = async (id, stopDate, projectId) => {
  const payload = {};
  if (stopDate) payload.stopDate = stopDate;
  if (projectId) payload.projectId = projectId;
  const res = await axiosInstance.patch(`/labours/${id}/stop`, payload);
  return res.data?.data;
};

/**
 * Change the stop date of a project the worker has already stopped on.
 * @param {string} id - Labour ID
 * @param {string} assignmentId - Project assignment ID (from projectHistory)
 * @param {string} stopDate - 'YYYY-MM-DD'
 * @returns {Promise<Object>} Updated labour object
 */
export const updateStopDate = async (id, assignmentId, stopDate) => {
  const res = await axiosInstance.patch(`/labours/${id}/assignments/${assignmentId}/stop-date`, { stopDate });
  return res.data?.data;
};

/**
 * Delete a project stint added by mistake. It stays in the worker's history, marked deleted.
 * @param {string} id - Labour ID
 * @param {string} assignmentId - Project assignment ID (from projectHistory)
 * @returns {Promise<Object>} Updated labour object
 */
export const deleteAssignment = async (id, assignmentId) => {
  const res = await axiosInstance.delete(`/labours/${id}/assignments/${assignmentId}`);
  return res.data?.data;
};
