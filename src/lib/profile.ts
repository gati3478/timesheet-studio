const PROFILE_STORAGE_KEY = 'timesheet.profile.v1';

export interface ProfileSnapshot {
  companyCode: string;
  employeeName: string;
  employeeId: string;
}

export function isNumeric(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function looksLikeName(value: string): boolean {
  return /[^\d\s]/.test(value.trim());
}

export function normalizeCompanyCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !isValidCompanyCode(trimmed)) return '';
  return trimmed;
}

export function normalizeEmployeeId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !isValidEmployeeId(trimmed)) return '';
  return trimmed;
}

export function normalizeEmployeeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !isValidEmployeeName(trimmed)) return '';
  return trimmed;
}

export interface FieldErrors {
  companyCode: boolean;
  employeeName: boolean;
  employeeId: boolean;
}

export const NO_FIELD_ERRORS: Readonly<FieldErrors> = Object.freeze({
  companyCode: false,
  employeeName: false,
  employeeId: false
});

function isValidCompanyCode(value: string): boolean {
  return value.length >= 6 && value.length <= 12 && isNumeric(value);
}

function isValidEmployeeName(value: string): boolean {
  return value.length > 0 && looksLikeName(value);
}

function isValidEmployeeId(value: string): boolean {
  return /^\d{11}$/.test(value);
}

export interface ProfileValidationResult {
  messages: string[];
  fieldErrors: FieldErrors;
}

export function validateProfile(snapshot: ProfileSnapshot): ProfileValidationResult {
  const messages: string[] = [];
  const fieldErrors: FieldErrors = { ...NO_FIELD_ERRORS };
  const cc = snapshot.companyCode.trim();
  const name = snapshot.employeeName.trim();
  const id = snapshot.employeeId.trim();

  if (!cc) {
    messages.push('Company code is required.');
    fieldErrors.companyCode = true;
  } else if (!isValidCompanyCode(cc)) {
    messages.push('Company code must be numeric (6\u201312 digits).');
    fieldErrors.companyCode = true;
  }

  if (!name) {
    messages.push('Employee name is required.');
    fieldErrors.employeeName = true;
  } else if (!isValidEmployeeName(name)) {
    messages.push('Employee name must contain text.');
    fieldErrors.employeeName = true;
  }

  if (!id) {
    messages.push('Employee ID is required.');
    fieldErrors.employeeId = true;
  } else if (!isValidEmployeeId(id)) {
    messages.push('Employee ID must be exactly 11 digits.');
    fieldErrors.employeeId = true;
  }

  return { messages, fieldErrors };
}

export function identifyInvalidFields(snapshot: ProfileSnapshot): FieldErrors {
  return validateProfile(snapshot).fieldErrors;
}

export function validateProfileFields(snapshot: ProfileSnapshot): string[] {
  return validateProfile(snapshot).messages;
}

export function repairProfileSnapshot(snapshot: ProfileSnapshot): ProfileSnapshot {
  let nextCompanyCode = snapshot.companyCode.trim();
  let nextEmployeeName = snapshot.employeeName.trim();
  const nextEmployeeId = snapshot.employeeId.trim();

  if (
    !isNumeric(nextCompanyCode) &&
    looksLikeName(nextCompanyCode) &&
    isNumeric(nextEmployeeName) &&
    isNumeric(nextEmployeeId)
  ) {
    const swapped = nextEmployeeName;
    nextEmployeeName = nextCompanyCode;
    nextCompanyCode = swapped;
  }

  return {
    companyCode: normalizeCompanyCode(nextCompanyCode),
    employeeName: normalizeEmployeeName(nextEmployeeName),
    employeeId: normalizeEmployeeId(nextEmployeeId)
  };
}

export function persistProfile(profile: ProfileSnapshot): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function loadSavedProfile(): ProfileSnapshot | null {
  const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<ProfileSnapshot>;

    const fixed = repairProfileSnapshot({
      companyCode: typeof parsed.companyCode === 'string' ? parsed.companyCode : '',
      employeeName: typeof parsed.employeeName === 'string' ? parsed.employeeName : '',
      employeeId: typeof parsed.employeeId === 'string' ? parsed.employeeId : ''
    });

    persistProfile(fixed);
    return fixed;
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}
