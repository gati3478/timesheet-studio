import type {
  ComputedTimesheet,
  DayCode,
  TimesheetComputationInput
} from '../../src/lib/server/types';

export function makeComputedTimesheet(
  overrides: Partial<ComputedTimesheet> = {}
): ComputedTimesheet {
  const dayCodesByDay = new Map<number, DayCode>();
  for (let day = 1; day <= 31; day += 1) {
    dayCodesByDay.set(day, '8');
  }
  // Weekends in a typical month
  dayCodesByDay.set(4, 'X');
  dayCodesByDay.set(5, 'X');
  dayCodesByDay.set(11, 'X');
  dayCodesByDay.set(12, 'X');
  dayCodesByDay.set(18, 'X');
  dayCodesByDay.set(19, 'X');
  dayCodesByDay.set(25, 'X');
  dayCodesByDay.set(26, 'X');

  return {
    dayCodesByDay: overrides.dayCodesByDay ?? dayCodesByDay,
    firstHalfHours: overrides.firstHalfHours ?? 72,
    secondHalfHours: overrides.secondHalfHours ?? 104,
    workedDays: overrides.workedDays ?? 22,
    totalWorkedHours: overrides.totalWorkedHours ?? 176,
    paidVacationHours: overrides.paidVacationHours ?? 0,
    weekdayHolidayCount: overrides.weekdayHolidayCount ?? 0,
    startDateLabel: overrides.startDateLabel ?? '01.03.2026',
    endDateLabel: overrides.endDateLabel ?? '31.03.2026',
    lastWorkdayLabel: overrides.lastWorkdayLabel ?? '31.03'
  };
}

export function makeTimesheetInput(
  overrides: Partial<TimesheetComputationInput> = {}
): TimesheetComputationInput {
  return {
    year: overrides.year ?? 2026,
    month: overrides.month ?? 3,
    vacationDates: overrides.vacationDates ?? [],
    holidayDates: overrides.holidayDates ?? new Set<string>()
  };
}
