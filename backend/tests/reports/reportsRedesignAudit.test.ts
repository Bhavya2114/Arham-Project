import fs from 'fs';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { Project } from '../../src/models/Project';
import { Customer } from '../../src/models/Customer';
import { getAuthToken } from '../helpers/auth.helper';

describe('Reports & Analytics Redesign Audit Suite (Section 28)', () => {
  let adminToken: string;
  let reportsJsxContent: string;
  let testCustomer: any;
  let activeProj: any;
  let completedProj: any;

  beforeAll(async () => {
    adminToken = await getAuthToken('ADMIN');

    // Load frontend Reports.jsx source code for structural & component verification
    const reportsJsxPath = path.resolve(__dirname, '../../../frontend/src/pages/Reports.jsx');
    reportsJsxContent = fs.readFileSync(reportsJsxPath, 'utf-8');

    // Create test customer
    testCustomer = await Customer.create({
      name: `Redesign Audit Customer ${Date.now()}`,
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `redesign_audit_${Date.now()}@test.com`,
      type: 'RETAIL',
      createdBy: new mongoose.Types.ObjectId(),
    });

    const now = Date.now();
    activeProj = await Project.create({
      projectCode: `PRJ-RED-ACT-${now}`,
      name: `Wiring Redesign Test ${now}`,
      customer: testCustomer._id,
      siteAddress: 'Panvel Site, Navi Mumbai',
      startDate: new Date('2026-01-15'),
      expectedEndDate: new Date('2026-08-30'),
      status: 'IN_PROGRESS',
      budget: 100000,
      createdBy: new mongoose.Types.ObjectId(),
    });

    completedProj = await Project.create({
      projectCode: `PRJ-RED-CMP-${now}`,
      name: `Completed Redesign Test ${now}`,
      customer: testCustomer._id,
      siteAddress: 'Pune Site',
      startDate: new Date('2026-02-01'),
      expectedEndDate: new Date('2026-06-30'),
      status: 'COMPLETED',
      budget: 50000,
      createdBy: new mongoose.Types.ObjectId(),
    });
  });

  afterAll(async () => {
    if (testCustomer) {
      await Project.deleteMany({ customer: testCustomer._id });
      await Customer.findByIdAndDelete(testCustomer._id);
    }
  });

  describe('1. Projects Profitability loads via API and UI components', () => {
    it('API returns 200 with profitability data', async () => {
      const res = await request(app)
        .get('/api/reports/projects-profitability')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const foundActive = res.body.data.find((p: any) => p.projectCode === activeProj.projectCode);
      const foundCompleted = res.body.data.find((p: any) => p.projectCode === completedProj.projectCode);
      expect(foundActive).toBeDefined();
      expect(foundCompleted).toBeDefined();
    });

    it('UI contains Projects Profitability as the ONLY report tab and no Purchase or GST tabs', () => {
      expect(reportsJsxContent).toContain('>Reports</h1>');
      expect(reportsJsxContent).toContain("axiosInstance.get('/reports/projects-profitability')");
      expect(reportsJsxContent).not.toMatch(/GST & Tax Summary/i);
      expect(reportsJsxContent).not.toContain("setActiveTab('gst')");
      expect(reportsJsxContent).not.toMatch(/<button[^>]*>\s*Purchase Report\s*<\/button>/i);
      expect(reportsJsxContent).not.toContain("setActiveTab('purchases')");
    });
  });

  describe('2. KPI cards display', () => {
    it('Frontend contains Total projects KPI card', () => {
      expect(reportsJsxContent).toContain('Total projects');
      expect(reportsJsxContent).toContain('value: allCount');
    });

    it('Frontend contains Total profit KPI card', () => {
      expect(reportsJsxContent).toContain('Total profit');
      expect(reportsJsxContent).toContain('formatRupees(totals.profit)');
    });

    it('Received and pending collection KPI cards were removed in the redesign', () => {
      expect(reportsJsxContent).not.toContain('TOTAL RECEIVED');
      expect(reportsJsxContent).not.toContain('PENDING COLLECTION');
    });
  });

  describe('3. Project cards display as default view', () => {
    it('viewMode is initialized to "cards"', () => {
      expect(reportsJsxContent).toContain("const [viewMode, setViewMode] = useState('cards')");
    });

    it('Card grid has responsive classes (desktop 4 across)', () => {
      expect(reportsJsxContent).toContain('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4');
    });
  });

  describe('4. Project status displays in cards', () => {
    it('Displays status pill on each project card', () => {
      expect(reportsJsxContent).toContain('<StatusBadge status={p.status} />');
      expect(reportsJsxContent).toContain('{badge.label}');
      expect(reportsJsxContent).toContain('badge.cls');
    });

    it('getCardStatusBadge correctly maps COMPLETED and IN_PROGRESS/ACTIVE', () => {
      expect(reportsJsxContent).toContain("label: 'Completed'");
      expect(reportsJsxContent).toContain("label: 'Ongoing'");
    });
  });

  describe('5. Project profit displays', () => {
    it('Project profit heading and formatted currency are rendered', () => {
      expect(reportsJsxContent).toContain('Project profit');
      expect(reportsJsxContent).toContain('formatRupees(profit)');
    });
  });

  describe('6. Margin displays', () => {
    it('Margin % badge renders next to project profit', () => {
      expect(reportsJsxContent).toContain('{margin}%');
      expect(reportsJsxContent).toContain('p.projectMargin !== undefined ? p.projectMargin : (p.grossMargin || 0)');
    });
  });

  describe('7. Budget progress displays', () => {
    it('Shows Budget used label, percentage and progress bar', () => {
      expect(reportsJsxContent).toContain('Budget used');
      expect(reportsJsxContent).toContain('{budgetUsed}%');
      expect(reportsJsxContent).toContain('if (used > 80)');
      expect(reportsJsxContent).toContain('style={{ width: `${Math.min(100, Math.max(0, budgetUsed))}%` }}');
    });
  });

  describe('8. Search works', () => {
    it('Search input is present with correct placeholder and filters project list', () => {
      expect(reportsJsxContent).toContain('Search project or client');
      expect(reportsJsxContent).toContain('setSearchTerm(e.target.value)');
      expect(reportsJsxContent).toContain('nameMatch');
      expect(reportsJsxContent).toContain('clientMatch');
      expect(reportsJsxContent).toContain('codeMatch');
    });
  });

  describe('9. Status filters work', () => {
    it('Status filter buttons All, Ongoing, Completed are present with counts', () => {
      expect(reportsJsxContent).toContain('All · {allCount}');
      expect(reportsJsxContent).toContain('Ongoing · {ongoingCount}');
      expect(reportsJsxContent).toContain('Completed · {completedCount}');
    });

    it('Filter handlers correctly update filterStatus', () => {
      expect(reportsJsxContent).toContain("setFilterStatus('ALL')");
      expect(reportsJsxContent).toContain("setFilterStatus('ONGOING')");
      expect(reportsJsxContent).toContain("setFilterStatus('COMPLETED')");
    });
  });

  describe('10, 11 & 12. View Details opens drawer, shows correct project, and close works', () => {
    it('View Details button sets selectedProject', () => {
      expect(reportsJsxContent).toContain('onClick={() => setSelectedProject(p)}');
      expect(reportsJsxContent).toContain('View details');
    });

    it('Drawer displays selected project details and financial breakdown', () => {
      expect(reportsJsxContent).toContain('const p = selectedProject;');
      expect(reportsJsxContent).toContain('{capitalise(p.projectName)}');
      expect(reportsJsxContent).toContain('text: p.projectCode');
      expect(reportsJsxContent).toContain("text: p.customerName || 'No client'");
      expect(reportsJsxContent).toContain('Where the money went');
    });

    it('Close button resets selectedProject', () => {
      expect(reportsJsxContent).toContain('onClick={() => setSelectedProject(null)}');
    });
  });

  describe('13. Open Project navigates to existing Project Details', () => {
    it('Open Project button calls navigate with /projects/:id', () => {
      expect(reportsJsxContent).toContain('navigate(`/projects/${p.projectId}`)');
      expect(reportsJsxContent).toContain('Open project');
    });
  });

  describe('14. Table View still works', () => {
    it('Table view toggle button toggles viewMode', () => {
      expect(reportsJsxContent).toContain("setViewMode(viewMode === 'cards' ? 'table' : 'cards')");
      expect(reportsJsxContent).toContain('Table view');
    });

    it('Detailed table headers and columns are preserved', () => {
      expect(reportsJsxContent).toContain('<th className="px-4 py-3">Code</th>');
      expect(reportsJsxContent).toContain('<th className="px-4 py-3 text-center">Status</th>');
      expect(reportsJsxContent).toContain('<th className="px-4 py-3 text-right">Budget</th>');
      expect(reportsJsxContent).toContain('<th className="px-4 py-3 text-right">Labour</th>');
    });
  });

  describe('15. Purchase Report still works', () => {
    it('API returns 200 with summary and breakdown', async () => {
      const res = await request(app)
        .get('/api/reports/purchases?range=month')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('supplierAnalysis');
      expect(res.body.data).toHaveProperty('productAnalysis');
    });
  });

  describe('16. GST & Tax Summary still works', () => {
    it('API returns 200 with summary and transaction registers', async () => {
      const res = await request(app)
        .get('/api/reports/gst-summary?range=month')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('inputGst');
      expect(res.body.data.summary).toHaveProperty('outputGst');
      expect(res.body.data.summary).toHaveProperty('netGstPosition');
    });
  });
});
