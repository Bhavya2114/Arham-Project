/**
 * Normalizes backend HTTP errors and exceptions into clean, user-friendly natural language strings.
 * Prevents raw stack traces, Zod internals, Mongoose validation messages, or DB schemas from leaking into UI.
 */
export const getErrorMessage = (error, defaultFallback = 'An unexpected error occurred. Please try again.') => {
  if (!error) return defaultFallback;

  // Handle String Error
  if (typeof error === 'string') return error;

  // Network / Connection Failure
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Axios Response Error
  if (error.response) {
    const status = error.response.status;
    const serverMsg = error.response.data?.message;

    // Use server message if human-readable (not a raw database/syntax error)
    if (serverMsg && typeof serverMsg === 'string' && !serverMsg.includes('Mongo') && !serverMsg.includes('E11000') && !serverMsg.includes('CastError')) {
      return serverMsg;
    }

    switch (status) {
      case 400:
        return 'Invalid request details. Please check the highlighted inputs and try again.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested record could not be found.';
      case 409:
        return 'This action cannot be completed because the record is referenced by existing transactions.';
      case 422:
        return 'Validation failed. Please verify form values.';
      case 500:
      case 502:
      case 503:
        return 'Something went wrong on the server. Please try again later.';
      default:
        return defaultFallback;
    }
  }

  // Client Exception Message
  if (error.message && typeof error.message === 'string' && !error.message.includes('Object')) {
    return error.message;
  }

  return defaultFallback;
};
