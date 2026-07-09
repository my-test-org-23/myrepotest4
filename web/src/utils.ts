const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
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

/** Month name, capitalized (e.g. "Julio") for use in headings. */
export function monthName(month: number): string {
  const m = MONTHS[month - 1] ?? '';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** "Vie, 10 de julio" — Spanish day-first date format. */
export function formatFullDate(date: string): string {
  const d = parseDate(date);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** 13 -> "13:00", 9 -> "09:00" (24-hour format, common in Spanish). */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "09:00 – 10:00" for a one-hour slot starting at `hour`. */
export function formatHourRange(hour: number): string {
  return `${formatHour(hour)} – ${formatHour((hour + 1) % 24)}`;
}

// Spanish weekday initials: Dom, Lun, Mar, Mié, Jue, Vie, Sáb.
export const weekdayLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
