import { SignalAspect, YardSchema } from "@/lib/yardlayout/schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface YardInfo {
  station_id: string;
  station_name: string;
}

export async function getYards(): Promise<YardInfo[]> {
  const res = await fetch(`${API_URL}/yards`);
  if (!res.ok) {
    throw new Error(`Failed to load yard list (${res.status})`);
  }
  return res.json();
}

export async function getYardSchema(stationId: string): Promise<YardSchema> {
  const res = await fetch(`${API_URL}/yard/${encodeURIComponent(stationId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load yard layout for "${stationId}" (${res.status})`);
  }
  return res.json();
}

export interface SensorSnapshot {
  station_id: string;
  zones: Record<string, boolean>;
  signals: Record<string, SignalAspect>;
}

export async function getSensorSnapshot(): Promise<SensorSnapshot> {
  const res = await fetch(`${API_URL}/sensors`);
  if (!res.ok) {
    throw new Error(`Failed to load sensor snapshot (${res.status})`);
  }
  return res.json();
}
