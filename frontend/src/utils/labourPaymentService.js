import axiosInstance from './api';

/**
 * Record a new labour payment.
 * @param {Object} payload - { labourId, amount, paymentDate, paymentMethod, notes }
 * @returns {Promise<Object>} Created payment object
 */
export const createPayment = async (payload) => {
  const res = await axiosInstance.post('/labour-payments', payload);
  return res.data?.data;
};

/**
 * Retrieve list of payments with optional query filters (e.g. { labourId }).
 * @param {Object} params - Query params
 * @returns {Promise<Array>} List of payment objects
 */
export const getPayments = async (params = {}) => {
  const res = await axiosInstance.get('/labour-payments', { params });
  return res.data?.data || [];
};

/**
 * Retrieve single payment by ID.
 * @param {string} id - Payment ID
 * @returns {Promise<Object>} Payment object
 */
export const getPaymentById = async (id) => {
  const res = await axiosInstance.get(`/labour-payments/${id}`);
  return res.data?.data;
};

/**
 * Update an existing payment.
 * @param {string} id - Payment ID
 * @param {Object} payload - { amount, paymentDate, paymentMethod, notes }
 * @returns {Promise<Object>} Updated payment object
 */
export const updatePayment = async (id, payload) => {
  const res = await axiosInstance.put(`/labour-payments/${id}`, payload);
  return res.data?.data;
};

/**
 * Delete a payment record.
 * @param {string} id - Payment ID
 * @returns {Promise<boolean>}
 */
export const deletePayment = async (id) => {
  const res = await axiosInstance.delete(`/labour-payments/${id}`);
  return res.data?.success;
};

/**
 * Retrieve all payments belonging to a specific labour worker.
 * @param {string} labourId - Labour ID
 * @returns {Promise<Array>} List of payments for this labour
 */
export const getPaymentsByLabourId = async (labourId) => {
  const res = await axiosInstance.get(`/labours/${labourId}/payments`);
  return res.data?.data || [];
};
