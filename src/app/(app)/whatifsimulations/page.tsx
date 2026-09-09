"use client";

import { useEffect, useState } from "react";
import {
  WhatIfResult,
  WhatIfScenariosResponse,
  getWhatIfScenarios,
  runWhatIfSimulation,
} from "@/lib/api";

const TRAIN_TYPES = [
  "VANDE_BHARAT",
  "RAJDHANI",
  "SHATABDI",
  "MAIL_EXPRESS",
  "PASSENGER",
  "MEMU",
  "GOODS",
  "DEPARTMENTAL",
];

const LINES = ["UP_MAIN", "UP_LOOP", "DN_MAIN", "DN_LOOP"];

const TURNOUTS = [
  "T1_ST_A1", "T2_ST_A1", "T3_ST_A1", "T4_ST_A1",
  "T1_ST_B1", "T2_ST_B1", "T3_ST_B1", "T4_ST_B1",
  "T1_ST_C1", "T2_ST_C1", "T3_ST_C1", "T4_ST_C1",
];

const BLOCKS = [
  "ST_A1_AB", "ST_A1_BC", "ST_B1_BC", "ST_B1_CD",
  "ST_C1_CD", "ST_C1_DE", "ST_A2_AB", "ST_B2_BC", "ST_C2_CD",
];

const inputCls =
  "w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500 transition-colors";
const labelCls = "block text-xs text-slate-400 mb-1";

const num = (v: string) => (v === "" ? 0 : Number(v));

const WhatIfPage = () => {
  const [data, setData] = useState<WhatIfScenariosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trainId, setTrainId] = useState("");
  const [trainType, setTrainType] = useState("MAIL_EXPRESS");
  const [blockId, setBlockId] = useState("ST_A1_AB");
  const [lineId, setLineId] = useState("UP_MAIN");
  const [sectionalSpeed, setSectionalSpeed] = useState("100");
  const [scenarioType, setScenarioType] = useState("FOG");
  const [parameter, setParameter] = useState("");
  const [direction, setDirection] = useState("UP");
  const [turnoutId, setTurnoutId] = useState("T1_ST_A1");
  const [blockFailureId, setBlockFailureId] = useState("ST_A1_AB");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWhatIfScenarios()
      .then((data) => {
        if (cancelled) return;
        setData(data);
        const live = data.trains[0];
        if (live) {
          setTrainId(live.train_id);
          setTrainType(live.train_type);
          setBlockId(live.block_id);
          setLineId(live.line_id);
          setSectionalSpeed(String(live.speed_kmph));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load scenarios");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scenario = data?.scenarios.find((s) => s.id === scenarioType) ?? null;

  const handleRun = async () => {
    if (!trainId || !trainType || !blockId || !scenarioType) {
      setError("Fill in train id, type, block and scenario");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const res = await runWhatIfSimulation({
        train_id: trainId,
        train_type: trainType,
        block_id: blockId,
        line_id: lineId,
        sectional_speed: num(sectionalSpeed),
        scenario_type: scenarioType,
        parameter: parameter === "" ? null : num(parameter),
        direction,
        turnout_id: scenarioType === "TURNOUT_FAILURE" ? turnoutId : null,
        block_failure_id: scenarioType === "BLOCK_FAILURE" ? blockFailureId : null,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  const deltaCls = (delta: number) =>
    delta > 0
      ? "text-red-400"
      : delta < 0
      ? "text-emerald-400"
      : "text-slate-400";

  return (
    <div className="h-full overflow-auto p-3 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-white">What If Simulations</h1>
        <p className="text-xs text-slate-400">
          Perturb a train run and compare the G&SR verdict + predicted delay
          against the baseline
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="font-semibold text-white text-sm mb-3">
              Scenario Builder
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <div>
                <label className={labelCls}>Train ID</label>
                <input
                  className={inputCls}
                  value={trainId}
                  onChange={(e) => setTrainId(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select
                  className={inputCls}
                  value={trainType}
                  onChange={(e) => setTrainType(e.target.value)}
                >
                  {TRAIN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Block</label>
                <input
                  className={inputCls}
                  value={blockId}
                  onChange={(e) => setBlockId(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Line</label>
                <select
                  className={inputCls}
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                >
                  {LINES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sectional Speed (km/h)</label>
                <input
                  className={inputCls}
                  type="number"
                  value={sectionalSpeed}
                  onChange={(e) => setSectionalSpeed(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Scenario</label>
                <select
                  className={inputCls}
                  value={scenarioType}
                  onChange={(e) => setScenarioType(e.target.value)}
                >
                  {data?.scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {scenarioType === "SPEED_RESTRICTION" && (
                <div>
                  <label className={labelCls}>Capped speed (km/h)</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={parameter}
                    onChange={(e) => setParameter(e.target.value)}
                    placeholder="30"
                  />
                </div>
              )}
              {scenarioType === "GRADIENT" && (
                <>
                  <div>
                    <label className={labelCls}>Gradient value</label>
                    <input
                      className={inputCls}
                      type="number"
                      value={parameter}
                      onChange={(e) => setParameter(e.target.value)}
                      placeholder="150"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Direction</label>
                    <select
                      className={inputCls}
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                    >
                      <option value="UP">UP</option>
                      <option value="DOWN">DOWN</option>
                    </select>
                  </div>
                </>
              )}
              {scenarioType === "HOLD" && (
                <div>
                  <label className={labelCls}>Hold minutes</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={parameter}
                    onChange={(e) => setParameter(e.target.value)}
                    placeholder="15"
                  />
                </div>
              )}
              {scenarioType === "TURNOUT_FAILURE" && (
                <div>
                  <label className={labelCls}>Jam turnout</label>
                  <select
                    className={inputCls}
                    value={turnoutId}
                    onChange={(e) => setTurnoutId(e.target.value)}
                  >
                    {TURNOUTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {scenarioType === "BLOCK_FAILURE" && (
                <div>
                  <label className={labelCls}>Failed block</label>
                  <select
                    className={inputCls}
                    value={blockFailureId}
                    onChange={(e) => setBlockFailureId(e.target.value)}
                  >
                    {BLOCKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {scenario && (
              <p className="text-xs text-slate-500 mt-3">{scenario.description}</p>
            )}
            <button
              onClick={handleRun}
              disabled={running}
              className="mt-3 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
            >
              {running ? "Running…" : "Run Simulation"}
            </button>
          </div>

          {(scenarioType === "TURNOUT_FAILURE" || scenarioType === "BLOCK_FAILURE") && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="font-semibold text-white text-sm mb-3">
                {scenarioType === "TURNOUT_FAILURE" ? "Turnout Map" : "Block Map"}
              </h2>
              <div className="relative h-48 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                {scenarioType === "TURNOUT_FAILURE" ? (
                  <svg viewBox="0 0 400 160" className="w-full h-full">
                    {/* UP_MAIN */}
                    <line x1="0" y1="40" x2="400" y2="40" stroke="#334155" strokeWidth="3" />
                    {/* UP_LOOP */}
                    <line x1="120" y1="10" x2="280" y2="10" stroke="#334155" strokeWidth="3" />
                    {/* DN_MAIN */}
                    <line x1="0" y1="120" x2="400" y2="120" stroke="#334155" strokeWidth="3" />
                    {/* DN_LOOP */}
                    <line x1="120" y1="150" x2="280" y2="150" stroke="#334155" strokeWidth="3" />
                    {/* Turnout lines */}
                    <line x1="120" y1="40" x2="120" y2="10" stroke="#475569" strokeWidth="2" />
                    <line x1="280" y1="10" x2="280" y2="40" stroke="#475569" strokeWidth="2" />
                    <line x1="120" y1="120" x2="120" y2="150" stroke="#475569" strokeWidth="2" />
                    <line x1="280" y1="150" x2="280" y2="120" stroke="#475569" strokeWidth="2" />
                    {/* Turnout markers */}
                    <circle cx="120" cy="40" r="6" fill={turnoutId === "T1_ST_A1" ? "#ef4444" : "#10b981"} />
                    <circle cx="280" cy="40" r="6" fill={turnoutId === "T2_ST_A1" ? "#ef4444" : "#10b981"} />
                    <circle cx="280" cy="120" r="6" fill={turnoutId === "T3_ST_A1" ? "#ef4444" : "#10b981"} />
                    <circle cx="120" cy="120" r="6" fill={turnoutId === "T4_ST_A1" ? "#ef4444" : "#10b981"} />
                    {/* Labels */}
                    <text x="200" y="5" textAnchor="middle" fill="#94a3b8" fontSize="10">UP_LOOP</text>
                    <text x="200" y="35" textAnchor="middle" fill="#94a3b8" fontSize="10">UP_MAIN</text>
                    <text x="200" y="115" textAnchor="middle" fill="#94a3b8" fontSize="10">DN_MAIN</text>
                    <text x="200" y="155" textAnchor="middle" fill="#94a3b8" fontSize="10">DN_LOOP</text>
                    <text x="120" y="70" textAnchor="middle" fill="#64748b" fontSize="8">T1</text>
                    <text x="280" y="70" textAnchor="middle" fill="#64748b" fontSize="8">T2</text>
                    <text x="280" y="100" textAnchor="middle" fill="#64748b" fontSize="8">T3</text>
                    <text x="120" y="100" textAnchor="middle" fill="#64748b" fontSize="8">T4</text>
                  </svg>
                ) : (
                  <svg viewBox="0 0 400 160" className="w-full h-full">
                    {/* Block sections */}
                    <rect x="20" y="50" width="100" height="60" rx="4" fill={blockFailureId === "ST_A1_AB" ? "#7f1d1d" : "#064e3b"} stroke={blockFailureId === "ST_A1_AB" ? "#ef4444" : "#10b981"} strokeWidth="2" />
                    <rect x="140" y="50" width="100" height="60" rx="4" fill={blockFailureId === "ST_A1_BC" ? "#7f1d1d" : "#064e3b"} stroke={blockFailureId === "ST_A1_BC" ? "#ef4444" : "#10b981"} strokeWidth="2" />
                    <rect x="260" y="50" width="100" height="60" rx="4" fill={blockFailureId === "ST_B1_BC" ? "#7f1d1d" : "#064e3b"} stroke={blockFailureId === "ST_B1_BC" ? "#ef4444" : "#10b981"} strokeWidth="2" />
                    {/* Block labels */}
                    <text x="70" y="85" textAnchor="middle" fill="#e2e8f0" fontSize="10">ST_A1_AB</text>
                    <text x="190" y="85" textAnchor="middle" fill="#e2e8f0" fontSize="10">ST_A1_BC</text>
                    <text x="310" y="85" textAnchor="middle" fill="#e2e8f0" fontSize="10">ST_B1_BC</text>
                    {/* Track lines */}
                    <line x1="20" y1="40" x2="360" y2="40" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
                    <line x1="20" y1="120" x2="360" y2="120" stroke="#475569" strokeWidth="2" strokeDasharray="4" />
                    {/* Status indicator */}
                    {blockFailureId && (
                      <g>
                        <circle cx="380" cy="80" r="8" fill="#ef4444" />
                        <text x="380" y="84" textAnchor="middle" fill="white" fontSize="10">✕</text>
                      </g>
                    )}
                  </svg>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {scenarioType === "TURNOUT_FAILURE"
                  ? `Turnout ${turnoutId} highlighted in red — trains requiring this turnout must hold`
                  : `Block ${blockFailureId} highlighted in red — trains cannot enter until cleared`}
              </p>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="font-semibold text-white text-sm mb-3">
                Comparison — {result.scenario_label}
                <span className="ml-2 text-xs text-slate-500 font-normal">
                  {result.train.train_id} · {result.train.train_type}
                </span>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Baseline
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-emerald-400">
                      ALLOWED
                    </span>
                    {result.movement.baseline.max_speed != null && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-900 text-sky-300">
                        Max {result.movement.baseline.max_speed} km/h
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Delay: {result.predicted_delay.baseline_min.toFixed(1)} min
                  </p>
                  <p className="text-xs text-slate-400 mt-1 italic">
                    {result.movement.baseline.reason}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    What If
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`text-xs font-bold ${
                        result.movement.scenario.allowed
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {result.movement.scenario.allowed ? "ALLOWED" : "HOLD"}
                    </span>
                    {result.movement.scenario.max_speed != null && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-900 text-sky-300">
                        Max {result.movement.scenario.max_speed} km/h
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Delay: {result.predicted_delay.scenario_min.toFixed(1)} min
                    {result.transit_impact_min > 0 && (
                      <span className="ml-2 text-orange-400">
                        +{result.transit_impact_min.toFixed(1)} min transit
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 italic">
                    {result.movement.scenario.reason}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-400">Result:</span>
                <span
                  className={`text-xs font-semibold ${
                    result.outcome === "HOLD"
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {result.outcome === "HOLD" ? "HOLD" : "RELEASE"}
                </span>
                {(result.predicted_delay.delta_min !== 0 ||
                  result.transit_impact_min > 0) && (
                  <span className={`text-xs font-bold ${deltaCls(result.predicted_delay.delta_min)}`}>
                    Δ delay {result.predicted_delay.delta_min >= 0 ? "+" : ""}
                    {result.predicted_delay.delta_min.toFixed(1)} min
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WhatIfPage;