import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import * as geminiService from '../../src/services/geminiInvoice.service';
import { Product } from '../../src/models/Product';
import { Purchase } from '../../src/models/Purchase';
import { Supplier } from '../../src/models/Supplier';

describe('POST /api/purchases/extract-bill API tests (Phase 7.4.4 Backend Gemini Extraction)', () => {
  let adminToken: string;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
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
    delete process.env.GEMINI_API_KEY;

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

    const testSup = await Supplier.create({
      name: 'ABC Electricals Pvt. Ltd.',
      companyName: 'ABC Electricals',
      gstNumber: '27ABCDE9999F1Z5',
      mobile: '9876543210',
    });

    const mockExtractedData: geminiService.ExtractionResult = {
      extracted: {
        supplier: {
          supplierName: 'ABC Electricals',
          supplierGSTIN: '27ABCDE9999F1Z5',
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
});
