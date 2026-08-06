// components/StationYardLayout.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { SignalAspect, YardSchema } from "@/lib/yardlayout/schema";
import { buildYardLayout, BuiltSegment } from "@/lib/yardlayout/builder";
import { getYardSchema } from "@/lib/api";
import demoYard from "@/config/yards/demo_yard.json";

type TrackStatus = "free" | "occupied" | "blocked";

interface TrainState {
  id: string;
  segmentId: string;
  t: number; // position along the SVG path (0..1), in path coordinates
  dir: 1 | -1; // traversal direction along the path
  speed: number; // pixels per second
}

interface StationYardLayoutProps {
  schema?: YardSchema;
  stationId?: string;
  signalOverrides?: Record<string, SignalAspect>;
  statusOverrides?: Record<string, TrackStatus>;
}

const parseEndpoints = (d: string) => {
  const nums = d.match(/-?[\d.]+/g)!.map(Number);
  return { sx: nums[0], sy: nums[1], ex: nums[2], ey: nums[3] };
};

const TrainMarker = ({ train }: { train: TrainState }) => {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    const pathEl = document.getElementById(
      train.segmentId
    ) as SVGPathElement | null;
    if (!pathEl || !ref.current) return;
    const pt = pathEl.getPointAtLength(train.t * pathEl.getTotalLength());
    ref.current.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
  }, [train]);

  return (
    <g ref={ref}>
      <circle r={4} fill="#f8fafc" stroke="#0f172a" strokeWidth={1.5} />
      <rect x={-22} y={-24} width={44} height={13} rx={3} fill="#1e3a8a" stroke="#3b82f6" strokeWidth={0.75} />
      <text
        x={0}
        y={-14}
        textAnchor="middle"
        fontSize="8.5"
        fill="#e2e8f0"
        fontFamily="sans-serif"
      >
        {train.id}
      </text>
    </g>
  );
};

const StationYardLayout = ({
  schema,
  stationId = "demo_yard",
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

  const segmentById = useMemo(
    () => new Map(yard.segments.map((s) => [s.id, s])),
    [yard]
  );

  const signals = useMemo(
    () =>
      yard.signals.map((s) => ({
        ...s,
        state: signalOverrides?.[s.id] ?? s.state,
      })),
    [yard, signalOverrides]
  );

  const [trains, setTrains] = useState<TrainState[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);

  // Spawn demo trains at the entry slices of the first UP and DN lines
  useEffect(() => {
    const lineSlices = (lineId: string) =>
      yard.segments.filter((s) => s.lineId === lineId);

    const upLine = yard.segments.find((s) => s.direction === "UP")?.lineId;
    const dnLine = yard.segments.find((s) => s.direction === "DN")?.lineId;

    const init: TrainState[] = [];
    if (upLine) {
      const entry = lineSlices(upLine)[0];
      if (entry)
        init.push({ id: "T12926", segmentId: entry.id, t: 0, dir: 1, speed: 45 });
    }
    if (dnLine) {
      const slices = lineSlices(dnLine);
      const entry = slices[slices.length - 1];
      if (entry)
        init.push({ id: "T90302", segmentId: entry.id, t: 1, dir: -1, speed: 35 });
    }
    setTrains(init);
    lastUpdateTimeRef.current = performance.now();
  }, [yard]);

  // Track status: derived from train positions, then live overrides applied
  const trackStatus = useMemo(() => {
    const status: Record<string, TrackStatus> = {};
    yard.segments.forEach((el) => {
      status[el.id] = "free";
    });
    trains.forEach((train) => {
      status[train.segmentId] = "occupied";
    });
    return { ...status, ...statusOverrides };
  }, [trains, yard, statusOverrides]);

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      const deltaTime = (timestamp - lastUpdateTimeRef.current) / 1000; // time in seconds
      lastUpdateTimeRef.current = timestamp;

      setTrains((currentTrains) => {
        const occupiedBy = new Map(
          currentTrains.map((t) => [t.segmentId, t.id] as const)
        );

        return currentTrains.map((train) => {
          const segment = segmentById.get(train.segmentId);
          const pathEl = document.getElementById(
            train.segmentId
          ) as SVGPathElement | null;
          if (!segment || !pathEl) return train;

          const length = pathEl.getTotalLength();
          const t = train.t + (train.dir * train.speed * deltaTime) / length;

          if (t <= 1 && t >= 0) {
            return { ...train, t };
          }

          // Reached an endpoint of the current segment
          const clamped = train.dir === 1 ? 1 : 0;
          const ep = parseEndpoints(segment.d);
          const exitX = train.dir === 1 ? ep.ex : ep.sx;
          const exitY = train.dir === 1 ? ep.ey : ep.sy;

          // Hold at a red signal guarding this exit (line segments only)
          const guardingRed = signals.find(
            (s) => s.lineId === segment.lineId && s.x === exitX && s.state === "red"
          );
          if (guardingRed) {
            return { ...train, t: clamped };
          }

          // Pick a connected, unoccupied segment sharing this endpoint
          type Candidate = { segment: BuiltSegment; t: number; dir: 1 | -1 };
          const candidates: Candidate[] = segment.connectedTo
            .map((id) => segmentById.get(id))
            .filter((ns): ns is BuiltSegment => {
              if (!ns) return false;
              const owner = occupiedBy.get(ns.id);
              return !owner || owner === train.id;
            })
            .flatMap((ns): Candidate[] => {
              const nep = parseEndpoints(ns.d);
              if (nep.sx === exitX && nep.sy === exitY)
                return [{ segment: ns, t: 0, dir: 1 }];
              if (nep.ex === exitX && nep.ey === exitY)
                return [{ segment: ns, t: 1, dir: -1 }];
              return [];
            });

          if (candidates.length === 0) {
            return { ...train, t: clamped };
          }

          const pick =
            candidates[Math.floor(Math.random() * candidates.length)];
          return {
            ...train,
            segmentId: pick.segment.id,
            t: pick.t,
            dir: pick.dir,
          };
        });
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [segmentById, signals]);

  const colorMap: Record<TrackStatus, string> = {
    free: "#22c55e",
    occupied: "#ef4444",
    blocked: "#D3D3D3",
  };

  return (
    <div className="pt-1 border bg-gray-950 border-gray-700 w-full h-full min-h-[360px] lg:min-h-[420px] mx-auto flex flex-col">
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
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <svg viewBox={yard.viewBox} className="min-w-[720px] w-full h-full rounded-md">
          {signals.map((signal) => {
          const poleHeight = 40; // total signal height
          const bodyHeight = 28; // box size

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
                cy={poleHeight - bodyHeight - 10}
                r={3.5}
                fill={signal.state === "red" ? "red" : "#330000"}
              />
              {/* Yellow */}
              <circle
                cx={0}
                cy={poleHeight - bodyHeight - 1}
                r={3.5}
                fill={signal.state === "yellow" ? "yellow" : "#332200"}
              />
              {/* Green */}
              <circle
                cx={0}
                cy={poleHeight - bodyHeight + 8}
                r={3.5}
                fill={signal.state === "green" ? "limegreen" : "#002200"}
              />

              {/* Label */}
              <text
                x={0}
                y={poleHeight - 50}
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

            {/* Layer 2: Animated trains */}
            {trains.map((train) => (
              <TrainMarker key={train.id} train={train} />
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
