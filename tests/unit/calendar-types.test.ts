import { describe, expect, it } from 'vitest';
import { computeSummary, type DayItem } from '../../src/lib/calendar-types';

function makeDayItem(overrides: Partial<DayItem> & { day: number }): DayItem {
  return {
    dateIso: `2026-03-${String(overrides.day).padStart(2, '0')}`,
    isWeekend: false,
    isHoliday: false,
    isVacation: false,
    ...overrides
  };
}

describe('computeSummary', () => {
  it('returns all zeros for an empty array', () => {
    const result = computeSummary([]);
    expect(result).toEqual({
      workedDayCount: 0,
      vacationDayCount: 0,
      blockedDayCount: 0,
      weekdayHolidayCount: 0,
      firstHalfHours: 0,
      secondHalfHours: 0,
      totalHours: 0,
      vacationHours: 0
    });
  });

  it('counts a single workday in the first half', () => {
    const result = computeSummary([makeDayItem({ day: 1 })]);
    expect(result.workedDayCount).toBe(1);
    expect(result.firstHalfHours).toBe(8);
    expect(result.secondHalfHours).toBe(0);
    expect(result.totalHours).toBe(8);
  });

  it('counts a single workday in the second half', () => {
    const result = computeSummary([makeDayItem({ day: 16 })]);
    expect(result.workedDayCount).toBe(1);
    expect(result.firstHalfHours).toBe(0);
    expect(result.secondHalfHours).toBe(8);
    expect(result.totalHours).toBe(8);
  });

  it('counts a weekend day as blocked', () => {
    const result = computeSummary([makeDayItem({ day: 7, isWeekend: true })]);
    expect(result.blockedDayCount).toBe(1);
    expect(result.workedDayCount).toBe(0);
    expect(result.weekdayHolidayCount).toBe(0);
  });

  it('counts a weekday holiday as blocked and as weekday holiday', () => {
    const result = computeSummary([makeDayItem({ day: 3, isHoliday: true })]);
    expect(result.blockedDayCount).toBe(1);
    expect(result.weekdayHolidayCount).toBe(1);
    expect(result.workedDayCount).toBe(0);
  });

  it('counts a weekend holiday as blocked but not as weekday holiday', () => {
    const result = computeSummary([makeDayItem({ day: 7, isWeekend: true, isHoliday: true })]);
    expect(result.blockedDayCount).toBe(1);
    expect(result.weekdayHolidayCount).toBe(0);
  });

  it('counts a vacation day with correct hours', () => {
    const result = computeSummary([makeDayItem({ day: 10, isVacation: true })]);
    expect(result.vacationDayCount).toBe(1);
    expect(result.vacationHours).toBe(8);
    expect(result.workedDayCount).toBe(0);
    expect(result.totalHours).toBe(0);
  });

  it('splits hours correctly at the day 15/16 boundary', () => {
    const result = computeSummary([makeDayItem({ day: 15 }), makeDayItem({ day: 16 })]);
    expect(result.firstHalfHours).toBe(8);
    expect(result.secondHalfHours).toBe(8);
    expect(result.totalHours).toBe(16);
  });

  it('computes correct summary for a full month mix', () => {
    const items: DayItem[] = [
      // First half: 2 workdays, 1 weekend, 1 holiday (weekday), 1 vacation
      makeDayItem({ day: 1 }),
      makeDayItem({ day: 2 }),
      makeDayItem({ day: 3, isWeekend: true }),
      makeDayItem({ day: 4, isHoliday: true }),
      makeDayItem({ day: 5, isVacation: true }),
      // Second half: 3 workdays, 1 weekend+holiday
      makeDayItem({ day: 16 }),
      makeDayItem({ day: 17 }),
      makeDayItem({ day: 18 }),
      makeDayItem({ day: 19, isWeekend: true, isHoliday: true })
    ];
    const result = computeSummary(items);
    expect(result.workedDayCount).toBe(5);
    expect(result.vacationDayCount).toBe(1);
    expect(result.blockedDayCount).toBe(3);
    expect(result.weekdayHolidayCount).toBe(1);
    expect(result.firstHalfHours).toBe(16);
    expect(result.secondHalfHours).toBe(24);
    expect(result.totalHours).toBe(40);
    expect(result.vacationHours).toBe(8);
  });
});
