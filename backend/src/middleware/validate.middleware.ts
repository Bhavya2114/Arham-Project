import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';

type RequestProperty = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, property: RequestProperty = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      console.log(`[VALIDATION CHECK ${req.method} ${req.path}] REQ.${property.toUpperCase()}:`, JSON.stringify(req[property], null, 2));
      const parsed = schema.parse(req[property]);
      if (property === 'query') {
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[property] = parsed;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`[VALIDATION FAILED ${req.method} ${req.path}] DETAILS:`, JSON.stringify(error.flatten(), null, 2));
        const fieldErrors = error.flatten().fieldErrors;
        const formattedErrors = error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: fieldErrors,
          details: formattedErrors,
        });
        return;
      }

      next(error);
    }
  };
