import { useCallback, useEffect, useRef, useState } from "react";
import {
  commEmit,
  commRequest,
  commTriggerPyEvent,
  commTriggerPyRequest,
  subscribeCommTrace,
  type CommTrace,
} from "./lib/api";
import "./App.css";

type LogEntry = {
  id: number;
  time: string;
  message: string;
};

let logId = 0;

function formatTime() {
  return new Date().toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const pushLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev.slice(-199),
      { id: ++logId, time: formatTime(), message },
    ]);
  }, []);

  useEffect(() => {
    const un = subscribeCommTrace((entry: CommTrace) => {
      pushLog(entry.message);
    });
    return () => {
      un.then((u) => u());
    };
  }, [pushLog]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushLog(`error: ${label} — ${msg}`);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <h1>Comm Test</h1>
      <p className="subtitle">Bidirectional Rust ↔ Python event &amp; request/response bus</p>

      <section className="panel">
        <h2>Rust → Python</h2>
        <div className="row">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run("Rust→Py request (hello)", () => commRequest("hello", {}))
            }
          >
            Request: hello
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run("Rust→Py event (test.event)", () =>
                commEmit("test.event", { from: "rust-ui", ts: Date.now() }),
              )
            }
          >
            Event: test.event
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Python → Rust</h2>
        <div className="row">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run("Py→Rust request (rust.ping)", () =>
                commTriggerPyRequest("rust.ping", {}),
              )
            }
          >
            Request: rust.ping
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run("Py→Rust request (rust.echo)", () =>
                commTriggerPyRequest("rust.echo", { hello: "from python" }),
              )
            }
          >
            Request: rust.echo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run("Py→Rust event (test.event)", () =>
                commTriggerPyEvent("test.event", {
                  from: "python-ui",
                  ts: Date.now(),
                }),
              )
            }
          >
            Event: test.event
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="comm-log">
        <div className="comm-log-header">
          <h2>Comm trace</h2>
          <button type="button" className="btn-muted" onClick={() => setLogs([])}>
            Clear
          </button>
        </div>
        <div className="comm-log-body">
          {logs.length === 0 ? (
            <p className="comm-log-empty">Press a button to exercise the bus.</p>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="log-line log-rust">
                <span className="log-time">{entry.time}</span>
                <span className="log-side">rust</span>
                <span className="log-msg">{entry.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </section>
    </main>
  );
}

export default App;
