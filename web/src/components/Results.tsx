import { useEffect, useState } from 'react';
import { api } from '../api';
import type { OverlapResult } from '../types';
import { formatFullDate, formatHourRange } from '../utils';

export default function Results() {
  const [data, setData] = useState<OverlapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .overlap()
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <p className="muted">Cargando horarios sugeridos…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data || data.slots.length === 0) {
    return (
      <div className="empty-state">
        <p>Aún no hay disponibilidad.</p>
        <p className="muted">
          Cuando las personas indiquen cuándo están disponibles, los mejores
          horarios para reunirse aparecerán aquí.
        </p>
      </div>
    );
  }

  const { totalUsers, slots } = data;
  const best = slots[0].count;
  // Slots where everyone who signed in is available.
  const unanimous = slots.filter((s) => s.count === totalUsers && totalUsers > 0);
  const topSlots = slots.filter((s) => s.count === best);

  const highlight = unanimous.length > 0 ? unanimous : topSlots;
  const rest = slots.filter((s) => !highlight.includes(s));

  return (
    <div className="results">
      <div className="results-summary card">
        <p className="results-lede">
          {unanimous.length > 0
            ? `Todos (${totalUsers}) están disponibles en estos horarios:`
            : `Mejor coincidencia hasta ahora: ${best} de ${totalUsers} personas:`}
        </p>
        <ul className="slot-list">
          {highlight.map((s) => (
            <li key={`${s.date}-${s.hour}`} className="slot-row slot-row-top">
              <div className="slot-row-main">
                <span className="slot-row-date">{formatFullDate(s.date)}</span>
                <span className="slot-row-time">{formatHourRange(s.hour)}</span>
              </div>
              <span className="slot-row-count">
                {s.count}/{totalUsers}
              </span>
              <div className="slot-row-names">{s.names.join(', ')}</div>
            </li>
          ))}
        </ul>
      </div>

      {rest.length > 0 && (
        <div className="results-rest">
          <h3 className="section-subtitle">Otros horarios en que hay disponibilidad</h3>
          <ul className="slot-list">
            {rest.map((s) => (
              <li key={`${s.date}-${s.hour}`} className="slot-row">
                <div className="slot-row-main">
                  <span className="slot-row-date">{formatFullDate(s.date)}</span>
                  <span className="slot-row-time">{formatHourRange(s.hour)}</span>
                </div>
                <span className="slot-row-count">
                  {s.count}/{totalUsers}
                </span>
                <div className="slot-row-names">{s.names.join(', ')}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
