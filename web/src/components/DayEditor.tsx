import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatFullDate, formatHour } from '../utils';

interface Props {
  date: string;
  hours: number[]; // selectable hours from meta
  initialSelected: number[];
  onSaved: (date: string, hours: number[]) => void;
  onBack: () => void;
}

export default function DayEditor({ date, hours, initialSelected, onSaved, onBack }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local selection in sync if the day changes.
  useEffect(() => {
    setSelected(new Set(initialSelected));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function toggle(hour: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(hours));
  }
  function clearAll() {
    setSelected(new Set());
  }

  async function save() {
    setSaving(true);
    setError(null);
    const list = Array.from(selected).sort((a, b) => a - b);
    try {
      await api.setDay(date, list);
      onSaved(date, list);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="day-editor">
      <div className="day-editor-head">
        <button type="button" className="btn btn-ghost btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2 className="day-editor-title">{formatFullDate(date)}</h2>
      </div>

      <p className="day-editor-sub">Tap every hour you could meet.</p>

      <div className="slot-toolbar">
        <button type="button" className="btn btn-small" onClick={selectAll}>
          Select all
        </button>
        <button type="button" className="btn btn-small" onClick={clearAll}>
          Clear
        </button>
        <span className="slot-count">{selected.size} selected</span>
      </div>

      <div className="slot-grid">
        {hours.map((hour) => {
          const on = selected.has(hour);
          return (
            <button
              key={hour}
              type="button"
              className={`slot${on ? ' slot-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(hour)}
            >
              {formatHour(hour)}
            </button>
          );
        })}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="day-editor-actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save this day'}
        </button>
      </div>
    </div>
  );
}
