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
