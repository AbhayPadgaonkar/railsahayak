"use client";

import { useEffect, useState } from "react";
import {
  DecisionRequest,
  DecisionResult,
  getDecision,
  getSections,
  getYardSchema,
  LineInfo,
  TrainRequest,
} from "@/lib/api";
import {
  allowColor,
  buildDecisionRequest,
  buildStationModels,
  CONDITIONS,
  emptyTrain,
  LINES,
  num,
  SIGNAL_STATES,
  StationModel,
  TRAIN_TYPES,
} from "@/lib/decisionComposer";

const inputCls =
  "w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500 transition-colors";
const labelCls = "block text-xs text-slate-400 mb-1";

const DecisionPanel = () => {
  const [sections, setSections] = useState<LineInfo | null>(null);
  const [sectionId, setSectionId] = useState<string>("");
  const [transitStations, setTransitStations] = useState<StationModel[]>([]);
  const [blockNext, setBlockNext] = useState<Record<string, string[]>>({});
  const [trains, setTrains] = useState<TrainRequest[]>([]);
  const [occupiedLines, setOccupiedLines] = useState("");
  const [occupiedTurnouts, setOccupiedTurnouts] = useState("");
  const [foulingSegments, setFoulingSegments] = useState("");
  const [disasterActive, setDisasterActive] = useState(false);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load section model once (controllers + station ownership)
  useEffect(() => {
    let cancelled = false;
    getSections()
      .then((info) => {
        if (cancelled) return;
        setSections(info);
        const first = info.sections[0]?.section_id;
        if (first) setSectionId(first);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load sections");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When the controller picks their section, load that section's station blocks
  // and scope the default trains to it.
  useEffect(() => {
    if (!sections || !sectionId) return;
    const section = sections.sections.find((s) => s.section_id === sectionId);
    if (!section) return;
    let cancelled = false;

    Promise.all(
      section.stations.map((station_id) =>
        getYardSchema(station_id)
          .catch(() => null)
          .then((schema) => ({ station_id, schema }))
      )
    )
      .then((loaded) => {
        if (cancelled) return;

        const { models, blockNext } = buildStationModels(loaded);
        setTransitStations(models);
        setBlockNext(blockNext);
        setTrains(models[0]?.blocks[0]
          ? [
              emptyTrain(models[0].blocks[0]),
              emptyTrain(models[0].blocks[0]),
            ]
          : []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load station layouts");
      });

    return () => {
      cancelled = true;
    };
  }, [sections, sectionId]);

  const currentSection =
    sections?.sections.find((s) => s.section_id === sectionId) ?? null;

  const allBlocks = transitStations.flatMap((s) => s.blocks);

  const updateTrain = (index: number, patch: Partial<TrainRequest>) => {
    setTrains((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  };

  const handleBlockChange = (index: number, block: string) => {
    const nexts = blockNext[block] ?? [];
    updateTrain(index, {
      block_id: block,
      next_block_id: nexts[0] ?? null,
    });
  };

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    const payload: DecisionRequest = buildDecisionRequest({
      trains,
      occupiedLines,
      occupiedTurnouts,
      foulingSegments,
      disasterActive,
    });
    try {
      setResult(await getDecision(payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-3 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Train Management</h1>
          <p className="text-xs text-slate-400">
            {currentSection
              ? `Compose a decision request for ${currentSection.name} (${currentSection.controller_id}) against the G&SR rule engine`
              : "Compose a section decision request against the G&SR rule engine"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className={labelCls} htmlFor="dp-section">Section</label>
          <select
            id="dp-section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className={inputCls + " w-auto"}
            disabled={!sections}
          >
            {(sections?.sections ?? []).map((s) => (
              <option key={s.section_id} value={s.section_id}>
                {s.name} ({s.controller_id})
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              setTrains((prev) => [...prev, emptyTrain(allBlocks[0] ?? "")])
            }
            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-sm text-slate-300 transition-colors"
          >
            + Add Train
          </button>
          <button
            onClick={handleRun}
            disabled={loading || allBlocks.length === 0}
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
                Train #{idx + 1} — {currentSection?.name ?? "Section"}
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
                <label className={labelCls} htmlFor={`train-id-${idx}`}>Train ID</label>
                <input
                  id={`train-id-${idx}`}
                  className={inputCls}
                  value={train.train_id}
                  onChange={(e) => updateTrain(idx, { train_id: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`train-type-${idx}`}>Type</label>
                <select
                  id={`train-type-${idx}`}
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
                <label className={labelCls} htmlFor={`train-block-${idx}`}>Block</label>
                <select
                  id={`train-block-${idx}`}
                  className={inputCls}
                  value={train.block_id}
                  onChange={(e) => handleBlockChange(idx, e.target.value)}
                >
                  {transitStations.map((station) => (
                    <optgroup key={station.station_id} label={`${station.station_name} (${station.station_id})`}>
                      {station.blocks.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor={`train-line-${idx}`}>Line</label>
                <select
                  id={`train-line-${idx}`}
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
                <label className={labelCls} htmlFor={`train-next-${idx}`}>Next Block</label>
                <select
                  id={`train-next-${idx}`}
                  className={inputCls}
                  value={train.next_block_id ?? ""}
                  onChange={(e) =>
                    updateTrain(idx, { next_block_id: e.target.value || null })
                  }
                >
                  <option value="">(none)</option>
                  {(blockNext[train.block_id] ?? []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor={`train-signal-${idx}`}>Signal</label>
                <select
                  id={`train-signal-${idx}`}
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
                <label className={labelCls} htmlFor={`train-speed-${idx}`}>Sectional Speed</label>
                <input
                  id={`train-speed-${idx}`}
                  className={inputCls}
                  type="number"
                  value={train.sectional_speed}
                  onChange={(e) =>
                    updateTrain(idx, { sectional_speed: num(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`train-condition-${idx}`}>Condition</label>
                <select
                  id={`train-condition-${idx}`}
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
                <label className={labelCls} htmlFor={`train-sched-${idx}`}>Scheduled Time</label>
                <input
                  id={`train-sched-${idx}`}
                  className={inputCls}
                  type="number"
                  value={train.scheduled_time}
                  onChange={(e) =>
                    updateTrain(idx, { scheduled_time: num(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`train-current-${idx}`}>Current Time</label>
                <input
                  id={`train-current-${idx}`}
                  className={inputCls}
                  type="number"
                  value={train.current_time}
                  onChange={(e) =>
                    updateTrain(idx, { current_time: num(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`train-gradient-${idx}`}>Gradient Value</label>
                <input
                  id={`train-gradient-${idx}`}
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
                <label className={labelCls} htmlFor={`train-grad-dir-${idx}`}>Gradient Direction</label>
                <select
                  id={`train-grad-dir-${idx}`}
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
        <h2 className="font-semibold text-white text-sm mb-3">
          Section Context
          {currentSection && (
            <span className="ml-2 text-xs text-slate-400 font-normal">
              {currentSection.name} — {currentSection.controller_id}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls} htmlFor="occupied-lines">
              Occupied Lines (comma-separated, block|line)
            </label>
            <input
              id="occupied-lines"
              className={inputCls}
              value={occupiedLines}
              onChange={(e) => setOccupiedLines(e.target.value)}
              placeholder="ST_A1_AB|UP_MAIN"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="occupied-turnouts">Occupied Turnouts</label>
            <input
              id="occupied-turnouts"
              className={inputCls}
              value={occupiedTurnouts}
              onChange={(e) => setOccupiedTurnouts(e.target.value)}
              placeholder="T1_ST_A1, T2_ST_A1"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="fouling-segments">Fouling Segments</label>
            <input
              id="fouling-segments"
              className={inputCls}
              value={foulingSegments}
              onChange={(e) => setFoulingSegments(e.target.value)}
              placeholder="ST_A1_BC"
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