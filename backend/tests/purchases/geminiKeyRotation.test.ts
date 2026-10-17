import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';
import { geminiKeyManager, maskApiKey } from '../../src/services/geminiKeyManager.service';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      apiKey: string;
      models: { generateContent: (args: any) => any };
      constructor(config: { apiKey: string }) {
        this.apiKey = config?.apiKey;
        this.models = {
          generateContent: (args: any) => mockGenerateContent(this.apiKey, args),
        };
      }
    },
  };
});

const sampleValidInvoice = {
  supplier: {
    supplierName: 'Arham Test Supplier Pvt Ltd',
    supplierGSTIN: '08ABCDE1234F1Z5',
    supplierAddress: '123 Commercial Hub, Jaipur',
    supplierState: 'Rajasthan',
    supplierStateCode: '08',
    supplierPhone: '9876543210',
  },
  invoice: {
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-06-22',
    poNumber: 'PO-999',
    paymentTerms: 'Credit 30 Days',
    deliveryNoteNo: null,
    deliveryNoteDate: null,
    ewayBillNo: null,
    placeOfSupply: 'Rajasthan',
    irn: null,
    acknowledgementNumber: null,
    acknowledgementDate: null,
  },
  items: [
    {
      itemName: 'Galvanized Steel Sheet 2mm',
      hsnSac: '7208',
      quantity: 10,
      unit: 'Pcs',
      unitPrice: 1500,
      discountPercent: 10,
      discountAmount: 1500,
      taxableAmount: 13500,
      gstRate: 18,
      cgstRate: 9,
      cgstAmount: 1215,
      sgstRate: 9,
      sgstAmount: 1215,
      igstRate: 0,
      igstAmount: 0,
      lineTotal: 15930,
    },
  ],
  totals: {
    taxableAmount: 13500,
    totalDiscount: 1500,
    totalCGST: 1215,
    totalSGST: 1215,
    totalIGST: 0,
    totalGST: 2430,
    roundOff: 0,
    grandTotal: 15930,
  },
};

describe('Gemini API Key Rotation and Failover Suite', () => {
  let adminToken: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');
  });

  beforeEach(() => {
    // Clean all GEMINI_API_KEY environment variables before each test
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('GEMINI_API_KEY')) {
        delete process.env[key];
      }
    }
    geminiKeyManager.resetStates();
    mockGenerateContent.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('1. Single configured GEMINI_API_KEY_1 works normally', async () => {
    process.env.GEMINI_API_KEY_1 = 'key_alpha_111111';

    mockGenerateContent.mockImplementation((apiKey: string) => {
      expect(apiKey).toBe('key_alpha_111111');
      return Promise.resolve({
        text: JSON.stringify(sampleValidInvoice),
      });
    });

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.extracted.invoice.invoiceNumber).toBe('INV-2026-001');
    expect(res.body.data.extracted.items.length).toBe(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Verify key is not leaked in response
    expect(JSON.stringify(res.body)).not.toContain('key_alpha_111111');
  });

  it('2. Multiple configured keys work normally using primary key when it succeeds', async () => {
    process.env.GEMINI_API_KEY_1 = 'primary_key_11111';
    process.env.GEMINI_API_KEY_2 = 'secondary_key_22222';

    mockGenerateContent.mockImplementation((apiKey: string) => {
      expect(apiKey).toBe('primary_key_11111');
      return Promise.resolve({
        text: JSON.stringify(sampleValidInvoice),
      });
    });

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('3. CRITICAL TEST: Simulated quota/rate-limit error on API 1 automatically fails over to API 2 and succeeds', async () => {
    process.env.GEMINI_API_KEY_1 = 'quota_exhausted_key_1';
    process.env.GEMINI_API_KEY_2 = 'healthy_working_key_2';

    const attemptedKeys: string[] = [];

    mockGenerateContent.mockImplementation((apiKey: string) => {
      attemptedKeys.push(apiKey);

      if (apiKey === 'quota_exhausted_key_1') {
        const quotaErr: any = new Error('Resource has been exhausted (e.g. check quota) - 429 RESOURCE_EXHAUSTED');
        quotaErr.status = 429;
        return Promise.reject(quotaErr);
      }

      if (apiKey === 'healthy_working_key_2') {
        return Promise.resolve({
          text: JSON.stringify(sampleValidInvoice),
        });
      }

      return Promise.reject(new Error('Unknown key'));
    });

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(attemptedKeys).toEqual(['quota_exhausted_key_1', 'healthy_working_key_2']);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);

    // Verify the extracted invoice data and Review Purchase workflow expectations
    expect(res.body.data.extracted.invoice.invoiceNumber).toBe('INV-2026-001');
    expect(res.body.data.extracted.supplier.supplierName).toBe('Arham Test Supplier Pvt Ltd');
    expect(res.body.data.extracted.items[0].itemName).toBe('Galvanized Steel Sheet 2mm');
    expect(res.body.data.extracted.totals.grandTotal).toBe(15930);

    // Verify Review Purchase matching structures are present
    expect(res.body.data.matching).toBeDefined();
    expect(res.body.data.matching.supplier).toBeDefined();
    expect(res.body.data.matching.items).toBeDefined();
    expect(res.body.data.matching.items[0].extractedItemName).toBe('Galvanized Steel Sheet 2mm');

    // Verify no keys leaked in response
    expect(JSON.stringify(res.body)).not.toContain('quota_exhausted_key_1');
    expect(JSON.stringify(res.body)).not.toContain('healthy_working_key_2');
  });

  it('4. If all configured keys fail due to quota exhaustion, returns controlled HTTP 429 error', async () => {
    process.env.GEMINI_API_KEY_1 = 'key_exhausted_1';
    process.env.GEMINI_API_KEY_2 = 'key_exhausted_2';

    mockGenerateContent.mockImplementation((_apiKey: string) => {
      const quotaErr: any = new Error('Quota exceeded 429');
      quotaErr.status = 429;
      return Promise.reject(quotaErr);
    });

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Gemini AI quota exceeded');
    expect(res.body.message).toContain('All configured Gemini API keys (2 keys) have exceeded their quota');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('5. Safe handling of empty, whitespace, or missing environment variables', () => {
    process.env.GEMINI_API_KEY_1 = '   ';
    process.env.GEMINI_API_KEY_2 = 'valid_key_two';
    process.env.GEMINI_API_KEY_3 = '';

    const keys = geminiKeyManager.getConfiguredKeys();
    expect(keys.length).toBe(1);
    expect(keys[0].name).toBe('GEMINI_API_KEY_2');
    expect(keys[0].key).toBe('valid_key_two');
  });

  it('6. Dynamic discovery of unlimited future keys (e.g. GEMINI_API_KEY_5, GEMINI_API_KEY_10)', () => {
    process.env.GEMINI_API_KEY_10 = 'key_ten';
    process.env.GEMINI_API_KEY_2 = 'key_two';
    process.env.GEMINI_API_KEY_5 = 'key_five';

    const keys = geminiKeyManager.getConfiguredKeys();
    expect(keys.length).toBe(3);
    // Keys must be ordered numerically: 2, 5, 10
    expect(keys[0].name).toBe('GEMINI_API_KEY_2');
    expect(keys[1].name).toBe('GEMINI_API_KEY_5');
    expect(keys[2].name).toBe('GEMINI_API_KEY_10');
  });

  it('7. Backward compatibility with legacy GEMINI_API_KEY', () => {
    process.env.GEMINI_API_KEY = 'legacy_gemini_key';

    const keys = geminiKeyManager.getConfiguredKeys();
    expect(keys.length).toBe(1);
    expect(keys[0].name).toBe('GEMINI_API_KEY');
    expect(keys[0].key).toBe('legacy_gemini_key');
  });

  it('8. Non-recoverable errors (e.g. invalid JSON response) do not waste quota or trigger key rotation', async () => {
    process.env.GEMINI_API_KEY_1 = 'key_1';
    process.env.GEMINI_API_KEY_2 = 'key_2';

    mockGenerateContent.mockImplementation((apiKey: string) => {
      expect(apiKey).toBe('key_1');
      return Promise.resolve({
        text: 'Not a JSON document at all',
      });
    });

    const res = await request(app)
      .post('/api/purchases/extract-bill')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('bill', Buffer.from('mock pdf content'), {
        filename: 'sample_bill.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(502);
    expect(res.body.message).toContain('Failed to parse Gemini response as JSON');
    // Only key 1 was attempted; key 2 was NOT wasted!
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('9. API key masking function correctly masks secrets', () => {
    expect(maskApiKey('AIzaSyD-1234567890-AbCdEfG')).toBe('AIza...dEfG');
    expect(maskApiKey('short')).toBe('****');
    expect(maskApiKey('')).toBe('');
  });
});
