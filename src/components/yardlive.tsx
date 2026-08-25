"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession } from "@/lib/auth";
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

const YardLive = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [stationId, setStationId] = useState<string | null>("st_a1");
  const [yards, setYards] = useState<YardInfo[]>([]);
  const [lineInfo, setLineInfo] = useState<LineInfo | null>(null);
  const [sensorState, setSensorState] = useState<SensorSnapshot | null>(null);

  const allowedSection = useMemo(() => {
    const session = getSession();
    if (!lineInfo || !session) return null;
    const cid = session.controller_id.toLowerCase();
    return (
      lineInfo.sections.find((s) => s.controller_id.toLowerCase() === cid) ??
      null
    );
  }, [lineInfo]);

  const allowedStationIds = useMemo(
    () => new Set((allowedSection?.stations ?? []).map((s) => s.toLowerCase())),
    [allowedSection]
  );

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("station");
    if (param && VALID_ID.test(param.toLowerCase())) {
      setStationId(param.toLowerCase());
    }
  }, []);

  // Once sections are loaded, default to the first allowed station and redirect
  // away from any station the controller is not authorised to view.
  useEffect(() => {
    if (!allowedSection) return;
    const fallback = allowedSection.stations[0]?.toLowerCase() ?? "st_a1";
    if (
      !stationId ||
      !allowedStationIds.has(stationId.toLowerCase())
    ) {
      setStationId(fallback);
      router.replace(`${pathname}?station=${fallback}`);
    }
  }, [allowedSection, allowedStationIds, stationId, pathname, router]);

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
    if (!stationId) return;
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

  // Only the controller's assigned section is shown in the picker; while the
  // section model is unavailable we fall back to the full list so the UI
  // stays usable.
  const pickerGroups = useMemo(() => {
    const groups: { label: string; stations: YardInfo[] }[] = [];
    if (allowedSection) {
      groups.push({
        label: `${allowedSection.name} (${allowedSection.controller_id})`,
        stations: allowedSection.stations
          .map((sid) => yardById.get(sid))
          .filter((y): y is YardInfo => Boolean(y)),
      });
      return groups;
    }
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
  }, [allowedSection, lineInfo, yardById, yards]);

  const handleStationChange = (next: string) => {
    setStationId(next);
    router.replace(`${pathname}?station=${next}`);
  };

  const effectiveStationId = stationId ?? "st_a1";

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-400">Section / Station:</span>
        <select
          value={stationId ?? ""}
          onChange={(e) => handleStationChange(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-100 outline-none focus:border-sky-500 transition-colors"
        >
          {stationId === null && (
            <option value="" disabled>
              Select station
            </option>
          )}
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
        <StationYardLayout
          stationId={effectiveStationId}
          sensorState={sensorState ?? undefined}
        />
      </div>
    </div>
  );
};

export default YardLive;