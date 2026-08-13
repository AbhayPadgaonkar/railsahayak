"use client";

import { useState } from "react";
import {
  DecisionRequest,
  DecisionResult,
  getDecision,
  TrainRequest,
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

const SIGNAL_STATES = ["GREEN", "YELLOW", "RED", "DEFECTIVE"];

const CONDITIONS = ["", "FOG", "STORM"];

const BLOCKS: Record<string, string[]> = {
  A_B: ["B_C"],
  B_C: ["C_D"],
  C_D: [],
};

const LINES = ["UP_MAIN", "UP_LOOP", "DN_MAIN"];

const DEFAULT_TRAINS: TrainRequest[] = [
  {
    train_id: "RAJ1",
    train_type: "RAJDHANI",
    block_id: "A_B",
    line_id: "UP_MAIN",
    next_block_id: "B_C",
    signal_state: "GREEN",
    sectional_speed: 110,
    scheduled_time: 1000,
    current_time: 1015,
    gradient: null,
    condition: null,
    has_written_authority: false,
  },
  {
    train_id: "G3",
    train_type: "GOODS",
    block_id: "A_B",
    line_id: "UP_MAIN",
    next_block_id: "B_C",
    signal_state: "GREEN",
    sectional_speed: 75,
    scheduled_time: 1000,
    current_time: 1030,
    gradient: null,
    condition: null,
    has_written_authority: false,
  },
];

const emptyTrain = (): TrainRequest => ({
  train_id: "",
  train_type: "PASSENGER",
  block_id: "A_B",
  line_id: "UP_MAIN",
  next_block_id: "B_C",
  signal_state: "GREEN",
  sectional_speed: 100,
  scheduled_time: 1000,
  current_time: 1000,
  gradient: null,
  condition: null,
  has_written_authority: false,
});

const inputCls =
  "w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500 transition-colors";
const labelCls = "block text-xs text-slate-400 mb-1";

const num = (v: string) => (v === "" ? 0 : Number(v));

const DecisionPanel = () => {
  const [trains, setTrains] = useState<TrainRequest[]>(DEFAULT_TRAINS);
  const [occupiedLines, setOccupiedLines] = useState("");
  const [occupiedTurnouts, setOccupiedTurnouts] = useState("");
  const [foulingSegments, setFoulingSegments] = useState("");
  const [disasterActive, setDisasterActive] = useState(false);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTrain = (index: number, patch: Partial<TrainRequest>) => {
    setTrains((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  };

  const handleBlockChange = (index: number, block: string) => {
    const nexts = BLOCKS[block] ?? [];
    updateTrain(index, {
      block_id: block,
      next_block_id: nexts[0] ?? null,
    });
  };

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    const payload: DecisionRequest = {
      trains,
      context: {
        occupied_lines: occupiedLines
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        occupied_turnouts: occupiedTurnouts
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        fouling_segments: foulingSegments
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        disaster_active: disasterActive,
      },
    };
    try {
      setResult(await getDecision(payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision request failed");
    } finally {
      setLoading(false);
    }
  };

  const allowColor = (allow: boolean) =>
    allow ? "text-emerald-400" : "text-red-400";

  return (
    <div className="flex flex-col gap-4 p-3 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Train Management</h1>
          <p className="text-xs text-slate-400">
            Compose a section decision request against the G&SR rule engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTrains((prev) => [...prev, emptyTrain()])}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-sm text-slate-300 transition-colors"
          >
            + Add Train
          </button>
          <button
            onClick={handleRun}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
          >
            {loading ? "Running..." : "Run Decision"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Train cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {trains.map((train, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">
                Train #{idx + 1}
              </h2>
              {trains.length > 1 && (
                <button
                  onClick={() =>
                    setTrains((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Train ID</label>
                <input
                  className={inputCls}
                  value={train.train_id}
                  onChange={(e) => updateTrain(idx, { train_id: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select
                  className={inputCls}
                  value={train.train_type}
                  onChange={(e) =>
                    updateTrain(idx, { train_type: e.target.value })
                  }
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
                <select
                  className={inputCls}
                  value={train.block_id}
                  onChange={(e) => handleBlockChange(idx, e.target.value)}
                >
                  {Object.keys(BLOCKS).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Line</label>
                <select
                  className={inputCls}
                  value={train.line_id}
                  onChange={(e) => updateTrain(idx, { line_id: e.target.value })}
                >
                  {LINES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Next Block</label>
                <select
                  className={inputCls}
                  value={train.next_block_id ?? ""}
                  onChange={(e) =>
                    updateTrain(idx, { next_block_id: e.target.value || null })
                  }
                >
                  <option value="">(none)</option>
                  {(BLOCKS[train.block_id] ?? []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Signal</label>
                <select
                  className={inputCls}
                  value={train.signal_state}
                  onChange={(e) =>
                    updateTrain(idx, { signal_state: e.target.value })
                  }
                >
                  {SIGNAL_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sectional Speed</label>
                <input
                  className={inputCls}
                  type="number"
                  value={train.sectional_speed}
                  onChange={(e) =>
                    updateTrain(idx, { sectional_speed: num(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Condition</label>
                <select
                  className={inputCls}
                  value={train.condition ?? ""}
                  onChange={(e) =>
                    updateTrain(idx, { condition: e.target.value || null })
                  }
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c === "" ? "(clear)" : c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Scheduled Time</label>
                <input
                  className={inputCls}
                  type="number"
                  value={train.scheduled_time}
                  onChange={(e) =>
                    updateTrain(idx, { scheduled_time: num(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Current Time</label>
                <input
                  className={inputCls}
                  type="number"
                  value={train.current_time}
                  onChange={(e) =>
                    updateTrain(idx, { current_time: num(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Gradient Value</label>
                <input
                  className={inputCls}
                  type="number"
                  placeholder="none"
                  value={train.gradient?.value ?? ""}
                  onChange={(e) =>
                    updateTrain(idx, {
                      gradient: e.target.value === ""
                        ? null
                        : { value: num(e.target.value), direction: train.gradient?.direction ?? "UP" },
                    })
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Gradient Direction</label>
                <select
                  className={inputCls}
                  value={train.gradient?.direction ?? "UP"}
                  onChange={(e) =>
                    updateTrain(idx, {
                      gradient: {
                        value: train.gradient?.value ?? 0,
                        direction: e.target.value as "UP" | "DOWN",
                      },
                    })
                  }
                >
                  <option value="UP">UP</option>
                  <option value="DOWN">DOWN</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-800">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={train.has_written_authority}
                  onChange={(e) =>
                    updateTrain(idx, {
                      has_written_authority: e.target.checked,
                    })
                  }
                  className="accent-sky-500"
                />
                Written authority
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Context */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="font-semibold text-white text-sm mb-3">Section Context</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>
              Occupied Lines (comma-separated, block|line)
            </label>
            <input
              className={inputCls}
              value={occupiedLines}
              onChange={(e) => setOccupiedLines(e.target.value)}
              placeholder="B_C|UP_MAIN"
            />
          </div>
          <div>
            <label className={labelCls}>Occupied Turnouts</label>
            <input
              className={inputCls}
              value={occupiedTurnouts}
              onChange={(e) => setOccupiedTurnouts(e.target.value)}
              placeholder="T1, T2"
            />
          </div>
          <div>
            <label className={labelCls}>Fouling Segments</label>
            <input
              className={inputCls}
              value={foulingSegments}
              onChange={(e) => setFoulingSegments(e.target.value)}
              placeholder="A_B"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 mt-3">
          <input
            type="checkbox"
            checked={disasterActive}
            onChange={(e) => setDisasterActive(e.target.checked)}
            className="accent-red-500"
          />
          Disaster / emergency mode active (holds all trains)
        </label>
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold text-white text-sm mb-3">Decision Output</h2>
          <div className="space-y-2">
            {result.decisions.map((d) => (
              <div
                key={d.train_id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">
                      {d.train_id}
                    </span>
                    <span
                      className={`font-bold text-sm ${allowColor(d.allow_movement)}`}
                    >
                      {d.allow_movement ? "ALLOWED" : "HOLD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.allowed_actions.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300"
                      >
                        {a}
                      </span>
                    ))}
                    {d.max_speed != null && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-900 text-sky-300">
                        Max {d.max_speed} km/h
                      </span>
                    )}
                  </div>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {d.reasons.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs text-slate-500 flex gap-1.5"
                    >
                      <span className="text-slate-700">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {result.optimized_order && result.optimized_order.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Optimized Precedence Order
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {[...result.optimized_order]
                  .sort((a, b) => a.order - b.order)
                  .map((o, i) => (
                    <div key={o.train_id} className="flex flex-col items-start gap-0.5">
                      <span className="text-[11px] px-2.5 py-1 rounded-md bg-sky-900 text-sky-200 font-semibold">
                        {o.train_id}
                      </span>
                      {o.reason && (
                        <span className="text-[10px] text-slate-500">
                          {o.reason}
                        </span>
                      )}
                      {i < result.optimized_order!.length - 1 && (
                        <span className="text-slate-600">→</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionPanel;
