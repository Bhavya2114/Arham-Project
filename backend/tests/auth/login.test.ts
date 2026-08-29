import request from 'supertest';
import app from '../../src/app';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

describe('POST /api/auth/login integration tests', () => {
  const credentials = {
    ADMIN: { email: 'admin@erp.com', password: 'Password@123' },
    SALES: { email: 'sales@erp.com', password: 'Password@123' },
    WAREHOUSE: { email: 'warehouse@erp.com', password: 'Password@123' },
    ACCOUNTS: { email: 'accounts@erp.com', password: 'Password@123' },
  };

  describe('Successful Logins', () => {
    Object.entries(credentials).forEach(([role, creds]) => {
      it(`should successfully login as ${role} and return HTTP 200 with a valid JWT`, async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(creds);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('message', 'Login successful');
        expect(res.body).toHaveProperty('user');

        const decoded: any = jwt.verify(res.body.token, env.JWT_SECRET);
        expect(decoded).toHaveProperty('userId', res.body.user.id);
        expect(decoded).toHaveProperty('email', creds.email);
        expect(decoded).toHaveProperty('role', role);
      });
    });
  });

  describe('Invalid Logins', () => {
    it('should return HTTP 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password@123' });

      expect(res.status).toBe(400);
      expect(res.body.token).toBeUndefined();
    });

    it('should return HTTP 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@erp.com' });

      expect(res.status).toBe(400);
      expect(res.body.token).toBeUndefined();
    });

    it('should return HTTP 400 when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'Password@123' });

      expect(res.status).toBe(400);
      expect(res.body.token).toBeUndefined();
    });

    it('should return HTTP 401 when user does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@erp.com', password: 'Password@123' });

      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });

    it('should return HTTP 401 when password is incorrect', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@erp.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });
  });
});
