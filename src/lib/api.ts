import { SignalAspect, YardSchema } from "@/lib/yardlayout/schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface YardInfo {
  station_id: string;
  station_name: string;
}

export interface SectionInfo {
  section_id: string;
  name: string;
  controller_id: string;
  stations: string[];
}

export interface LineInfo {
  line_id: string;
  line_name: string;
  line_order: string[];
  sections: SectionInfo[];
}

export async function getYards(): Promise<YardInfo[]> {
  const res = await fetch(`${API_URL}/yards`);
  if (!res.ok) {
    throw new Error(`Failed to load yard list (${res.status})`);
  }
  return res.json();
}

export async function getSections(): Promise<LineInfo> {
  const res = await fetch(`${API_URL}/sections`);
  if (!res.ok) {
    throw new Error(`Failed to load sections (${res.status})`);
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

export async function getSensorSnapshot(stationId?: string): Promise<SensorSnapshot> {
  const qs = stationId ? `?station=${encodeURIComponent(stationId)}` : "";
  const res = await fetch(`${API_URL}/sensors${qs}`);
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
  section_id?: string | null;
  section_name?: string | null;
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

export interface AuditEntry {
  action: string;
  detail: Record<string, unknown>;
  at: string;
}

export async function getAuditLogs(limit = 50): Promise<AuditEntry[]> {
  const res = await fetch(`${API_URL}/auditlogs?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load audit logs (${res.status})`);
  }
  const body = (await res.json()) as { logs: AuditEntry[] };
  return body.logs;
}

export interface CrisisTypeInfo {
  type: string;
  label: string;
  is_disaster: boolean;
  default_severity: string;
  default_action: string;
}

export interface CrisisStation {
  station_id: string;
  name: string;
}

export interface Crisis {
  id: string;
  type: string;
  label: string;
  is_disaster: boolean;
  severity: string;
  location: string;
  block_id?: string | null;
  description: string;
  status: "ACTIVE" | "RESOLVED";
  declared_at: string;
  resolved_at?: string | null;
  affected_trains: string[];
  station_name?: string | null;
}

export interface CrisisState {
  disaster_active: boolean;
  types: CrisisTypeInfo[];
  stations: CrisisStation[];
  crises: Crisis[];
}

export async function getCrises(): Promise<CrisisState> {
  const res = await fetch(`${API_URL}/crisis`);
  if (!res.ok) {
    throw new Error(`Failed to load crisis state (${res.status})`);
  }
  return res.json();
}

export interface DeclareCrisisParams {
  crisis_type: string;
  severity?: string | null;
  location: string;
  block_id?: string | null;
  description?: string | null;
}

export async function declareCrisis(
  params: DeclareCrisisParams
): Promise<Crisis> {
  const res = await fetch(`${API_URL}/crisis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to declare crisis (${res.status})`);
  }
  const resp = (await res.json()) as { crisis: Crisis };
  return resp.crisis;
}

export async function resolveCrisis(crisisId: string): Promise<Crisis> {
  const res = await fetch(`${API_URL}/crisis/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crisis_id: crisisId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to resolve crisis (${res.status})`);
  }
  const resp = (await res.json()) as { crisis: Crisis };
  return resp.crisis;
}

export interface WhatIfScenario {
  id: string;
  label: string;
  description: string;
}

export interface WhatIfTrain {
  train_id: string;
  train_type: string;
  block_id: string;
  line_id: string;
  speed_kmph: number;
}

export interface WhatIfScenariosResponse {
  scenarios: WhatIfScenario[];
  trains: WhatIfTrain[];
}

export interface WhatIfRunParams {
  train_id: string;
  train_type: string;
  block_id: string;
  line_id: string;
  sectional_speed: number;
  scenario_type: string;
  parameter?: number | null;
  direction?: string;
  scheduled_time?: number;
  current_time?: number;
  gradient?: Gradient | null;
  condition?: string | null;
}

export interface WhatIfMovement {
  allowed: boolean;
  max_speed: number | null;
  reason: string;
}

export interface WhatIfResult {
  scenario_type: string;
  scenario_label: string;
  scenario_description: string;
  train: {
    train_id: string;
    train_type: string;
    block_id: string;
    line_id: string;
  };
  predicted_delay: {
    baseline_min: number;
    scenario_min: number;
    delta_min: number;
  };
  transit_impact_min: number;
  movement: {
    baseline: WhatIfMovement;
    scenario: WhatIfMovement;
  };
  outcome: string;
}

export async function getWhatIfScenarios(): Promise<WhatIfScenariosResponse> {
  const res = await fetch(`${API_URL}/whatif/scenarios`);
  if (!res.ok) {
    throw new Error(`Failed to load what-if scenarios (${res.status})`);
  }
  return res.json();
}

export async function runWhatIfSimulation(
  params: WhatIfRunParams
): Promise<WhatIfResult> {
  const res = await fetch(`${API_URL}/whatif/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Simulation failed (${res.status})`);
  }
  return res.json();
}
