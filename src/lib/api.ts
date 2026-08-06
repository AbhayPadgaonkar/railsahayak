import { YardSchema } from "@/lib/yardlayout/schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getYardSchema(stationId: string): Promise<YardSchema> {
  const res = await fetch(`${API_URL}/yard/${encodeURIComponent(stationId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load yard layout for "${stationId}" (${res.status})`);
  }
  return res.json();
}
