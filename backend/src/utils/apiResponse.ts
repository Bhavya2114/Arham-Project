import { ApiErrorResponse, ApiSuccessResponse } from '../types/common.types';

export const successResponse = <T>(
  message: string,
  data?: T
): ApiSuccessResponse<T> => ({
  success: true,
  message,
  ...(data !== undefined ? { data } : {}),
});

export const errorResponse = (
  message: string,
  errors?: unknown
): ApiErrorResponse => ({
  success: false,
  message,
  ...(errors !== undefined ? { errors } : {}),
});
