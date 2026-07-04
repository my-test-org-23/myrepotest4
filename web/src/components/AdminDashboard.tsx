import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminSummary } from '../types';
import { formatFullDate, formatHour } from '../utils';
import Results from './Results';

export default function AdminDashboard() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .adminSummary()
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="admin">
      <section className="admin-section">
        <h2 className="section-title">Suggested times</h2>
        <Results />
      </section>

      <section className="admin-section">
        <h2 className="section-title">Participants</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error-text">{error}</p>}
        {data && (
          <>
            <div className="stat-row">
              <div className="stat card">
                <span className="stat-num">{data.totalUsers}</span>
                <span className="stat-label">people signed in</span>
              </div>
              <div className="stat card">
                <span className="stat-num">{data.totalSlots}</span>
                <span className="stat-label">total slots picked</span>
              </div>
            </div>

            {data.users.length === 0 && (
              <p className="muted">Nobody has signed in yet.</p>
            )}

            <ul className="admin-users">
              {data.users.map((u) => (
                <li key={u.id} className="card admin-user">
                  <div className="admin-user-head">
                    <span className="admin-user-name">{u.name}</span>
                    <span className="admin-user-meta">
                      {u.totalDays} day{u.totalDays === 1 ? '' : 's'} ·{' '}
                      {u.totalSlots} slot{u.totalSlots === 1 ? '' : 's'}
                    </span>
                  </div>
                  {u.slots.length === 0 ? (
                    <p className="muted small">No availability set.</p>
                  ) : (
                    <div className="admin-user-days">
                      {groupByDate(u.slots).map(([date, hrs]) => (
                        <div key={date} className="admin-day">
                          <span className="admin-day-date">{formatFullDate(date)}</span>
                          <span className="admin-day-hours">
                            {hrs.map((h) => formatHour(h)).join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function groupByDate(slots: { date: string; hour: number }[]): [string, number[]][] {
  const map = new Map<string, number[]>();
  for (const s of slots) {
    const arr = map.get(s.date) || [];
    arr.push(s.hour);
    map.set(s.date, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, hrs]) => [d, hrs.sort((x, y) => x - y)]);
}
