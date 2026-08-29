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
    expect(res.body.data).toHaveProperty('totalSales');
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(res.body.data).toHaveProperty('totalCost');
    expect(res.body.data).toHaveProperty('totalProfit');
    expect(res.body.data).toHaveProperty('lowStockCount');
    expect(res.body.data).toHaveProperty('outOfStockCount');
  });

  it('should retrieve sales summary report with range filtering', async () => {
    const res = await request(app)
      .get('/api/reports/sales?range=month')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('sales');
    expect(Array.isArray(res.body.data.sales)).toBe(true);
  });

  it('should retrieve profit & loss summary report', async () => {
    const res = await request(app)
      .get('/api/reports/profit?range=month')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('revenue');
    expect(res.body.data).toHaveProperty('cogs');
    expect(res.body.data).toHaveProperty('grossProfit');
    expect(res.body.data).toHaveProperty('profitMarginPercent');
  });

  it('should retrieve low-stock and out-of-stock product listing', async () => {
    const res = await request(app)
      .get('/api/reports/low-stock')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
