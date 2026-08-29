import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { errorResponse } from '../utils/apiResponse';

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error.name === 'CastError') {
    res.status(404).json(errorResponse('Resource not found'));
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(
      errorResponse('Validation failed', error.flatten().fieldErrors)
    );
    return;
  }

  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : 500;

  // Log error stack to console for observability
  console.error('Caught API Error:', error);

  // In production, sanitize 500 error messages to prevent leaking internal database/system schemas
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message || 'Internal server error';

  res.status(statusCode).json(
    errorResponse(message)
  );
};
