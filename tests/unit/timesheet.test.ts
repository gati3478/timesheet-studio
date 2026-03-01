import { describe, expect, it } from 'vitest';
import { computeTimesheet, TimesheetValidationError } from '../../src/lib/server/timesheet';

describe('computeTimesheet', () => {
  it('computes january 2026 totals and labels', () => {
    const result = computeTimesheet({
      year: 2026,
      month: 1,
      vacationDates: ['2026-01-06'],
      holidayDates: new Set(['2026-01-01', '2026-01-02', '2026-01-07'])
    });

    expect(result.dayCodesByDay.get(1)).toBe('X');
    expect(result.dayCodesByDay.get(5)).toBe('8');
    expect(result.dayCodesByDay.get(6)).toBe('შ');
    expect(result.dayCodesByDay.get(31)).toBe('X');

    expect(result.firstHalfHours).toBe(56);
    expect(result.secondHalfHours).toBe(88);
    expect(result.workedDays).toBe(18);
    expect(result.totalWorkedHours).toBe(144);
    expect(result.paidVacationHours).toBe(8);
    expect(result.weekdayHolidayCount).toBe(3);

    expect(result.startDateLabel).toBe('01.01.2026');
    expect(result.endDateLabel).toBe('31.01.2026');
    expect(result.lastWorkdayLabel).toBe('30.01');
  });

  it('handles leap-year february and clears out-of-month days', () => {
    const result = computeTimesheet({
      year: 2024,
      month: 2,
      vacationDates: [],
      holidayDates: new Set()
    });

    expect(result.dayCodesByDay.get(29)).toBe('8');
    expect(result.dayCodesByDay.get(30)).toBe('');
    expect(result.dayCodesByDay.get(31)).toBe('');
    expect(result.firstHalfHours).toBe(88);
    expect(result.secondHalfHours).toBe(80);
    expect(result.workedDays).toBe(21);
    expect(result.totalWorkedHours).toBe(168);
    expect(result.endDateLabel).toBe('29.02.2024');
    expect(result.lastWorkdayLabel).toBe('29.02');
  });

  it('blocks vacation dates that fall on weekend or holiday', () => {
    expect(() =>
      computeTimesheet({
        year: 2026,
        month: 1,
        vacationDates: ['2026-01-01', '2026-01-04'],
        holidayDates: new Set(['2026-01-01'])
      })
    ).toThrowError(TimesheetValidationError);

    try {
      computeTimesheet({
        year: 2026,
        month: 1,
        vacationDates: ['2026-01-01', '2026-01-04'],
        holidayDates: new Set(['2026-01-01'])
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TimesheetValidationError);
      const validation = error as TimesheetValidationError;
      expect(validation.details).toHaveLength(2);
    }
  });
});
