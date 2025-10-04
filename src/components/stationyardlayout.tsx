// components/StationYardLayout.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Train from './train'; // Import the new Train component


type TrackStatus = 'free' | 'occupied';

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
  isLoop?: boolean;
}

const LAYOUT_CONFIG: TrackSegment[] = [
  // UP Main Line
  { id: 'upMain_1', d: 'M 0 150 L 100 150', connectedTo: ['upMain_2'] },
  { id: 'upMain_2', d: 'M 100 150 L 200 150', connectedTo: ['upMain_3'] },
  { id: 'upMain_3', d: 'M 200 150 L 300 150', connectedTo: ['upMain_Turnout1_Straight'] },
  { id: 'upMain_4', d: 'M 400 150 L 800 150', connectedTo: ['upMain_Turnout1_Straight','upMain_Turnout2_Straight'] },
  { id: 'upMain_5', d: 'M 900 150 L 1000 150', connectedTo: ['upMain_6'] },
  { id: 'upMain_6', d: 'M 1000 150 L 1100 150', connectedTo: ['upMain_7'] },
  { id: 'upMain_7', d: 'M 1100 150 L 1200 150', connectedTo: [''] },
  // DN Main Line
  { id: 'dnMain_5', d: 'M 0 250 L 100 250', connectedTo: [''] },
  { id: 'dnMain_4', d: 'M 100 250 L 200 250', connectedTo: ['dnMain_5'] },
  { id: 'dnMain_3', d: 'M 400 250 L 800 250', connectedTo: ['dnMain_Turnout2_Straight'] },
  { id: 'dnMain_2', d: 'M 1000 250 L 1100 250', connectedTo: ['dnMain_Turnout1_Straight','up_down_2_Diverge'] },
  { id: 'dnMain_1', d: 'M 1100 250 L 1200 250', connectedTo: ['dnMain_2'] },
  // Loops
  { id: 'commonLoop', d: 'M 500 70 L 700 70', connectedTo: ['upTurnout_1_Diverge', 'upTurnout_2_Diverge'], isLoop: true },
  { id: 'sideLoop', d: 'M 500 330 L 700 330', connectedTo: ['dnTurnout_1_Diverge', 'dnTurnout_2_Diverge'], isLoop: true },
  // Turnouts
  { id: 'upMain_Turnout1_Straight', d: 'M 300 150 L 400 150', connectedTo: ['up_down_1_Diverge', 'upTurnout_1_Diverge','upMain_4'] },
  { id: 'upTurnout_1_Diverge', d: 'M 400 150 L 500 70', connectedTo: ['commonLoop'] },
  { id: 'upMain_Turnout2_Straight', d: 'M 800 150 L 900 150', connectedTo: ['upTurnout_2_Diverge','up_down_2_Diverge','upMain_5'] },
  { id: 'upTurnout_2_Diverge', d: 'M 700 70 L 800 150', connectedTo: ['commonLoop', 'upMain_Turnout2_Straight'] },
  { id: 'dnMain_Turnout2_Straight', d: 'M 200 250 L 400 250', connectedTo: ['dnMain_4'] },
  { id: 'dnTurnout_1_Diverge', d: 'M 400 250 L 500 330', connectedTo: ['dnMain_1', 'sideLoop'] },
  { id: 'dnMain_Turnout1_Straight', d: 'M 800 250 L 1000 250', connectedTo: ['dnMain_2', 'dnMain_3'] },
  { id: 'dnTurnout_2_Diverge', d: 'M 700 330 L 800 250', connectedTo: ['sideLoop', 'dnMain_3'] },

  { id: 'up_down_1_Diverge', d: 'M 200 250 L 300 150', connectedTo: ['upMain_1', 'commonLoop'] },
  { id: 'up_down_2_Diverge', d: 'M 1000 250 L 900 150', connectedTo: ['upMain_1', 'commonLoop'] },
];

const getTrackElementById = (id: string) => LAYOUT_CONFIG.find(el => el.id === id);

const StationYardLayout = () => {
  const [trains, setTrains] = useState<TrainState[]>([]);
  const [trackStatus, setTrackStatus] = useState<Record<string, TrackStatus>>({});
  const lastUpdateTimeRef = useRef<number>(0);

  // Initialize simulation
  useEffect(() => {
    setTrains([
      { id: 'T12926', currentSegmentId: 'upMain_1', progress: 0, speed: 50 },
      { id: 'T90302', currentSegmentId: 'dnMain_3', progress: 0, speed: 50 },
    ]);
    lastUpdateTimeRef.current = performance.now();
  }, []);
  
  // Derive track status from train positions
  useEffect(() => {
    const newStatus: Record<string, TrackStatus> = {};
    LAYOUT_CONFIG.forEach(el => { newStatus[el.id] = 'free'; });
    trains.forEach(train => {
      newStatus[train.currentSegmentId] = 'occupied';
    });
    setTrackStatus(newStatus);
  }, [trains]);


  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      const deltaTime = (timestamp - lastUpdateTimeRef.current) / 1000; // time in seconds
      lastUpdateTimeRef.current = timestamp;

      setTrains(currentTrains => {
        const occupiedSegments = new Set(currentTrains.map(t => t.currentSegmentId));

        return currentTrains.map(train => {
          const segmentElement = document.getElementById(train.currentSegmentId) as SVGPathElement | null;
          if (!segmentElement) return train;

          const segmentLength = segmentElement.getTotalLength();
          const distanceToTravel = train.speed * deltaTime;
          const newProgress = train.progress + distanceToTravel / segmentLength;

          // If train finishes segment, find the next one
          if (newProgress >= 1) {
            const currentSegmentConfig = getTrackElementById(train.currentSegmentId);
            if (!currentSegmentConfig) return train;

            const availableNextSegments = currentSegmentConfig.connectedTo.filter(id => !occupiedSegments.has(id));

            if (availableNextSegments.length > 0) {
              const nextSegmentId = availableNextSegments[Math.floor(Math.random() * availableNextSegments.length)];
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
    free: '#22c55e',
    occupied: '#ef4444',
  };

  return (
    <div className=" pt-1 rounded-xl  border bg-black  border-gray-900 w-full mx-auto">
      
      
      <div className="flex justify-center items-center gap-8 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap.free }} />
          <span className=" text-gray-300">Track Free</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap.occupied }} />
          <span className=" text-gray-300">Track Occupied</span>
        </div>
      </div>
      
      <svg viewBox="0 0 1200 379" className="w-full h-full bg-black rounded-md">
        <g>
          {/* Layer 1: Base Tracks (with unique IDs for animation) */}
          {LAYOUT_CONFIG.map(segment => (
            <path
              id={segment.id} // IMPORTANT: ID is needed for getElementById
              key={segment.id}
              d={segment.d}
              stroke={trackStatus[segment.id] === 'free' ? '#22c55e' : colorMap[trackStatus[segment.id]]}
              strokeWidth={6}
              strokeDasharray={segment.isLoop ? "8 4" : "none"}
              fill="none"
              style={{ transition: 'stroke 0.5s ease' }}
            />
          ))}

          {/* Layer 2: Render the animated trains */}
          {trains.map(train => (
            <Train
              key={train.id}
              trainId={train.id}
              segmentId={train.currentSegmentId}
              progress={train.progress}
            />
          ))}

          {/* Labels */}
          <text x="50" y="140" className="text-sm font-sans font-semibold fill-gray-400">UP MAIN</text>
          <text x="50" y="265" className="text-sm font-sans font-semibold fill-gray-400">DN MAIN</text>
        </g>
      </svg>
    </div>
  );
};

export default StationYardLayout;