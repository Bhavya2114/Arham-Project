import {
  calculateLabourEarned,
  parseCalendarDate,
} from '../../src/services/labour.service';

describe('Labour Wage Calculation Unit Tests (Phase 6)', () => {
  describe('parseCalendarDate', () => {
    it('should parse YYYY-MM-DD date string without day shifts', () => {
      const parts = parseCalendarDate('2026-09-01');
      expect(parts).toEqual({ year: 2026, month: 9, day: 1 });
    });

    it('should parse Date object correctly in Indian Standard Time', () => {
      // 2026-09-01T00:00:00.000Z is 05:30 IST on Sep 1, 2026
      const d = new Date('2026-09-01T00:00:00.000Z');
      const parts = parseCalendarDate(d);
      expect(parts).toEqual({ year: 2026, month: 9, day: 1 });
    });

    it('should return null for invalid inputs', () => {
      expect(parseCalendarDate(null)).toBeNull();
      expect(parseCalendarDate('')).toBeNull();
      expect(parseCalendarDate('invalid-date')).toBeNull();
    });
  });

  describe('calculateLabourEarned - Business Rules', () => {
    // 1. Active labour for 1 day (startDate = today)
    it('1. should calculate 1 day for ACTIVE labour when startDate is today (inclusive)', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 800,
        status: 'ACTIVE',
        stoppedAt: null,
      };
      const result = calculateLabourEarned(labour, '2026-09-01');

      expect(result.earnedDays).toBe(1);
      expect(result.totalEarned).toBe(800);
    });

    // 2. Active labour for multiple days
    it('2. should calculate multiple days for ACTIVE labour from startDate to today inclusive', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 800,
        status: 'ACTIVE',
        stoppedAt: null,
      };
      // Sep 1 to Sep 5 inclusive = 5 days (1, 2, 3, 4, 5)
      const result = calculateLabourEarned(labour, '2026-09-05');

      expect(result.earnedDays).toBe(5);
      expect(result.totalEarned).toBe(4000); // 5 * 800
    });

    // 3. Stopped labour for 1 day (stoppedAt = startDate)
    it('3. should calculate 1 day for STOPPED labour when stoppedAt equals startDate', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 800,
        status: 'STOPPED',
        stoppedAt: '2026-09-01',
      };
      // Even if referenceDate is way in the future, stopped labour stays 1 day
      const result = calculateLabourEarned(labour, '2026-10-31');

      expect(result.earnedDays).toBe(1);
      expect(result.totalEarned).toBe(800);
    });

    // 4. Stopped labour for multiple days
    it('4. should calculate multiple days for STOPPED labour from startDate to stoppedAt inclusive', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 500,
        status: 'STOPPED',
        stoppedAt: '2026-09-10',
      };
      // Sep 1 to Sep 10 inclusive = 10 days
      const result = calculateLabourEarned(labour, '2026-10-15');

      expect(result.earnedDays).toBe(10);
      expect(result.totalEarned).toBe(5000); // 10 * 500
    });

    // 5. Start date counts
    it('5. should count start date as day 1', () => {
      const labour = {
        startDate: '2026-09-20',
        dailyWage: 1000,
        status: 'ACTIVE',
      };
      const result = calculateLabourEarned(labour, '2026-09-20');
      expect(result.earnedDays).toBe(1);
      expect(result.totalEarned).toBe(1000);
    });

    // 6. Stop date counts
    it('6. should count stop date as an inclusive day', () => {
      const labour = {
        startDate: '2026-09-20',
        dailyWage: 1000,
        status: 'STOPPED',
        stoppedAt: '2026-09-21',
      };
      // Sep 20 and Sep 21 = 2 days
      const result = calculateLabourEarned(labour, '2026-09-30');
      expect(result.earnedDays).toBe(2);
      expect(result.totalEarned).toBe(2000);
    });

    // 7. Active labour uses today / referenceDate and increases over time
    it('7. should automatically increase earned days for ACTIVE labour as calendar days advance', () => {
      const labour = {
        startDate: '2026-09-25',
        dailyWage: 500,
        status: 'ACTIVE',
      };

      const day1 = calculateLabourEarned(labour, '2026-09-25');
      expect(day1.earnedDays).toBe(1);
      expect(day1.totalEarned).toBe(500);

      const day6 = calculateLabourEarned(labour, '2026-09-30');
      expect(day6.earnedDays).toBe(6);
      expect(day6.totalEarned).toBe(3000);

      const day10 = calculateLabourEarned(labour, '2026-10-04');
      expect(day10.earnedDays).toBe(10);
      expect(day10.totalEarned).toBe(5000);
    });

    // 8. Stopped labour uses stoppedAt instead of today (remains fixed)
    it('8. should remain fixed for STOPPED labour regardless of how many days pass after stoppedAt', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 600,
        status: 'STOPPED',
        stoppedAt: '2026-09-05',
      };

      const check1 = calculateLabourEarned(labour, '2026-09-05');
      const check2 = calculateLabourEarned(labour, '2026-09-30');
      const check3 = calculateLabourEarned(labour, '2027-01-01');

      expect(check1.earnedDays).toBe(5);
      expect(check1.totalEarned).toBe(3000);

      expect(check2.earnedDays).toBe(5);
      expect(check2.totalEarned).toBe(3000);

      expect(check3.earnedDays).toBe(5);
      expect(check3.totalEarned).toBe(3000);
    });

    // 9. Daily wage multiplication with standard values
    it('9. should correctly multiply earnedDays by dailyWage', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 1250,
        status: 'STOPPED',
        stoppedAt: '2026-09-04',
      };
      // 4 days * 1250 = 5000
      const result = calculateLabourEarned(labour);
      expect(result.earnedDays).toBe(4);
      expect(result.totalEarned).toBe(5000);
    });

    // 10. Decimal daily wage if provided
    it('10. should correctly calculate totalEarned with decimal daily wage', () => {
      const labour = {
        startDate: '2026-09-01',
        dailyWage: 550.75,
        status: 'STOPPED',
        stoppedAt: '2026-09-03',
      };
      // 3 days * 550.75 = 1652.25
      const result = calculateLabourEarned(labour);
      expect(result.earnedDays).toBe(3);
      expect(result.totalEarned).toBe(1652.25);
    });

    // 11. Edge case: Start date in the future (invalid date range does not produce negative days)
    it('11. should return 0 earnedDays and 0 totalEarned if startDate is in the future', () => {
      const labour = {
        startDate: '2026-10-10',
        dailyWage: 800,
        status: 'ACTIVE',
      };
      const result = calculateLabourEarned(labour, '2026-09-30');
      expect(result.earnedDays).toBe(0);
      expect(result.totalEarned).toBe(0);
    });

    // 12. Edge case: Date objects with timestamp components
    it('12. should handle Date objects with time-of-day without shifting calendar days', () => {
      const startDate = new Date('2026-09-01T23:30:00.000Z');
      const stoppedDate = new Date('2026-09-05T01:30:00.000Z');

      const labour = {
        startDate,
        dailyWage: 1000,
        status: 'STOPPED',
        stoppedAt: stoppedDate,
      };

      const result = calculateLabourEarned(labour);
      expect(result.earnedDays).toBeGreaterThanOrEqual(4);
      expect(result.totalEarned).toBeGreaterThanOrEqual(4000);
    });
  });
});
