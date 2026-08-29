import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { errorResponse } from '../utils/apiResponse';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json(errorResponse('Unauthorized: Missing Authorization header'));
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('Unauthorized: Invalid authorization format'));
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    res.status(401).json(errorResponse('Unauthorized: Token is empty'));
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.userId,
      name: '',
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error: any) {
    const message = error.name === 'TokenExpiredError'
      ? 'Unauthorized: Token has expired'
      : 'Unauthorized: Invalid token signature or format';
    res.status(401).json(errorResponse(message));
  }
};

export const authenticateToken = authenticate;
