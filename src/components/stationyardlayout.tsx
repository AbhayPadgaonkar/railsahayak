// components/StationYardLayout.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";

type TrackStatus = "free" | "occupied" | "blocked";

interface TrainState {
  id: string;
  currentSegmentId: string;
  progress: number; // Position on the segment (0.0 to 1.0)
  speed: number; // Pixels per second
}

interface TrackSegment {
  id: string;
  d: string;
  connectedTo: string[];
  isBlock?: boolean;
}

interface Signal {
  id: string;
  connectedTo: string[]; // tracks it's linked to
  state: "red" | "green" | "yellow";
}

// Extracts x,y coordinates from an SVG path string
const getPathEndPoints = (d: string) => {
  const matchStart = d.match(/M\s*([\d.]+)\s*([\d.]+)/);
  const matchEnd = d.match(/L\s*([\d.]+)\s*([\d.]+)/g);
  if (!matchStart || !matchEnd) return null;

  const [x1, y1] = matchStart.slice(1).map(Number);
  const [x2, y2] = matchEnd[matchEnd.length - 1]
    .match(/([\d.]+)\s*([\d.]+)/)!
    .slice(1)
    .map(Number);

  return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
};

const SIGNAL_CONFIG: Signal[] = [
  {
    id: "Outer_Warner_UP",
    state: "green",
    connectedTo: ["upMain_1", "upMain_2"],
  },
  { id: "Home_UP", state: "red", connectedTo: ["upMain_2", "upMain_3"] },
  {
    id: "Loop_Starter_DN",
    state: "green",
    connectedTo: ["upTurnout_1_Diverge", "commonLoop"],
  },
  {
    id: "Loop_Starter_UP",
    state: "red",
    connectedTo: ["commonLoop", "upTurnout_2_Diverge"],
  },
  { id: "Starter_UP", state: "green", connectedTo: ["stopMainUP", "upMain_5"] },
  { id: "Adv_Starter_UP", state: "red", connectedTo: ["upMain_6", "upMain_7"] },

  {
    id: "Outer_Warner_DN",
    state: "red",
    connectedTo: ["dnMain_2", "dnMain_1"],
  },
  {
    id: "Home_DN",
    state: "green",
    connectedTo: ["dnMain_Turnout1_Straight", "dnMain_2"],
  },
  {
    id: "Loop_Starter",
    state: "red",
    connectedTo: ["dnTurnout_1_Diverge", "sideLoop"],
  },
  { id: "Starter_DN", state: "green", connectedTo: ["dnMain_4", "stopMainDN"] },
  { id: "Adv_Starter_DN", state: "red", connectedTo: ["dnMain_6", "dnMain_5"] },
];

const LAYOUT_CONFIG: TrackSegment[] = [
  // UP Main Line
  {
    id: "upMain_1",
    d: "M 0 150 L 100 150",
    connectedTo: ["upMain_2"],
    isBlock: true,
  },
  { id: "upMain_2", d: "M 100 150 L 200 150", connectedTo: ["upMain_3"] },
  {
    id: "upMain_3",
    d: "M 200 150 L 300 150",
    connectedTo: ["upMain_Turnout1_Straight"],
  },
  { id: "upMain_4", d: "M 400 150 L 500 150", connectedTo: ["stopMainUP"] },
  { id: "stopMainUP", d: "M 500 150 L 700 150", connectedTo: ["upMain5"] },
  {
    id: "upMain_5",
    d: "M 700 150 L 800 150",
    connectedTo: ["upMain_Turnout2_Straight"],
  },
  { id: "upMain_6", d: "M 900 150 L 1000 150", connectedTo: ["upMain_7"] },
  { id: "upMain_7", d: "M 1000 150 L 1100 150", connectedTo: ["upMain_8"] },
  {
    id: "upMain_8",
    d: "M 1100 150 L 1200 150",
    connectedTo: [""],
    isBlock: true,
  },
  // DN Main Line
  {
    id: "dnMain_6",
    d: "M 0 250 L 100 250",
    connectedTo: ["dnMain_5"],
    isBlock: true,
  },
  {
    id: "dnMain_5",
    d: "M 100 250 L 200 250",
    connectedTo: ["dnMain_Turnout2_Straight"],
  },
  { id: "dnMain_4", d: "M 400 250 L 500 250", connectedTo: ["stopMainDN"] },
  { id: "stopMainDN", d: "M 500 250 L 700 250", connectedTo: ["dnMain_3"] },
  {
    id: "dnMain_3",
    d: "M 700 250 L 800 250",
    connectedTo: ["dnMain_Turnout1_Straight"],
  },
  {
    id: "dnMain_2",
    d: "M 1000 250 L 1100 250",
    connectedTo: ["dnMain_Turnout1_Straight", "up_down_2_Diverge"],
  },
  {
    id: "dnMain_1",
    d: "M 1100 250 L 1200 250",
    connectedTo: ["dnMain_2"],
    isBlock: true,
  },
  // Loops
  {
    id: "commonLoop",
    d: "M 500 70 L 700 70",
    connectedTo: ["upTurnout_1_Diverge", "upTurnout_2_Diverge"],
  }, //Common loop can handle both up and down
  {
    id: "sideLoop",
    d: "M 500 330 L 700 330",
    connectedTo: ["dnTurnout_1_Diverge", "dnTurnout_2_Diverge"],
  },
  // Turnouts
  {
    id: "upMain_Turnout1_Straight",
    d: "M 300 150 L 400 150",
    connectedTo: ["up_down_1_Diverge", "upTurnout_1_Diverge", "upMain_4"],
  },
  {
    id: "upTurnout_1_Diverge",
    d: "M 400 150 L 500 70",
    connectedTo: ["commonLoop", "upMain_Turnout1_Straight"],
  },
  {
    id: "upMain_Turnout2_Straight",
    d: "M 800 150 L 900 150",
    connectedTo: ["upTurnout_2_Diverge", "up_down_2_Diverge", "upMain_6"],
  },
  {
    id: "upTurnout_2_Diverge",
    d: "M 700 70 L 800 150",
    connectedTo: ["commonLoop", "upMain_Turnout2_Straight"],
  },
  {
    id: "dnMain_Turnout2_Straight",
    d: "M 200 250 L 400 250",
    connectedTo: ["dnMain_4"],
  },
  {
    id: "dnTurnout_1_Diverge",
    d: "M 400 250 L 500 330",
    connectedTo: ["dnMain_1", "sideLoop"],
  },
  {
    id: "dnMain_Turnout1_Straight",
    d: "M 800 250 L 1000 250",
    connectedTo: ["dnMain_2", "dnMain_3"],
  },
  {
    id: "dnTurnout_2_Diverge",
    d: "M 700 330 L 800 250",
    connectedTo: ["sideLoop", "dnMain_3"],
  },

  {
    id: "up_down_1_Diverge",
    d: "M 200 250 L 300 150",
    connectedTo: ["upMain_1", "commonLoop"],
  },
  {
    id: "up_down_2_Diverge",
    d: "M 1000 250 L 900 150",
    connectedTo: ["upMain_1", "commonLoop"],
  },
];

const getTrackElementById = (id: string) =>
  LAYOUT_CONFIG.find((el) => el.id === id);

const StationYardLayout = () => {
  const [trains, setTrains] = useState<TrainState[]>([]);
  const [trackStatus, setTrackStatus] = useState<Record<string, TrackStatus>>(
    {}
  );
  const lastUpdateTimeRef = useRef<number>(0);

  // Initialize simulation
  // useEffect(() => {
  //   setTrains([
  //     { id: "T12926", currentSegmentId: "upMain_1", progress: 0, speed: 30 },
  //     { id: "T90302", currentSegmentId: "dnMain_3", progress: 0, speed: 30 },
  //   ]);
  //   lastUpdateTimeRef.current = performance.now();
  // }, []);

  // Derive track status from train positions
  useEffect(() => {
    const newStatus: Record<string, TrackStatus> = {};
    LAYOUT_CONFIG.forEach((el) => {
      newStatus[el.id] = "free";
    });
    trains.forEach((train) => {
      newStatus[train.currentSegmentId] = "occupied";
    });
    setTrackStatus(newStatus);
  }, [trains]);

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
            const currentSegmentConfig = getTrackElementById(
              train.currentSegmentId
            );
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
  }, []);

  const colorMap: Record<TrackStatus, string> = {
    free: "#22c55e",
    occupied: "#ef4444",
    blocked: "#D3D3D3",
  };

  return (
    <div className=" pt-1   border bg-gray-950  border-gray-700 w-full h-12/12 mx-auto">
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

      <svg viewBox="0 0 1200 408" className="w-full h-full rounded-md">
        {SIGNAL_CONFIG.map((signal) => {
          const [t1, t2] = signal.connectedTo.map((id) =>
            LAYOUT_CONFIG.find((t) => t.id === id)
          );
          if (!t1 || !t2) return null;

          const p1 = getPathEndPoints(t1.d);
          const p2 = getPathEndPoints(t2.d);
          if (!p1 || !p2) return null;

          // Find the join (end of first track)
          const joinX = p1.end.x;
          const joinY = p1.end.y;

          const poleHeight = 40; // total signal height
          const bodyHeight = 28; // box size

          return (
            <g
              key={signal.id}
              transform={`translate(${joinX}, ${joinY - poleHeight})`}
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
                {signal.id}
              </text>
            </g>
          );
        })}

        <g>
          {/* Layer 1: Base Tracks (with unique IDs for animation) */}
          {LAYOUT_CONFIG.map((segment) => (
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
          <text
            x="10"
            y="140"
            className="text-xs font-sans font-semibold fill-gray-100"
          >
            UP MAIN
          </text>
          <text
            x="10"
            y="270"
            className="text-xs font-sans font-semibold fill-gray-100"
          >
            DN MAIN
          </text>
        </g>
      </svg>
    </div>
  );
};

export default StationYardLayout;
