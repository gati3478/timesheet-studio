import { describe, expect, it } from 'vitest';
import { computeTimesheet, TimesheetValidationError } from '../../src/lib/server/timesheet';
import { makeTimesheetInput } from '../helpers/fixtures';

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

  it('throws for invalid vacation date format', () => {
    try {
      computeTimesheet({
        year: 2026,
        month: 3,
        vacationDates: ['not-a-date'],
        holidayDates: new Set()
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimesheetValidationError);
      const validation = error as TimesheetValidationError;
      expect(validation.details).toHaveLength(1);
      expect(validation.details[0]).toContain('invalid date format');
    }
  });

  it('throws for vacation date outside selected month', () => {
    try {
      computeTimesheet({
        year: 2026,
        month: 1,
        vacationDates: ['2026-02-15'],
        holidayDates: new Set()
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimesheetValidationError);
      const validation = error as TimesheetValidationError;
      expect(validation.details).toHaveLength(1);
      expect(validation.details[0]).toContain('not in selected month');
    }
  });

  it('handles multiple valid vacations correctly', () => {
    // March 2026: 2nd Mon, 4th Wed, 5th Thu are weekdays; Mar 3 is a holiday
    const result = computeTimesheet({
      year: 2026,
      month: 3,
      vacationDates: ['2026-03-02', '2026-03-04', '2026-03-05'],
      holidayDates: new Set(['2026-03-03'])
    });

    expect(result.paidVacationHours).toBe(24);
    expect(result.dayCodesByDay.get(2)).toBe('შ');
    expect(result.dayCodesByDay.get(4)).toBe('შ');
    expect(result.dayCodesByDay.get(5)).toBe('შ');

    // Worked days should be reduced by 3 vs a no-vacation scenario
    const baseline = computeTimesheet({
      year: 2026,
      month: 3,
      vacationDates: [],
      holidayDates: new Set(['2026-03-03'])
    });
    expect(result.workedDays).toBe(baseline.workedDays - 3);
  });

  it('computes December last workday when month ends on Thursday', () => {
    // Dec 2026: day 31 is Thursday
    const result = computeTimesheet({
      year: 2026,
      month: 12,
      vacationDates: [],
      holidayDates: new Set()
    });

    expect(result.lastWorkdayLabel).toBe('31.12');
    expect(result.endDateLabel).toBe('31.12.2026');
  });

  it('assigns no X codes to weekdays when holidayDates is empty', () => {
    const result = computeTimesheet({
      year: 2026,
      month: 3,
      vacationDates: [],
      holidayDates: new Set()
    });

    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(2026, 2, day);
      const dow = date.getDay();
      const code = result.dayCodesByDay.get(day)!;
      if (dow === 0 || dow === 6) {
        expect(code).toBe('X');
      } else {
        expect(code).toBe('8');
      }
    }
  });

  it('duplicate vacation dates in array are deduplicated', () => {
    const result = computeTimesheet(
      makeTimesheetInput({
        vacationDates: ['2026-03-02', '2026-03-02']
      })
    );

    expect(result.paidVacationHours).toBe(8);
    expect(result.dayCodesByDay.get(2)).toBe('შ');
  });

  it('all weekdays are holidays → zero worked days and hours', () => {
    // March 2026 weekdays: 2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27,30,31
    const allWeekdayHolidays = new Set(
      [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 30, 31].map(
        (d) => `2026-03-${String(d).padStart(2, '0')}`
      )
    );

    const result = computeTimesheet(
      makeTimesheetInput({
        holidayDates: allWeekdayHolidays
      })
    );

    expect(result.workedDays).toBe(0);
    expect(result.totalWorkedHours).toBe(0);
    expect(result.weekdayHolidayCount).toBe(22);

    for (let day = 1; day <= 31; day++) {
      expect(result.dayCodesByDay.get(day)).toBe('X');
    }
  });

  it('vacation on a holiday date throws with details', () => {
    try {
      computeTimesheet(
        makeTimesheetInput({
          holidayDates: new Set(['2026-03-03']),
          vacationDates: ['2026-03-03']
        })
      );
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimesheetValidationError);
      const validation = error as TimesheetValidationError;
      expect(validation.details).toHaveLength(1);
      expect(validation.details[0]).toContain('vacation cannot be on weekend/holiday');
    }
  });

  it('lastWorkday skips holidays on terminal weekday', () => {
    // Dec 2026: 31st is Thursday. Making it a holiday should retreat to 30th (Wednesday).
    const result = computeTimesheet(
      makeTimesheetInput({
        month: 12,
        holidayDates: new Set(['2026-12-31'])
      })
    );

    expect(result.lastWorkdayLabel).toBe('30.12');
  });

  it('lastWorkday skips consecutive holidays at month end', () => {
    // Dec 2026: 31st (Thu) and 30th (Wed) are both holidays → last workday is 29th (Tue)
    const result = computeTimesheet(
      makeTimesheetInput({
        month: 12,
        holidayDates: new Set(['2026-12-30', '2026-12-31'])
      })
    );

    expect(result.lastWorkdayLabel).toBe('29.12');
  });

  it('February 2026 lastWorkdayLabel is 27.02 when month ends on Saturday', () => {
    // Feb 2026: 28th is Saturday, so last weekday is Friday the 27th
    const result = computeTimesheet(
      makeTimesheetInput({
        month: 2,
        vacationDates: [],
        holidayDates: new Set()
      })
    );

    expect(result.lastWorkdayLabel).toBe('27.02');
  });
});
