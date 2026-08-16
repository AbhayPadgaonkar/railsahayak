"use client";

import { useEffect, useState } from "react";
import { AuditEntry, getAuditLogs } from "@/lib/api";

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  decision_run: {
    label: "Decision Run",
    cls: "bg-sky-900 text-sky-200",
  },
  advisory_accept: {
    label: "Advisory Accepted",
    cls: "bg-emerald-900 text-emerald-200",
  },
  advisory_dismiss: {
    label: "Advisory Dismissed",
    cls: "bg-slate-700 text-slate-200",
  },
  crisis_declare: {
    label: "Crisis Declared",
    cls: "bg-red-900 text-red-200",
  },
  crisis_resolve: {
    label: "Crisis Resolved",
    cls: "bg-emerald-900 text-emerald-200",
  },
  whatif_run: {
    label: "What-If Simulation",
    cls: "bg-violet-900 text-violet-200",
  },
};

const actionBadge = (action: string) =>
  ACTION_LABELS[action] ?? { label: action, cls: "bg-slate-800 text-slate-300" };

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuditLogs()
      .then((entries) => {
        if (!cancelled) setLogs(entries);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load audit logs");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full overflow-auto p-3">
      <div className="mb-3">
        <h1 className="text-xl font-bold text-white">Audit Logs</h1>
        <p className="text-xs text-slate-400">
          Decision runs and advisory actions executed by controllers against the
          G&SR engine
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading audit logs…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-slate-500">
          No audit entries yet — run a decision or accept a recommendation and
          it will appear here.
        </p>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => {
                const badge = actionBadge(entry.action);
                return (
                  <tr
                    key={`${entry.at}-${i}`}
                    className="border-t border-slate-800 bg-slate-900/40"
                  >
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {entry.at}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                        {JSON.stringify(entry.detail, null, 2)}
                      </pre>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;