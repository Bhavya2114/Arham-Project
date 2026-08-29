import { PaginationMeta, PaginationParams } from '../types/common.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const getPaginationParams = (
  page?: string | number,
  limit?: string | number
): PaginationParams => {
  const parsedPage = Number(page) || DEFAULT_PAGE;
  const parsedLimit = Number(limit) || DEFAULT_LIMIT;

  const safePage = parsedPage > 0 ? parsedPage : DEFAULT_PAGE;
  const safeLimit =
    parsedLimit > 0 ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};

export const getPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit) || 1,
});
