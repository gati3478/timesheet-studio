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
