import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Categories API integration tests', () => {
  let adminToken: string;
  let createdCategoryId: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  it('should create a new category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Laptops & Computers', description: 'Computing devices' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Laptops & Computers');
    createdCategoryId = res.body.data.id;
  });

  it('should reject duplicate category name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'laptops & computers' });

    expect(res.status).toBe(400);
  });

  it('should list all categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should retrieve category details by ID', async () => {
    const res = await request(app)
      .get(`/api/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Laptops & Computers');
  });

  it('should update a category', async () => {
    const res = await request(app)
      .put(`/api/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'High-End Laptops', description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('High-End Laptops');
  });

  it('should delete a category', async () => {
    const res = await request(app)
      .delete(`/api/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const refetch = await request(app)
      .get(`/api/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(refetch.status).toBe(404);
  });
});
