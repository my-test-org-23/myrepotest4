import { config } from './config';

/** Returns every date string 'YYYY-MM-DD' in the configured event month. */
export function monthDates(): string[] {
  const { year, month } = config.event;
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based here
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

/** Returns the selectable hours, e.g. [7, 8, ..., 22]. */
export function slotHours(): number[] {
  const { startHour, endHour } = config.slots;
  const out: number[] = [];
  for (let h = startHour; h < endHour; h++) out.push(h);
  return out;
}

const validDates = new Set(monthDates());
const validHours = new Set(slotHours());

export function isValidDate(date: string): boolean {
  return validDates.has(date);
}

export function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && validHours.has(hour);
}
