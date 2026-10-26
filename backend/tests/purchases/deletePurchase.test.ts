import request from 'supertest';
import app from '../../src/app';
import { Product } from '../../src/models/Product';
import { Purchase } from '../../src/models/Purchase';
import { MaterialConsumption } from '../../src/models/MaterialConsumption';
import { getAuthToken } from '../helpers/auth.helper';

describe('Delete a purchase bill', () => {
  let adminToken: string;
  let warehouseToken: string;
  let supplierId: string;
  let productA: string;
  let productB: string;
  let projectId: string;
  const suffix = Date.now();

  const createBill = async (billNumber: string, items: any[]) => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplierId, invoiceNumber: billNumber, invoiceDate: '2026-09-17', items });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    warehouseToken = await getAuthToken('WAREHOUSE');

    const sup = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Delete Bill Supplier ${suffix}` });
    supplierId = sup.body.data.id;

    const a = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Delete Bill MCB ${suffix}`, sku: `DEL-A-${suffix}`, category: 'Test Category', currentStock: 0, costPrice: 50 });
    productA = a.body.data.id;

    const b = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Delete Bill RCCB ${suffix}`, sku: `DEL-B-${suffix}`, category: 'Test Category', currentStock: 0, costPrice: 50 });
    productB = b.body.data.id;

    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectCode: `DEL-PRJ-${suffix}`, name: 'Delete Bill Site', siteAddress: 'Kota', startDate: '2026-09-01', status: 'IN_PROGRESS' });
    expect(proj.status).toBe(201);
    projectId = proj.body.data.id;
  });

  it('only lets an admin delete', async () => {
    const billId = await createBill(`DEL-ROLE-${suffix}`, [{ productId: productB, purchasePrice: 10, quantity: 1, taxRate: 18 }]);

    const res = await request(app)
      .delete(`/api/purchases/${billId}`)
      .set('Authorization', `Bearer ${warehouseToken}`);
    expect(res.status).toBe(403);
    expect(await Purchase.exists({ _id: billId })).toBeTruthy();

    await request(app).delete(`/api/purchases/${billId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  });

  it('takes the stock back, then the rest from project issues, and erases the bill', async () => {
    // Earlier bill: 20 @ 80, then the bill to delete: 30 @ 100
    await createBill(`DEL-OLD-${suffix}`, [{ productId: productA, purchasePrice: 80, quantity: 20, taxRate: 18 }]);
    const billId = await createBill(`DEL-NEW-${suffix}`, [
      { productId: productA, purchasePrice: 100, quantity: 30, taxRate: 18 },
      { productId: productB, purchasePrice: 200, quantity: 5, taxRate: 18 },
    ]);
    expect((await Product.findById(productA))?.currentStock).toBe(50);
    expect((await Product.findById(productA))?.costPrice).toBe(100);

    // 40 of product A go to the site, leaving 10 in the store
    const issue = await request(app)
      .post('/api/material-consumptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project: projectId, product: productA, quantity: 40 });
    expect(issue.status).toBe(201);

    const preview = await request(app)
      .get(`/api/purchases/${billId}/delete-preview`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.stockRemoved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: productA, quantity: 10 }),
        expect.objectContaining({ productId: productB, quantity: 5 }),
      ])
    );
    expect(preview.body.data.projectRemoved).toEqual([
      expect.objectContaining({ projectId, productId: productA, quantity: 20, projectName: 'Delete Bill Site' }),
    ]);

    const res = await request(app)
      .delete(`/api/purchases/${billId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(await Purchase.exists({ _id: billId })).toBeNull();

    const a = await Product.findById(productA);
    expect(a?.currentStock).toBe(0);
    expect(a?.costPrice).toBe(80);
    expect((await Product.findById(productB))?.currentStock).toBe(0);

    const issues = await MaterialConsumption.find({ project: projectId, product: productA });
    expect(issues).toHaveLength(1);
    expect(issues[0].quantity).toBe(20);
    expect(issues[0].actualCostTotal).toBe(2000);

    const again = await request(app)
      .delete(`/api/purchases/${billId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(again.status).toBe(404);
  });
});
