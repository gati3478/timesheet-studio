import { HOURS_PER_WORKDAY } from './constants';

export type DayItem = {
  day: number;
  dateIso: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isVacation: boolean;
};

export type CalendarCell =
  | { kind: 'empty'; key: string }
  | { kind: 'day'; key: string; item: DayItem };

export interface SummaryResult {
  workedDayCount: number;
  vacationDayCount: number;
  blockedDayCount: number;
  weekdayHolidayCount: number;
  firstHalfHours: number;
  secondHalfHours: number;
  totalHours: number;
  vacationHours: number;
}

export function computeSummary(dayItems: DayItem[]): SummaryResult {
  let worked = 0;
  let vacation = 0;
  let blocked = 0;
  let weekdayHoliday = 0;
  let h1 = 0;
  let h2 = 0;
  for (const item of dayItems) {
    if (item.isWeekend || item.isHoliday) {
      blocked++;
      if (item.isHoliday && !item.isWeekend) weekdayHoliday++;
    } else if (item.isVacation) {
      vacation++;
    } else {
      worked++;
      if (item.day <= 15) h1 += HOURS_PER_WORKDAY;
      else h2 += HOURS_PER_WORKDAY;
    }
  }
  return {
    workedDayCount: worked,
    vacationDayCount: vacation,
    blockedDayCount: blocked,
    weekdayHolidayCount: weekdayHoliday,
    firstHalfHours: h1,
    secondHalfHours: h2,
    totalHours: h1 + h2,
    vacationHours: vacation * HOURS_PER_WORKDAY
  };
}
