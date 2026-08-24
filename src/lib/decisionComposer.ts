import type { DecisionRequest, TrainRequest } from "@/lib/api";
import type { YardSchema } from "@/lib/yardlayout/schema";

export const TRAIN_TYPES = [
  "VANDE_BHARAT",
  "RAJDHANI",
  "SHATABDI",
  "MAIL_EXPRESS",
  "PASSENGER",
  "MEMU",
  "GOODS",
  "DEPARTMENTAL",
];

export const SIGNAL_STATES = [
  "GREEN",
  "DOUBLE_YELLOW",
  "SINGLE_YELLOW",
  "RED",
  "DEFECTIVE",
];

export const CONDITIONS = ["", "FOG", "STORM"];

export const LINES = ["UP_MAIN", "UP_LOOP", "DN_MAIN"];

// used to derive block order / next-block links
export const ORDERING_LINE = "UP_MAIN";

export interface StationModel {
  station_id: string;
  station_name: string;
  blocks: string[];
}

export const emptyTrain = (block_id: string): TrainRequest => ({
  train_id: "",
  train_type: "PASSENGER",
  block_id,
  line_id: "UP_MAIN",
  next_block_id: null,
  signal_state: "GREEN",
  sectional_speed: 100,
  scheduled_time: 1000,
  current_time: 1000,
  gradient: null,
  condition: null,
  has_written_authority: false,
});

export const num = (v: string) => (v === "" ? 0 : Number(v));

export const allowColor = (allow: boolean) =>
  allow ? "text-emerald-400" : "text-red-400";

export const parseCsvList = (value: string): string[] =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export interface LoadedStationSchema {
  station_id: string;
  schema: YardSchema | null;
}

export interface StationModels {
  models: StationModel[];
  blockNext: Record<string, string[]>;
}

// Build per-station ordered block lists plus next-block links along the
// ordering line, joining the tail of one station to the head of the next so
// the decision request mirrors section_sim line traversal.
export function buildStationModels(
  loaded: LoadedStationSchema[],
  orderingLine: string = ORDERING_LINE
): StationModels {
  const models: StationModel[] = [];
  const next: Record<string, string[]> = {};

  for (const { station_id, schema } of loaded) {
    if (!schema) continue;
    const inStation = schema.blocks.filter((b) =>
      b.lines.some((s) => s.line === orderingLine)
    );
    const ordered = [...inStation].sort(
      (a, b) =>
        a.lines.find((s) => s.line === orderingLine)!.from_x -
        b.lines.find((s) => s.line === orderingLine)!.from_x
    );
    const ids = ordered.map((b) => b.id);
    ids.forEach((id, i) => {
      next[id] = i + 1 < ids.length ? [ids[i + 1]] : [];
    });
    models.push({
      station_id,
      station_name: schema.station_name ?? station_id,
      blocks: ids,
    });
  }

  // Cross-station link: last block of a station -> first block of the next
  // station (mirrors section_sim line traversal on the ordering line).
  for (let i = 0; i < models.length - 1; i++) {
    const cur = models[i];
    const nxt = models[i + 1];
    if (cur.blocks.length && nxt.blocks.length) {
      const tail = cur.blocks[cur.blocks.length - 1];
      const head = nxt.blocks[0];
      next[tail] = next[tail] ?? [];
      if (!next[tail].includes(head)) next[tail].push(head);
    }
  }

  return { models, blockNext: next };
}

export interface DecisionComposerInput {
  trains: TrainRequest[];
  occupiedLines: string;
  occupiedTurnouts: string;
  foulingSegments: string;
  disasterActive: boolean;
}

export const buildDecisionRequest = ({
  trains,
  occupiedLines,
  occupiedTurnouts,
  foulingSegments,
  disasterActive,
}: DecisionComposerInput): DecisionRequest => ({
  trains,
  context: {
    occupied_lines: parseCsvList(occupiedLines),
    occupied_turnouts: parseCsvList(occupiedTurnouts),
    fouling_segments: parseCsvList(foulingSegments),
    disaster_active: disasterActive,
  },
});