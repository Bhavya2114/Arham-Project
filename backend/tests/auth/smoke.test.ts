import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('GET /api/auth/me smoke tests', () => {
  it('should return 200 and user details when request contains a valid ADMIN token', async () => {
    const token = await getAuthToken('ADMIN');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('userId');
    expect(res.body.user).toHaveProperty('role', 'ADMIN');
  });

  it('should return 401 when request is sent without a token', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
