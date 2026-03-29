import {
  isNumeric,
  looksLikeName,
  isValidCompanyCode,
  isValidEmployeeName,
  isValidEmployeeId
} from './validation';
import { getStorage } from './storage';

const PROFILE_STORAGE_KEY = 'timesheet.profile.v1';

export interface ProfileSnapshot {
  companyCode: string;
  employeeName: string;
  employeeId: string;
}

function normalizeField(value: string, isValid: (v: string) => boolean): string {
  const trimmed = value.trim();
  return trimmed && isValid(trimmed) ? trimmed : '';
}

export function normalizeCompanyCode(value: string): string {
  return normalizeField(value, isValidCompanyCode);
}

export function normalizeEmployeeId(value: string): string {
  return normalizeField(value, isValidEmployeeId);
}

export function normalizeEmployeeName(value: string): string {
  return normalizeField(value, isValidEmployeeName);
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
    companyCode: nextCompanyCode,
    employeeName: nextEmployeeName,
    employeeId: nextEmployeeId
  };
}

export async function persistProfile(profile: ProfileSnapshot): Promise<void> {
  await getStorage().setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function loadSavedProfile(): Promise<ProfileSnapshot | null> {
  const saved = await getStorage().getItem(PROFILE_STORAGE_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<ProfileSnapshot>;

    return repairProfileSnapshot({
      companyCode: typeof parsed.companyCode === 'string' ? parsed.companyCode : '',
      employeeName: typeof parsed.employeeName === 'string' ? parsed.employeeName : '',
      employeeId: typeof parsed.employeeId === 'string' ? parsed.employeeId : ''
    });
  } catch {
    await getStorage().removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}
