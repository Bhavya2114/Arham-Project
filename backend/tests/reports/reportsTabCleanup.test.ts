import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../../src/app';
import { getAuthToken } from '../helpers/auth.helper';

describe('Reports & Analytics Tab Cleanup & Inventory Preservation Suite', () => {
  let adminToken: string;
  let reportsJsxContent: string;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // Read the frontend Reports.jsx source file to verify tab definitions and structure
    const reportsJsxPath = path.resolve(__dirname, '../../../frontend/src/pages/Reports.jsx');
    reportsJsxContent = fs.readFileSync(reportsJsxPath, 'utf-8');
  });

  describe('Frontend Reports & Analytics UI Navigation Verification', () => {
    it('1. Reports page contains Projects Profitability tab', () => {
      // The page now shows only the projects profitability report, with no tabs
      expect(reportsJsxContent).toContain("axiosInstance.get('/reports/projects-profitability')");
      expect(reportsJsxContent).not.toContain('setActiveTab(');
    });

    it('2. Reports page does NOT contain Purchase Report tab and cannot select it', () => {
      expect(reportsJsxContent).not.toMatch(/Purchase Report/i);
      expect(reportsJsxContent).not.toContain("setActiveTab('purchases')");
    });

    it('3. Reports page does NOT contain GST & Tax Summary tab and cannot select it', () => {
      expect(reportsJsxContent).not.toMatch(/GST & Tax Summary/i);
      expect(reportsJsxContent).not.toContain("setActiveTab('gst')");
    });

    it('4. Reports page does NOT contain Inventory Analytics tab', () => {
      expect(reportsJsxContent).not.toMatch(/Inventory Analytics/i);
      expect(reportsJsxContent).not.toContain("setActiveTab('inventory')");
      expect(reportsJsxContent).not.toContain('/reports/inventory');
    });

    it('5. Reports page does NOT contain Low Stock Alert tab', () => {
      expect(reportsJsxContent).not.toMatch(/Low Stock Alert/i);
      expect(reportsJsxContent).not.toContain("setActiveTab('low-stock')");
      expect(reportsJsxContent).not.toContain('/reports/low-stock');
    });
  });

  describe('Existing Three Reports Functionality Verification', () => {
    it('6a. Projects Profitability report returns 200 with valid data structure', async () => {
      const res = await request(app)
        .get('/api/reports/projects-profitability')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('6b. Purchase Report returns 200 with valid data structure', async () => {
      const res = await request(app)
        .get('/api/reports/purchases?range=month')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('orderCount');
      expect(res.body.data.summary).toHaveProperty('netPurchases');
      expect(res.body.data.summary).toHaveProperty('grossPurchases');
      expect(Array.isArray(res.body.data.supplierAnalysis)).toBe(true);
    });

    it('6c. GST & Tax Summary report returns 200 with valid data structure', async () => {
      const res = await request(app)
        .get('/api/reports/gst-summary?range=month')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('taxablePurchases');
      expect(res.body.data.summary).toHaveProperty('inputGst');
      expect(res.body.data.summary).toHaveProperty('taxableOutput');
      expect(res.body.data.summary).toHaveProperty('outputGst');
      expect(res.body.data.summary).toHaveProperty('netGstPosition');
      expect(Array.isArray(res.body.data.purchaseTransactions)).toBe(true);
      expect(Array.isArray(res.body.data.outputTransactions)).toBe(true);
    });
  });

  describe('Inventory Module Operational Preservation', () => {
    it('7. Inventory Low Stock functionality remains intact and working', async () => {
      const res = await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('8. Inventory Products and Categories operational endpoints remain intact', async () => {
      const prodRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prodRes.status).toBe(200);
      expect(prodRes.body.success).toBe(true);
      expect(Array.isArray(prodRes.body.data)).toBe(true);

      const catRes = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(catRes.status).toBe(200);
      expect(catRes.body.success).toBe(true);
      expect(Array.isArray(catRes.body.data)).toBe(true);
    });
  });
});
