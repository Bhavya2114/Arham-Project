import request from 'supertest';
import app from '../../src/app';

const credentials = {
  ADMIN: { email: 'admin@erp.com', password: 'Password@123' },
  SALES: { email: 'sales@erp.com', password: 'Password@123' },
  WAREHOUSE: { email: 'warehouse@erp.com', password: 'Password@123' },
  ACCOUNTS: { email: 'accounts@erp.com', password: 'Password@123' },
};

export const getAuthToken = async (role: 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS'): Promise<string> => {
  const res = await request(app)
    .post('/api/auth/login')
    .send(credentials[role]);
  
  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login failed for role ${role}: ${JSON.stringify(res.body)}`);
  }
  
  return res.body.token;
};
