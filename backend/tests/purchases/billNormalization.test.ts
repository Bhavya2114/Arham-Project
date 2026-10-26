import { normalizeIgstBill, normalizeTaxInclusiveLine } from '../../src/utils/billNormalization';
import { calculateLineItem } from '../../src/utils/purchaseCalculations';

// Bill INV0002 (RAJ ELECTRICALS): rates include 18% GST, interstate so IGST only
const inv0002Items = () => [
  { itemName: 'LMS 25 MM PIPE', quantity: 100, unitPrice: 60, discountAmount: 0, taxableAmount: 5084.75, gstRate: 18, igstAmount: 915.25, cgstAmount: 457.63, sgstAmount: 457.62, lineTotal: 6000 },
  { itemName: '20mm faxibel pipe', quantity: 2, unitPrice: 230, discountAmount: 0, taxableAmount: 389.83, gstRate: 18, igstAmount: 70.17, lineTotal: 460 },
  { itemName: '16 mm faxibel pipe', quantity: 2, unitPrice: 290, discountAmount: 0, taxableAmount: 491.53, gstRate: 18, igstAmount: 88.48, lineTotal: 580 },
  { itemName: '25 mm faxibel pipe', quantity: 2, unitPrice: 290, discountAmount: 0, taxableAmount: 491.53, gstRate: 18, igstAmount: 88.48, lineTotal: 580 },
];

describe('Bills whose rate already includes GST', () => {
  it('uses the printed taxable amount and matches the bill total', () => {
    const items: any[] = inv0002Items();
    const totals: any = { totalIGST: 1162.38, totalCGST: 0, totalSGST: 0 };

    items.forEach((item) => expect(normalizeTaxInclusiveLine(item)).toBe(true));
    expect(normalizeIgstBill(items, totals)).toBe(true);

    expect(items[0].unitPrice).toBeCloseTo(50.8475, 4);
    expect(items[0].printedUnitPrice).toBe(60);

    const lines = items.map((i) =>
      calculateLineItem({ quantity: i.quantity, rate: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.gstRate, suppliedTaxAmount: i.igstAmount })
    );
    const taxable = lines.reduce((s, l) => s + l.taxableValue, 0);
    const tax = lines.reduce((s, l) => s + l.lineTax, 0);
    expect(taxable).toBeCloseTo(6457.64, 2);
    expect(tax).toBeCloseTo(1162.38, 2);
    expect(Math.round((taxable + tax - 0.02) * 100) / 100).toBe(7620);

    items.forEach((i) => {
      expect(i.cgstAmount).toBe(0);
      expect(i.sgstAmount).toBe(0);
    });
  });

  it('also works when the reader copied qty x rate into taxable', () => {
    const item: any = { quantity: 100, unitPrice: 60, discountAmount: 0, taxableAmount: 6000, gstRate: 18, igstAmount: 915.25, lineTotal: 6000 };
    expect(normalizeTaxInclusiveLine(item)).toBe(true);
    expect(item.taxableAmount).toBe(5084.75);
  });

  it('leaves a normal bill alone', () => {
    const item: any = { quantity: 10, unitPrice: 100, discountAmount: 0, taxableAmount: 1000, gstRate: 18, cgstAmount: 90, sgstAmount: 90, lineTotal: 1180 };
    expect(normalizeTaxInclusiveLine(item)).toBe(false);
    expect(item.unitPrice).toBe(100);

    const totals: any = { totalCGST: 90, totalSGST: 90, totalIGST: 0 };
    expect(normalizeIgstBill([item], totals)).toBe(false);
    expect(item.cgstAmount).toBe(90);
  });

  it('handles a discounted rate that includes GST', () => {
    // 10 x 118 = 1180, 10% off = 1062 incl. GST, taxable 900
    const item: any = { quantity: 10, unitPrice: 118, discountPercent: 10, discountAmount: 118, taxableAmount: 900, gstRate: 18, cgstAmount: 81, sgstAmount: 81, lineTotal: 1062 };
    expect(normalizeTaxInclusiveLine(item)).toBe(true);
    expect(item.unitPrice).toBe(100);
    expect(item.discountAmount).toBe(100);
    expect(item.taxableAmount).toBe(900);
  });
});
