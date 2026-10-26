import request from 'supertest';
import app from '../../src/app';
import { Product } from '../../src/models/Product';
import { getAuthToken } from '../helpers/auth.helper';

describe('Confirm purchase with a bill number that is already saved', () => {
  let adminToken: string;
  let supplierA: string;
  let supplierB: string;
  let productId: string;
  const suffix = Date.now();
  const billNumber = `DUP-BILL-${suffix}`;

  const billFor = (supplierId: string) => ({
    supplierId,
    invoiceNumber: billNumber,
    invoiceDate: '2026-09-04',
    items: [{ productId, purchasePrice: 100, quantity: 5, taxRate: 18 }],
  });

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const supA = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Dup Bill Supplier A ${suffix}` });
    supplierA = supA.body.data.id;

    const supB = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Dup Bill Supplier B ${suffix}` });
    supplierB = supB.body.data.id;

    const prod = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Dup Bill Product ${suffix}`, sku: `DUP-BILL-${suffix}`, category: 'Test Category', currentStock: 10 });
    productId = prod.body.data.id;
  });

  it('saves the first bill', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(billFor(supplierA));

    expect(res.status).toBe(201);
    expect(res.body.data.invoiceNumber).toBe(billNumber);
  });

  it('rejects the same bill from the same supplier with a clear 409 and leaves stock alone', async () => {
    const before = await Product.findById(productId);

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(billFor(supplierA));

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(`Bill ${billNumber}`);
    expect(res.body.message).toContain('already recorded');
    expect(res.body.message).not.toMatch(/network busy/i);

    const after = await Product.findById(productId);
    expect(after?.currentStock).toBe(before?.currentStock);
  });

  it('accepts the same bill number from a different supplier', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(billFor(supplierB));

    expect(res.status).toBe(201);
    expect(res.body.data.invoiceNumber).toBe(billNumber);
    expect(res.body.data.purchaseNumber).not.toBe(billNumber);
  });
});
