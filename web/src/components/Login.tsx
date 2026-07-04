import { useState, FormEvent } from 'react';
import { api, ApiError, setToken } from '../api';
import type { Session } from '../types';

interface Props {
  onSignedIn: (session: Session) => void;
}

export default function Login({ onSignedIn }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await api.auth(code.trim(), needsName ? name.trim() : name.trim() || undefined);
      setToken(session.token);
      onSignedIn(session);
    } catch (err) {
      if (err instanceof ApiError && err.needsName) {
        // The code was the participant code but a name is required.
        setNeedsName(true);
        setError('Enter your name to continue.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={submit}>
        <h1 className="login-title">When are you free?</h1>
        <p className="login-sub">
          Enter the code you were given to help pick a time for the event.
        </p>

        <label className="field">
          <span className="field-label">Access code</span>
          <input
            className="input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            placeholder="e.g. JULY2026"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
        </label>

        {needsName && (
          <label className="field">
            <span className="field-label">Your name</span>
            <input
              className="input"
              type="text"
              autoComplete="name"
              placeholder="How should we list you?"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </button>

        <p className="login-hint">
          Have an organizer code? Enter it here to open the dashboard.
        </p>
      </form>
    </div>
  );
}
