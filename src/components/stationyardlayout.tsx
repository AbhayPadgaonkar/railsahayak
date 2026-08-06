// components/StationYardLayout.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { YardSchema } from "@/lib/yardlayout/schema";
import { buildYardLayout } from "@/lib/yardlayout/builder";
import { getYardSchema } from "@/lib/api";
import demoYard from "@/config/yards/demo_yard.json";

type TrackStatus = "free" | "occupied" | "blocked";

interface TrainState {
  id: string;
  currentSegmentId: string;
  progress: number; // Position on the segment (0.0 to 1.0)
  speed: number; // Pixels per second
}

interface StationYardLayoutProps {
  schema?: YardSchema;
  stationId?: string;
}

const StationYardLayout = ({ schema, stationId = "demo_yard" }: StationYardLayoutProps) => {
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

  const [trains, setTrains] = useState<TrainState[]>([]);
  const [signals, setSignals] = useState(yard.signals);
  const [trackStatus, setTrackStatus] = useState<Record<string, TrackStatus>>(
    {}
  );
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    setSignals(yard.signals);
  }, [yard]);

  // Initialize simulation
  // useEffect(() => {
  //   setTrains([
  //     { id: "T12926", currentSegmentId: "UP_MAIN__0", progress: 0, speed: 30 },
  //     { id: "T90302", currentSegmentId: "DN_MAIN__0", progress: 0, speed: 30 },
  //   ]);
  //   lastUpdateTimeRef.current = performance.now();
  // }, []);

  // Derive track status from train positions
  useEffect(() => {
    const newStatus: Record<string, TrackStatus> = {};
    yard.segments.forEach((el) => {
      newStatus[el.id] = "free";
    });
    trains.forEach((train) => {
      newStatus[train.currentSegmentId] = "occupied";
    });
    setTrackStatus(newStatus);
  }, [trains, yard]);

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      const deltaTime = (timestamp - lastUpdateTimeRef.current) / 1000; // time in seconds
      lastUpdateTimeRef.current = timestamp;

      setTrains((currentTrains) => {
        const occupiedSegments = new Set(
          currentTrains.map((t) => t.currentSegmentId)
        );

        return currentTrains.map((train) => {
          const segmentElement = document.getElementById(
            train.currentSegmentId
          ) as SVGPathElement | null;
          if (!segmentElement) return train;

          const segmentLength = segmentElement.getTotalLength();
          const distanceToTravel = train.speed * deltaTime;
          const newProgress = train.progress + distanceToTravel / segmentLength;

          // If train finishes segment, find the next one
          if (newProgress >= 1) {
            const currentSegmentConfig = segmentById.get(train.currentSegmentId);
            if (!currentSegmentConfig) return train;

            const availableNextSegments =
              currentSegmentConfig.connectedTo.filter(
                (id) => !occupiedSegments.has(id)
              );

            if (availableNextSegments.length > 0) {
              const nextSegmentId =
                availableNextSegments[
                  Math.floor(Math.random() * availableNextSegments.length)
                ];
              return { ...train, currentSegmentId: nextSegmentId, progress: 0 };
            } else {
              // No path available, stop at the end of the segment
              return { ...train, progress: 1 };
            }
          }

          return { ...train, progress: newProgress };
        });
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [segmentById]);

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

            {/* Layer 2: Render the animated trains
            {trains.map((train) => (
              <Train
                key={train.id}
                trainId={train.id}
                segmentId={train.currentSegmentId}
                progress={train.progress}
              />
            ))} */}

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
