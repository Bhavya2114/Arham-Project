import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import * as geminiService from '../../src/services/geminiInvoice.service';
import { parseExplicitRoundOff, extractedTotalsSchema } from '../../src/validators/billExtraction.validator';
import { calculatePurchaseTotals } from '../../src/utils/purchaseCalculations';
import { Purchase } from '../../src/models/Purchase';
import { Product } from '../../src/models/Product';
import { Supplier } from '../../src/models/Supplier';
import { User } from '../../src/models/User';

describe('Conditional Rounded-Off Detection and Financial Calculations', () => {
  let adminToken: string;
  let adminUserId: any;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
    const user = await User.findOne({ email: 'admin@erp.com' });
    adminUserId = user ? user._id : undefined;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. UNIT TESTS FOR PARSER & VALIDATOR: VARIOUS OCR VARIATIONS
  // =========================================================================
  describe('parseExplicitRoundOff & extractedTotalsSchema unit tests', () => {
    it('Scenario 1: Parses dynamic positive rounded-off string "Add : Rounded Off (+)     0.37"', () => {
      const res = parseExplicitRoundOff('Add : Rounded Off (+)     0.37');
      expect(res).not.toBeNull();
      expect(res?.amount).toBe(0.37);
      expect(res?.type).toBe('add');
    });

    it('Scenario 1 variation: Parses "+0.37" and numeric 0.37', () => {
      const res1 = parseExplicitRoundOff('+0.37');
      expect(res1).toEqual({ amount: 0.37, type: 'add' });

      const res2 = parseExplicitRoundOff(0.37);
      expect(res2).toEqual({ amount: 0.37, type: 'add' });

      const res3 = parseExplicitRoundOff('Rounded Off (+) 0.37');
      expect(res3).toEqual({ amount: 0.37, type: 'add' });
    });

    it('Scenario 2: Parses dynamic negative rounded-off string "Less: Rounded Off (-) 0.50"', () => {
      const res = parseExplicitRoundOff('Less: Rounded Off (-) 0.50');
      expect(res).not.toBeNull();
      expect(res?.amount).toBe(-0.5);
      expect(res?.type).toBe('less');
    });

    it('Scenario 2 variation: Parses "-0.50" and numeric -0.5', () => {
      const res1 = parseExplicitRoundOff('-0.50');
      expect(res1).toEqual({ amount: -0.5, type: 'less' });

      const res2 = parseExplicitRoundOff(-0.5);
      expect(res2).toEqual({ amount: -0.5, type: 'less' });

      const res3 = parseExplicitRoundOff('Rounded Off (-) 0.50');
      expect(res3).toEqual({ amount: -0.5, type: 'less' });
    });

    it('Scenario 3 & 4: Returns null for absent, undefined, null, or zero values without defaulting to 0', () => {
      expect(parseExplicitRoundOff(null)).toBeNull();
      expect(parseExplicitRoundOff(undefined)).toBeNull();
      expect(parseExplicitRoundOff('')).toBeNull();
      expect(parseExplicitRoundOff(0)).toBeNull();
      expect(parseExplicitRoundOff('0')).toBeNull();
      expect(parseExplicitRoundOff('0.00')).toBeNull();
      expect(parseExplicitRoundOff('₹0.00')).toBeNull();
    });

    it('Scenario 5: Returns null when rounding label is present without a valid numeric value', () => {
      expect(parseExplicitRoundOff('Rounded Off')).toBeNull();
      expect(parseExplicitRoundOff('Round Off')).toBeNull();
      expect(parseExplicitRoundOff('Add: Rounded Off (+)')).toBeNull();
      expect(parseExplicitRoundOff('Less: Rounded Off (-)')).toBeNull();
    });

    it('Schema transform: normalizes raw totals and gives roundedOffAmount priority over roundOff', () => {
      const parsed1 = extractedTotalsSchema.parse({
        taxableAmount: 1000,
        totalDiscount: 0,
        totalCGST: 90,
        totalSGST: 90,
        totalIGST: 0,
        totalGST: 180,
        roundedOffAmount: 0.37,
        roundOff: 0.37,
        grandTotal: 1180.37,
      });
      expect(parsed1.roundedOffAmount).toBe(0.37);
      expect(parsed1.roundedOffType).toBe('add');
      expect(parsed1.roundOff).toBe(0.37);

      // Absent rounding preserves null
      const parsed2 = extractedTotalsSchema.parse({
        taxableAmount: 1000,
        totalDiscount: 0,
        totalCGST: 90,
        totalSGST: 90,
        totalIGST: 0,
        totalGST: 180,
        grandTotal: 1180,
      });
      expect(parsed2.roundedOffAmount).toBeNull();
      expect(parsed2.roundedOffType).toBeNull();
      expect(parsed2.roundOff).toBeNull();
    });
  });

  // =========================================================================
  // 2. FINANCIAL CALCULATION UTILITY TESTS
  // =========================================================================
  describe('calculatePurchaseTotals financial calculations', () => {
    const sampleItems = [
      {
        quantity: 1,
        rate: 204879.72,
        grossAmount: 204879.72,
        discountPercent: 0,
        discountAmount: 0,
        taxableValue: 204879.72,
        discountedUnitPrice: 204879.72,
        taxRate: 18,
        rateGst: 36878.28,
        lineTax: 36878.28,
        cgstAmount: 18439.14,
        sgstAmount: 18439.14,
        igstAmount: 0,
        totalCost: 241758.00,
      },
    ];

    it('Scenario 1: Invoice with Rounded Off (+) 0.37 calculates Grand Total = Taxable + GST + 0.37', () => {
      const totals = calculatePurchaseTotals({
        items: sampleItems,
        suppliedCgst: 18439.14,
        suppliedSgst: 18439.14,
        roundedOffAmount: 0.37,
      });

      expect(totals.subtotal).toBe(204879.72);
      expect(totals.taxAmount).toBe(36878.28);
      // 204879.72 + 36878.28 + 0.37 = 241758.37
      expect(totals.totalAmount).toBe(241758.37);
      expect(totals.grandTotal).toBe(241758.37);
    });

    it('Scenario 2: Invoice with Rounded Off (-) 0.50 calculates Grand Total = Taxable + GST - 0.50', () => {
      const totals = calculatePurchaseTotals({
        items: sampleItems,
        suppliedCgst: 18439.14,
        suppliedSgst: 18439.14,
        roundedOffAmount: -0.50,
      });

      // 204879.72 + 36878.28 - 0.50 = 241757.50
      expect(totals.totalAmount).toBe(241757.50);
      expect(totals.grandTotal).toBe(241757.50);
    });

    it('Scenario 3 & 4: Invoice without any rounded-off line applies no rounding adjustment', () => {
      const totals = calculatePurchaseTotals({
        items: sampleItems,
        suppliedCgst: 18439.14,
        suppliedSgst: 18439.14,
        roundedOffAmount: null,
      });

      // 204879.72 + 36878.28 = 241758.00
      expect(totals.totalAmount).toBe(241758.00);
    });
  });

  // =========================================================================
  // 3. OCR EXTRACTION API TESTS WITH ROUNDED OFF
  // =========================================================================
  describe('POST /api/purchases/extract-bill with rounded-off extraction', () => {
    it('Extracts explicit positive rounding line and returns roundedOffAmount & roundedOffType', async () => {
      process.env.GEMINI_API_KEY = 'test_mock_gemini_key';

      const mockData: geminiService.ExtractionResult = {
        extracted: {
          supplier: {
            supplierName: 'Om Electricals',
            supplierGSTIN: '27AABCU9603R1ZM',
            supplierAddress: 'Pune',
            supplierState: 'Maharashtra',
            supplierStateCode: '27',
            supplierPhone: '9876543210',
          },
          invoice: {
            invoiceNumber: 'INV-ROUND-001',
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
          items: [
            {
              itemName: 'Polycab 2.5 Sqmm Wire',
              hsnSac: '8544',
              quantity: 1,
              unit: 'Box',
              unitPrice: 204879.35,
              discountPercent: 0,
              discountAmount: 0,
              taxableAmount: 204879.35,
              gstRate: 18,
              cgstRate: 9,
              cgstAmount: 18439.14,
              sgstRate: 9,
              sgstAmount: 18439.14,
              igstRate: 0,
              igstAmount: 0,
              lineTotal: 241757.63,
            },
          ],
          totals: {
            taxableAmount: 204879.35,
            totalDiscount: 0,
            totalCGST: 18439.14,
            totalSGST: 18439.14,
            totalIGST: 0,
            totalGST: 36878.28,
            roundedOffAmount: 0.37,
            roundedOffType: 'add',
            roundOff: 0.37,
            grandTotal: 241758.00,
          },
        },
        metadata: {
          fileName: 'uploaded_invoice.pdf',
          fileType: 'application/pdf',
        },
        validation: {
          itemsCalculationMatch: true,
          totalsCalculationMatch: true,
          warnings: [],
        },
      };

      jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockData);

      const res = await request(app)
        .post('/api/purchases/extract-bill')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('bill', Buffer.from('mock pdf invoice content'), {
          filename: 'uploaded_invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.extracted.totals.roundedOffAmount).toBe(0.37);
      expect(res.body.data.extracted.totals.roundedOffType).toBe('add');
      expect(res.body.data.extracted.totals.grandTotal).toBe(241758.00);
    });

    it('Extracts bill without rounding line and returns roundedOffAmount=null without auto-inferring', async () => {
      process.env.GEMINI_API_KEY = 'test_mock_gemini_key';

      const mockData: geminiService.ExtractionResult = {
        extracted: {
          supplier: {
            supplierName: 'No Rounding Supplier',
            supplierGSTIN: '27AABCU9603R1Z2',
            supplierAddress: null,
            supplierState: null,
            supplierStateCode: null,
            supplierPhone: null,
          },
          invoice: {
            invoiceNumber: 'INV-NOROUND-002',
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
          items: [
            {
              itemName: 'Modular Switches',
              hsnSac: '8536',
              quantity: 10,
              unit: 'Pcs',
              unitPrice: 100,
              discountPercent: 0,
              discountAmount: 0,
              taxableAmount: 1000,
              gstRate: 18,
              cgstRate: 9,
              cgstAmount: 90,
              sgstRate: 9,
              sgstAmount: 90,
              igstRate: 0,
              igstAmount: 0,
              lineTotal: 1180,
            },
          ],
          totals: {
            taxableAmount: 1000,
            totalDiscount: 0,
            totalCGST: 90,
            totalSGST: 90,
            totalIGST: 0,
            totalGST: 180,
            roundedOffAmount: null,
            roundedOffType: null,
            roundOff: null,
            grandTotal: 1180,
          },
        },
        metadata: {
          fileName: 'no_round_bill.pdf',
          fileType: 'application/pdf',
        },
        validation: {
          itemsCalculationMatch: true,
          totalsCalculationMatch: true,
          warnings: [],
        },
      };

      jest.spyOn(geminiService, 'extractInvoiceFromBuffer').mockResolvedValue(mockData);

      const res = await request(app)
        .post('/api/purchases/extract-bill')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('bill', Buffer.from('mock pdf content'), {
          filename: 'no_round_bill.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.extracted.totals.roundedOffAmount).toBeNull();
      expect(res.body.data.extracted.totals.roundedOffType).toBeNull();
    });
  });

  // =========================================================================
  // 4. DATABASE PERSISTENCE & HISTORICAL DATA INTEGRATION TESTS
  // =========================================================================
  describe('Purchase Model & POST /api/purchases persistence', () => {
    it('Creates purchase with roundedOffAmount: 0.37 and accurately calculates totalAmount', async () => {
      const sup = await Supplier.create({
        name: `Rounding Sup ${Date.now()}`,
        gstNumber: `27AABCU${Date.now().toString().slice(-4)}R1ZM`,
        mobile: '9876543210',
      });

      const prod = await Product.create({
        name: `Cable Wire ${Date.now()}`,
        sku: `SKU-ROUND-${Date.now()}`,
        category: 'General',
        costPrice: 204879.35,
        gstRate: 18,
        currentStock: 10,
        supplier: sup._id,
        createdBy: adminUserId,
      });

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId: sup._id.toString(),
          invoiceNumber: `INV-STORE-ROUND-${Date.now()}`,
          roundedOffAmount: 0.37,
          roundedOffType: 'add',
          items: [
            {
              productId: prod._id.toString(),
              purchasePrice: 204879.35,
              quantity: 1,
              taxRate: 18,
              taxAmount: 36878.28,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const purchaseData = res.body.data;
      expect(purchaseData.roundedOffAmount).toBe(0.37);
      expect(purchaseData.roundedOffType).toBe('add');
      // Subtotal = 204879.35, Tax = 36878.28, RoundOff = 0.37 -> Total = 241758.00
      expect(purchaseData.totalAmount).toBe(241758.00);

      // Verify GET /api/purchases/:id preserves the exact stored roundedOffAmount
      const getRes = await request(app)
        .get(`/api/purchases/${purchaseData.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.roundedOffAmount).toBe(0.37);
      expect(getRes.body.data.roundedOffType).toBe('add');
      expect(getRes.body.data.totalAmount).toBe(241758.00);
    });

    it('Scenario 6: Protect historical purchases — existing purchases without roundedOffAmount preserve stored totalAmount', async () => {
      const sup = await Supplier.create({
        name: `Historical Sup ${Date.now()}`,
        mobile: '9876543210',
      });

      const prod = await Product.create({
        name: `Historical Item ${Date.now()}`,
        sku: `SKU-HIST-${Date.now()}`,
        category: 'General',
        costPrice: 500,
        gstRate: 18,
        currentStock: 20,
        supplier: sup._id,
        createdBy: adminUserId,
      });

      // Directly insert historical purchase document without roundedOffAmount field
      const historicalDoc = await Purchase.create({
        purchaseNumber: `HIST-${Date.now()}`,
        supplier: sup._id,
        items: [
          {
            product: prod._id,
            productName: prod.name,
            sku: prod.sku,
            purchasePrice: 500,
            quantity: 2,
            taxRate: 18,
            totalCost: 1180,
          },
        ],
        subtotal: 1000,
        taxAmount: 180,
        totalAmount: 1180, // Existing stored total
        createdBy: adminUserId,
      });

      // Fetch via service/API
      const getRes = await request(app)
        .get(`/api/purchases/${historicalDoc._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      // Stored total is preserved without recalculation
      expect(getRes.body.data.totalAmount).toBe(1180);
      // Missing roundedOffAmount is safely returned as null
      expect(getRes.body.data.roundedOffAmount).toBeNull();
      expect(getRes.body.data.roundedOffType).toBeNull();
    });
  });
});
