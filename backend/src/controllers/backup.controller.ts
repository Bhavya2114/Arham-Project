import { Request, Response, NextFunction } from 'express';
import { startBackup, getBackupStatus, downloadBackup, getLastBackup } from '../services/backup.service';
import { successResponse } from '../utils/apiResponse';

export const handleStartBackup = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await startBackup();
    res.status(202).json(successResponse('Backup started', data));
  } catch (error) {
    next(error);
  }
};

export const handleGetBackupStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getBackupStatus(req.params.requestId as string);
    res.status(200).json(successResponse('Backup status retrieved', data));
  } catch (error) {
    next(error);
  }
};

export const handleDownloadBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fileName, data } = await downloadBackup(req.params.requestId as string);
    const safeName = fileName.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(data);
  } catch (error) {
    next(error);
  }
};

export const handleGetLastBackup = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getLastBackup();
    res.status(200).json(successResponse('Last backup retrieved', data));
  } catch (error) {
    next(error);
  }
};
