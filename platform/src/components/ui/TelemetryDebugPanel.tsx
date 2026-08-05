import { useEffect, useMemo, useState } from 'react';

type TelemetryRecord = {
  timestamp: string;
  area: string;
  action: string;
  metadata?: Record<string, unknown>;
};

const TELEMETRY_EVENT_NAME = 'dashboard:interaction';
const MAX_RECORDS = 12;

export function TelemetryDebugPanel(): JSX.Element | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const [expanded, setExpanded] = useState(false);
  const [records, setRecords] = useState<TelemetryRecord[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<TelemetryRecord>;
      const detail = customEvent.detail;
      if (!detail || typeof detail !== 'object') {
        return;
      }

      setRecords((current) => [detail, ...current].slice(0, MAX_RECORDS));
    };

    window.addEventListener(TELEMETRY_EVENT_NAME, handler as EventListener);

    return () => {
      window.removeEventListener(TELEMETRY_EVENT_NAME, handler as EventListener);
    };
  }, []);

  const summary = useMemo(() => {
    if (!records.length) {
      return 'No telemetry events captured yet.';
    }

    const latest = records[0];
    return `${latest.area} / ${latest.action}`;
  }, [records]);

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-ink/95 p-3 text-xs text-mist shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mint/80">Telemetry</p>
          <p className="mt-1 text-mist/80">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls="telemetry-debug-panel"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-mist transition hover:border-mint/40 hover:text-mint"
        >
          {expanded ? 'Hide panel' : 'Show panel'}
        </button>
      </div>

      <div id="telemetry-debug-panel" className={`mt-3 space-y-2 ${expanded ? '' : 'hidden'}`}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-mint/70">Recent events</p>
          <button
            type="button"
            onClick={() => setRecords([])}
            className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-mist transition hover:border-mint/40 hover:text-mint"
          >
            Clear
          </button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {records.length ? (
            records.map((record, index) => (
              <div key={`${record.timestamp}-${record.action}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-2">
                <p className="font-medium text-white">
                  {record.area} / {record.action}
                </p>
                <p className="mt-1 text-[10px] text-mist/70">{new Date(record.timestamp).toLocaleTimeString()}</p>
                {record.metadata ? (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[10px] text-mist/70">{JSON.stringify(record.metadata, null, 2)}</pre>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-[11px] text-mist/70">Trigger dashboard interactions to inspect event payloads.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
