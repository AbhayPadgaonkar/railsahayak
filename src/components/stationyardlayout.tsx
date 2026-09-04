// components/StationYardLayout.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { SignalAspect, YardSchema } from "@/lib/yardlayout/schema";
import { buildYardLayout } from "@/lib/yardlayout/builder";
import { getYardSchema, SensorSnapshot, DecisionTrain } from "@/lib/api";
import demoYard from "@/config/yards/demo_yard.json";

type TrackStatus = "free" | "occupied" | "blocked";

interface StationYardLayoutProps {
  schema?: YardSchema;
  stationId?: string;
  sensorState?: SensorSnapshot;
  signalOverrides?: Record<string, SignalAspect>;
  statusOverrides?: Record<string, TrackStatus>;
}

const StationYardLayout = ({
  schema,
  stationId = "st_a1",
  sensorState,
  signalOverrides,
  statusOverrides,
}: StationYardLayoutProps) => {
  const [fetchedSchema, setFetchedSchema] = useState<YardSchema | null>(null);

  useEffect(() => {
    if (schema) return;
    let cancelled = false;
    getYardSchema(stationId)
      .then((data) => {
        if (!cancelled) setFetchedSchema(data);
      })
      .catch(() => {
        // Backend unreachable or station unknown — fall back to bundled demo layout
      });
    return () => {
      cancelled = true;
    };
  }, [schema, stationId]);

  const yard = useMemo(
    () => buildYardLayout(schema ?? fetchedSchema ?? (demoYard as YardSchema)),
    [schema, fetchedSchema]
  );

  const signals = useMemo(
    () =>
      yard.signals.map((s) => ({
        ...s,
        state: signalOverrides?.[s.id] ?? sensorState?.signals[s.id] ?? s.state,
      })),
    [yard, signalOverrides, sensorState]
  );

  // Sensor zones reported occupied by the backend → mark their slices occupied
  const sensorStatusOverrides = useMemo(() => {
    if (!sensorState) return undefined;
    const overrides: Record<string, TrackStatus> = {};
    for (const zone of yard.zones) {
      if (sensorState.zones[zone.id]) {
        zone.segmentIds.forEach((id) => {
          overrides[id] = "occupied";
        });
      }
    }
    return overrides;
  }, [sensorState, yard]);

  // Decision-engine trains (from POST /decision store) → yard positions.
  // Position resolved from the yard's declared blocks: train.block_id → block,
  // block span on train.line_id → midpoint x; y from the yard line.
  const decisionMarkers = useMemo(() => {
    if (!sensorState?.trains?.length) return [];
    const lineById = new Map(yard.lines.map((l) => [l.id, l]));
    return sensorState.trains.map((t): DecisionTrain & { x: number; y: number } => {
      const block = yard.blocks.find((b) => b.id === t.block_id);
      const span =
        block?.spans.find((s) => s.lineId === t.line_id) ??
        block?.spans[0];
      if (span) {
        const line = lineById.get(span.lineId);
        return { ...t, x: (span.from_x + span.to_x) / 2, y: line?.y ?? 150 };
      }
      return { ...t, x: 600, y: 150 };
    });
  }, [sensorState?.trains, yard]);

  // Track status: derived from sensor zones + manual overrides
  const trackStatus = useMemo(() => {
    const status: Record<string, TrackStatus> = {};
    yard.segments.forEach((el) => {
      status[el.id] = "free";
    });
    return { ...status, ...sensorStatusOverrides, ...statusOverrides };
  }, [yard, sensorStatusOverrides, statusOverrides]);

  const colorMap: Record<TrackStatus, string> = {
    free: "#22c55e",
    occupied: "#ef4444",
    blocked: "#D3D3D3",
  };

  return (
    <div className="pt-1 border bg-gray-950 border-gray-700 w-full h-full min-h-[300px] lg:min-h-[360px] mx-auto flex flex-col">
      <div className="flex justify-start pl-2.5 items-start gap-8 mb-1">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colorMap.free }}
          />
          <span className=" text-gray-300">Track Free</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colorMap.occupied }}
          />
          <span className=" text-gray-300">Track Occupied</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: "#10b981" }}
          />
          <span className=" text-gray-300">Decision GO</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: "#ef4444" }}
          />
          <span className=" text-gray-300">Decision HOLD</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <svg viewBox={yard.viewBox} className="min-w-[720px] w-full h-full rounded-md">
          {signals.map((signal) => {
          const poleHeight = 52; // total signal height
          const bodyHeight = 36; // box size
          const state =
            (signal.state as string) === "yellow"
              ? "single_yellow"
              : signal.state;

          return (
            <g
              key={signal.id}
              transform={`translate(${signal.x}, ${signal.y - poleHeight})`}
            >
              {/* Rod — bottom touches track */}
              <line
                x1={0}
                y1={poleHeight - bodyHeight}
                x2={0}
                y2={poleHeight}
                stroke="#555"
                strokeWidth="2"
              />

              {/* Signal box (above rod) */}
              <rect
                x={-6}
                y={poleHeight - bodyHeight - 15}
                width={12}
                height={bodyHeight}
                rx={3}
                fill="#4d4d4d"
                stroke="#555"
                strokeWidth="0.5"
              />

              {/* Red */}
              <circle
                cx={0}
                cy={poleHeight - bodyHeight - 6}
                r={3.5}
                fill={state === "red" ? "red" : "#330000"}
              />
              {/* Single yellow */}
              <circle
                cx={0}
                cy={poleHeight - bodyHeight + 4}
                r={3.5}
                fill={state === "single_yellow" ? "#facc15" : "#332200"}
              />
              {/* Double yellow */}
              <circle
                cx={0}
                cy={state === "double_yellow" ? poleHeight - bodyHeight + 14 : poleHeight - bodyHeight + 14}
                r={3.5}
                fill={state === "double_yellow" ? "#facc15" : "#332200"}
              />
              {/* Green */}
              <circle
                cx={0}
                cy={poleHeight - bodyHeight + 24}
                r={3.5}
                fill={state === "green" ? "limegreen" : "#002200"}
              />

              {/* Label */}
              <text
                x={0}
                y={poleHeight - 58}
                textAnchor="middle"
                fontSize="9"
                fill="#aaa"
                fontFamily="sans-serif"
              >
                {signal.name}
              </text>
            </g>
          );
        })}

          <g>
            {/* Layer 1: Base Tracks (with unique IDs for animation) */}
            {yard.segments.map((segment) => (
              <path
                id={segment.id} // IMPORTANT: ID is needed for getElementById
                key={segment.id}
                d={segment.d}
                stroke={
                  trackStatus[segment.id] === "free"
                    ? "#22c55e"
                    : colorMap[trackStatus[segment.id]]
                }
                strokeWidth={6}
                strokeDasharray={segment.isBlock ? "8 4" : "none"}
                fill="none"
                style={{ transition: "stroke 0.5s ease" }}
              />
            ))}

            {/* Layer 2: Decision-engine trains */}
            {decisionMarkers.map((d) => (
              <g
                key={`dec-${d.train_id}`}
                transform={`translate(${d.x}, ${d.y})`}
              >
                <circle
                  r={6}
                  fill={d.allow_movement ? "#10b981" : "#ef4444"}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                />
                <rect x={-26} y={-23} width={52} height={13} rx={3} fill="#0f172a" stroke="#475569" strokeWidth={0.75} />
                <text
                  x={0}
                  y={-13}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#e2e8f0"
                  fontFamily="sans-serif"
                >
                  {d.train_id}
                  {d.max_speed != null ? ` ${d.max_speed}` : ""}
                </text>
              </g>
            ))}

            {/* Labels */}
            {yard.labels.map((label) => (
              <text
                key={`${label.text}-${label.x}-${label.y}`}
                x={label.x}
                y={label.y}
                className="text-xs font-sans font-semibold fill-gray-100"
              >
                {label.text}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default StationYardLayout;
