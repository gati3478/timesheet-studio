import { endOfMonth, format, getDate, getDaysInMonth, getISODay, parseISO } from 'date-fns';
import type { ComputedTimesheet, DayCode, TimesheetComputationInput } from './types';

export class TimesheetValidationError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[]) {
    super(message);
    this.name = 'TimesheetValidationError';
    this.details = details;
  }
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function isWeekday(date: Date): boolean {
  const day = getISODay(date);
  return day >= 1 && day <= 5;
}

function formatCellDate(date: Date): string {
  return format(date, 'dd.MM.yyyy');
}

function formatLeftDate(date: Date): string {
  return format(date, 'dd.MM');
}

export function computeTimesheet(input: TimesheetComputationInput): ComputedTimesheet {
  const { year, month, vacationDates, holidayDates } = input;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const monthDays = getDaysInMonth(monthStart);

  const vacationSet = new Set<string>();
  const vacationErrors: string[] = [];

  for (const rawDate of vacationDates) {
    const parsed = parseISO(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      vacationErrors.push(`${rawDate}: invalid date format`);
      continue;
    }

    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1) {
      vacationErrors.push(`${rawDate}: not in selected month`);
      continue;
    }

    const key = toDateKey(parsed);
    if (holidayDates.has(key) || !isWeekday(parsed)) {
      vacationErrors.push(`${rawDate}: vacation cannot be on weekend/holiday`);
      continue;
    }

    vacationSet.add(key);
  }

  if (vacationErrors.length > 0) {
    throw new TimesheetValidationError('Vacation dates contain invalid values.', vacationErrors);
  }

  const dayCodesByDay = new Map<number, DayCode>();
  let firstHalfHours = 0;
  let secondHalfHours = 0;
  let workedDays = 0;
  let paidVacationHours = 0;
  let weekdayHolidayCount = 0;

  for (let day = 1; day <= 31; day += 1) {
    if (day > monthDays) {
      dayCodesByDay.set(day, '');
      continue;
    }

    const current = new Date(year, month - 1, day);
    const key = toDateKey(current);
    const weekday = isWeekday(current);

    if (!weekday || holidayDates.has(key)) {
      dayCodesByDay.set(day, 'X');
      if (weekday && holidayDates.has(key)) {
        weekdayHolidayCount++;
      }
      continue;
    }

    if (vacationSet.has(key)) {
      dayCodesByDay.set(day, 'შ');
      paidVacationHours += 8;
      continue;
    }

    dayCodesByDay.set(day, '8');
    workedDays++;
    if (day <= 15) firstHalfHours += 8;
    else secondHalfHours += 8;
  }

  let lastWorkday = monthEnd;
  while (!isWeekday(lastWorkday) || holidayDates.has(toDateKey(lastWorkday))) {
    lastWorkday = new Date(
      lastWorkday.getFullYear(),
      lastWorkday.getMonth(),
      getDate(lastWorkday) - 1
    );
  }

  return {
    dayCodesByDay,
    firstHalfHours,
    secondHalfHours,
    workedDays,
    totalWorkedHours: firstHalfHours + secondHalfHours,
    paidVacationHours,
    weekdayHolidayCount,
    startDateLabel: formatCellDate(monthStart),
    endDateLabel: formatCellDate(monthEnd),
    lastWorkdayLabel: formatLeftDate(lastWorkday)
  };
}
