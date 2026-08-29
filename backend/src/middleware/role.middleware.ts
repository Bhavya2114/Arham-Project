import { NextFunction, Request, Response } from 'express';
import { Role } from '../constants/roles';
import { errorResponse } from '../utils/apiResponse';

export const requireRole =
  (...allowedRoles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Unauthorized: Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json(errorResponse('Forbidden: Access denied'));
      return;
    }

    next();
  };

export const authorize = requireRole;
