export function isNumeric(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function looksLikeName(value: string): boolean {
  return /[^\d\s]/.test(value.trim());
}

export function isValidCompanyCode(value: string): boolean {
  return value.length >= 6 && value.length <= 12 && isNumeric(value);
}

export function isValidEmployeeName(value: string): boolean {
  return value.length > 0 && looksLikeName(value);
}

export function isValidEmployeeId(value: string): boolean {
  return /^\d{11}$/.test(value);
}
