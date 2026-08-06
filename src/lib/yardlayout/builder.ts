import {
  SignalAspect,
  YardLabel,
  YardLine,
  YardSchema,
} from "./schema";

export interface BuiltSegment {
  id: string;
  d: string;
  connectedTo: string[];
  isBlock?: boolean;
  lineId?: string;
  turnoutId?: string;
}

export interface BuiltSignal {
  id: string;
  name: string;
  x: number;
  y: number;
  state: SignalAspect;
}

export interface BuiltYard {
  stationId: string;
  stationName: string;
  viewBox: string;
  segments: BuiltSegment[];
  signals: BuiltSignal[];
  labels: YardLabel[];
}

const within = (x: number, line: YardLine) =>
  x >= Math.min(line.from_x, line.to_x) && x <= Math.max(line.from_x, line.to_x);

function validate(schema: YardSchema): void {
  const lineIds = new Set<string>();
  for (const line of schema.lines) {
    if (lineIds.has(line.id)) {
      throw new Error(`Duplicate line id "${line.id}"`);
    }
    lineIds.add(line.id);
    if (line.from_x === line.to_x) {
      throw new Error(`Line "${line.id}" has zero length`);
    }
  }

  const requireLine = (id: string, ctx: string): YardLine => {
    const line = schema.lines.find((l) => l.id === id);
    if (!line) throw new Error(`${ctx} references unknown line "${id}"`);
    return line;
  };

  const turnoutIds = new Set<string>();
  for (const t of schema.turnouts) {
    if (turnoutIds.has(t.id)) {
      throw new Error(`Duplicate turnout id "${t.id}"`);
    }
    turnoutIds.add(t.id);
    const from = requireLine(t.from_line, `Turnout "${t.id}"`);
    const to = requireLine(t.to_line, `Turnout "${t.id}"`);
    if (t.from_line === t.to_line) {
      throw new Error(`Turnout "${t.id}" cannot connect line "${t.from_line}" to itself`);
    }
    if (!within(t.from_x, from)) {
      throw new Error(`Turnout "${t.id}" from_x ${t.from_x} is outside line "${from.id}"`);
    }
    if (!within(t.to_x, to)) {
      throw new Error(`Turnout "${t.id}" to_x ${t.to_x} is outside line "${to.id}"`);
    }
  }

  const signalIds = new Set<string>();
  for (const s of schema.signals) {
    if (signalIds.has(s.id)) {
      throw new Error(`Duplicate signal id "${s.id}"`);
    }
    signalIds.add(s.id);
    const line = requireLine(s.line, `Signal "${s.id}"`);
    if (!within(s.at_x, line)) {
      throw new Error(`Signal "${s.id}" at_x ${s.at_x} is outside line "${line.id}"`);
    }
  }

  for (const b of schema.block_boundaries ?? []) {
    for (const lineId of b.lines) {
      const line = requireLine(lineId, `Block boundary at x=${b.at_x}`);
      if (!within(b.at_x, line)) {
        throw new Error(`Block boundary at x=${b.at_x} is outside line "${lineId}"`);
      }
    }
  }
}

export function buildYardLayout(schema: YardSchema): BuiltYard {
  validate(schema);

  const segments: BuiltSegment[] = [];
  const byId = new Map<string, BuiltSegment>();

  const addSegment = (seg: BuiltSegment) => {
    segments.push(seg);
    byId.set(seg.id, seg);
  };

  const link = (a: string, b: string) => {
    const segA = byId.get(a);
    const segB = byId.get(b);
    if (!segA || !segB) return;
    if (!segA.connectedTo.includes(b)) segA.connectedTo.push(b);
    if (!segB.connectedTo.includes(a)) segB.connectedTo.push(a);
  };

  const lineSlices = new Map<string, BuiltSegment[]>();

  for (const line of schema.lines) {
    const anchors = new Set<number>([line.from_x, line.to_x]);

    for (const t of schema.turnouts) {
      if (t.from_line === line.id) anchors.add(t.from_x);
      if (t.to_line === line.id) anchors.add(t.to_x);
    }
    for (const s of schema.signals) {
      if (s.line === line.id) anchors.add(s.at_x);
    }
    for (const b of schema.block_boundaries ?? []) {
      if (b.lines.includes(line.id)) anchors.add(b.at_x);
    }

    const sorted = [...anchors].sort((a, b) => a - b);
    const slices: BuiltSegment[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const x1 = sorted[i];
      const x2 = sorted[i + 1];
      if (x1 === x2) continue;

      const isBlock = (schema.block_boundaries ?? []).some(
        (b) => b.lines.includes(line.id) && (b.at_x === x1 || b.at_x === x2)
      );

      const seg: BuiltSegment = {
        id: `${line.id}__${slices.length}`,
        d: `M ${x1} ${line.y} L ${x2} ${line.y}`,
        connectedTo: [],
        lineId: line.id,
        ...(isBlock ? { isBlock: true } : {}),
      };
      addSegment(seg);
      slices.push(seg);
    }

    lineSlices.set(line.id, slices);

    for (let i = 0; i < slices.length - 1; i++) {
      if (line.direction === "UP") {
        slices[i].connectedTo.push(slices[i + 1].id);
      } else if (line.direction === "DN") {
        slices[i + 1].connectedTo.push(slices[i].id);
      } else {
        link(slices[i].id, slices[i + 1].id);
      }
    }
  }

  const slicesTouching = (lineId: string, x: number): BuiltSegment[] =>
    (lineSlices.get(lineId) ?? []).filter((seg) => {
      const nums = seg.d.match(/-?[\d.]+/g)!.map(Number);
      return nums[0] === x || nums[2] === x;
    });

  for (const t of schema.turnouts) {
    const fromLine = schema.lines.find((l) => l.id === t.from_line)!;
    const toLine = schema.lines.find((l) => l.id === t.to_line)!;

    const diverge: BuiltSegment = {
      id: `${t.id}_diverge`,
      d: `M ${t.from_x} ${fromLine.y} L ${t.to_x} ${toLine.y}`,
      connectedTo: [],
      turnoutId: t.id,
    };
    addSegment(diverge);

    for (const seg of [
      ...slicesTouching(t.from_line, t.from_x),
      ...slicesTouching(t.to_line, t.to_x),
    ]) {
      link(diverge.id, seg.id);
    }
  }

  const signals: BuiltSignal[] = schema.signals.map((s) => {
    const line = schema.lines.find((l) => l.id === s.line)!;
    return {
      id: s.id,
      name: s.name ?? s.id,
      x: s.at_x,
      y: line.y,
      state: s.initial_state,
    };
  });

  return {
    stationId: schema.station_id,
    stationName: schema.station_name,
    viewBox: `0 0 ${schema.canvas.width} ${schema.canvas.height}`,
    segments,
    signals,
    labels: schema.labels ?? [],
  };
}
