import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Suppliers API integration tests', () => {
  let adminToken: string;
  let createdSupplierId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  it('should create a new supplier', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Apex Wholesale Corp',
        companyName: 'Apex Corp',
        mobile: '9876540000',
        email: 'info@apexcorp.com',
        gstNumber: '27APEXC1234F1Z5',
        address: '10 Industrial Area, Bengaluru',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Apex Wholesale Corp');
    createdSupplierId = res.body.data.id;
  });

  it('should list all suppliers', async () => {
    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should retrieve supplier details by ID', async () => {
    const res = await request(app)
      .get(`/api/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Apex Wholesale Corp');
  });

  it('should update supplier details', async () => {
    const res = await request(app)
      .put(`/api/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Apex Global Wholesalers',
        companyName: 'Apex Global',
        mobile: '9876540000',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Apex Global Wholesalers');
  });

  it('should delete a supplier', async () => {
    const res = await request(app)
      .delete(`/api/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const refetch = await request(app)
      .get(`/api/suppliers/${createdSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(refetch.status).toBe(404);
  });
});
