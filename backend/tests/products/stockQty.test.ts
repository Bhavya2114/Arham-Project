import { roundQty, QTY_DECIMALS } from '../../src/utils/stockQty';

// Stock quantities are kept to 3 decimals so float noise never reaches the screen
describe('roundQty', () => {
  it('removes float noise from adding decimals', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(6.800000000000001)).toBe(6.8);
  });

  it('keeps up to 3 decimals', () => {
    expect(QTY_DECIMALS).toBe(3);
    expect(roundQty(1.23456)).toBe(1.235);
    expect(roundQty(0.0004)).toBe(0);
  });

  it('leaves whole numbers and bad input sensible', () => {
    expect(roundQty(812)).toBe(812);
    expect(roundQty(0)).toBe(0);
    expect(roundQty(NaN)).toBe(0);
  });
});
