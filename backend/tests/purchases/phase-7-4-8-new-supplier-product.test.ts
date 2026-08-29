import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { Supplier } from '../../src/models/Supplier';
import { Product } from '../../src/models/Product';
import { Purchase } from '../../src/models/Purchase';
import { getAuthToken } from '../helpers/auth.helper';

describe('Phase 7.4.9 — Purchase Confirmation & Validation Tests (New vs Existing)', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  beforeEach(async () => {
    await Supplier.deleteMany({
      $or: [
        { name: { $in: [/748/i, /749/i, /Frig Care Centre/i, /New Supplier/i, /Dup Protection/i] } },
        { gstNumber: { $in: [/29ABCDE1234F1Z5/i, /08AGWP58975J1Z0/i, /07DUPCHECK1234Z/i] } },
      ],
    });
    await Product.deleteMany({
      $or: [
        { name: { $in: [/748/i, /749/i, /FINOLEX/i, /New Cable/i, /Dup Protection/i] } },
        { sku: { $in: [/SKU-748/i, /SKU-749/i, /SKU-DUP/i] } },
      ],
    });
    await Purchase.deleteMany({ invoiceNumber: { $in: [/TEST-748/i, /TEST-749/i, /FCC/i] } });
  });

  it('1. Existing supplier + existing product purchase confirmation', async () => {
    const uniqueSuffix = Date.now();
    const sup = await Supplier.create({
      name: `Existing Supplier 749 ${uniqueSuffix}`,
      gstNumber: `29ABCDE${uniqueSuffix.toString().substring(5)}F1Z5`,
      mobile: '9876543210',
    });

    const prod = await Product.create({
      name: `Existing Product 749 ${uniqueSuffix}`,
      sku: `SKU-749-${uniqueSuffix}`,
      category: 'General',
      supplier: sup._id,
      costPrice: 100,
      unitPrice: 120,
      sellingPrice: 120,
      gstRate: 18,
      currentStock: 10,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const payload = {
      supplierId: sup._id.toString(),
      invoiceNumber: `TEST-749-01-${uniqueSuffix}`,
      invoiceDate: '2026-08-24',
      items: [
        {
          productId: prod._id.toString(),
          purchasePrice: 100,
          quantity: 5,
          taxRate: 18,
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.supplierId).toBe(sup._id.toString());
    expect(res.body.data.items[0].productId).toBe(prod._id.toString());

    // Verify stock incremented 10 -> 15
    const updatedProd = await Product.findById(prod._id);
    expect(updatedProd?.currentStock).toBe(15);
  });

  it('2. New supplier + new product purchase confirmation', async () => {
    const uniqueSuffix = Date.now();
    const payload = {
      newSupplier: {
        name: `Frig Care Centre 749 ${uniqueSuffix}`,
        gstNumber: `08AGWP${uniqueSuffix.toString().substring(5)}J1Z0`,
      },
      invoiceNumber: `FCC/26-27/1278-${uniqueSuffix}`,
      invoiceDate: '2026-06-22',
      items: [
        {
          newProduct: {
            name: `FINOLEX 4.00 SQ MM X 200 MTR 749 ${uniqueSuffix}`,
            unit: 'Roll',
            unitPrice: 10670.4,
            gstRate: 18,
          },
          purchasePrice: 10670.4,
          quantity: 4,
          taxRate: 18,
          unit: 'Roll',
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.supplier.name).toBe(`Frig Care Centre 749 ${uniqueSuffix}`);
    expect(res.body.data.items[0].productName).toBe(`FINOLEX 4.00 SQ MM X 200 MTR 749 ${uniqueSuffix}`);

    // Verify newly created product has currentStock = 4
    const newProd = await Product.findOne({ name: `FINOLEX 4.00 SQ MM X 200 MTR 749 ${uniqueSuffix}` });
    expect(newProd).toBeDefined();
    expect(newProd?.currentStock).toBe(4);
  });

  it('3. Existing supplier + new product purchase confirmation', async () => {
    const uniqueSuffix = Date.now();
    const sup = await Supplier.create({
      name: `Existing Sup Hybrid 749 ${uniqueSuffix}`,
      mobile: '9876543210',
    });

    const payload = {
      supplierId: sup._id.toString(),
      invoiceNumber: `TEST-749-03-${uniqueSuffix}`,
      invoiceDate: '2026-08-24',
      items: [
        {
          newProduct: {
            name: `Hybrid New Cable 749 ${uniqueSuffix}`,
            unit: 'Mtr',
            unitPrice: 250,
            gstRate: 18,
          },
          purchasePrice: 250,
          quantity: 20,
          taxRate: 18,
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.supplierId).toBe(sup._id.toString());
    expect(res.body.data.items[0].productName).toBe(`Hybrid New Cable 749 ${uniqueSuffix}`);

    const newProd = await Product.findOne({ name: `Hybrid New Cable 749 ${uniqueSuffix}` });
    expect(newProd?.currentStock).toBe(20);
  });

  it('4. New supplier + existing product purchase confirmation', async () => {
    const uniqueSuffix = Date.now();
    const prod = await Product.create({
      name: `Existing Prod Hybrid 749 ${uniqueSuffix}`,
      sku: `SKU-HYB-${uniqueSuffix}`,
      category: 'General',
      costPrice: 50,
      unitPrice: 60,
      sellingPrice: 60,
      gstRate: 18,
      currentStock: 5,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const payload = {
      newSupplier: {
        name: `Hybrid New Supplier 749 ${uniqueSuffix}`,
        mobile: '9991112223',
      },
      invoiceNumber: `TEST-749-04-${uniqueSuffix}`,
      invoiceDate: '2026-08-24',
      items: [
        {
          productId: prod._id.toString(),
          purchasePrice: 50,
          quantity: 15,
          taxRate: 18,
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.supplier.name).toBe(`Hybrid New Supplier 749 ${uniqueSuffix}`);
    expect(res.body.data.items[0].productId).toBe(prod._id.toString());

    // Stock 5 -> 20
    const updatedProd = await Product.findById(prod._id);
    expect(updatedProd?.currentStock).toBe(20);
  });

  it('5 & 6. Duplicate supplier and product protection', async () => {
    const uniqueSuffix = Date.now();
    const preSup = await Supplier.create({
      name: `Dup Protection Supplier 749 ${uniqueSuffix}`,
      gstNumber: `08AGWP${uniqueSuffix.toString().substring(5)}J1Z0`,
      mobile: '9998887776',
    });

    const preProd = await Product.create({
      name: `Dup Protection Product 749 ${uniqueSuffix}`,
      sku: `SKU-DUP-${uniqueSuffix}`,
      category: 'General',
      costPrice: 100,
      unitPrice: 120,
      sellingPrice: 120,
      gstRate: 18,
      currentStock: 10,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const payloadWithNewFlags = {
      newSupplier: {
        name: `Dup Protection Supplier 749 ${uniqueSuffix}`,
        gstNumber: `08AGWP${uniqueSuffix.toString().substring(5)}J1Z0`,
      },
      invoiceNumber: `TEST-749-DUP-${uniqueSuffix}`,
      invoiceDate: '2026-08-24',
      items: [
        {
          newProduct: {
            name: `Dup Protection Product 749 ${uniqueSuffix}`,
            unit: 'Pcs',
            unitPrice: 100,
          },
          purchasePrice: 100,
          quantity: 5,
          taxRate: 18,
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payloadWithNewFlags);

    expect(res.status).toBe(201);
    expect(res.body.data.supplierId).toBe(preSup._id.toString());
    expect(res.body.data.items[0].productId).toBe(preProd._id.toString());

    // Verify stock 10 -> 15 on pre-existing product
    const updatedProd = await Product.findById(preProd._id);
    expect(updatedProd?.currentStock).toBe(15);
  });

  it('7. Rejects invalid quantity (0 or negative)', async () => {
    const payload = {
      newSupplier: { name: 'Valid Sup 749' },
      invoiceNumber: 'INV-INVALID-QTY',
      items: [
        {
          newProduct: { name: 'Valid Prod 749' },
          purchasePrice: 100,
          quantity: 0, // INVALID QTY
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });

  it('8. Rejects invalid purchase price (negative)', async () => {
    const payload = {
      newSupplier: { name: 'Valid Sup 749' },
      invoiceNumber: 'INV-INVALID-PRICE',
      items: [
        {
          newProduct: { name: 'Valid Prod 749' },
          purchasePrice: -50, // INVALID PRICE
          quantity: 2,
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });

  it('9. Rejects missing supplier information (no supplierId and no newSupplier)', async () => {
    const payload = {
      invoiceNumber: 'INV-NO-SUPPLIER',
      items: [
        {
          newProduct: { name: 'Valid Prod 749' },
          purchasePrice: 100,
          quantity: 2,
        },
      ],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });

  it('10. Rejects empty items array', async () => {
    const payload = {
      newSupplier: { name: 'Valid Sup 749' },
      invoiceNumber: 'INV-NO-ITEMS',
      items: [],
    };

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Validation failed');
  });
});
