import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Reports & Financial Analytics API integration tests', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  it('should retrieve dashboard summary KPIs', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalProducts');
    expect(res.body.data).toHaveProperty('totalStock');
    expect(res.body.data).toHaveProperty('inventoryValue');
    expect(res.body.data).toHaveProperty('lowStockCount');
    expect(res.body.data).toHaveProperty('outOfStockCount');
    expect(res.body.data).toHaveProperty('projects');
    expect(res.body.data).toHaveProperty('invoices');
    expect(res.body.data).toHaveProperty('purchases');
    expect(res.body.data).toHaveProperty('labour');
    expect(res.body.data).toHaveProperty('recentActivity');
  });

  it('should return 404 for obsolete sales and profit report endpoints', async () => {
    const resSales = await request(app)
      .get('/api/reports/sales?range=month')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resSales.status).toBe(404);

    const resProfit = await request(app)
      .get('/api/reports/profit?range=month')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resProfit.status).toBe(404);
  });

  it('should retrieve projects profitability report', async () => {
    const res = await request(app)
      .get('/api/reports/projects-profitability')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should retrieve low-stock and out-of-stock product listing', async () => {
    const res = await request(app)
      .get('/api/reports/low-stock')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
