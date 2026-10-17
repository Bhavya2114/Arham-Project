import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import * as geminiService from '../../src/services/geminiInvoice.service';
import { Product } from '../../src/models/Product';
import { Purchase } from '../../src/models/Purchase';
import { Supplier } from '../../src/models/Supplier';

describe('POST /api/purchases/extract-bill API tests (Phase 7.4.4 Backend Gemini Extraction)', () => {
  let adminToken: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('Test 1 — Missing file returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Purchase bill file is required');
  });

  it('Test 2 — Unsupported file format (e.g. text/plain .txt) returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('invalid file content'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Unsupported file type');
  });

  it('Test 3 — File > 10MB returns 413 Payload Too Large', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', largeBuffer, {
        filename: 'large_invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(413);
    expect(res.body.message).toContain('must not exceed 10 MB');
  });

  it('Test 7 — Missing GEMINI_API_KEY environment variable returns 500 error', async () => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('GEMINI_API_KEY')) {
        delete process.env[key];
      }
    }

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('fake pdf content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toContain('GEMINI_API_KEY environment variable is not configured');
  });

  it('Test 4, 5, 6, 10, 11 — Valid structured extraction response with mocked Gemini service', async () => {
    process.env.GEMINI_API_KEY = 'test_mock_gemini_key';

    const mockExtractedData: geminiService.ExtractionResult = {
      extracted: {
        supplier: {
          supplierName: 'Frig Care Centre',
          supplierGSTIN: '08AGWP58975J1Z0',
          supplierAddress: 'Main Road, Jaipur',
          supplierState: 'Rajasthan',
          supplierStateCode: '08',
          supplierPhone: '9876543210',
        },
        invoice: {
          invoiceNumber: 'FCC/26-27/1278',
          invoiceDate: '2026-06-22',
          poNumber: 'PO-09872',
          paymentTerms: 'CREDIT',
          deliveryNoteNo: 'DN-123',
          deliveryNoteDate: null,
          ewayBillNo: '1234 5678 9012',
          placeOfSupply: 'Rajasthan (08)',
          irn: null,
          acknowledgementNumber: null,
          acknowledgementDate: null,
        },
        items: [
          {
            itemName: 'FINOLEX 4.00 SQ MM X 200 MTR',
            hsnSac: '85446020',
            quantity: 4,
            unit: 'Roll',
            unitPrice: 10670.40,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 42681.60,
            gstRate: 18,
            cgstRate: 9,
            cgstAmount: 3841.34,
            sgstRate: 9,
            sgstAmount: 3841.34,
            igstRate: 0,
            igstAmount: 0,
            lineTotal: 50364.28,
          },
        ],
        totals: {
          taxableAmount: 42681.60,
          totalDiscount: 0,
          totalCGST: 3841.34,
          totalSGST: 3841.34,
          totalIGST: 0,
          totalGST: 7682.68,
          roundOff: -0.28,
          grandTotal: 50364.00,
        },
      },
      metadata: {
        fileName: 'sample_bill.pdf',
        fileType: 'application/pdf',
      },
      validation: {
        itemsCalculationMatch: true,
        totalsCalculationMatch: true,
        warnings: [],
      },
    };

    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockExtractedData);

    const initialPurchasesCount = await Purchase.countDocuments();
    const initialProducts = await Product.find().lean();

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill binary content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.extracted.supplier.supplierName).toBe('Frig Care Centre');
    expect(res.body.data.extracted.invoice.invoiceNumber).toBe('FCC/26-27/1278');
    expect(res.body.data.extracted.items.length).toBe(1);
    expect(res.body.data.extracted.items[0].unitPrice).toBe(10670.40);
    expect(res.body.data.extracted.totals.grandTotal).toBe(50364);

    // Test 12 & 13 — Confirm NO Purchase document created & Product stock UNCHANGED
    const finalPurchasesCount = await Purchase.countDocuments();
    expect(finalPurchasesCount).toBe(initialPurchasesCount);

    const finalProducts = await Product.find().lean();
    expect(finalProducts.length).toBe(initialProducts.length);
  });

  it('Test 14 — Bill with existing supplier correctly matches and returns matched=true, isNew=false, and supplier ID', async () => {
    process.env.GEMINI_API_KEY = 'test_mock_gemini_key';

    const uniqueGst = `27ABCDE${Date.now().toString().slice(-4)}F1Z5`;
    const testSup = await Supplier.create({
      name: `ABC Electricals ${Date.now()}`,
      companyName: 'ABC Electricals',
      gstNumber: uniqueGst,
      mobile: '9876543210',
    });

    const mockExtractedData: geminiService.ExtractionResult = {
      extracted: {
        supplier: {
          supplierName: 'ABC Electricals',
          supplierGSTIN: uniqueGst,
          supplierAddress: 'Mumbai',
          supplierState: 'Maharashtra',
          supplierStateCode: '27',
          supplierPhone: '9876543210',
        },
        invoice: {
          invoiceNumber: 'INV-TEST-001',
          invoiceDate: '2026-06-22',
          poNumber: null,
          paymentTerms: null,
          deliveryNoteNo: null,
          deliveryNoteDate: null,
          ewayBillNo: null,
          placeOfSupply: null,
          irn: null,
          acknowledgementNumber: null,
          acknowledgementDate: null,
        },
        items: [],
        totals: {
          taxableAmount: 0,
          totalDiscount: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalIGST: 0,
          totalGST: 0,
          roundOff: 0,
          grandTotal: 0,
        },
      },
      metadata: {
        fileName: 'abc_bill.pdf',
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
      .attach('bill', Buffer.from('mock pdf bill binary content'), {
        filename: 'abc_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matching.supplier.matched).toBe(true);
    expect(res.body.data.matching.supplier.isNew).toBe(false);
    expect(res.body.data.matching.supplier.id).toBe(testSup._id.toString());
  });

  it('Test 15 — Bill with completely new supplier returns matched=false, isNew=true with extracted name and GSTIN', async () => {
    process.env.GEMINI_API_KEY = 'test_mock_gemini_key';

    const mockExtractedData: geminiService.ExtractionResult = {
      extracted: {
        supplier: {
          supplierName: 'Brand New Unique Supplier 999',
          supplierGSTIN: '29BRAND9999K1Z9',
          supplierAddress: 'Bangalore',
          supplierState: 'Karnataka',
          supplierStateCode: '29',
          supplierPhone: '9988776655',
        },
        invoice: {
          invoiceNumber: 'INV-NEW-001',
          invoiceDate: '2026-06-22',
          poNumber: null,
          paymentTerms: null,
          deliveryNoteNo: null,
          deliveryNoteDate: null,
          ewayBillNo: null,
          placeOfSupply: null,
          irn: null,
          acknowledgementNumber: null,
          acknowledgementDate: null,
        },
        items: [],
        totals: {
          taxableAmount: 0,
          totalDiscount: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalIGST: 0,
          totalGST: 0,
          roundOff: 0,
          grandTotal: 0,
        },
      },
      metadata: {
        fileName: 'brand_new_bill.pdf',
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
      .attach('bill', Buffer.from('mock pdf bill binary content'), {
        filename: 'brand_new_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matching.supplier.matched).toBe(false);
    expect(res.body.data.matching.supplier.isNew).toBe(true);
    expect(res.body.data.matching.supplier.name).toBe('Brand New Unique Supplier 999');
    expect(res.body.data.matching.supplier.gstNumber).toBe('29BRAND9999K1Z9');
  });

  it('Test 12 — API extraction failure with HTTP 502 Bad Gateway when Gemini service fails', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const error502: any = new Error('Gemini AI service error (HTTP 502): Bad Gateway');
    error502.statusCode = 502;
    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockRejectedValue(error502);

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill'), {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Gemini AI service error');
  });

  it('Test 13 — Gemini quota failure with HTTP 429 Quota Exceeded when rate limit is hit', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const error429: any = new Error('Gemini AI quota exceeded (HTTP 429): Rate limit reached. Please try again later or enter details manually.');
    error429.statusCode = 429;
    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockRejectedValue(error429);

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill'), {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Gemini AI quota exceeded');
  });

  it('Test 14 — Missing numeric fields in extracted item defaults safely without NaN or undefined', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const mockIncompleteData: any = {
      extracted: {
        supplier: { supplierName: 'Test Supplier' },
        invoice: { invoiceNumber: 'INV-INCOMPLETE' },
        items: [
          {
            itemName: 'Incomplete Item',
            // quantity, unitPrice, discountPercent, taxAmount, cgstAmount, sgstAmount are undefined
          },
        ],
        totals: {},
      },
      metadata: { fileName: 'incomplete.pdf' },
      validation: { warnings: [] },
    };

    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockIncompleteData);

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill'), {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.matching.items[0];
    expect(item.quantity).toBe(1);
    expect(item.unitPrice).toBe(0);
    expect(item.discountPercent).toBe(0);
    expect(item.discountAmount).toBe(0);
    expect(item.taxableAmount).toBe(0);
    expect(item.cgstAmount).toBe(0);
    expect(item.sgstAmount).toBe(0);
    expect(item.igstAmount).toBe(0);
    expect(Number.isFinite(item.lineTotal)).toBe(true);
  });

  it('Test 15 — Undefined discount fields default safely to 0 without corrupting totals', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const mockDataNoDiscount: any = {
      extracted: {
        supplier: { supplierName: 'Standard Supplier' },
        invoice: { invoiceNumber: 'INV-STD-001' },
        items: [
          {
            itemName: 'Standard Item',
            quantity: 10,
            unitPrice: 100,
            gstRate: 18,
            // discountPercent and discountAmount are undefined
          },
        ],
        totals: { grandTotal: 1180 },
      },
      metadata: { fileName: 'standard.pdf' },
      validation: { warnings: [] },
    };

    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockDataNoDiscount);

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill'), {
        filename: 'bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.matching.items[0];
    expect(item.discountPercent).toBe(0);
    expect(item.discountAmount).toBe(0);
    expect(item.taxableAmount).toBe(1000);
    expect(item.lineTotal).toBe(1180);
  });

  it('Test 16 — Valid complete invoice data extracts 62% discount accurately', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const mockRajLaxmiInvoice: any = {
      extracted: {
        supplier: {
          supplierName: 'RAJ LAXMI ENTERPRISES',
          supplierGSTIN: '08ABCDE1234F1Z5',
        },
        invoice: {
          invoiceNumber: '560',
          invoiceDate: '2026-09-04',
        },
        items: [
          {
            itemName: 'PVC Brass Elbow 20mm',
            quantity: 160,
            unitPrice: 180,
            discountPercent: 62,
            gstRate: 18,
            hsnSac: '3917',
          },
        ],
        totals: {
          taxableAmount: 10944,
          totalDiscount: 17856,
          totalCGST: 984.96,
          totalSGST: 984.96,
          totalIGST: 0,
          grandTotal: 12913.92,
        },
      },
      metadata: { fileName: 'raj_laxmi_560.pdf' },
      validation: { warnings: [] },
    };

    jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockRajLaxmiInvoice);

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf bill'), {
        filename: 'raj_laxmi_560.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.matching.items[0];
    expect(item.quantity).toBe(160);
    expect(item.unitPrice).toBe(180);
    expect(item.discountPercent).toBe(62);
    expect(item.discountAmount).toBe(17856);
    expect(item.taxableAmount).toBe(10944);
    expect(item.effectiveUnitPrice).toBe(68.4);
    expect(item.cgstAmount).toBe(984.96);
    expect(item.sgstAmount).toBe(984.96);
    expect(item.lineTotal).toBe(12913.92);
  });
});
