"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import StationYardLayout from "./stationyardlayout";
import {
  getSensorSnapshot,
  getSections,
  getYards,
  LineInfo,
  SensorSnapshot,
  YardInfo,
} from "@/lib/api";

const POLL_INTERVAL_MS = 5000;
const VALID_ID = /^[a-z0-9_-]+$/;
const DEFAULT_STATION = "st_a1";

const YardLive = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [stationId, setStationId] = useState(DEFAULT_STATION);
  const [yards, setYards] = useState<YardInfo[]>([]);
  const [lineInfo, setLineInfo] = useState<LineInfo | null>(null);
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
    getSections()
      .then((info) => {
        if (!cancelled) setLineInfo(info);
      })
      .catch(() => {
        // sections model unavailable — fall back to flat yard list
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSensorState(null);

    const poll = () => {
      getSensorSnapshot(stationId)
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

  const yardById = useMemo(
    () => new Map(yards.map((yard) => [yard.station_id, yard])),
    [yards]
  );

  // Stations grouped by section (controller territory); any yards not in the
  // section model fall through to a flat "Other" group so legacy demos stay reachable.
  const pickerGroups = useMemo(() => {
    const groups: { label: string; stations: YardInfo[] }[] = [];
    if (lineInfo) {
      for (const section of lineInfo.sections) {
        groups.push({
          label: `${section.name} (${section.controller_id})`,
          stations: section.stations
            .map((sid) => yardById.get(sid))
            .filter((y): y is YardInfo => Boolean(y)),
        });
      }
    }
    const assigned = new Set(
      (lineInfo?.sections ?? []).flatMap((s) => s.stations)
    );
    const others = yards.filter((y) => !assigned.has(y.station_id));
    if (others.length) {
      groups.push({ label: "Other", stations: others });
    }
    return groups;
  }, [lineInfo, yardById, yards]);

  const handleStationChange = (next: string) => {
    setStationId(next);
    router.replace(next ? `${pathname}?station=${next}` : pathname);
  };

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-400">Section / Station:</span>
        <select
          value={stationId}
          onChange={(e) => handleStationChange(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-100 outline-none focus:border-sky-500 transition-colors"
        >
          {pickerGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.stations.map((yard) => (
                <option key={yard.station_id} value={yard.station_id}>
                  {yard.station_name} ({yard.station_id})
                </option>
              ))}
            </optgroup>
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