import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDaysInMonth,
  getISODay,
  parseISO,
  startOfMonth
} from 'date-fns';
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

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new TimesheetValidationError('Year must be between 2000 and 2100.', []);
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new TimesheetValidationError('Month must be an integer between 1 and 12.', []);
  }

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

  for (let day = 1; day <= 31; day += 1) {
    if (day > monthDays) {
      dayCodesByDay.set(day, '');
      continue;
    }

    const current = new Date(year, month - 1, day);
    const key = toDateKey(current);

    if (!isWeekday(current) || holidayDates.has(key)) {
      dayCodesByDay.set(day, 'X');
      continue;
    }

    if (vacationSet.has(key)) {
      dayCodesByDay.set(day, 'შ');
      continue;
    }

    dayCodesByDay.set(day, '8');
  }

  const firstHalfHours =
    Array.from({ length: Math.min(15, monthDays) }, (_, idx) => idx + 1).filter(
      (day) => dayCodesByDay.get(day) === '8'
    ).length * 8;

  const secondHalfHours =
    Array.from({ length: Math.max(0, monthDays - 15) }, (_, idx) => idx + 16).filter(
      (day) => dayCodesByDay.get(day) === '8'
    ).length * 8;

  const workedDays = Array.from({ length: monthDays }, (_, idx) => idx + 1).filter(
    (day) => dayCodesByDay.get(day) === '8'
  ).length;

  const paidVacationHours =
    Array.from({ length: monthDays }, (_, idx) => idx + 1).filter(
      (day) => dayCodesByDay.get(day) === 'შ'
    ).length * 8;

  const weekdayHolidayCount = eachDayOfInterval({
    start: startOfMonth(monthStart),
    end: monthEnd
  }).filter((date) => holidayDates.has(toDateKey(date)) && isWeekday(date)).length;

  let lastWorkday = monthEnd;
  while (!isWeekday(lastWorkday)) {
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
