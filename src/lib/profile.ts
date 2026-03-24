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
  if (trimmed.length === 0) return '';
  if (trimmed.length < 6 || trimmed.length > 12 || !isNumeric(trimmed)) return '';
  return trimmed;
}

export function normalizeEmployeeId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  if (!/^\d{11}$/.test(trimmed)) return '';
  return trimmed;
}

export function normalizeEmployeeName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  if (!looksLikeName(trimmed)) return '';
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

export function identifyInvalidFields(snapshot: ProfileSnapshot): FieldErrors {
  const cc = snapshot.companyCode.trim();
  const name = snapshot.employeeName.trim();
  const id = snapshot.employeeId.trim();
  return {
    companyCode: !cc || cc.length < 6 || cc.length > 12 || !isNumeric(cc),
    employeeName: !name || !looksLikeName(name),
    employeeId: !id || !/^\d{11}$/.test(id)
  };
}

export function validateProfileFields(snapshot: ProfileSnapshot): string[] {
  const errors: string[] = [];
  const cc = snapshot.companyCode.trim();
  const name = snapshot.employeeName.trim();
  const id = snapshot.employeeId.trim();

  if (!cc) errors.push('Company code is required.');
  else if (cc.length < 6 || cc.length > 12 || !isNumeric(cc))
    errors.push('Company code must be numeric (6\u201312 digits).');

  if (!name) errors.push('Employee name is required.');
  else if (!looksLikeName(name)) errors.push('Employee name must contain text.');

  if (!id) errors.push('Employee ID is required.');
  else if (!/^\d{11}$/.test(id)) errors.push('Employee ID must be exactly 11 digits.');

  return errors;
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
    nextEmployeeName = nextCompanyCode;
    nextCompanyCode = '';
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
