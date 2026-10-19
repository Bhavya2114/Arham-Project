import fs from 'fs';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { Project } from '../../src/models/Project';
import { Customer } from '../../src/models/Customer';
import { getAuthToken } from '../helpers/auth.helper';

describe('Project Profitability Report Count & Status Audit Suite', () => {
  let adminToken: string;
  let reportsJsxContent: string;
  let testCustomer: any;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // Read the frontend Reports.jsx source file to verify UI changes
    const reportsJsxPath = path.resolve(__dirname, '../../../frontend/src/pages/Reports.jsx');
    reportsJsxContent = fs.readFileSync(reportsJsxPath, 'utf-8');

    // Create a dedicated test customer for deterministic project status testing
    testCustomer = await Customer.create({
      name: `Audit Customer ${Date.now()}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `audit_customer_${Date.now()}@test.com`,
      type: 'RETAIL',
      createdBy: new mongoose.Types.ObjectId(),
    });
  });

  afterAll(async () => {
    if (testCustomer) {
      await Project.deleteMany({ customer: testCustomer._id });
      await Customer.findByIdAndDelete(testCustomer._id);
    }
  });

  describe('Frontend Reports.jsx UI Verification', () => {
    it('1. Report count badge displays "X Projects", NOT "X Active Projects"', () => {
      // The count is shown as the "Total projects" card
      expect(reportsJsxContent).toContain('const allCount = projectsProfitability.length;');
      expect(reportsJsxContent).toContain("{ label: 'Total projects', value: allCount");
      // Must NOT contain Active Projects in the Projects Profitability section
      expect(reportsJsxContent).not.toMatch(/\{projectsProfitability\.length\}\s+Active\s+Projects/i);
    });

    it('2 & 4. Status column exists immediately after Code column in table header and body', () => {
      // Check the table header order: Code followed by Status
      const headerCodeIndex = reportsJsxContent.indexOf('<th className="px-4 py-3">Code</th>');
      const headerStatusIndex = reportsJsxContent.indexOf('<th className="px-4 py-3 text-center">Status</th>');
      const headerBudgetIndex = reportsJsxContent.indexOf('<th className="px-4 py-3 text-right">Budget</th>');

      expect(headerCodeIndex).toBeGreaterThan(-1);
      expect(headerStatusIndex).toBeGreaterThan(headerCodeIndex);
      expect(headerBudgetIndex).toBeGreaterThan(headerStatusIndex);

      // Check table body row contains status cell
      expect(reportsJsxContent).toContain('STATUS_BADGES[status]');
      expect(reportsJsxContent).toContain("replace('_', ' ')");
    });
  });

  describe('Backend API & Multi-Status Inclusion Verification', () => {
    let completedProject: any;
    let activeProject: any;
    let cancelledProject: any;
    let reportItems: any[] = [];

    beforeAll(async () => {
      const now = Date.now();
      completedProject = await Project.create({
        projectCode: `PRJ-CMP-${now}`,
        name: `Completed Test Project ${now}`,
        customer: testCustomer._id,
        siteAddress: 'Completed Site, Mumbai',
        startDate: new Date('2026-01-01'),
        status: 'COMPLETED',
        budget: 50000,
        createdBy: new mongoose.Types.ObjectId(),
      });

      activeProject = await Project.create({
        projectCode: `PRJ-ACT-${now}`,
        name: `Active Test Project ${now}`,
        customer: testCustomer._id,
        siteAddress: 'Active Site, Mumbai',
        startDate: new Date('2026-02-01'),
        status: 'IN_PROGRESS',
        budget: 75000,
        createdBy: new mongoose.Types.ObjectId(),
      });

      cancelledProject = await Project.create({
        projectCode: `PRJ-CAN-${now}`,
        name: `Cancelled Test Project ${now}`,
        customer: testCustomer._id,
        siteAddress: 'Cancelled Site, Mumbai',
        startDate: new Date('2026-03-01'),
        status: 'CANCELLED',
        budget: 25000,
        createdBy: new mongoose.Types.ObjectId(),
      });

      const res = await request(app)
        .get('/api/reports/projects-profitability')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      reportItems = res.body.data;
    });

    it('2 & 3. Count represents all projects and COMPLETED projects are included', () => {
      expect(Array.isArray(reportItems)).toBe(true);
      const foundCompleted = reportItems.find((p: any) => p.projectCode === completedProject.projectCode);
      expect(foundCompleted).toBeDefined();
      expect(foundCompleted.status).toBe('COMPLETED');
    });

    it('5. ACTIVE / IN_PROGRESS project returns status correctly', () => {
      const foundActive = reportItems.find((p: any) => p.projectCode === activeProject.projectCode);
      expect(foundActive).toBeDefined();
      expect(foundActive.status).toBe('IN_PROGRESS');
    });

    it('6. COMPLETED project returns status COMPLETED', () => {
      const foundCompleted = reportItems.find((p: any) => p.projectCode === completedProject.projectCode);
      expect(foundCompleted).toBeDefined();
      expect(foundCompleted.status).toBe('COMPLETED');
    });

    it('7. CANCELLED project returns status CANCELLED', () => {
      const foundCancelled = reportItems.find((p: any) => p.projectCode === cancelledProject.projectCode);
      expect(foundCancelled).toBeDefined();
      expect(foundCancelled.status).toBe('CANCELLED');
    });

    it('8. Existing profitability calculations remain unchanged', () => {
      const foundCompleted = reportItems.find((p: any) => p.projectCode === completedProject.projectCode);

      expect(foundCompleted).toBeDefined();
      expect(foundCompleted.projectBudget).toBe(50000);
      expect(foundCompleted.totalMaterialCost).toBe(0);
      expect(foundCompleted.totalProjectExpenses).toBe(0);
      expect(foundCompleted.actualProjectCost).toBe(0);
      expect(foundCompleted.projectProfit).toBe(50000);
      expect(foundCompleted.projectMargin).toBe(100);
    });

    it('9. Purchase Report still works', async () => {
      const res = await request(app)
        .get('/api/reports/purchases?range=month')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
    });

    it('10. GST & Tax Summary report still works', async () => {
      const res = await request(app)
        .get('/api/reports/gst-summary?range=month')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('netGstPosition');
    });
  });
});
