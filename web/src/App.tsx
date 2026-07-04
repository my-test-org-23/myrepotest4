import { useCallback, useEffect, useState } from 'react';
import { api, clearToken, getToken } from './api';
import type { AvailabilityMap, EventMeta, Session } from './types';
import { monthName } from './utils';
import Login from './components/Login';
import Calendar from './components/Calendar';
import DayEditor from './components/DayEditor';
import Results from './components/Results';
import AdminDashboard from './components/AdminDashboard';

type Tab = 'calendar' | 'results';

export default function App() {
  const [meta, setMeta] = useState<EventMeta | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [tab, setTab] = useState<Tab>('calendar');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Load public event metadata once.
  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
  }, []);

  // Try to restore a session from a stored token.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setRestoring(false);
      return;
    }
    api
      .me()
      .then((me) => {
        setSession({ token, isAdmin: me.isAdmin, name: me.name, userId: me.userId ?? undefined });
      })
      .catch(() => clearToken())
      .finally(() => setRestoring(false));
  }, []);

  const loadAvailability = useCallback(() => {
    api.myAvailability().then(setAvailability).catch(() => setAvailability({}));
  }, []);

  // Load the participant's own availability after sign-in.
  useEffect(() => {
    if (session && !session.isAdmin) loadAvailability();
  }, [session, loadAvailability]);

  function handleSignedIn(s: Session) {
    setSession(s);
    setTab('calendar');
    setSelectedDay(null);
  }

  function handleLogout() {
    api.logout().catch(() => {});
    clearToken();
    setSession(null);
    setAvailability({});
    setSelectedDay(null);
  }

  function handleDaySaved(date: string, hours: number[]) {
    setAvailability((prev) => {
      const next = { ...prev };
      if (hours.length === 0) delete next[date];
      else next[date] = hours;
      return next;
    });
  }

  if (restoring || !meta) {
    return (
      <div className="app-loading">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Login onSignedIn={handleSignedIn} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-title-block">
            <p className="app-eyebrow">Scheduling</p>
            <h1 className="app-title">{meta.event.title}</h1>
            <p className="app-sub">
              {monthName(meta.event.month)} {meta.event.year}
              {session.name ? ` · ${session.name}` : session.isAdmin ? ' · Organizer' : ''}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-small" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="app-main">
        {session.isAdmin ? (
          <AdminDashboard />
        ) : selectedDay ? (
          <DayEditor
            date={selectedDay}
            hours={meta.hours}
            initialSelected={availability[selectedDay] || []}
            onSaved={handleDaySaved}
            onBack={() => setSelectedDay(null)}
          />
        ) : (
          <>
            <nav className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={tab === 'calendar'}
                className={`tab${tab === 'calendar' ? ' tab-active' : ''}`}
                onClick={() => setTab('calendar')}
              >
                My availability
              </button>
              <button
                role="tab"
                aria-selected={tab === 'results'}
                className={`tab${tab === 'results' ? ' tab-active' : ''}`}
                onClick={() => setTab('results')}
              >
                Suggested times
              </button>
            </nav>

            {tab === 'calendar' ? (
              <Calendar
                dates={meta.dates}
                availability={availability}
                onSelectDay={setSelectedDay}
              />
            ) : (
              <Results />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p className="muted small">
          Pick every hour you could make it. We’ll find the times that work for
          the most people.
        </p>
      </footer>
    </div>
  );
}
