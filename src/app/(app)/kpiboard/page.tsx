"use client";

import React, { useEffect, useMemo, useState } from "react";
import LineChart from "@/components/linechart";
import { getKpis, KpiSnapshot } from "@/lib/api";

const COLORS = {
  blue: { borderColor: "rgb(54, 162, 235)", backgroundColor: "rgba(54, 162, 235, 0.2)" },
  green: { borderColor: "rgb(34, 197, 94)", backgroundColor: "rgba(34, 197, 94, 0.2)" },
  orange: { borderColor: "rgb(249, 115, 22)", backgroundColor: "rgba(249, 115, 22, 0.2)" },
  red: { borderColor: "rgb(239, 68, 68)", backgroundColor: "rgba(239, 68, 68, 0.2)" },
  purple: { borderColor: "rgb(168, 85, 247)", backgroundColor: "rgba(168, 85, 247, 0.2)" },
};

export default function KpiBoard() {
  const [history, setHistory] = useState<KpiSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getKpis();
        if (active) setHistory(res.history);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load KPIs");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const labels = useMemo(
    () => history.map((snapshot) => snapshot.ts),
    [history]
  );

  const metric = (key: keyof KpiSnapshot) => history.map((s) => Number(s[key]));

  const advisoryDatasets = useMemo(
    () => [
      {
        label: "HIGH",
        data: history.map((s) => s.advisories.HIGH),
        ...COLORS.red,
      },
      {
        label: "MEDIUM",
        data: history.map((s) => s.advisories.MEDIUM),
        ...COLORS.orange,
      },
      {
        label: "LOW",
        data: history.map((s) => s.advisories.LOW),
        ...COLORS.blue,
      },
    ],
    [history]
  );

  if (loading) {
    return (
      <div className="p-4 bg-gray-900 min-h-screen text-gray-300">
        Loading KPIs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-gray-900 min-h-screen text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-900 min-h-screen">
      <div className="w-full h-full max-w-full rounded-xl">
        <LineChart
          title="Active Trains"
          labels={labels}
          datasets={[
            {
              label: "Trains",
              data: metric("active_trains"),
              ...COLORS.blue,
            },
          ]}
        />
      </div>
      <div className="w-full h-full max-w-full rounded-xl">
        <LineChart
          title="Block Utilization"
          labels={labels}
          datasets={[
            {
              label: "% occupied",
              data: metric("block_utilization_pct"),
              ...COLORS.purple,
            },
          ]}
        />
      </div>
      <div className="w-full h-full max-w-full rounded-xl">
        <LineChart
          title="Average Delay"
          labels={labels}
          datasets={[
            {
              label: "Minutes",
              data: metric("average_delay_min"),
              ...COLORS.orange,
            },
          ]}
        />
      </div>
      <div className="w-full h-full max-w-full rounded-xl">
        <LineChart
          title="Punctuality"
          labels={labels}
          datasets={[
            {
              label: "% on time",
              data: metric("punctuality_pct"),
              ...COLORS.green,
            },
          ]}
        />
      </div>
      <div className="w-full h-full max-w-full rounded-xl">
        <LineChart
          title="Throughput"
          labels={labels}
          datasets={[
            {
              label: "Trains / hour",
              data: metric("throughput_trains_per_hour"),
              ...COLORS.blue,
            },
          ]}
        />
      </div>
      <div className="w-full h-full max-w-full rounded-xl">
        <LineChart
          title="Advisories by Priority"
          labels={labels}
          datasets={advisoryDatasets}
        />
      </div>
    </div>
  );
}
