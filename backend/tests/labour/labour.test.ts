import mongoose from 'mongoose';
import { Labour } from '../../src/models/Labour';
import { Project } from '../../src/models/Project';
import { Customer } from '../../src/models/Customer';
import { User } from '../../src/models/User';
import { connectDB } from '../../src/config/database';

describe('Labour Model Unit & Validation Tests (Phase 1)', () => {
  const dummyProjectId = new mongoose.Types.ObjectId();

  const getValidLabourData = () => ({
    name: 'Rajesh Kumar',
    mobile: '9876543210',
    location: 'Pune',
    projectId: dummyProjectId,
    dailyWage: 800,
    startDate: new Date('2026-09-21'),
  });

  const getValidationError = async (doc: any) => {
    try {
      await doc.validate();
      return undefined;
    } catch (err) {
      return err as mongoose.Error.ValidationError;
    }
  };

  describe('Field Validations & Constraints', () => {
    // 1. Valid labour data is accepted
    it('1. should accept valid labour data', async () => {
      const labour = new Labour(getValidLabourData());
      const err = await getValidationError(labour);
      expect(err).toBeUndefined();
      expect(labour.name).toBe('Rajesh Kumar');
      expect(labour.mobile).toBe('9876543210');
      expect(labour.location).toBe('Pune');
      expect(labour.projectId).toEqual(dummyProjectId);
      expect(labour.dailyWage).toBe(800);
      expect(labour.startDate).toEqual(new Date('2026-09-21'));
    });

    // 2. name is required
    it('2. should reject when name is missing', async () => {
      const data: any = getValidLabourData();
      delete data.name;
      const labour = new Labour(data);
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.name).toBeDefined();
    });

    // 3. mobile is required
    it('3. should reject when mobile is missing', async () => {
      const data: any = getValidLabourData();
      delete data.mobile;
      const labour = new Labour(data);
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.mobile).toBeDefined();
    });

    // 4. location is required
    it('4. should reject when location is missing', async () => {
      const data: any = getValidLabourData();
      delete data.location;
      const labour = new Labour(data);
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.location).toBeDefined();
    });

    // 5. projectId is optional for master directory labour
    it('5. should allow unassigned labour master record without projectId', async () => {
      const data: any = getValidLabourData();
      delete data.projectId;
      const labour = new Labour(data);
      const err = await getValidationError(labour);
      expect(err).toBeUndefined();
      expect(labour.projectId).toBeNull();
    });

    // 6. dailyWage is required
    it('6. should reject when dailyWage is missing', async () => {
      const data: any = getValidLabourData();
      delete data.dailyWage;
      const labour = new Labour(data);
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.dailyWage).toBeDefined();
    });

    // 7. dailyWage cannot be 0
    it('7. should reject when dailyWage is 0', async () => {
      const labour = new Labour({
        ...getValidLabourData(),
        dailyWage: 0,
      });
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.dailyWage).toBeDefined();
    });

    // 8. dailyWage cannot be negative
    it('8. should reject when dailyWage is negative', async () => {
      const labour = new Labour({
        ...getValidLabourData(),
        dailyWage: -100,
      });
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.dailyWage).toBeDefined();
    });

    // 9. startDate is optional for unassigned master record
    it('9. should allow unassigned labour master record without startDate', async () => {
      const data: any = getValidLabourData();
      delete data.startDate;
      const labour = new Labour(data);
      const err = await getValidationError(labour);
      expect(err).toBeUndefined();
      expect(labour.startDate).toBeNull();
    });

    // 10. status defaults to INACTIVE
    it('10. should default status to INACTIVE', () => {
      const labour = new Labour(getValidLabourData());
      expect(labour.status).toBe('INACTIVE');
    });

    // 11. stoppedAt defaults to null
    it('11. should default stoppedAt to null', () => {
      const labour = new Labour(getValidLabourData());
      expect(labour.stoppedAt).toBeNull();
    });

    // 12. STOPPED is an accepted status
    it('12. should accept STOPPED as valid status', async () => {
      const labour = new Labour({
        ...getValidLabourData(),
        status: 'STOPPED',
        stoppedAt: new Date(),
      });
      const err = await getValidationError(labour);
      expect(err).toBeUndefined();
      expect(labour.status).toBe('STOPPED');
      expect(labour.stoppedAt).toBeInstanceOf(Date);
    });

    // 13. Invalid status is rejected
    it('13. should reject invalid status', async () => {
      const labour = new Labour({
        ...getValidLabourData(),
        status: 'PAUSED' as any,
      });
      const err = await getValidationError(labour);
      expect(err).toBeDefined();
      expect(err?.errors.status).toBeDefined();
    });

    // Additional: String whitespace trimming
    it('should trim whitespace from name, mobile, and location', () => {
      const labour = new Labour({
        ...getValidLabourData(),
        name: '   Rajesh Kumar   ',
        mobile: '  9876543210  ',
        location: '   Pune   ',
      });
      expect(labour.name).toBe('Rajesh Kumar');
      expect(labour.mobile).toBe('9876543210');
      expect(labour.location).toBe('Pune');
    });

    // Additional: Verify NO endDate field exists on the schema
    it('should not contain an endDate field in the schema definition', () => {
      const schemaPaths = Object.keys(Labour.schema.paths);
      expect(schemaPaths).not.toContain('endDate');
    });
  });

  describe('Database Persistence & Project Reference (Phase 1)', () => {
    let createdProjectId: mongoose.Types.ObjectId;
    let createdLabourId: mongoose.Types.ObjectId;

    beforeAll(async () => {
      await connectDB();

      // Find or create a user and customer for a test project
      let user = await User.findOne();
      if (!user) {
        user = await User.create({
          name: 'Test Admin',
          email: `admin_${Date.now()}@test.com`,
          password: 'Password@123',
          role: 'ADMIN',
        });
      }

      let customer = await Customer.findOne();
      if (!customer) {
        customer = await Customer.create({
          name: 'Test Customer',
          mobile: '9876543210',
          type: 'RETAIL',
          status: 'ACTIVE',
          createdBy: user._id,
        });
      }

      // Create a test project to verify reference
      const project = await Project.create({
        projectCode: `PRJ-LAB-${Date.now()}`,
        name: 'Office Renovation',
        customer: customer._id,
        siteAddress: 'Senapati Bapat Road, Pune',
        startDate: new Date('2026-09-01'),
        status: 'IN_PROGRESS',
        createdBy: user._id,
      });
      createdProjectId = project._id as mongoose.Types.ObjectId;
    });

    afterAll(async () => {
      if (createdLabourId) {
        await Labour.findByIdAndDelete(createdLabourId);
      }
      if (createdProjectId) {
        await Project.findByIdAndDelete(createdProjectId);
      }
    });

    // 14. projectId follows the existing Project reference pattern
    it('14. should save Labour document and successfully populate referenced Project', async () => {
      const labourDoc = await Labour.create({
        name: 'Rajesh Kumar',
        mobile: '9876543210',
        location: 'Pune',
        projectId: createdProjectId,
        dailyWage: 800,
        startDate: new Date('2026-09-21'),
      });
      createdLabourId = labourDoc._id as mongoose.Types.ObjectId;

      expect(labourDoc._id).toBeDefined();
      expect(labourDoc.status).toBe('INACTIVE');
      expect(labourDoc.stoppedAt).toBeNull();
      expect(labourDoc.createdAt).toBeInstanceOf(Date);
      expect(labourDoc.updatedAt).toBeInstanceOf(Date);

      // Verify populate works via Mongoose ref: 'Project'
      const populated = await Labour.findById(labourDoc._id).populate('projectId');
      expect(populated).not.toBeNull();
      const refProject = populated?.projectId as any;
      expect(refProject.name).toBe('Office Renovation');
      expect(refProject.siteAddress).toBe('Senapati Bapat Road, Pune');
    });

    it('should format toJSON correctly with id and without _id and __v', async () => {
      const labourDoc = await Labour.findById(createdLabourId);
      expect(labourDoc).not.toBeNull();
      const json = labourDoc!.toJSON() as Record<string, any>;
      expect(json.id).toBe(createdLabourId.toString());
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
