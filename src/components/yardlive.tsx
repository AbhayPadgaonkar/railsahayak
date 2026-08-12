"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import StationYardLayout from "./stationyardlayout";
import {
  getSensorSnapshot,
  getYards,
  SensorSnapshot,
  YardInfo,
} from "@/lib/api";

const POLL_INTERVAL_MS = 5000;
const VALID_ID = /^[a-z0-9_-]+$/;

const YardLive = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [stationId, setStationId] = useState("demo_yard");
  const [yards, setYards] = useState<YardInfo[]>([]);
  const [sensorState, setSensorState] = useState<SensorSnapshot | null>(null);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("station");
    if (param && VALID_ID.test(param.toLowerCase())) {
      setStationId(param.toLowerCase());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getYards()
      .then((list) => {
        if (!cancelled) setYards(list);
      })
      .catch(() => {
        // API unreachable — keep the default yard fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSensorState(null);

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
  }, [stationId]);

  const handleStationChange = (next: string) => {
    setStationId(next);
    router.replace(next ? `${pathname}?station=${next}` : pathname);
  };

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-400">Station:</span>
        <select
          value={stationId}
          onChange={(e) => handleStationChange(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-100 outline-none focus:border-sky-500 transition-colors"
        >
          {yards.map((yard) => (
            <option key={yard.station_id} value={yard.station_id}>
              {yard.station_name} ({yard.station_id})
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-0">
        <StationYardLayout stationId={stationId} sensorState={sensorState ?? undefined} />
      </div>
    </div>
  );
};

export default YardLive;