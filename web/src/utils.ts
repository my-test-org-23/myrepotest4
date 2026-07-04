const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parse 'YYYY-MM-DD' into a local Date (avoids UTC off-by-one). */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayOfMonth(date: string): number {
  return parseDate(date).getDate();
}

/** 0 = Sunday .. 6 = Saturday for the first day of the given month's dates. */
export function weekdayIndex(date: string): number {
  return parseDate(date).getDay();
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

export function formatFullDate(date: string): string {
  const d = parseDate(date);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** 13 -> "1 PM", 9 -> "9 AM". */
export function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

/** "9 AM – 10 AM" for a one-hour slot starting at `hour`. */
export function formatHourRange(hour: number): string {
  return `${formatHour(hour)} – ${formatHour((hour + 1) % 24)}`;
}

export const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
