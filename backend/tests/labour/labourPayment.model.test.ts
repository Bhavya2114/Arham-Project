import mongoose from 'mongoose';
import { LabourPayment } from '../../src/models/LabourPayment';

describe('LabourPayment Model Unit Tests (Phase 7)', () => {
  const dummyLabourId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();

  const getValidPaymentData = () => ({
    labourId: dummyLabourId,
    amount: 3000,
    paymentDate: new Date('2026-09-30'),
    paymentMethod: 'CASH',
    notes: 'Advance wage payment',
    createdBy: dummyUserId,
  });

  const getValidationError = async (doc: any) => {
    try {
      await doc.validate();
      return undefined;
    } catch (err) {
      return err as mongoose.Error.ValidationError;
    }
  };

  it('1. should validate a complete and valid payment document', async () => {
    const payment = new LabourPayment(getValidPaymentData());
    const err = await getValidationError(payment);
    expect(err).toBeUndefined();
    expect(payment.labourId).toEqual(dummyLabourId);
    expect(payment.amount).toBe(3000);
    expect(payment.paymentMethod).toBe('CASH');
    expect(payment.createdBy).toEqual(dummyUserId);
    expect(payment.notes).toBe('Advance wage payment');
  });

  it('2. should reject when labourId is missing', async () => {
    const data: any = getValidPaymentData();
    delete data.labourId;
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.labourId).toBeDefined();
  });

  it('3. should reject when labourId is invalid format', async () => {
    const data: any = getValidPaymentData();
    data.labourId = 'invalid-id-format';
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.labourId).toBeDefined();
  });

  it('4. should reject when amount is missing', async () => {
    const data: any = getValidPaymentData();
    delete data.amount;
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.amount).toBeDefined();
  });

  it('5. should reject when amount is zero', async () => {
    const data = getValidPaymentData();
    data.amount = 0;
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.amount).toBeDefined();
  });

  it('6. should reject when amount is negative', async () => {
    const data = getValidPaymentData();
    data.amount = -500;
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.amount).toBeDefined();
  });

  it('7. should reject invalid payment method', async () => {
    const data: any = getValidPaymentData();
    data.paymentMethod = 'BITCOIN';
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.paymentMethod).toBeDefined();
  });

  it('8. should accept all valid payment methods (CASH, UPI, BANK_TRANSFER)', async () => {
    for (const method of ['CASH', 'UPI', 'BANK_TRANSFER']) {
      const data = getValidPaymentData();
      data.paymentMethod = method as any;
      const payment = new LabourPayment(data);
      const err = await getValidationError(payment);
      expect(err).toBeUndefined();
      expect(payment.paymentMethod).toBe(method);
    }
  });

  it('9. should reject invalid payment date', async () => {
    const data: any = getValidPaymentData();
    data.paymentDate = 'not-a-valid-date';
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.paymentDate).toBeDefined();
  });

  it('10. should allow optional notes to be omitted', async () => {
    const data: any = getValidPaymentData();
    delete data.notes;
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeUndefined();
    expect(payment.notes).toBeUndefined();
  });

  it('11. should reject when createdBy is missing', async () => {
    const data: any = getValidPaymentData();
    delete data.createdBy;
    const payment = new LabourPayment(data);
    const err = await getValidationError(payment);
    expect(err).toBeDefined();
    expect(err?.errors.createdBy).toBeDefined();
  });
});
