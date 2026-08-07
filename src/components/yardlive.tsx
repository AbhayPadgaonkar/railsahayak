"use client";

import { useEffect, useState } from "react";
import StationYardLayout from "./stationyardlayout";
import { getSensorSnapshot, SensorSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 5000;

const YardLive = () => {
  const [sensorState, setSensorState] = useState<SensorSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      getSensorSnapshot()
        .then((snapshot) => {
          if (!cancelled) setSensorState(snapshot);
        })
        .catch(() => {
          // API unreachable — keep last known state
        });
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return <StationYardLayout sensorState={sensorState ?? undefined} />;
};

export default YardLive;
