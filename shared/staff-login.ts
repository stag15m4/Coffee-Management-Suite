const STAFF_DOMAIN = 'staff.coffeemanagementsuite.invalid';
export const STAFF_LOGIN_PATTERN = /^[a-z][a-z0-9._-]{2,39}$/;
export function staffAuthEmail(loginId: string): string {
  const normalized = loginId.trim().toLowerCase();
  if (!STAFF_LOGIN_PATTERN.test(normalized))
    throw new Error(
      'Staff ID must be 3–40 characters: letters, numbers, dots, dashes, or underscores, starting with a letter.'
    );
  return `${normalized}@${STAFF_DOMAIN}`;
}
export function staffIdFromEmail(email?: string | null): string | null {
  if (!email?.toLowerCase().endsWith(`@${STAFF_DOMAIN}`)) return null;
  return email.slice(0, email.indexOf('@'));
}
export function loginEmail(identifier: string): string {
  const normalized = identifier.trim();
  return normalized.includes('@') ? normalized : staffAuthEmail(normalized);
}
