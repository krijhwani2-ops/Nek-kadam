/**
 * Safe date parsing and formatting utilities for Nek Kadam application.
 * Prevents RangeError: Invalid time value crashes and handles null/undefined/invalid dates gracefully.
 */

/**
 * Safely parses any date input (string, number, Date, null, undefined) into a valid Date object or null.
 */
export function safeParseDate(input?: string | number | Date | null): Date | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  
  // Handle space separated ISO timestamps e.g. "2026-07-28 10:00:00"
  let strInput = String(input).trim();
  if (strInput.includes(' ') && !strInput.includes('T')) {
    strInput = strInput.replace(' ', 'T');
  }
  
  const parsed = new Date(strInput);
  if (isNaN(parsed.getTime())) {
    // Try standard fallback parse if direct parse failed
    const fallbackParsed = new Date(input);
    return isNaN(fallbackParsed.getTime()) ? null : fallbackParsed;
  }
  return parsed;
}

/**
 * Safely formats a date input into a localized date string.
 * Returns a fallback string if the date is null or invalid.
 */
export function safeFormatDate(
  input?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
  locale?: string | string[],
  fallback: string = 'N/A'
): string {
  const date = safeParseDate(input);
  if (!date) return fallback;
  try {
    return date.toLocaleDateString(locale, options);
  } catch (err) {
    return fallback;
  }
}

/**
 * Safely formats a date input into a localized time string.
 */
export function safeFormatTime(
  input?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
  locale?: string | string[],
  fallback: string = 'N/A'
): string {
  const date = safeParseDate(input);
  if (!date) return fallback;
  try {
    return date.toLocaleTimeString(locale, options);
  } catch (err) {
    return fallback;
  }
}
