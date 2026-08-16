"use client";

import { useEffect, useState } from "react";
import {
  CrisisState,
  declareCrisis,
  getCrises,
  resolveCrisis,
} from "@/lib/api";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const severityCls = (severity: string) =>
  ({
    LOW: "bg-slate-700 text-slate-200",
    MEDIUM: "bg-amber-800 text-amber-100",
    HIGH: "bg-orange-800 text-orange-100",
    CRITICAL: "bg-red-800 text-red-100",
  })[severity] ?? "bg-slate-700 text-slate-200";

const inputCls =
  "w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500 transition-colors";
const labelCls = "block text-xs text-slate-400 mb-1";

const CrisisManagementPage = () => {
  const [state, setState] = useState<CrisisState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [crisisType, setCrisisType] = useState("");
  const [severity, setSeverity] = useState("HIGH");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [declaring, setDeclaring] = useState(false);

  const active = state?.crises.filter((c) => c.status === "ACTIVE") ?? [];
  const resolved = state?.crises.filter((c) => c.status === "RESOLVED") ?? [];

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await getCrises();
      setState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load crisis state");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeclare = async () => {
    if (!crisisType) {
      setError("Select a crisis type");
      return;
    }
    if (!location) {
      setError("Select a location (station)");
      return;
    }
    setDeclaring(true);
    setError(null);
    try {
      await declareCrisis({
        crisis_type: crisisType,
        severity,
        location,
        description: description || null,
      });
      setDescription("");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to declare crisis");
    } finally {
      setDeclaring(false);
    }
  };

  const handleResolve = async (crisisId: string) => {
    setError(null);
    try {
      await resolveCrisis(crisisId);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve crisis");
    }
  };

  return (
    <div className="h-full overflow-auto p-3 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Crisis Management</h1>
          <p className="text-xs text-slate-400">
            Declare and resolve incidents; a disaster class crisis forces the
            whole decision engine into emergency (HOLD) mode
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-sm text-slate-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {state?.disaster_active && (
        <div className="rounded-xl border border-red-800 bg-red-950/60 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl">🚨</span>
            <div>
              <h2 className="font-bold text-red-200 text-base">
                DISASTER MODE ACTIVE
              </h2>
              <p className="text-xs text-red-300/80">
                A line-wide disaster crisis is active. All /decision runs hold
                every train until the crisis is resolved.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading crisis state…</p>
      ) : (
        <>
          {/* Declare form */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="font-semibold text-white text-sm mb-3">
              Declare New Crisis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Crisis Type</label>
                <select
                  className={inputCls}
                  value={crisisType}
                  onChange={(e) => {
                    const t = state?.types.find(
                      (x) => x.type === e.target.value
                    );
                    setCrisisType(e.target.value);
                    if (t) {
                      setSeverity(t.default_severity);
                      if (t.is_disaster) {
                        setDescription(t.default_action);
                      }
                    }
                  }}
                >
                  <option value="">Select type…</option>
                  {state?.types.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                      {t.is_disaster ? " (disaster)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Severity</label>
                <select
                  className={inputCls}
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Location (station)</label>
                <select
                  className={inputCls}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="">Select station…</option>
                  {state?.stations.map((s) => (
                    <option key={s.station_id} value={s.station_id}>
                      {s.name} ({s.station_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 xl:col-span-1">
                <label className={labelCls}>Description / Action</label>
                <input
                  className={inputCls}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What to do"
                />
              </div>
            </div>
            <button
              onClick={handleDeclare}
              disabled={declaring}
              className="mt-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
            >
              {declaring ? "Declaring…" : "Declare Crisis"}
            </button>
          </div>

          {/* Active crises */}
          <div>
            <h2 className="font-semibold text-white text-sm mb-2">
              Active Crises ({active.length})
            </h2>
            {active.length === 0 ? (
              <p className="text-xs text-slate-500">
                No active crises. Line operating normally.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {active.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-red-900/60 bg-red-950/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          {c.label}
                          <span className="ml-2 text-xs text-slate-400 font-normal">
                            {c.id}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.station_name} ({c.location})
                          {c.block_id ? ` — block ${c.block_id}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${severityCls(c.severity)}`}
                      >
                        {c.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2">
                      {c.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Declared {c.declared_at}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-400">
                          Trains in area:
                        </span>
                        {c.affected_trains.length === 0 ? (
                          <span className="text-[11px] text-slate-500">
                            none
                          </span>
                        ) : (
                          c.affected_trains.map((t) => (
                            <span
                              key={t}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300"
                            >
                              {t}
                            </span>
                          ))
                        )}
                      </div>
                      <button
                        onClick={() => handleResolve(c.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <h2 className="font-semibold text-white text-sm mb-2">
                Recently Resolved ({resolved.length})
              </h2>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Crisis</th>
                      <th className="text-left px-3 py-2">Severity</th>
                      <th className="text-left px-3 py-2">Location</th>
                      <th className="text-left px-3 py-2">Declared</th>
                      <th className="text-left px-3 py-2">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-slate-800 bg-slate-900/40"
                      >
                        <td className="px-3 py-2 text-slate-300">
                          {c.label}{" "}
                          <span className="text-slate-500 text-xs">
                            {c.id}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${severityCls(c.severity)}`}
                          >
                            {c.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-xs">
                          {c.station_name} ({c.location})
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-xs font-mono">
                          {c.declared_at}
                        </td>
                        <td className="px-3 py-2 text-emerald-400 text-xs font-mono">
                          {c.resolved_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CrisisManagementPage;