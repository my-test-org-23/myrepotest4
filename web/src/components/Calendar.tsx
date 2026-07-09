import type { AvailabilityMap } from '../types';
import { dayOfMonth, weekdayIndex, weekdayLabels } from '../utils';

interface Props {
  dates: string[];
  availability: AvailabilityMap;
  onSelectDay: (date: string) => void;
}

export default function Calendar({ dates, availability, onSelectDay }: Props) {
  if (dates.length === 0) return null;

  // Number of blank cells before the 1st so the grid lines up under weekdays.
  const leadingBlanks = weekdayIndex(dates[0]);

  return (
    <div className="calendar">
      <div className="calendar-grid calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="day-cell day-blank" />
        ))}

        {dates.map((date) => {
          const hours = availability[date] || [];
          const count = hours.length;
          const hasAvail = count > 0;
          return (
            <button
              key={date}
              type="button"
              className={`day-cell${hasAvail ? ' day-has-avail' : ''}`}
              onClick={() => onSelectDay(date)}
              aria-label={`${dayOfMonth(date)} de julio${
                hasAvail ? `, ${count} horario${count === 1 ? '' : 's'} seleccionado${count === 1 ? '' : 's'}` : ''
              }`}
            >
              <span className="day-number">{dayOfMonth(date)}</span>
              {hasAvail && <span className="day-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      <p className="calendar-legend">
        Toca un día para indicar las horas en que estás disponible. El número
        muestra cuántas horas elegiste.
      </p>
    </div>
  );
}
