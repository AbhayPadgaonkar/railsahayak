// components/Train.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface TrainProps {
  segmentId: string;
  progress: number; // 0.0 to 1.0
  trainId: string;
}

const Train = ({ segmentId, progress, trainId }: TrainProps) => {
  const [transform, setTransform] = useState('');

  useEffect(() => {
    const path = document.getElementById(segmentId) as SVGPathElement | null;
    if (!path) return;

    const length = path.getTotalLength();
    if (length === 0) return;

    // Calculate current position
    const point = path.getPointAtLength(progress * length);
    
    // Calculate angle for rotation
    // Look ahead slightly to determine the direction of the path
    const lookaheadPoint = path.getPointAtLength((progress + 0.01) * length);
    const angle = Math.atan2(lookaheadPoint.y - point.y, lookaheadPoint.x - point.x) * (180 / Math.PI);

    setTransform(`translate(${point.x}, ${point.y}) rotate(${angle})`);
  }, [segmentId, progress]);

  return (
    <g transform={transform}>
      {/* Train Body */}
      <rect x="-20" y="-5" width="30" height="10" fill="#facc15" rx="2" />
      {/* Train Front */}
      <polygon points="10,-5 15,0 10,5" fill="#f97316" />
      {/* Train ID Label */}
      <text
        y="-8"
        x="-5"
        textAnchor="middle"
        fontSize="8px"
        fill="white"
        fontWeight="bold"
      >
        {trainId}
      </text>
    </g>
  );
};

export default Train;