export type DayCode = '8' | 'X' | 'შ' | '';

export interface HolidayEntry {
  date: string;
  title: string;
  isStateOnly: boolean;
}

export interface TimesheetGenerateRequest {
  year: number;
  month: number;
  companyCode: string;
  employeeName: string;
  employeeId: string;
  vacationDates: string[];
  outputFormat: 'docx' | 'doc';
}

export interface ComputedTimesheet {
  dayCodesByDay: Map<number, DayCode>;
  firstHalfHours: number;
  secondHalfHours: number;
  workedDays: number;
  totalWorkedHours: number;
  paidVacationHours: number;
  weekdayHolidayCount: number;
  startDateLabel: string;
  endDateLabel: string;
  lastWorkdayLabel: string;
}

export interface TimesheetComputationInput {
  year: number;
  month: number;
  vacationDates: string[];
  holidayDates: Set<string>;
}
