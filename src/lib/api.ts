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
  trains?: DecisionTrain[];
}

export interface DecisionTrain {
  train_id: string;
  block_id: string;
  line_id: string;
  allow_movement: boolean;
  max_speed: number | null;
  signal_state: string;
}

export async function getSensorSnapshot(): Promise<SensorSnapshot> {
  const res = await fetch(`${API_URL}/sensors`);
  if (!res.ok) {
    throw new Error(`Failed to load sensor snapshot (${res.status})`);
  }
  return res.json();
}

export interface Gradient {
  value: number;
  direction: "UP" | "DOWN";
}

export interface TrainRequest {
  train_id: string;
  train_type: string;
  block_id: string;
  line_id: string;
  next_block_id?: string | null;
  signal_state: string;
  sectional_speed: number;
  scheduled_time: number;
  current_time: number;
  gradient?: Gradient | null;
  condition?: string | null;
  has_written_authority: boolean;
}

export interface SystemContext {
  occupied_lines: string[];
  occupied_turnouts: string[];
  fouling_segments: string[];
  disaster_active: boolean;
}

export interface DecisionRequest {
  trains: TrainRequest[];
  context: SystemContext;
}

export interface DecisionResponse {
  train_id: string;
  allow_movement: boolean;
  allowed_actions: string[];
  max_speed: number | null;
  reasons: string[];
}

export interface OptimizedOrder {
  train_id: string;
  order: number;
  reason?: string;
}

export interface DecisionResult {
  decisions: DecisionResponse[];
  optimized_order: OptimizedOrder[] | null;
}

export async function getDecision(
  payload: DecisionRequest
): Promise<DecisionResult> {
  const res = await fetch(`${API_URL}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Decision request failed (${res.status})`);
  }
  return res.json();
}

export interface Advisory {
  id: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  location: string;
  duration: string;
  description: string;
  affected_trains: string[];
  strategies: string[];
}

export interface AdvisoryResponse {
  advisories: Advisory[];
}

export async function getAdvisories(): Promise<AdvisoryResponse> {
  const res = await fetch(`${API_URL}/advisory`);
  if (!res.ok) {
    throw new Error(`Failed to load advisories (${res.status})`);
  }
  return res.json();
}

export interface AdvisoryActionResult {
  advisory_id: string;
  action: string;
  applied: boolean;
  decision?: DecisionResult | null;
}

export async function applyAdvisory(
  advisoryId: string,
  action: "accept" | "dismiss"
): Promise<AdvisoryActionResult> {
  const res = await fetch(`${API_URL}/advisory/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ advisory_id: advisoryId, action }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Advisory action failed (${res.status})`);
  }
  return res.json();
}

export interface DelayPrediction {
  train_id: string;
  train_type: string;
  predicted_delay_min: number;
}

export async function predictDelay(
  params: Record<string, string | number | undefined>
): Promise<DelayPrediction> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      qs.set(k, String(v));
    }
  }
  const res = await fetch(`${API_URL}/predict-delay?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Delay prediction failed (${res.status})`);
  }
  return res.json();
}
