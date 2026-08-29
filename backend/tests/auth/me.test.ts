import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

describe('GET /api/auth/me integration tests', () => {
  const roles: Array<'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS'> = [
    'ADMIN',
    'SALES',
    'WAREHOUSE',
    'ACCOUNTS'
  ];

  describe('Success with Valid Roles', () => {
    roles.forEach((role) => {
      it(`should return HTTP 200 and safe profile for authenticated role ${role}`, async () => {
        const token = await getAuthToken(role);

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('userId');
        expect(res.body.user).toHaveProperty('email');
        expect(res.body.user).toHaveProperty('role', role);
      });
    });
  });

  describe('Failure with Invalid Tokens', () => {
    it('should return HTTP 401 when Authorization header is missing', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return HTTP 401 when Authorization header format is malformed', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer');

      expect(res.status).toBe(401);
    });

    it('should return HTTP 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
    });

    it('should return HTTP 401 when token is expired', async () => {
      // Sign an expired token using secret
      const expiredToken = jwt.sign({ userId: '1', role: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '-1h' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should return HTTP 401 when token is tampered', async () => {
      const validToken = await getAuthToken('ADMIN');
      const tamperedToken = validToken + 'a'; // alter signature

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });
  });
});
