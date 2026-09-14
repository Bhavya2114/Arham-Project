import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { Product } from '../../src/models/Product';
import { Purchase } from '../../src/models/Purchase';
import { Supplier } from '../../src/models/Supplier';
import * as geminiService from '../../src/services/geminiInvoice.service';

describe('Purchase Discount Support Integration Tests', () => {
  let adminToken: string;
  let supplierId: string;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    const timestamp = Date.now();
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `RAJ LAXMI ENTERPRISES ${timestamp}`,
        mobile: `98${timestamp.toString().slice(-8)}`,
        gstNumber: '08AABCR1234F1Z9',
      });
    supplierId = supRes.body.data.id;
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
    jest.restoreAllMocks();
  });

  /**
   * Helper to create a test product
   */
  const createProduct = async (name: string, initialCost: number = 0) => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        sku: `SKU-${timestamp}-${Math.floor(Math.random() * 1000)}`,
        category: 'Electrical Supplies',
        costPrice: initialCost,
        unitPrice: initialCost * 1.5,
        currentStock: 50,
        minStockQuantity: 5,
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  /**
   * Test 1 — 62% discount (Invoice example from RAJ LAXMI ENTERPRISES)
   * Quantity: 160
   * Rate: 180
   * Discount: 62%
   * GST: 18%
   * Expected taxable value: 10,944.00
   * Expected CGST: 984.96
   * Expected SGST: 984.96
   * Expected total: 12,913.92
   * Effective costPrice: 68.40
   */
  it('Test 1 — 62% discount correctly calculates taxable value, split GST, and effective unit cost', async () => {
    const productId = await createProduct('6A SWITCH', 0);

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-560-6ASWITCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        items: [
          {
            productId,
            purchasePrice: 180,
            quantity: 160,
            discountPercent: 62,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const purchase = purchaseRes.body.data;

    // Line item assertions
    expect(purchase.items.length).toBe(1);
    const item = purchase.items[0];
    expect(item.purchasePrice).toBe(180);
    expect(item.quantity).toBe(160);
    expect(item.discountPercent).toBe(62);
    expect(item.discountAmount).toBe(17856);
    expect(item.taxableAmount).toBe(10944);
    expect(item.discountedPrice).toBe(68.40);
    expect(item.taxRate).toBe(18);
    expect(item.taxAmount).toBe(1969.92);
    expect(item.totalCost).toBe(12913.92);

    // Purchase totals assertions
    expect(purchase.subtotal).toBe(10944);
    expect(purchase.totalDiscount).toBe(17856);
    expect(purchase.taxAmount).toBe(1969.92);
    expect(purchase.totalAmount).toBe(12913.92);

    // Verify Product inventory valuation: Product.costPrice MUST become effective discounted rate (₹68.40)
    const productRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(productRes.status).toBe(200);
    expect(productRes.body.data.costPrice).toBe(68.40);
    expect(productRes.body.data.currentStock).toBe(50 + 160);
  });

  /**
   * Test 2 — No discount (0%)
   * Quantity: 10
   * Rate: 100
   * Discount: 0%
   * GST: 18%
   * Expected taxable value: 1,000.00
   * Expected total: 1,180.00
   */
  it('Test 2 — No discount defaults to 0 and calculates standard totals without regressions', async () => {
    const productId = await createProduct('Standard Wire', 0);

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-NODISC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        items: [
          {
            productId,
            purchasePrice: 100,
            quantity: 10,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const purchase = purchaseRes.body.data;

    expect(purchase.items[0].discountPercent).toBe(0);
    expect(purchase.items[0].discountAmount).toBe(0);
    expect(purchase.items[0].taxableAmount).toBe(1000);
    expect(purchase.items[0].discountedPrice).toBe(100);
    expect(purchase.subtotal).toBe(1000);
    expect(purchase.taxAmount).toBe(180);
    expect(purchase.totalAmount).toBe(1180);

    // Product costPrice should be ₹100
    const productRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(productRes.body.data.costPrice).toBe(100);
  });

  /**
   * Test 3 — Different discount (10%)
   * Quantity: 5
   * Rate: 200
   * Discount: 10%
   * GST: 18%
   * Expected taxable value: 900.00
   * Expected total: 1,062.00
   */
  it('Test 3 — Different discount (10%) calculates gross, discount, and taxable correctly', async () => {
    const productId = await createProduct('Conduit Pipe', 0);

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-10DISC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        items: [
          {
            productId,
            purchasePrice: 200,
            quantity: 5,
            discountPercent: 10,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const purchase = purchaseRes.body.data;

    expect(purchase.items[0].discountAmount).toBe(100);
    expect(purchase.items[0].taxableAmount).toBe(900);
    expect(purchase.items[0].discountedPrice).toBe(180);
    expect(purchase.subtotal).toBe(900);
    expect(purchase.taxAmount).toBe(162);
    expect(purchase.totalAmount).toBe(1062);

    // Product costPrice should become ₹180
    const productRes = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(productRes.body.data.costPrice).toBe(180);
  });

  /**
   * Test 4 — Invalid discount validation
   * Test negative discount and discount greater than 100%.
   */
  it('Test 4 — Rejects negative discount percentage and discount greater than 100%', async () => {
    const productId = await createProduct('Test Item', 0);

    // Case A: Negative discount percentage
    const resNegative = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 100,
            quantity: 5,
            discountPercent: -5,
          },
        ],
      });
    expect(resNegative.status).toBe(400);

    // Case B: Discount > 100%
    const resOverHundred = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 100,
            quantity: 5,
            discountPercent: 110,
          },
        ],
      });
    expect(resOverHundred.status).toBe(400);

    // Case C: Negative discount amount
    const resNegativeAmount = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        items: [
          {
            productId,
            purchasePrice: 100,
            quantity: 5,
            discountAmount: -50,
          },
        ],
      });
    expect(resNegativeAmount.status).toBe(400);
  });

  /**
   * Test 5 — AI extraction with 62% discount
   * Verifies that when Gemini extracts an invoice with 62% discount, matching items contain discount details
   */
  it('Test 5 — AI invoice extraction maps discountPercent, discountAmount, and effective costPrice', async () => {
    process.env.GEMINI_API_KEY = 'mock_key_for_test';

    const mockExtractedData: geminiService.ExtractionResult = {
      extracted: {
        supplier: {
          supplierName: 'RAJ LAXMI ENTERPRISES',
          supplierGSTIN: '08AABCR1234F1Z9',
          supplierAddress: 'Jaipur, Rajasthan',
          supplierState: 'Rajasthan',
          supplierStateCode: '08',
          supplierPhone: '9876543210',
        },
        invoice: {
          invoiceNumber: 'INV-560',
          invoiceDate: '2026-06-22',
          poNumber: null,
          paymentTerms: null,
          deliveryNoteNo: null,
          deliveryNoteDate: null,
          ewayBillNo: null,
          placeOfSupply: 'Rajasthan (08)',
          irn: null,
          acknowledgementNumber: null,
          acknowledgementDate: null,
        },
        items: [
          {
            itemName: '6A SWITCH',
            hsnSac: '8536',
            quantity: 160,
            unit: 'Pcs',
            unitPrice: 180,
            discountPercent: 62,
            discountAmount: 17856,
            taxableAmount: 10944,
            gstRate: 18,
            cgstRate: 9,
            cgstAmount: 984.96,
            sgstRate: 9,
            sgstAmount: 984.96,
            igstRate: 0,
            igstAmount: 0,
            lineTotal: 12913.92,
          },
        ],
        totals: {
          taxableAmount: 10944,
          totalDiscount: 17856,
          totalCGST: 984.96,
          totalSGST: 984.96,
          totalIGST: 0,
          totalGST: 1969.92,
          roundOff: 0,
          grandTotal: 12913.92,
        },
      },
      metadata: {
        fileName: 'raj_laxmi_560.pdf',
        fileType: 'application/pdf',
      },
      validation: {
        itemsCalculationMatch: true,
        totalsCalculationMatch: true,
        warnings: [],
      },
    };

    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockExtractedData);

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill content'), {
        filename: 'raj_laxmi_560.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const matchingItems = res.body.data.matching.items;
    expect(matchingItems.length).toBe(1);
    expect(matchingItems[0].unitPrice).toBe(180);
    expect(matchingItems[0].discountPercent).toBe(62);
    expect(matchingItems[0].discountAmount).toBe(17856);
    expect(matchingItems[0].taxableAmount).toBe(10944);
    expect(matchingItems[0].effectiveUnitPrice).toBe(68.40);
    expect(matchingItems[0].lineTotal).toBe(12913.92);
    expect(matchingItems[0].matchedProduct.costPrice).toBe(68.40);
  });

  /**
   * Test 6 — Existing purchase compatibility
   * Verifies that legacy purchase records in the database without discount fields load correctly with default discount 0
   */
  it('Test 6 — Legacy purchase records without discount fields load cleanly with default 0 discount', async () => {
    const productId = await createProduct('Legacy Switch', 150);

    // Direct Mongoose insertion simulating a pre-existing purchase without discount fields
    const legacyPurchaseDoc = await Purchase.create({
      purchaseNumber: `LEGACY-PUR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber: `LEGACY-INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      supplier: supplierId,
      purchaseDate: new Date(),
      items: [
        {
          product: productId,
          productName: 'Legacy Switch',
          sku: 'LEGACY-SKU',
          purchasePrice: 150,
          quantity: 4,
          taxRate: 18,
          taxAmount: 108,
          totalCost: 708,
        },
      ],
      subtotal: 600,
      taxAmount: 108,
      totalAmount: 708,
      createdBy: (await Supplier.findById(supplierId))?._id, // valid ObjectId
    });

    const getRes = await request(app)
      .get(`/api/purchases/${legacyPurchaseDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    const item = getRes.body.data.items[0];
    expect(item.purchasePrice).toBe(150);
    expect(item.discountPercent).toBe(0);
    expect(item.discountAmount).toBe(0);
    expect(item.taxableAmount).toBe(600);
    expect(item.discountedPrice).toBe(150);
    expect(item.totalCost).toBe(708);
    expect(getRes.body.data.totalAmount).toBe(708);
  });

  /**
   * Test 7 — Complete purchase flow with new product creation and stock valuation
   */
  it('Test 7 — Complete purchase creation with inline new product sets product costPrice to discounted rate', async () => {
    const timestamp = Date.now();
    const newProdName = `Inline 6A Socket ${timestamp}`;

    const purchaseRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId,
        invoiceNumber: `INV-NEWPROD-${timestamp}`,
        items: [
          {
            newProduct: {
              name: newProdName,
              unit: 'Pcs',
              category: 'Electrical Supplies',
            },
            purchasePrice: 302,
            quantity: 30,
            discountPercent: 62,
            taxRate: 18,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    const purchase = purchaseRes.body.data;

    // Rate 302 * 30 = 9060 gross
    // 62% disc = 5617.20
    // Taxable = 3442.80
    // Effective cost = 3442.80 / 30 = 114.76
    expect(purchase.items[0].purchasePrice).toBe(302);
    expect(purchase.items[0].discountPercent).toBe(62);
    expect(purchase.items[0].discountAmount).toBe(5617.20);
    expect(purchase.items[0].taxableAmount).toBe(3442.80);
    expect(purchase.items[0].discountedPrice).toBe(114.76);

    // Verify created Product document in database
    const createdProduct = await Product.findOne({ name: newProdName });
    expect(createdProduct).toBeDefined();
    expect(createdProduct!.costPrice).toBe(114.76);
    expect(createdProduct!.currentStock).toBe(30);
  });
});
