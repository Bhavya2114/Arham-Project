import { NextFunction, Request, Response } from 'express';
import * as authService from '../services/auth.service';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, user } = await authService.login(req.body);
    res.status(200).json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  res.status(200).json({
    user: {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
};
